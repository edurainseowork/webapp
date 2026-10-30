/**
 * ============================================================================
 * PRD SECTION 5 — NATIVE NODE.JS 5-STAGE STRESS & SELF-HEALING TEST SUITE
 * ============================================================================
 * Executes the 5-Stage Ramp-Up Architecture from the PRD:
 *   Stage 1: Normal Load        (50 Concurrent VUs)
 *   Stage 2: High Load          (150 Concurrent VUs)
 *   Stage 3: Breaking Point     (300 Concurrent VUs)
 *   Stage 4: Overload Spike     (500 Concurrent VUs — triggers 503 Backpressure Guard)
 *   Stage 5: Recovery Phase     (20 Concurrent VUs — verifies 100% self-healing & 0% errors)
 */

process.env.LOG_LEVEL = process.env.LOG_LEVEL || "warn";
import assert from "node:assert/strict";
import http from "node:http";
import app, { pool } from "../dist/app.mjs";

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.ceil((p / 100) * sortedArr.length) - 1);
  return Number(sortedArr[idx].toFixed(2));
}

async function runStage(baseUrl, stageName, concurrency, requestsPerVu) {
  const latencies = [];
  let status200 = 0;
  let status429 = 0;
  let status503 = 0;
  let unexpectedErrors = 0;

  const start = performance.now();

  const workers = Array.from({ length: concurrency }, async (_, vuIdx) => {
    for (let i = 0; i < requestsPerVu; i++) {
      const reqStart = performance.now();
      try {
        const res = await fetch(`${baseUrl}/api/courses`, {
          headers: {
            "X-Forwarded-For": `172.16.${Math.floor(vuIdx / 250)}.${(vuIdx % 250) + 1}`,
          },
        });
        await res.arrayBuffer();
        latencies.push(performance.now() - reqStart);

        if (res.status === 200) status200++;
        else if (res.status === 429) status429++;
        else if (res.status === 503) status503++;
        else unexpectedErrors++;
      } catch {
        unexpectedErrors++;
      }
    }
  });

  await Promise.all(workers);

  const durationSec = (performance.now() - start) / 1000;
  latencies.sort((a, b) => a - b);
  const total = status200 + status429 + status503 + unexpectedErrors;
  const rps = Number((total / durationSec).toFixed(1));
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);

  console.log(
    `  🔹 ${stageName.padEnd(28)} | VUs: ${String(concurrency).padStart(3)} | Total: ${String(total).padStart(4)} | RPS: ${String(rps).padStart(7)} | 200 OK: ${String(status200).padStart(4)} | 503 Shed: ${String(status503).padStart(3)} | 500 Crash: ${unexpectedErrors} | p95: ${p95}ms`
  );

  return { stageName, concurrency, total, rps, status200, status429, status503, unexpectedErrors, p95, p99 };
}

async function main() {
  console.log("\n============================================================================");
  console.log("🔥 TIER 3: 5-STAGE STRESS & SELF-HEALING SUITE (PRD SECTION 5)");
  console.log("============================================================================\n");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    // Prime L1/L2 cache before stress ramp
    await fetch(`${baseUrl}/api/courses`);

    const s1 = await runStage(baseUrl, "Stage 1: Normal Load", 50, 4);
    const s2 = await runStage(baseUrl, "Stage 2: High Load", 150, 3);
    const s3 = await runStage(baseUrl, "Stage 3: Breaking Point", 300, 2);
    const s4 = await runStage(baseUrl, "Stage 4: Overload Spike", 500, 2);

    // Brief drain pause before Stage 5 Recovery check
    await new Promise((r) => setTimeout(r, 400));
    const s5 = await runStage(baseUrl, "Stage 5: Self-Healing Recovery", 20, 5);

    // Verify zero unhandled 500 crashes across all 5 stages
    const totalUnexpected =
      s1.unexpectedErrors + s2.unexpectedErrors + s3.unexpectedErrors + s4.unexpectedErrors + s5.unexpectedErrors;
    assert.equal(totalUnexpected, 0, `Expected 0 unhandled crashes across all stress stages, got ${totalUnexpected}`);

    // Verify Stage 5 Recovery self-healed 100% (all 200 OK, p95 < 400ms SLA with remote DB & adaptive compression)
    assert.equal(s5.status200, s5.total, `Recovery phase failed to serve 100% 200 OK (${s5.status200}/${s5.total})`);
    assert.ok(s5.p95 < 400, `Recovery p95 latency (${s5.p95}ms) did not return to SLA (<400ms)`);

    console.log(
      `\n🎉 STRESS & SELF-HEALING VERIFIED: 0 Crashes at 500 VUs & 100% Recovery (${s5.status200}/${s5.total} 200 OK, p95=${s5.p95}ms)!\n`
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error("\n❌ Stress Test Suite Failed:", err);
  process.exit(1);
});

