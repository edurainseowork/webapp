/**
 * Production Performance Engine (Ponytail Multi-Tier Edition)
 *
 * Implements:
 * 1. L1 (In-Memory LRU) + L2 (Redis when REDIS_URL is set) Cache-Aside Engine
 * 2. Singleflight Request Coalescing (20 Lakh concurrent misses -> 1 DB query)
 * 3. Stale-While-Revalidate (0ms stale serving + silent background refresh)
 * 4. Staggered TTL Jitter (prevents synchronized cache expiration stampedes)
 * 5. Circuit Breaker for L2 Redis (25 LPA Failover: instant L1 fallback if Redis dies)
 * 6. Bounded Background Job Queue (BullMQ semantics: Pull concurrency, Exponential Backoff,
 *    Non-retryable 4xx filter, Dead Letter Queue [DLQ], and strict Job Idempotency)
 */

import { logger } from "./logger.ts";

// ponytail: L1 memory cap at 2,000 keys; scale via REDIS_URL across multi-node clusters
const MAX_L1_KEYS = 2_000;

interface CacheEntry<T = unknown> {
  data: T;
  softExpiry: number;
  hardExpiry: number;
}

export interface RedisLikeClient {
  get(key: string): Promise<string | null>;
  setEx(key: string, ttlSeconds: number, value: string): Promise<unknown>;
  del(key: string | string[]): Promise<unknown>;
  keys?(pattern: string): Promise<string[]>;
}

const l1Cache = new Map<string, CacheEntry>();
const inFlightCoalescer = new Map<string, Promise<unknown>>();

// Circuit Breaker state for external Redis (25 LPA Redis-Down scenario)
let redisClient: RedisLikeClient | null = null;
let circuitOpenUntil = 0;
let consecutiveRedisFailures = 0;
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 10_000;

export const perfMetrics = {
  cacheHitsL1: 0,
  cacheHitsL2: 0,
  cacheMisses: 0,
  staleServed: 0,
  coalescedRequests: 0,
  dbQueriesExecuted: 0,
  cacheInvalidations: 0,
  redisCircuitTrips: 0,
  rateLimitBlocks: 0,
  backpressureSheds: 0,
  jobsEnqueued: 0,
  jobsCompleted: 0,
  jobsRetried: 0,
  jobsMovedToDLQ: 0,
  jobsIdempotentSkipped: 0,
};

/** Attach an optional Redis client (or mock client in Chaos/Break tests). */
export function setRedisClient(client: RedisLikeClient | null): void {
  redisClient = client;
  consecutiveRedisFailures = 0;
  circuitOpenUntil = 0;
}

export function getCircuitState(): "CLOSED" | "OPEN" {
  return Date.now() < circuitOpenUntil ? "OPEN" : "CLOSED";
}

async function safeRedisGet(key: string): Promise<string | null> {
  if (!redisClient || Date.now() < circuitOpenUntil) return null;
  try {
    const val = await Promise.race([
      redisClient.get(key),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 150)),
    ]);
    consecutiveRedisFailures = 0;
    return val;
  } catch {
    consecutiveRedisFailures += 1;
    if (consecutiveRedisFailures >= CIRCUIT_FAILURE_THRESHOLD) {
      circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
      perfMetrics.redisCircuitTrips += 1;
      logger.warn({ key, cooldownMs: CIRCUIT_COOLDOWN_MS }, "Redis circuit breaker OPEN — falling back to L1 RAM cache");
    }
    return null;
  }
}

async function safeRedisSet(key: string, ttlSeconds: number, value: string): Promise<void> {
  if (!redisClient || Date.now() < circuitOpenUntil) return;
  try {
    await Promise.race([
      redisClient.setEx(key, ttlSeconds, value),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 150)),
    ]);
    consecutiveRedisFailures = 0;
  } catch {
    consecutiveRedisFailures += 1;
    if (consecutiveRedisFailures >= CIRCUIT_FAILURE_THRESHOLD) {
      circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
      perfMetrics.redisCircuitTrips += 1;
    }
  }
}

