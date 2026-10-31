/**
 * Production Performance Engine (Ponytail Multi-Tier Edition - v3)
 *
 * Implements:
 * 1. L1 (In-Memory Monotonic LRU) + L2 (Redis when REDIS_URL is set) Cache-Aside Engine
 * 2. Versioned Scope Invalidation (INCR scope version; zero KEYS * scans)
 * 3. Redis Singleflight Coalescing & Distributed SET NX Locks
 * 4. Stale-While-Revalidate with Redis Clock (PTTL) early refresh
 * 5. Bounded Wait + Stale-Prev Version Fallback (public catalog)
 * 6. Global DB Concurrency Gate (INCR {EP}:dbslots) with 503 Shedding
 * 7. Half-Open Exponential Cooldown Circuit Breaker with Slack Alerts
 * 8. Bounded Background Job Queue (BullMQ semantics)
 */

import { logger } from "./logger";
import { sendSlackAlert } from "./slackAlert";

const MAX_L1_KEYS = 2_000;
const CACHE_EPOCH = process.env.CACHE_EPOCH?.trim() || "1";
const EP = `edurain:e${CACHE_EPOCH}`;
const DB_FETCH_GLOBAL_CAP = Number(process.env.DB_FETCH_GLOBAL_CAP || 25);
const isLambda = () => !!process.env.AWS_LAMBDA_FUNCTION_NAME;

export class ShedError extends Error {
  readonly status = 503;
  readonly retryAfter = 1;
  constructor(message = "Service busy, please retry shortly") {
    super(message);
    this.name = "ShedError";
  }
}

export interface RedisLikeClient {
  get(key: string): Promise<string | null>;
  setEx(key: string, ttlSeconds: number, value: string): Promise<unknown>;
  set?(key: string, value: string, opts?: { PX?: number; NX?: boolean }): Promise<unknown>;
  getWithPttl?(key: string): Promise<[string | null, number]>;
  del(key: string | string[]): Promise<unknown>;
  incr?(key: string): Promise<number>;
  pexpire?(key: string, ms: number): Promise<unknown>;
  mget?(keys: string[]): Promise<(string | null)[]>;
  setNx?(key: string, value: string, px: number): Promise<boolean>;
  eval?(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
  ping?(): Promise<string>;
}

interface L1Entry<T = unknown> {
  d: T;
  until: number; // monotonic performance.now() ms
  hardUntil: number; // monotonic performance.now() ms (stale window)
}

type Entry<T> = { d: T; t: number }; // d=data, t=fresh window ms

const l1Cache = new Map<string, L1Entry>();
const inFlightCoalescer = new Map<string, Promise<unknown>>();
const versionMemo = new Map<string, { ver: number | string; until: number }>();
let localVersionSeq = 0;
const pendingBumps = new Set<string>();
let lastRecoveredBumpTime = 0;
let lastSlackAlertTime = 0;

// Circuit Breaker state
let redisClient: RedisLikeClient | null = null;
let circuitState: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
let circuitCooldownMs = 10_000;
let circuitOpenUntil = 0;
let consecutiveFailures = 0;
let consecutiveSuccesses = 0;
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_SUCCESS_THRESHOLD = 2;
const REDIS_CMD_TIMEOUT_MS = 1500;

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
  lockAcquired: 0,
  lockWaited: 0,
  lockFallbackToDb: 0,
  earlyRefreshes: 0,
  negativeHits: 0,
  dbSlotWaits: 0,
  dbShed: 0,
  stalePrevServed: 0,
  versionBumps: 0,
  pendingBumps: 0,
  jobsEnqueued: 0,
  jobsCompleted: 0,
  jobsRetried: 0,
  jobsMovedToDLQ: 0,
  jobsIdempotentSkipped: 0,
};

function mono(): number {
  return performance.now();
}

export function scopeOf(key: string): string {
  const parts = key.split(":");
  const scope = parts.length >= 2 ? `${parts[0]}:${parts[1]}` : (parts[0] || "edurain:global");
  if (!/^edurain:[a-z0-9-]+$/.test(scope)) {
    throw new Error(`Invalid cache scope format: "${scope}" derived from key "${key}"`);
  }
  return scope;
}

