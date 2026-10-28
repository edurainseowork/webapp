/**
 * ============================================================================
 * UNIFIED "BACKEND CHECK" PIPELINE ORCHESTRATOR
 * ============================================================================
 * Triggered whenever the user says "backend check" or runs:
 *   pnpm --filter @workspace/backend test:check
 *
 * Executes in sequence:
 *   0. Build Express Bundle (`dist/app.mjs`, `dist/index.mjs`)
 *   1. Tier 1: Integration Testing Suite (`tests/integration/api.integration.mjs`)
 *   2. Tier 2: Load Testing Suite (`performance/run-load-test.mjs`)
 *   3. Tier 3: 5-Stage Stress & Self-Healing Suite (`performance/run-stress-test.mjs`)
 *   4. Tier 4: 6-Scenario Break Test Suite (`src/scripts/run-break-tests.mjs`)
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "../..");

const steps = [
  { name: "Build Backend Bundle (dist/app.mjs)", args: ["./build.mjs"] },
  { name: "Tier 1: Integration Tests (API + DB + Headers)", args: ["--env-file=.env", "./tests/integration/api.integration.mjs"] },
  { name: "Tier 2: Load Testing (20 VUs / 1,600 Reqs SLA)", args: ["--env-file=.env", "./performance/run-load-test.mjs"] },
  { name: "Tier 3: 5-Stage Stress & Self-Healing (50 -> 500 -> 20 VUs)", args: ["--env-file=.env", "./performance/run-stress-test.mjs"] },
  { name: "Tier 4: 6-Scenario Break Test Suite (Cache/RateLimit/Queue)", args: ["./src/scripts/run-break-tests.mjs"] },
];

console.log("============================================================================");
console.log("🚀 EDURAIN PRODUCTION BACKEND CHECK PIPELINE (4-TIER PRD VERIFICATION)");
console.log("============================================================================");

const summary = [];

for (const step of steps) {
  const t0 = performance.now();
  const res = spawnSync(process.execPath, step.args, {
    cwd: backendRoot,
    stdio: "inherit",
    env: { ...process.env },
  });
  const elapsedSec = ((performance.now() - t0) / 1000).toFixed(2);
  if (res.status !== 0) {
    console.error(`\n❌ Pipeline halted at step: ${step.name} (exit code ${res.status})`);
    process.exit(res.status || 1);
  }
  summary.push({ name: step.name, status: "PASS ✅", elapsedSec: `${elapsedSec}s` });
}

console.log("\n============================================================================");
console.log("🏆 FINAL BACKEND CHECK SCORECARD");
console.log("============================================================================");
for (const item of summary) {
  console.log(`  ${item.status}  ${item.name.padEnd(58)} (${item.elapsedSec})`);
}
console.log("============================================================================\n");