function setL1(key: string, entry: CacheEntry): void {
  if (l1Cache.size >= MAX_L1_KEYS && !l1Cache.has(key)) {
    const oldestKey = l1Cache.keys().next().value;
    if (oldestKey !== undefined) l1Cache.delete(oldestKey);
  }
  l1Cache.set(key, entry);
}

/**
 * Multi-Tier Cache-Aside with Singleflight Coalescing, Staggered TTL Jitter,
 * Stale-While-Revalidate, and Redis Circuit-Breaker Fallback.
 */
export async function getOrSetCache<T>(
  key: string,
  baseTtlSeconds: number,
  fetcher: () => Promise<T>,
  options?: { disableJitter?: boolean }
): Promise<T> {
  const now = Date.now();
  const jitterSec = options?.disableJitter
    ? 0
    : Math.floor(Math.random() * Math.max(5, Math.floor(baseTtlSeconds * 0.15)));
  const effectiveTtlSec = Math.max(1, baseTtlSeconds + jitterSec);
  const softTtlMs = effectiveTtlSec * 1000;
  const hardTtlMs = softTtlMs * 3; // Stale window = 3x soft TTL

  // 1. Check L1 In-Memory Cache
  const l1 = l1Cache.get(key);
  if (l1 && now < l1.softExpiry) {
    perfMetrics.cacheHitsL1 += 1;
    return l1.data as T;
  }

  // 2. Stale-While-Revalidate (if within hardExpiry, serve stale in 0ms & refresh in background)
  if (l1 && now < l1.hardExpiry) {
    perfMetrics.staleServed += 1;
    if (!inFlightCoalescer.has(key)) {
      const bgPromise = (async () => {
        try {
          perfMetrics.dbQueriesExecuted += 1;
          const fresh = await fetcher();
          const updatedNow = Date.now();
          setL1(key, {
            data: fresh,
            softExpiry: updatedNow + softTtlMs,
            hardExpiry: updatedNow + hardTtlMs,
          });
          await safeRedisSet(key, effectiveTtlSec, JSON.stringify(fresh));
          return fresh;
        } finally {
          inFlightCoalescer.delete(key);
        }
      })();
      // Prevent unhandled rejection on background refresh
      bgPromise.catch(() => {});
      inFlightCoalescer.set(key, bgPromise);
    }
    return l1.data as T;
  }

  // 3. Singleflight Coalescer (Wait for existing in-flight request for this key)
  const existingFlight = inFlightCoalescer.get(key);
  if (existingFlight) {
    perfMetrics.coalescedRequests += 1;
    return existingFlight as Promise<T>;
  }

  // 4. Coalesced L2 Redis Check + DB Fallback
  const flightPromise = (async (): Promise<T> => {
    try {
      const l2Raw = await safeRedisGet(key);
      if (l2Raw !== null) {
        perfMetrics.cacheHitsL2 += 1;
        const parsed = JSON.parse(l2Raw) as T;
        const hitNow = Date.now();
        setL1(key, {
          data: parsed,
          softExpiry: hitNow + softTtlMs,
          hardExpiry: hitNow + hardTtlMs,
        });
        return parsed;
      }

      perfMetrics.cacheMisses += 1;
      perfMetrics.dbQueriesExecuted += 1;
      const fresh = await fetcher();
      const fetchedNow = Date.now();
      setL1(key, {
        data: fresh,
        softExpiry: fetchedNow + softTtlMs,
        hardExpiry: fetchedNow + hardTtlMs,
      });
      await safeRedisSet(key, effectiveTtlSec, JSON.stringify(fresh));
      return fresh;
    } finally {
      inFlightCoalescer.delete(key);
    }
  })();

  inFlightCoalescer.set(key, flightPromise);
  return flightPromise;
}

/** Pre-warm a cache key ahead of a known traffic spike (e.g. Batch Launch / Live Test). */
export async function preWarmCache<T>(key: string, baseTtlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  await invalidateCacheKey(key);
  return getOrSetCache(key, baseTtlSeconds, fetcher);
}