function verKey(scope: string): string {
  return `${EP}:ver:${scope}`;
}

function dataKey(scope: string, ver: number | string, logicalKey: string): string {
  const vTag = typeof ver === "string" && ver.startsWith("vL") ? ver : `v${ver}`;
  return `${EP}:d:${scope}:${vTag}:${logicalKey}`;
}

let lastKnownGen: string | null = null;
let lastGenCheckTime = 0;

export async function checkRedisGeneration(client: RedisLikeClient): Promise<void> {
  const now = mono();
  if (now - lastGenCheckTime < 2000) return;
  lastGenCheckTime = now;
  try {
    const gen = await client.get(`${EP}:gen`);
    if (!gen) {
      const newGen = String(Date.now());
      if (client.set) {
        await client.set(`${EP}:gen`, newGen);
      } else {
        await client.setEx(`${EP}:gen`, 86400 * 365, newGen);
      }
      if (lastKnownGen && lastKnownGen !== newGen) {
        versionMemo.clear();
        l1Cache.clear();
      }
      lastKnownGen = newGen;
    } else {
      if (lastKnownGen && lastKnownGen !== gen) {
        versionMemo.clear();
        l1Cache.clear();
      }
      lastKnownGen = gen;
    }
  } catch {
    // Non-blocking
  }
}

export async function sendIfChanged(req: any, res: any, scopes: string[]): Promise<boolean> {
  const vs = await Promise.all(scopes.map(getVersion));
  const etag = `W/"${vs.join("-")}"`;
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", "no-cache");
  if (req.headers && req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return true;
  }
  return false;
}

function lockKeyOf(dk: string): string {
  return `${EP}:lock:${dk}`;
}

export function setRedisClient(client: RedisLikeClient | null): void {
  redisClient = client;
  consecutiveFailures = 0;
  consecutiveSuccesses = 0;
  circuitState = "CLOSED";
  circuitCooldownMs = 10_000;
  circuitOpenUntil = 0;
}

export function getRedisClient(): RedisLikeClient | null {
  const now = Date.now();
  if (circuitState === "OPEN") {
    if (now >= circuitOpenUntil) {
      circuitState = "HALF_OPEN";
      consecutiveSuccesses = 0;
      return redisClient;
    }
    return null;
  }
  return redisClient;
}

export function getCircuitState(): "CLOSED" | "OPEN" | "HALF_OPEN" {
  if (circuitState === "OPEN" && Date.now() >= circuitOpenUntil) {
    return "HALF_OPEN";
  }
  return circuitState;
}

function recordRedisSuccess(): void {
  if (circuitState === "HALF_OPEN") {
    consecutiveSuccesses += 1;
    if (consecutiveSuccesses >= CIRCUIT_SUCCESS_THRESHOLD) {
      circuitState = "CLOSED";
      consecutiveFailures = 0;
      circuitCooldownMs = 10_000;
      logger.info("Redis circuit breaker recovered to CLOSED");
      onRedisRecovered();
    }
  } else if (circuitState === "CLOSED") {
    consecutiveFailures = 0;
  }
}

function recordRedisFailure(err?: unknown): void {
  consecutiveFailures += 1;
  consecutiveSuccesses = 0;
  if (consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD || circuitState === "HALF_OPEN") {
    circuitState = "OPEN";
    perfMetrics.redisCircuitTrips += 1;
    circuitOpenUntil = Date.now() + circuitCooldownMs;
    logger.warn({ cooldownMs: circuitCooldownMs, err }, "Redis circuit breaker OPEN — fallback to L1");

    const now = Date.now();
    if (now - lastSlackAlertTime > 10 * 60_000) {
      lastSlackAlertTime = now;
      void sendSlackAlert("Redis Circuit Breaker OPEN", err, {
        message: `Redis failover tripped. Operating in L1 local mode for ${circuitCooldownMs}ms.`,
      }).catch(() => {});
    }

    circuitCooldownMs = Math.min(circuitCooldownMs * 2, 60_000);
  }
}

