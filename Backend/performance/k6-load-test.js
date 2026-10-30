/**
 * ============================================================================
 * PRD SECTION 4 — GRAFANA K6 LOAD TEST SCRIPT (EXPECTED PEAK TRAFFIC SLA)
 * ============================================================================
 * Run with k6 CLI:
 *   k6 run Backend/performance/k6-load-test.js
 */

import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 20 }, // Ramp up to 20 Virtual Users over 1 minute
    { duration: "3m", target: 20 }, // Stay at 20 Virtual Users for 3 minutes
    { duration: "1m", target: 0 },  // Ramp down to 0 over 1 minute
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],               // Error rate must be < 1%
    http_req_duration: ["p(95)<200", "p(99)<400"], // 95% < 200ms, 99% < 400ms
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";

export default function () {
  const resCourses = http.get(`${BASE_URL}/api/courses`);
  check(resCourses, {
    "courses status is 200": (r) => r.status === 200,
    "courses has RateLimit header": (r) => r.headers["X-Ratelimit-Limit"] !== undefined,
  });

  const resBanners = http.get(`${BASE_URL}/api/banners?placement=web`);
  check(resBanners, {
    "banners status is 200": (r) => r.status === 200,
  });

  const resCategories = http.get(`${BASE_URL}/api/categories`);
  check(resCategories, {
    "categories status is 200": (r) => r.status === 200,
  });

  sleep(1);
}