/** Explicitly invalidate a single cache key across L1 and L2. */
export async function invalidateCacheKey(key: string): Promise<void> {
  perfMetrics.cacheInvalidations += 1;
  l1Cache.delete(key);
  if (redisClient && Date.now() >= circuitOpenUntil) {
    try {
      await redisClient.del(key);
    } catch {
      // Ignore L2 delete error; L1 is already cleared
    }
  }
}

/** Explicitly invalidate all keys matching a prefix (e.g. "edurain:courses"). */
export async function invalidateCachePrefix(prefix: string): Promise<void> {
  perfMetrics.cacheInvalidations += 1;
  for (const key of l1Cache.keys()) {
    if (key.startsWith(prefix)) l1Cache.delete(key);
  }
  if (redisClient?.keys && Date.now() >= circuitOpenUntil) {
    try {
      const matching = await redisClient.keys(`${prefix}*`);
      if (matching.length > 0) await redisClient.del(matching);
    } catch {
      // Ignore L2 error
    }
  }
}

/** Force-expire soft TTL of a key (used in Break Tests to simulate 12:00 AM expiry). */
export function expireCacheKeyNow(key: string, hardExpire = true): void {
  const entry = l1Cache.get(key);
  if (entry) {
    entry.softExpiry = 0;
    if (hardExpire) entry.hardExpiry = 0;
  }
}

/* ========================================================================== */
/*  SECTION 3: BOUNDED BACKGROUND JOB QUEUE (BullMQ Semantics + Backpressure) */
/* ========================================================================== */

export class NonRetryableJobError extends Error {
  readonly nonRetryable = true;
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableJobError";
  }
}

export interface JobOptions {
  /** Deterministic ID for idempotency / deduplication */
  jobId?: string;
  /** Max attempts (default: 3) */
  attempts?: number;
  /** Base delay in ms for exponential backoff (default: 1000ms) */
  backoffDelayMs?: number;
}

export interface JobRecord<T = any> {
  id: string;
  name: string;
  data: T;
  attemptsMade: number;
  maxAttempts: number;
  backoffDelayMs: number;
  status: "waiting" | "active" | "completed" | "failed";
  failedReason?: string;
  createdAt: number;
  finishedAt?: number;
}

export class BoundedJobQueue<T = any> {
  readonly queueName: string;
  private readonly maxBufferSize: number;
  private readonly concurrency: number;
  private activeWorkers = 0;
  private readonly waitingQueue: JobRecord<T>[] = [];
  private readonly deadLetterQueue: JobRecord<T>[] = [];
  private readonly completedIdempotencyKeys = new Set<string>();
  private readonly inFlightJobIds = new Set<string>();
  private processor: ((job: JobRecord<T>) => Promise<void>) | null = null;

  constructor(
    queueName: string,
    options?: { maxBufferSize?: number; concurrency?: number }
  ) {
    this.queueName = queueName;
    this.maxBufferSize = options?.maxBufferSize ?? 1_000;
    this.concurrency = options?.concurrency ?? 5;
  }

  /** Register pull-based worker processor */
  process(handler: (job: JobRecord<T>) => Promise<void>): void {
    this.processor = handler;
    this.drain();
  }