function onRedisRecovered(): void {
  const now = Date.now();
  if (now - lastRecoveredBumpTime < 5 * 60_000) return;
  lastRecoveredBumpTime = now;

  void (async () => {
    try {
      await sendSlackAlert("Redis Circuit Breaker CLOSED", null, {
        message: "Redis connection recovered to CLOSED state.",
      }).catch(() => {});

      if (pendingBumps.size > 0 && redisClient?.incr) {
        for (const scope of Array.from(pendingBumps)) {
          try {
            await redisClient.incr(verKey(scope));
            pendingBumps.delete(scope);
          } catch {
            break;
          }
        }
      }
    } catch {
      // non-blocking recovery hook
    }
  })();
}

export async function getVersion(scope: string): Promise<number | string> {
  const now = mono();
  const memo = versionMemo.get(scope);
  if (memo && now < memo.until) return memo.ver;

  const client = getRedisClient();
  if (client) {
    void checkRedisGeneration(client);
    try {
      const raw = await Promise.race([
        client.get(verKey(scope)),
        new Promise<null>((_, rej) => setTimeout(() => rej(new Error("Timeout")), REDIS_CMD_TIMEOUT_MS)),
      ]);
      recordRedisSuccess();
      const ver = raw ? Number(raw) || 0 : 0;
      versionMemo.set(scope, { ver, until: now + 1000 });
      return ver;
    } catch (e) {
      recordRedisFailure(e);
    }
  }

  // Local fallback version
  const localVer = memo?.ver || `vL${++localVersionSeq}`;
  versionMemo.set(scope, { ver: localVer, until: now + 1000 });
  return localVer;
}

export async function bumpVersion(scope: string): Promise<number | string> {
  perfMetrics.versionBumps += 1;
  const client = getRedisClient();
  if (client?.incr) {
    try {
      const n = await Promise.race([
        client.incr(verKey(scope)),
        new Promise<number>((_, rej) => setTimeout(() => rej(new Error("Timeout")), REDIS_CMD_TIMEOUT_MS)),
      ]);
      recordRedisSuccess();
      const current = typeof versionMemo.get(scope)?.ver === "number" ? (versionMemo.get(scope)!.ver as number) : 0;
      const nextVer = Math.max(current, n);
      versionMemo.set(scope, { ver: nextVer, until: mono() + 1000 });
      return nextVer;
    } catch (e) {
      recordRedisFailure(e);
      pendingBumps.add(scope);
      perfMetrics.pendingBumps = pendingBumps.size;
    }
  } else {
    pendingBumps.add(scope);
    perfMetrics.pendingBumps = pendingBumps.size;
  }

  const nextLocal = `vL${++localVersionSeq}`;
  versionMemo.set(scope, { ver: nextLocal, until: mono() + 1000 });
  return nextLocal;
}

function l1Get(key: string): L1Entry | null {
  const entry = l1Cache.get(key);
  if (!entry) return null;
  // Hit: Move to end for true LRU
  l1Cache.delete(key);
  l1Cache.set(key, entry);
  return entry;
}

function l1Set(key: string, data: unknown, ttlMs: number): void {
  if (l1Cache.size >= MAX_L1_KEYS && !l1Cache.has(key)) {
    const oldestKey = l1Cache.keys().next().value;
    if (oldestKey !== undefined) l1Cache.delete(oldestKey);
  }
  const now = mono();
  l1Cache.set(key, { d: data, until: now + ttlMs, hardUntil: now + ttlMs * 3 });
}

async function safeRedisGetWithPttl(key: string): Promise<{ raw: string | null; pttl: number }> {
  const client = getRedisClient();
  if (!client) return { raw: null, pttl: -1 };
  try {
    let raw: string | null = null;
    let pttl = -1;
    if (client.getWithPttl) {
      [raw, pttl] = await Promise.race([
        client.getWithPttl(key),
        new Promise<[null, number]>((_, rej) => setTimeout(() => rej(new Error("Timeout")), REDIS_CMD_TIMEOUT_MS)),
      ]);
    } else {
      raw = await Promise.race([
        client.get(key),
        new Promise<null>((_, rej) => setTimeout(() => rej(new Error("Timeout")), REDIS_CMD_TIMEOUT_MS)),
      ]);
      pttl = raw ? 30_000 : -1;
    }
    recordRedisSuccess();
    return { raw, pttl };
  } catch (e) {
    recordRedisFailure(e);
    return { raw: null, pttl: -1 };
  }
}

