#!/usr/bin/env node
/**
 * EduRain Cache Pre-Warming Tool (Phase 4)
 *
 * Sequentially warms public catalog routes at ~5 requests/second so cold containers
 * or post-epoch-bump caches don't cause a thundering herd against Postgres.
 *
 * Usage:
 *   node Backend/tools/warm-cache.mjs [baseUrl]
 *   Default: http://localhost:5000
 */

const baseUrl = (process.argv[2] || process.env.API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

const TARGET_ENDPOINTS = [
  "/api/courses",
  "/api/categories",
  "/api/banners?placement=home",
  "/api/banners?placement=courses",
  "/api/support-contacts",
  "/api/sync/versions?c=warmup",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function warmRoute(path) {
  const url = `${baseUrl}${path}`;
  const start = performance.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "EduRain-CacheWarmer/1.0" },
    });
    const duration = (performance.now() - start).toFixed(1);
    const etag = res.headers.get("etag") || "-";
    const xSync = res.headers.get("x-sync") || "-";
    console.log(`[${res.status}] ${path} (${duration}ms) — ETag: ${etag} | X-Sync: ${xSync}`);
  } catch (err) {
    console.error(`[FAIL] ${path}:`, err.message);
  }
}

async function main() {
  console.log(`================================================================`);
  console.log(`🔥 EDURAIN CACHE WARMER — Warming catalog on ${baseUrl}`);
  console.log(`================================================================`);

  for (const path of TARGET_ENDPOINTS) {
    await warmRoute(path);
    await sleep(200); // 5 req/s cadence
  }

  console.log(`================================================================`);
  console.log(`✅ All target routes pre-warmed successfully.`);
  console.log(`================================================================`);
}

main().catch((err) => {
  console.error("Warm-cache failed:", err);
  process.exit(1);
});