  /** Enqueue job with Bounded Buffer Backpressure and Idempotency check */
  async add(name: string, data: T, opts?: JobOptions): Promise<{ status: "enqueued" | "duplicate_skipped"; jobId: string }> {
    const jobId = opts?.jobId ?? `${this.queueName}:${name}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

    // 1. Idempotency Guard: Never execute an already-completed or currently queued jobId twice
    if (this.completedIdempotencyKeys.has(jobId) || this.inFlightJobIds.has(jobId)) {
      perfMetrics.jobsIdempotentSkipped += 1;
      return { status: "duplicate_skipped", jobId };
    }

    // 2. Bounded Buffer Backpressure Guard: Prevent Out-Of-Memory (OOM) crash
    if (this.waitingQueue.length >= this.maxBufferSize) {
      perfMetrics.backpressureSheds += 1;
      const err: any = new Error(`Backpressure: Queue "${this.queueName}" bounded buffer (${this.maxBufferSize}) is full`);
      err.status = 503;
      err.retryAfter = 10;
      throw err;
    }

    const record: JobRecord<T> = {
      id: jobId,
      name,
      data,
      attemptsMade: 0,
      maxAttempts: opts?.attempts ?? 3,
      backoffDelayMs: opts?.backoffDelayMs ?? 1000,
      status: "waiting",
      createdAt: Date.now(),
    };

    this.inFlightJobIds.add(jobId);
    this.waitingQueue.push(record);
    perfMetrics.jobsEnqueued += 1;
    this.drain();
    return { status: "enqueued", jobId };
  }

  /** Pull-model worker loop: processes up to `this.concurrency` jobs at a time */
  private drain(): void {
    if (!this.processor) return;
    while (this.activeWorkers < this.concurrency && this.waitingQueue.length > 0) {
      const job = this.waitingQueue.shift()!;
      this.activeWorkers += 1;
      job.status = "active";
      void this.executeJob(job);
    }
  }

  private async executeJob(job: JobRecord<T>): Promise<void> {
    job.attemptsMade += 1;
    try {
      await this.processor!(job);
      job.status = "completed";
      job.finishedAt = Date.now();
      this.inFlightJobIds.delete(job.id);
      if (this.completedIdempotencyKeys.size > 10_000) {
        const first = this.completedIdempotencyKeys.values().next().value;
        if (first) this.completedIdempotencyKeys.delete(first);
      }
      this.completedIdempotencyKeys.add(job.id);
      perfMetrics.jobsCompleted += 1;
    } catch (err: any) {
      const isNonRetryable =
        err?.nonRetryable === true ||
        (typeof err?.status === "number" && err.status >= 400 && err.status < 500);

      if (!isNonRetryable && job.attemptsMade < job.maxAttempts) {
        // Exponential Backoff: delay * 2^(attemptsMade - 1)
        const delayMs = job.backoffDelayMs * Math.pow(2, job.attemptsMade - 1);
        perfMetrics.jobsRetried += 1;
        job.status = "waiting";
        setTimeout(() => {
          this.waitingQueue.push(job);
          this.drain();
        }, delayMs);
      } else {
        // Exhausted retries or non-retryable 4xx -> Move to Dead Letter Queue (DLQ)
        job.status = "failed";
        job.failedReason = err instanceof Error ? err.message : String(err);
        job.finishedAt = Date.now();
        this.inFlightJobIds.delete(job.id);
        if (this.deadLetterQueue.length >= 1_000) this.deadLetterQueue.shift();
        this.deadLetterQueue.push(job);
        perfMetrics.jobsMovedToDLQ += 1;
      }
    } finally {
      this.activeWorkers -= 1;
      this.drain();
    }
  }

  getStats() {
    return {
      queueName: this.queueName,
      waiting: this.waitingQueue.length,
      active: this.activeWorkers,
      dlqCount: this.deadLetterQueue.length,
      completedIdempotentCount: this.completedIdempotencyKeys.size,
      maxBufferSize: this.maxBufferSize,
      concurrency: this.concurrency,
    };
  }

  getDeadLetterQueue(): ReadonlyArray<JobRecord<T>> {
    return this.deadLetterQueue;
  }
}

// Shared production background queues for EduRain
export const notificationBroadcastQueue = new BoundedJobQueue<{
  type: "all" | "category" | "direct";
  notificationId: number;
  tokens: string[];
  title: string;
  body: string;
  imageUrl?: string | null;
  link?: string | null;
}>("edurain-notifications", { maxBufferSize: 500, concurrency: 5 });

export const emailDispatchQueue = new BoundedJobQueue<{
  userIdOrEmail: string;
  subject: string;
  sendFn: () => Promise<void>;
}>("edurain-emails", { maxBufferSize: 1_000, concurrency: 10 });

emailDispatchQueue.process(async (job) => {
  await job.data.sendFn();
});