async function safeRedisGet(key: string): Promise<string | null> {
  const client = getRedisClient();
  if (!client) return null;
  try {
    const val = await Promise.race([
      client.get(key),
      new Promise<null>((_, rej) => setTimeout(() => rej(new Error("Timeout")), REDIS_CMD_TIMEOUT_MS)),
    ]);
    recordRedisSuccess();
    return val;
  } catch (e) {
    recordRedisFailure(e);
    return null;
  }
}

async function tryLock(dk: string): Promise<string | null> {
  const client = getRedisClient();
  if (!client?.setNx) return "local-token";
  try {
    const token = Math.random().toString(36).slice(2);
    const ok = await Promise.race([
      client.setNx(lockKeyOf(dk), token, 8000),
      new Promise<boolean>((_, rej) => setTimeout(() => rej(new Error("Timeout")), REDIS_CMD_TIMEOUT_MS)),
    ]);
    recordRedisSuccess();
    if (ok) {
      perfMetrics.lockAcquired += 1;
      return token;
    }
    return null;
  } catch (e) {
    recordRedisFailure(e);
    return "local-token"; // Fail open to singleflight
  }
}

async function unlock(dk: string): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  try {
    await client.del(lockKeyOf(dk));
  } catch {
    // Non-critical, 8000ms PX expiry protects lock
  }
}

async function pollRedis(dk: string, maxWaitMs = 1500, intervalMs = 50): Promise<string | null> {
  perfMetrics.lockWaited += 1;
  const start = mono();
  while (mono() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const val = await safeRedisGet(dk);
    if (val) return val;
  }
  return null;
}

// Global DB Concurrency Gate (Redis INCR + local fallback)
let localDbSlotsActive = 0;
const LOCAL_DB_SLOT_MAX = 5;

async function acquireDbSlot(timeoutMs = 300): Promise<string | null> {
  const start = mono();
  while (mono() - start <= timeoutMs) {
    const client = getRedisClient();
    if (client?.incr) {
      try {
        const slotKey = `${EP}:dbslots`;
        const val = await client.incr(slotKey);
        if (client.pexpire && val === 1) await client.pexpire(slotKey, 10000);
        if (val <= DB_FETCH_GLOBAL_CAP) {
          return "redis";
        }
        if (client.eval) {
          await client.eval("redis.call('DECR', KEYS[1])", 1, slotKey);
        } else {
          await client.del(slotKey); // fallback release
        }
      } catch {
        // Fall back to local slot
      }
    }

    if (localDbSlotsActive < LOCAL_DB_SLOT_MAX) {
      localDbSlotsActive += 1;
      return "local";
    }

    perfMetrics.dbSlotWaits += 1;
    await new Promise((r) => setTimeout(r, 40));
  }
  perfMetrics.dbShed += 1;
  return null;
}

async function releaseDbSlot(slot: string | null): Promise<void> {
  if (!slot) return;
  if (slot === "local") {
    localDbSlotsActive = Math.max(0, localDbSlotsActive - 1);
    return;
  }
  const client = getRedisClient();
  if (client?.eval) {
    try {
      await client.eval("redis.call('DECR', KEYS[1])", 1, `${EP}:dbslots`);
    } catch {
      // safe fallback
    }
  }
}

function withJitter(baseSec: number): number {
  const jitterSec = Math.floor(Math.random() * Math.max(2, Math.floor(baseSec * 0.15)));
  return Math.max(1, baseSec + jitterSec);
}

export interface CacheOptions {
  perUser?: boolean;
  negativeTtlSec?: number;
  allowStalePrev?: boolean;
  disableJitter?: boolean;
}

export async function invalidateSafe(fn: () => Promise<unknown> | unknown): Promise<void> {
  try {
    await fn();
  } catch (err: any) {
    logger.warn({ err: err?.message || String(err) }, "Cache invalidation failed safely without throwing");
  }
}

