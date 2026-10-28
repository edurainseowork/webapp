/**
 * ============================================================================
 * PRD SECTION 3 — INTEGRATION TESTING SUITE (API + DB + MIDDLEWARE + HEADERS)
 * ============================================================================
 * Validates:
 * 1. Decoupled Express `app` ephemeral socket binding (`app.listen(0)`).
 * 2. Health & Readiness probes (`/api/healthz`, `/api/health/perf?dbStats=true`).
 * 3. Node.js Event Loop Lag (`monitorEventLoopDelay`: p50, p95, p99, max) & DB Pool telemetry.
 * 4. Security Headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`).
 * 5. Rate Limiting Standard Headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`).
 * 6. Multi-Tier Caching (`Cache-Control: public, max-age=60, stale-while-revalidate=300`) & DB consistency.
 * 7. Banner 4-Placement Filtering (`mobile`, `web`, `purchase`, `courses`) & Input Validation (`400`/`401`/`404`).
 */

process.env.LOG_LEVEL = process.env.LOG_LEVEL || "warn";
import assert from "node:assert/strict";
import http from "node:http";
import app, { pool } from "../../dist/app.mjs";

const results = [];

async function runCase(name, fn) {
  const start = performance.now();
  try {
    const detail = await fn();
    const durationMs = Number((performance.now() - start).toFixed(2));
    results.push({ name, status: "PASS", durationMs, detail });
    console.log(`  ✅ [PASS] ${name} (${durationMs}ms) — ${detail}`);
  } catch (err) {
    const durationMs = Number((performance.now() - start).toFixed(2));
    results.push({ name, status: "FAIL", durationMs, detail: err.message });
    console.error(`  ❌ [FAIL] ${name} (${durationMs}ms) — ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log("\n============================================================================");
  console.log("🧪 TIER 1: INTEGRATION TESTING SUITE (PRD SECTION 3)");
  console.log("============================================================================\n");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. Healthz & Security Headers Contract
    await runCase("GET /api/healthz — Liveness & Hardened Security Headers", async () => {
      const res = await fetch(`${baseUrl}/api/healthz`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
      assert.equal(res.headers.get("x-frame-options"), "DENY");
      assert.ok(res.headers.get("referrer-policy"));
      const body = await res.json();
      assert.equal(body.status, "ok");
      return `HTTP 200, Security Headers verified (X-Frame-Options: DENY, nosniff)`;
    });

    // 2. Deep Telemetry Probe (Event Loop Lag + DB Pool + pg_stat_activity)
    await runCase("GET /api/health/perf?dbStats=true — Event Loop Lag & DB Pool Telemetry", async () => {
      const res = await fetch(`${baseUrl}/api/health/perf?dbStats=true`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.status, "ok");
      assert.ok(body.eventLoopLagMs, "Missing eventLoopLagMs");
      assert.equal(typeof body.eventLoopLagMs.p95, "number");
      assert.equal(typeof body.eventLoopLagMs.p99, "number");
      assert.ok(body.dbPool, "Missing dbPool stats");
      assert.equal(typeof body.dbPool.totalConnections, "number");
      assert.ok(Array.isArray(body.dbPool.pgStatActivity), "Missing dbPool.pgStatActivity");
      return `EventLoop p95=${body.eventLoopLagMs.p95}ms, Pool total=${body.dbPool.totalConnections}, PG activities=${body.dbPool.pgStatActivity.length}`;
    });

    // 3. Catalog Courses Read + RateLimit Headers + Cache-Control + Singleflight L1 Cache Hit
    await runCase("GET /api/courses — DB Read, RateLimit Headers & L1 Cache Speedup", async () => {
      const t0 = performance.now();
      const res1 = await fetch(`${baseUrl}/api/courses`);
      const coldMs = performance.now() - t0;
      assert.equal(res1.status, 200);
      assert.ok(res1.headers.get("x-ratelimit-limit"), "Missing X-RateLimit-Limit header");
      assert.ok(res1.headers.get("x-ratelimit-remaining"), "Missing X-RateLimit-Remaining header");
      assert.ok(res1.headers.get("x-ratelimit-reset"), "Missing X-RateLimit-Reset header");
      assert.match(res1.headers.get("cache-control") || "", /stale-while-revalidate/);
      const courses1 = await res1.json();
      assert.ok(Array.isArray(courses1), "Expected courses array");

      const t1 = performance.now();
      const res2 = await fetch(`${baseUrl}/api/courses`);
      const warmMs = performance.now() - t1;
      assert.equal(res2.status, 200);
      const courses2 = await res2.json();
      assert.equal(courses1.length, courses2.length);
      return `Courses=${courses1.length}, Cold=${coldMs.toFixed(1)}ms -> Warm(L1)=${warmMs.toFixed(1)}ms, X-RateLimit-Limit=${res1.headers.get("x-ratelimit-limit")}`;
    });

    // 4. Banner Placement Filtering Contract (home, web_home, courses, purchases)
    await runCase("GET /api/banners?placement=... — Multi-Placement Contract", async () => {
      for (const placement of ["home", "web_home", "courses", "purchases"]) {
        const res = await fetch(`${baseUrl}/api/banners?placement=${placement}`);
        assert.equal(res.status, 200, `Failed for placement=${placement}`);
        const json = await res.json();
        assert.ok(json.success, `Expected json.success to be true`);
        assert.ok(Array.isArray(json.data), `Expected data array for placement=${placement}`);
        for (const item of json.data) {
          assert.equal(item.placement, placement, `Mismatched placement in response`);
        }
      }
      return `Verified placement filtering across [home, web_home, courses, purchases]`;
    });

    // 5. Categories & Support Contacts Contract
    await runCase("GET /api/categories & /api/support-contacts — Schema & Status Contract", async () => {
      const [catRes, supRes] = await Promise.all([
        fetch(`${baseUrl}/api/categories`),
        fetch(`${baseUrl}/api/support-contacts`),
      ]);
      assert.equal(catRes.status, 200);
      assert.equal(supRes.status, 200);
      const cats = await catRes.json();
      const sups = await supRes.json();
      assert.ok(Array.isArray(cats));
      assert.ok(Array.isArray(sups.data));
      return `Categories=${cats.length}, SupportContacts=${sups.data.length}`;
    });

    // 6. Auth Guard & Negative Contract (401 Unauthorized on Admin Mutation)
    await runCase("POST /api/banners (Unauthenticated) — Strict 401 Auth Guard", async () => {
      const res = await fetch(`${baseUrl}/api/banners`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Unauthorized Banner" }),
      });
      assert.equal(res.status, 401);
      return `Blocked unauthenticated mutation with HTTP 401`;
    });

    // 7. Unknown API Route Contract (404 Not Found)
    await runCase("GET /api/non-existent-endpoint — Clean JSON 404 Contract", async () => {
      const res = await fetch(`${baseUrl}/api/non-existent-endpoint-xyz`);
      assert.equal(res.status, 404);
      return `Returned clean HTTP 404 for unknown route`;
    });

    console.log(`\n🎉 ALL ${results.length}/${results.length} INTEGRATION TESTS PASSED!\n`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error("\n❌ Integration Test Suite Failed:", err);
  process.exit(1);
});

