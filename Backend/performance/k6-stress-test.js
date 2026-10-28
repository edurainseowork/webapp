/**
 * ============================================================================
 * PRD SECTION 5 — GRAFANA K6 STRESS TEST SCRIPT (5-STAGE RAMP-UP & RECOVERY)
 * ============================================================================
 * Run with k6 CLI:
 *   k6 run Backend/performance/k6-stress-test.js
 */

import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 50 },  // Stage 1: Normal load
    { duration: "2m", target: 150 }, // Stage 2: High load
    { duration: "2m", target: 300 }, // Stage 3: Approaching breaking point
    { duration: "2m", target: 500 }, // Stage 4: Overload spike
    { duration: "2m", target: 20 },  // Stage 5: Recovery phase (Verify self-healing)
    { duration: "1m", target: 0 },   // Cool down
  ],
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";

export default function () {
  const res = http.get(`${BASE_URL}/api/courses`);
  check(res, {
    "status is 200 or controlled 429/503": (r) =>
      r.status === 200 || r.status === 429 || r.status === 503,
  });
  sleep(0.5);
}