export async function getOrSetCache<T>(
  key: string,
  baseTtlSeconds: number,
  fetcher: () => Promise<T>,
  opts: CacheOptions = {}
): Promise<T> {
  if (process.env.CACHE_BYPASS === "true") return fetcher();

  const scope = scopeOf(key);
  const ver = await getVersion(scope);
  const dk = dataKey(scope, ver, key);
  const t = withJitter(baseTtlSeconds) * 1000;

  // 1) L1 Check (monotonic performance.now)
  if (!opts.perUser) {
    const l1 = l1Get(dk);
    if (l1) {
      const nowMono = mono();
      if (nowMono < l1.until) {
        perfMetrics.cacheHitsL1 += 1;
        return l1.d as T;
      }
      // Stale-While-Revalidate in L1 (within hardUntil)
      if (nowMono < l1.hardUntil) {
        perfMetrics.staleServed += 1;
        if (!inFlightCoalescer.has(dk)) {
          const bgRefresh = (async () => {
            try {
              perfMetrics.dbQueriesExecuted += 1;
              const fresh = await fetcher();
              l1Set(dk, fresh, Math.min(30_000, t));
              const payload = JSON.stringify({ d: fresh, t });
              if (payload.length <= 512 * 1024) {
                const client = getRedisClient();
                if (client?.set) await client.set(dk, payload, { PX: 3 * t });
              }
            } catch {
              // ignore
            } finally {
              inFlightCoalescer.delete(dk);
            }
          })();
          inFlightCoalescer.set(dk, bgRefresh);
          if (isLambda()) await bgRefresh;
          else void bgRefresh.catch(() => {});
        }
        return l1.d as T;
      }
    }
  }

  // 2) In-process Singleflight Coalescing
  if (inFlightCoalescer.has(dk)) {
    perfMetrics.coalescedRequests += 1;
    return inFlightCoalescer.get(dk) as Promise<T>;
  }

  const run = (async (): Promise<T> => {
    try {
      // 3) Redis: GET + PTTL in single round-trip
      const hit = await safeRedisGetWithPttl(dk);
      if (hit.raw) {
        perfMetrics.cacheHitsL2 += 1;
        const e = JSON.parse(hit.raw) as Entry<T>;
        const remaining = hit.pttl - 2 * e.t;
        if (!opts.perUser) l1Set(dk, e.d, Math.min(30_000, e.t));

        if (remaining > 0.2 * e.t) return e.d; // Fresh

        // Early refresh zone
        const lock = await tryLock(dk);
        if (lock) {
          perfMetrics.earlyRefreshes += 1;
          const bgRefresh = (async () => {
            try {
              perfMetrics.dbQueriesExecuted += 1;
              const fresh = await fetcher();
              const payload = JSON.stringify({ d: fresh, t });
              if (payload.length <= 512 * 1024) {
                const client = getRedisClient();
                if (client?.set) await client.set(dk, payload, { PX: 3 * t });
              }
              if (!opts.perUser) l1Set(dk, fresh, Math.min(30_000, t));
            } finally {
              await unlock(dk);
            }
          })();

          if (isLambda()) await bgRefresh;
          else void bgRefresh.catch(() => {});
        }
        return e.d;
      }

      // 4) Cache Miss: Distributed Lock & Double Check
      const lock = await tryLock(dk);
      if (lock) {
        try {
          const again = await safeRedisGetWithPttl(dk);
          if (again.raw) {
            return (JSON.parse(again.raw) as Entry<T>).d;
          }
          return await executeDbFetch(dk, t, fetcher, opts);
        } finally {
          await unlock(dk);
        }
      }

      // 5) Bounded Wait
      const waited = await pollRedis(dk, 1500, 50);
      if (waited) return (JSON.parse(waited) as Entry<T>).d;

      // 6) Stale-Prev Version Fallback (public catalog only)
      if (opts.allowStalePrev && typeof ver === "number" && ver > 0) {
        const prev = await safeRedisGet(dataKey(scope, ver - 1, key));
        if (prev) {
          perfMetrics.stalePrevServed += 1;
          return (JSON.parse(prev) as Entry<T>).d;
        }
      }

      // 7) Global DB Concurrency Gate & Shedding
      perfMetrics.lockFallbackToDb += 1;
      const slot = await acquireDbSlot(300);
      if (!slot) throw new ShedError();

      try {
        const late = await safeRedisGet(dk);
        if (late) return (JSON.parse(late) as Entry<T>).d;
        return await executeDbFetch(dk, t, fetcher, opts);
      } finally {
        await releaseDbSlot(slot);
      }
    } finally {
      inFlightCoalescer.delete(dk);
    }
  })();

  inFlightCoalescer.set(dk, run);
  return run;
}

