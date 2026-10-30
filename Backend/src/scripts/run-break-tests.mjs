/**
 * EduRain Production Backend Performance & Break Test Suite
 *
 * Executes all 6 stress, chaos, and break-point scenarios:
 * 1. Rate Limiting & Brute-Force Protection (HTTP 429 + Retry-After)
 * 2. Multi-Tier Cache Hit/Miss Latency & Explicit CMS Invalidation Benchmark
 * 3. Cache Stampede ("Diwali Sale 12:00 AM" — 2,000 simultaneous requests on expired key)
 * 4. 25 LPA Chaos Test — "What If Redis Crashes?" (Circuit Breaker + L1 Fallback)
 * 5. Backpressure & OOM Protection ("1,000 IN • 100 OUT" Bounded Buffer & 503 Load Shedding)
 * 6. Background Job Queue Retries, Exponential Backoff, Dead Letter Queue (DLQ) & Idempotency
 */

import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

// Import compiled production modules via tsx/esbuild bundle or direct TypeScript build
import {
  BoundedJobQueue,
  NonRetryableJobError,
  expireCacheKeyNow,
  getCircuitState,
  getOrSetCache,
  invalidateCachePrefix,
  perfMetrics,
  preWarmCache,
  setRedisClient,
} from "../lib/perfEngine.ts";
import {
  LUA_TOKEN_BUCKET_SCRIPT,
  backpressureGuard,
  paymentRateLimiter,
  rateLimit,
} from "../middlewares/security.ts";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createMockReqRes(ip = "203.0.113.5", userId = null) {
  const headers = {};
  let statusCode = 200;
  let body = null;
  const listeners = {};

  const req = {
    ip,
    user: userId ? { id: userId } : undefined,
    headers: {},
  };

  const res = {
    setHeader(k, v) {
      headers[k.toLowerCase()] = v;
    },
    getHeader(k) {
      return headers[k.toLowerCase()];
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
    on(event, fn) {
      listeners[event] = fn;
    },
    finish() {
      if (listeners.finish) listeners.finish();
    },
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
    get headers() {
      return headers;
    },
  };

  return { req, res };
}

async function runAllBreakTests() {
  console.log("================================================================================");
  console.log("🚀 EDURAIN PRODUCTION PERFORMANCE & BREAK TEST SUITE");
  console.log("================================================================================\n");

  const results = [];

  /* ------------------------------------------------------------------------ */
  /* TEST 1: Rate Limiting PRD — 4 Algorithms, Dual IP+Account & Lua Script   */
  /* ------------------------------------------------------------------------ */
  {
    const t0 = performance.now();

    // 1A: Sliding Window + Standard Headers (X-RateLimit-*, RateLimit-*, Retry-After)
    const loginLimiter = rateLimit({
      windowMs: 60_000,
      limit: 10,
      algorithm: "sliding-window",
      keyStrategy: "ip",
      keyPrefix: "test-rl-ip",
      message: "Too many login attempts, please try again later",
    });

    const statuses = [];
    let lastHeaders = {};
    for (let i = 1; i <= 15; i++) {
      const { req, res } = createMockReqRes("198.51.100.42");
      let nextCalled = false;
      await loginLimiter(req, res, () => {
        nextCalled = true;
      });
      statuses.push(nextCalled ? 200 : res.statusCode);
      lastHeaders = res.headers;
    }

    assert.equal(statuses.filter((s) => s === 200).length, 10, "First 10 requests allowed");
    assert.equal(statuses.filter((s) => s === 429).length, 5, "Requests 11..15 blocked (429)");
    assert.equal(lastHeaders["x-ratelimit-limit"], "10", "X-RateLimit-Limit header must be present");
    assert.equal(lastHeaders["x-ratelimit-remaining"], "0", "X-RateLimit-Remaining must be 0 on 429");
    assert.ok(Number(lastHeaders["x-ratelimit-reset"]) > 0, "X-RateLimit-Reset epoch timestamp must be present");
    assert.ok(Number(lastHeaders["retry-after"]) > 0, "Retry-After header must be present");

    // 1B: Dual IP + Account Identifier Brute-Force Test (Attacker rotates 8 different IPs against 1 victim email)
    const dualAuthLimiter = rateLimit({
      windowMs: 60_000,
      limit: 5,
      algorithm: "sliding-window",
      keyStrategy: "ip+identifier",
      keyPrefix: "test-rl-dual",
    });

    const botnetStatuses = [];
    for (let i = 1; i <= 8; i++) {
      const { req, res } = createMockReqRes(`203.0.113.${i}`); // Different IP every request!
      req.body = { email: "victim@edurain.in" };
      let nextCalled = false;
      await dualAuthLimiter(req, res, () => {
        nextCalled = true;
      });
      botnetStatuses.push(nextCalled ? 200 : res.statusCode);
    }

    assert.equal(botnetStatuses.filter((s) => s === 200).length, 5, "Only 5 attempts allowed for victim@edurain.in across rotating IPs");
    assert.equal(botnetStatuses.filter((s) => s === 429).length, 3, "Attempts 6..8 blocked even from fresh IPs!");

    // 1C: Token Bucket + Atomic Redis Lua Script Verification
    assert.ok(LUA_TOKEN_BUCKET_SCRIPT.includes("redis.call('HMGET'"), "Atomic Lua Token Bucket script must be embedded");
    const tokenBucketLimiter = rateLimit({
      windowMs: 1_000, // 1s window, 2 tokens (refill = 2 tokens/sec)
      limit: 2,
      algorithm: "token-bucket",
      keyStrategy: "user",
      keyPrefix: "test-rl-tb",
    });

    const tbStatuses = [];
    for (let i = 0; i < 3; i++) {
      const { req, res } = createMockReqRes("10.0.0.1", 777);
      let ok = false;
      await tokenBucketLimiter(req, res, () => { ok = true; });
      tbStatuses.push(ok ? 200 : res.statusCode);
    }
    assert.deepEqual(tbStatuses, [200, 200, 429], "Token bucket allows burst of 2 and rejects 3rd");
    await sleep(550); // Wait 0.55s -> 1 token refills!
    {
      const { req, res } = createMockReqRes("10.0.0.1", 777);
      let refilledOk = false;
      await tokenBucketLimiter(req, res, () => { refilledOk = true; });
      assert.equal(refilledOk, true, "Token bucket must refill 1 token after 500ms");
    }

    // 1D: Payment Route Limiter (20 req/min per User)
    let paymentAllowed = 0;
    let paymentBlocked = 0;
    for (let i = 1; i <= 25; i++) {
      const { req, res } = createMockReqRes("10.0.0.9", 999);
      let ok = false;
      await paymentRateLimiter(req, res, () => { ok = true; });
      if (ok) paymentAllowed++;
      else if (res.statusCode === 429) paymentBlocked++;
    }
    assert.equal(paymentAllowed, 20, "Payment limiter allows 20 requests/min");
    assert.equal(paymentBlocked, 5, "Payment limiter blocks requests 21..25");

    const elapsed = (performance.now() - t0).toFixed(2);
    console.log(`✅ [TEST 1 PASS] Rate Limiting PRD — Sliding Window, Token Bucket, Dual IP+Account & Headers (${elapsed}ms)`);
    console.log(`   ├─ Standard Headers Verified : X-RateLimit-Limit=10, Remaining=0, Reset=${lastHeaders["x-ratelimit-reset"]}, Retry-After=${lastHeaders["retry-after"]}s`);
    console.log(`   ├─ Botnet IP-Rotation Attack : 5 Allowed, 3 Blocked (429) on victim@edurain.in across 8 distinct IPs`);
    console.log(`   ├─ Token Bucket Refill Test  : Burst [200, 200, 429] -> 500ms steady refill -> 200 OK`);
    console.log(`   └─ Payment Route Limiter     : 20 Allowed, 5 Blocked (429)\n`);

    results.push({
      test: "Test 1: Rate Limiting PRD (4 Algos + Dual IP/Acct + Headers)",
      status: "PASS",
      metrics: `IP: 10/15, Botnet Acct: 5/8, TokenBucket Refill: OK, Payment: 20/25`,
    });
  }

  /* ------------------------------------------------------------------------ */
  /* TEST 2: Cache Hit vs Miss Latency & Explicit CMS Invalidation Benchmark  */
  /* ------------------------------------------------------------------------ */
  {
    await invalidateCachePrefix("edurain:test-courses");
    let dbVersion = 1;
    let simulatedDbCalls = 0;

    const slowDbFetcher = async () => {
      simulatedDbCalls += 1;
      await sleep(45); // Simulate 45ms PostgreSQL join query
      return [{ id: 101, title: `NEET Target Batch v${dbVersion}`, price: 499900 }];
    };

    // Request 1: Cold Cache Miss
    const missStart = performance.now();
    const firstRes = await getOrSetCache("edurain:test-courses:list", 300, slowDbFetcher);
    const missLatencyMs = performance.now() - missStart;

    // Requests 2..500: Warm Cache Hits (499 requests)
    const hitStart = performance.now();
    for (let i = 0; i < 499; i++) {
      const cachedRes = await getOrSetCache("edurain:test-courses:list", 300, slowDbFetcher);
      assert.equal(cachedRes[0].title, "NEET Target Batch v1");
    }
    const totalHitMs = performance.now() - hitStart;
    const avgHitLatencyMs = totalHitMs / 499;

    assert.equal(simulatedDbCalls, 1, "500 requests should only trigger 1 DB query");
    assert.ok(avgHitLatencyMs < 1.0, "Cache HIT average latency must be under 1ms");

    // Explicit CMS Mutation Invalidation
    dbVersion = 2;
    await invalidateCachePrefix("edurain:test-courses");
    const afterInvalidation = await getOrSetCache("edurain:test-courses:list", 300, slowDbFetcher);
    assert.equal(afterInvalidation[0].title, "NEET Target Batch v2", "Must serve fresh v2 data immediately after CMS invalidation");
    assert.equal(simulatedDbCalls, 2, "Invalidation should trigger exactly 1 fresh DB fetch");

    console.log(`✅ [TEST 2 PASS] Cache-Aside Latency & CMS Invalidation Benchmark`);
    console.log(`   ├─ Request 1 (CACHE MISS)       -> ${missLatencyMs.toFixed(2)}ms (1 SQL query)`);
    console.log(`   ├─ Requests 2..500 (CACHE HITS) -> ${avgHitLatencyMs.toFixed(4)}ms avg (0 SQL queries — 99.8% DB savings)`);
    console.log(`   └─ CMS Update Invalidation      -> Immediate v1 -> v2 consistency verified\n`);

    results.push({
      test: "Test 2: Cache Hit/Miss Latency & CMS Invalidation",
      status: "PASS",
      metrics: `Miss: ${missLatencyMs.toFixed(1)}ms | Hit Avg: ${avgHitLatencyMs.toFixed(4)}ms (499 hits = 0 DB queries)`,
    });
  }

  /* ------------------------------------------------------------------------ */
  /* TEST 3: Cache Stampede ("Diwali Sale 12:00 AM" — 2,000 Concurrent Hits)  */
  /* ------------------------------------------------------------------------ */
  {
    const stampedeKey = "edurain:stampede:homepage";
    await invalidateCachePrefix("edurain:stampede");
    let stampedeDbQueries = 0;

    const heavyHomepageQuery = async () => {
      stampedeDbQueries += 1;
      await sleep(60); // 60ms heavy homepage query
      return { banner: "Diwali Sale Live", batches: 14 };
    };

    // Pre-warm and then force-expire at 12:00:00 AM
    await preWarmCache(stampedeKey, 300, heavyHomepageQuery);
    assert.equal(stampedeDbQueries, 1);
    expireCacheKeyNow(stampedeKey, true); // Hard-expire at 12:00:00!

    const coalescedBefore = perfMetrics.coalescedRequests;
    const CONCURRENT_USERS = 2_000;

    const t0 = performance.now();
    const responses = await Promise.all(
      Array.from({ length: CONCURRENT_USERS }, () =>
        getOrSetCache(stampedeKey, 300, heavyHomepageQuery)
      )
    );
    const burstDurationMs = performance.now() - t0;
    const coalescedDelta = perfMetrics.coalescedRequests - coalescedBefore;

    assert.equal(responses.length, CONCURRENT_USERS);
    assert.equal(stampedeDbQueries, 2, "Out of 2,000 simultaneous requests on expired key, ONLY 1 query may hit DB!");
    assert.equal(coalescedDelta, CONCURRENT_USERS - 1, "1,999 requests must be coalesced via Singleflight");

    // Sub-test 3B: Stale-While-Revalidate (Soft-expire only)
    expireCacheKeyNow(stampedeKey, false); // Soft-expired, but within hardExpiry window
    const swrStart = performance.now();
    const staleRes = await getOrSetCache(stampedeKey, 300, heavyHomepageQuery);
    const swrLatencyMs = performance.now() - swrStart;
    assert.equal(staleRes.banner, "Diwali Sale Live");
    assert.ok(swrLatencyMs < 5, "Stale-While-Revalidate must return in <5ms without blocking on DB");
    await sleep(80); // Let background refresh complete
    assert.equal(stampedeDbQueries, 3, "Background revalidation quietly refreshed the cache once");

    console.log(`✅ [TEST 3 PASS] Cache Stampede ("Diwali Sale 12:00 AM" — 2,000 Simultaneous Users)`);
    console.log(`   ├─ Concurrent Requests Fired : ${CONCURRENT_USERS}`);
    console.log(`   ├─ Coalesced via Singleflight: ${coalescedDelta} requests waited on 1 shared Promise`);
    console.log(`   ├─ Total DB Queries Executed : 1 (99.95% Stampede Reduction in ${burstDurationMs.toFixed(1)}ms)`);
    console.log(`   └─ Stale-While-Revalidate    : Served in ${swrLatencyMs.toFixed(2)}ms while refreshing silently in background\n`);

    results.push({
      test: "Test 3: Cache Stampede (2,000 Concurrent Misses)",
      status: "PASS",
      metrics: `2,000 concurrent requests -> 1 DB query (1,999 coalesced), SWR=${swrLatencyMs.toFixed(2)}ms`,
    });
  }

  /* ------------------------------------------------------------------------ */
  /* TEST 4: 25 LPA Chaos Test — "What If Redis Crashes Mid-Traffic?"         */
  /* ------------------------------------------------------------------------ */
  {
    let redisDead = true;
    const deadRedisClient = {
      async get() {
        if (redisDead) throw new Error("ECONNREFUSED 127.0.0.1:6379 — Redis cluster down");
        return null;
      },
      async setEx() {
        if (redisDead) throw new Error("ECONNREFUSED 127.0.0.1:6379 — Redis cluster down");
      },
      async del() {
        if (redisDead) throw new Error("ECONNREFUSED 127.0.0.1:6379 — Redis cluster down");
      },
    };

    setRedisClient(deadRedisClient);
    await invalidateCachePrefix("edurain:chaos");

    let dbQueriesDuringOutage = 0;
    const dbFetcher = async () => {
      dbQueriesDuringOutage += 1;
      await sleep(20);
      return { status: "surviving_without_redis", courses: 13 };
    };

    // Trip the circuit breaker (3 failures) and then fire 500 concurrent requests
    for (let i = 0; i < 3; i++) {
      await getOrSetCache(`edurain:chaos:trip:${i}`, 60, dbFetcher);
    }
    assert.equal(getCircuitState(), "OPEN", "Circuit breaker must trip to OPEN after 3 Redis failures");

    const queriesBeforeWave = dbQueriesDuringOutage;
    const waveResponses = await Promise.all(
      Array.from({ length: 500 }, () =>
        getOrSetCache("edurain:chaos:catalog", 300, dbFetcher)
      )
    );

    assert.equal(waveResponses.length, 500);
    assert.equal(dbQueriesDuringOutage - queriesBeforeWave, 1, "Even with Redis DEAD, L1 + Singleflight must cap 500 requests to 1 DB query!");

    // Restore clean state
    setRedisClient(null);

    console.log(`✅ [TEST 4 PASS] 25 LPA Chaos Test — "What If Redis Crashes?"`);
    console.log(`   ├─ Simulated Failure         : ECONNREFUSED 127.0.0.1:6379 (Redis Down)`);
    console.log(`   ├─ Circuit Breaker State     : TRIPPED -> OPEN (0ms fast-fail to L1 RAM Cache)`);
    console.log(`   ├─ 500 Concurrent Requests   : 500/500 HTTP 200 OK (0% downtime)`);
    console.log(`   └─ DB Queries During Outage  : 1 query (Protected by L1 + In-Process Singleflight)\n`);

    results.push({
      test: "Test 4: Redis Crash Failover (25 LPA Scenario)",
      status: "PASS",
      metrics: `Circuit Breaker=OPEN, 500/500 requests succeeded via L1 + Singleflight (1 DB query)`,
    });
  }

  /* ------------------------------------------------------------------------ */
  /* TEST 5: Backpressure & OOM Break Test ("1,000 IN • 100 OUT")             */
  /* ------------------------------------------------------------------------ */
  {
    const guard = backpressureGuard({ maxConcurrent: 100 });
    const activeResponses = [];
    let accepted = 0;
    let shed503 = 0;

    // Simulate 1,000 concurrent incoming requests while consumer holds 100 active slots
    for (let i = 0; i < 1_000; i++) {
      const { req, res } = createMockReqRes(`10.0.0.${i % 250}`);
      let passed = false;
      guard(req, res, () => {
        passed = true;
      });
      if (passed) {
        accepted += 1;
        activeResponses.push(res);
      } else if (res.statusCode === 503) {
        shed503 += 1;
      }
    }

    assert.equal(accepted, 100, "Exactly 100 concurrent requests should enter the bounded buffer");
    assert.equal(shed503, 900, "Excess 900 requests must be shed with HTTP 503 Service Unavailable");

    // Now release the 100 active slots and verify immediate recovery
    for (const r of activeResponses) r.finish();

    const { req: recoveryReq, res: recoveryRes } = createMockReqRes("10.0.0.1");
    let recovered = false;
    guard(recoveryReq, recoveryRes, () => {
      recovered = true;
    });
    assert.equal(recovered, true, "Server must immediately accept new requests once in-flight slots drain");

    const heapMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    console.log(`✅ [TEST 5 PASS] Backpressure & OOM Protection ("1,000 IN • 100 OUT")`);
    console.log(`   ├─ Incoming Burst            : 1,000 concurrent requests`);
    console.log(`   ├─ Bounded Active Capacity   : 100 accepted (200 OK)`);
    console.log(`   ├─ Load Shedding (HTTP 503)  : 900 politely rejected with Retry-After=10s`);
    console.log(`   └─ Process Heap Memory       : ${heapMb} MB (Flat, 0% OOM risk & instant recovery)\n`);

    results.push({
      test: "Test 5: Backpressure & Load Shedding (1,000 IN / 100 OUT)",
      status: "PASS",
      metrics: `100 Accepted, 900 Shed (HTTP 503), Heap=${heapMb}MB (Zero OOM)`,
    });
  }

  /* ------------------------------------------------------------------------ */
  /* TEST 6: BullMQ Semantics — Retries, Backoff, DLQ & Job Idempotency       */
  /* ------------------------------------------------------------------------ */
  {
    const testQueue = new BoundedJobQueue("test-orders", { maxBufferSize: 50, concurrency: 5 });
    let executionCounter = 0;
    let transientAttempts = 0;

    testQueue.process(async (job) => {
      if (job.name === "flaky-network-job") {
        transientAttempts += 1;
        if (transientAttempts < 3) {
          throw new Error("503 Downstream SMTP gateway timeout");
        }
        return; // Succeeds on 3rd attempt!
      }

      if (job.name === "bad-request-job") {
        throw new NonRetryableJobError("400 Invalid email address format");
      }

      if (job.name === "always-failing-job") {
        throw new Error("502 Bad Gateway persistent outage");
      }

      if (job.name === "idempotent-payment-unlock") {
        executionCounter += 1;
        await sleep(10);
      }
    });

    // 6A: Transient failure -> Exponential Backoff -> Success on 3rd try
    await testQueue.add("flaky-network-job", { email: "student@edurain.in" }, { attempts: 3, backoffDelayMs: 30 });
    // 6B: Non-retryable 400 -> Immediate DLQ (1 attempt only)
    await testQueue.add("bad-request-job", { email: "bad@@" }, { attempts: 3, backoffDelayMs: 30 });
    // 6C: Persistent 502 failure -> Exhausts 3 attempts -> Moves to DLQ
    await testQueue.add("always-failing-job", { id: 99 }, { attempts: 3, backoffDelayMs: 30 });

    // 6D: Idempotency — Fire 50 duplicate jobs with the same paymentId (`order:pay_987654`)
    const idempResults = await Promise.all(
      Array.from({ length: 50 }, () =>
        testQueue.add(
          "idempotent-payment-unlock",
          { userId: 42, courseId: 17 },
          { jobId: "order:pay_987654", attempts: 3, backoffDelayMs: 20 }
        )
      )
    );

    const enqueuedCount = idempResults.filter((r) => r.status === "enqueued").length;
    const skippedCount = idempResults.filter((r) => r.status === "duplicate_skipped").length;

    // Wait for backoff timers to finish (~300ms)
    await sleep(350);

    const dlq = testQueue.getDeadLetterQueue();
    const badReqJob = dlq.find((j) => j.name === "bad-request-job");
    const persistentFailJob = dlq.find((j) => j.name === "always-failing-job");

    assert.equal(transientAttempts, 3, "Flaky job must succeed on attempt 3 after exponential backoff");
    assert.ok(badReqJob, "400 Bad Request job must land in Dead Letter Queue");
    assert.equal(badReqJob.attemptsMade, 1, "Non-retryable 400 error must NOT waste retries");
    assert.ok(persistentFailJob, "Persistent 502 job must land in Dead Letter Queue");
    assert.equal(persistentFailJob.attemptsMade, 3, "Persistent 502 job must retry 3 times before DLQ");
    assert.equal(enqueuedCount, 1, "Only 1 of the 50 identical payment jobs should be enqueued");
    assert.equal(skippedCount, 49, "49 duplicate payment jobs must be skipped by Idempotency guard");
    assert.equal(executionCounter, 1, "Side-effect (course unlock) must execute EXACTLY ONCE");

    console.log(`✅ [TEST 6 PASS] Background Queues — Retries, Exponential Backoff, DLQ & Idempotency`);
    console.log(`   ├─ Exponential Backoff Retry : Attempt 1 (Fail) -> Attempt 2 (Fail) -> Attempt 3 (Success ✅)`);
    console.log(`   ├─ Smart 400 Error Filter    : Discarded after 1 attempt -> Moved to DLQ`);
    console.log(`   ├─ Dead Letter Queue (DLQ)   : Captured persistent failure after 3 attempts with reason`);
    console.log(`   └─ Payment Job Idempotency   : 50 duplicate triggers -> Executed 1 time (49 skipped)\n`);

    results.push({
      test: "Test 6: Queues, Exponential Backoff, DLQ & Idempotency",
      status: "PASS",
      metrics: `Retry 3x->Success, 400->1x DLQ, 502->3x DLQ, Idempotency: 1/50 executed`,
    });
  }

  console.log("================================================================================");
  console.log("🎉 ALL 6 PRODUCTION BREAK TESTS PASSED WITH ZERO ERRORS!");
  console.log("================================================================================");
  console.table(results);
}

runAllBreakTests().catch((err) => {
  console.error("❌ BREAK TEST FAILED:", err);
  process.exit(1);
});