async function executeDbFetch<T>(
  dk: string,
  t: number,
  fetcher: () => Promise<T>,
  opts: CacheOptions
): Promise<T> {
  perfMetrics.cacheMisses += 1;
  perfMetrics.dbQueriesExecuted += 1;
  const val = await fetcher();

  const px = val === null || val === undefined ? (opts.negativeTtlSec || 30) * 1000 : 3 * t;
  const payload = JSON.stringify({ d: val, t });

  if (payload.length <= 512 * 1024) {
    const client = getRedisClient();
    if (client?.set) {
      try {
        await client.set(dk, payload, { PX: px });
      } catch (e) {
        recordRedisFailure(e);
      }
    } else if (client) {
      try {
        await client.setEx(dk, Math.max(1, Math.floor(px / 1000)), payload);
      } catch (e) {
        recordRedisFailure(e);
      }
    }
  } else {
    logger.warn({ dk, size: payload.length }, "Payload exceeds 512KB limit, skipping Redis cache");
  }

  if (!opts.perUser) l1Set(dk, val, Math.min(30_000, t));
  return val;
}

export async function preWarmCache<T>(key: string, baseTtlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  await invalidateCacheKey(key);
  return getOrSetCache(key, baseTtlSeconds, fetcher);
}

export async function invalidateCacheKey(logicalKey: string): Promise<void> {
  perfMetrics.cacheInvalidations += 1;
  const scope = scopeOf(logicalKey);
  const ver = await getVersion(scope);
  const dk = dataKey(scope, ver, logicalKey);

  l1Cache.delete(dk);
  const client = getRedisClient();
  if (client) {
    try {
      await client.del(dk);
    } catch {
      // non-blocking
    }
  }
}

export async function invalidateCachePrefix(prefix: string): Promise<void> {
  perfMetrics.cacheInvalidations += 1;
  const scope = scopeOf(prefix);
  await bumpVersion(scope);

  // Clear L1 keys matching prefix
  for (const k of l1Cache.keys()) {
    if (k.includes(scope)) l1Cache.delete(k);
  }
}

export function expireCacheKeyNow(key: string, hardExpire = true): void {
  const scope = scopeOf(key);
  for (const [k, entry] of l1Cache.entries()) {
    if (k.includes(scope)) {
      if (hardExpire) {
        l1Cache.delete(k);
      } else {
        entry.until = 0; // soft expired, hardUntil preserved for SWR
      }
    }
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
  jobId?: string;
  attempts?: number;
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

  process(handler: (job: JobRecord<T>) => Promise<void>): void {
    this.processor = handler;
    this.drain();
  }

  async add(name: string, data: T, opts?: JobOptions): Promise<{ status: "enqueued" | "duplicate_skipped"; jobId: string }> {
    const jobId = opts?.jobId ?? `${this.queueName}:${name}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

    if (this.completedIdempotencyKeys.has(jobId) || this.inFlightJobIds.has(jobId)) {
      perfMetrics.jobsIdempotentSkipped += 1;
      return { status: "duplicate_skipped", jobId };
    }

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
        const delayMs = job.backoffDelayMs * Math.pow(2, job.attemptsMade - 1);
        perfMetrics.jobsRetried += 1;
        job.status = "waiting";
        setTimeout(() => {
          this.waitingQueue.push(job);
          this.drain();
        }, delayMs);
      } else {
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
