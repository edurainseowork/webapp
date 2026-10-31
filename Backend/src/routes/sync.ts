import { Router, type IRouter } from "express";
import { getVersion } from "../lib/perfEngine";

const router: IRouter = Router();

// ponytail: kul 11 domains, ek MGET, 1s memo. Koi DB nahi, koi auth nahi, koi PII nahi.
export const SYNC_DOMAINS = {
  courses: "edurain:courses",
  categories: "edurain:categories",
  banners: "edurain:banners",
  faqs: "edurain:faqs",
  support: "edurain:support",
  coupons: "edurain:coupons",
  live: "edurain:live-classes",
  content: "edurain:content",
  tests: "edurain:tests",
  ebooks: "edurain:ebooks",
  notif: "edurain:notif",
} as const;

export type SyncDomainKey = keyof typeof SYNC_DOMAINS;

// Lightweight in-memory rate limiter for /sync:
// Client ID (?c=): 30/min per c
// Missing/invalid c: 20,000/min per IP
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const clientBuckets = new Map<string, RateLimitBucket>();
const ipBuckets = new Map<string, RateLimitBucket>();

function checkSyncRateLimit(clientId: string, ip: string): boolean {
  const now = Date.now();

  // Periodic pruning of expired buckets (at most once every 30s)
  if (clientBuckets.size > 20_000 || ipBuckets.size > 5_000) {
    for (const [k, b] of clientBuckets) {
      if (now > b.resetAt) clientBuckets.delete(k);
    }
    for (const [k, b] of ipBuckets) {
      if (now > b.resetAt) ipBuckets.delete(k);
    }
  }

  if (clientId) {
    let b = clientBuckets.get(clientId);
    if (!b || now > b.resetAt) {
      b = { count: 1, resetAt: now + 60_000 };
      clientBuckets.set(clientId, b);
      return true;
    }
    b.count += 1;
    return b.count <= 30;
  }

  // Fallback to IP with large 20,000/min cap for large NAT environments
  let b = ipBuckets.get(ip);
  if (!b || now > b.resetAt) {
    b = { count: 1, resetAt: now + 60_000 };
    ipBuckets.set(ip, b);
    return true;
  }
  b.count += 1;
  return b.count <= 20_000;
}

function hashClientId(cid: string): number {
  let hash = 0;
  for (let i = 0; i < cid.length; i++) {
    hash = (hash << 5) - hash + cid.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// 1-second memo for version dictionary across all 11 domains
let cachedVersions: Record<string, number | string> = {};
let cachedHash = "00000000";
let versionsMemoExpiry = 0;

function computeFnvHex(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export async function fetchAllVersions(): Promise<Record<string, number | string>> {
  const now = Date.now();
  if (now < versionsMemoExpiry && Object.keys(cachedVersions).length > 0) {
    return cachedVersions;
  }

  const v: Record<string, number | string> = {};
  const entries = Object.entries(SYNC_DOMAINS);
  const versions = await Promise.all(entries.map(([, scope]) => getVersion(scope)));
  entries.forEach(([dom], i) => {
    v[dom] = versions[i];
  });

  cachedVersions = v;
  cachedHash = computeFnvHex(JSON.stringify(v));
  versionsMemoExpiry = now + 1000;
  return v;
}

/** Synchronous helper returning latest 8-hex version hash for X-Sync response header */
export function getSyncHash(): string {
  // Fire background refresh if expired
  if (Date.now() >= versionsMemoExpiry) {
    void fetchAllVersions().catch(() => {});
  }
  return cachedHash;
}

// GET /api/sync/versions?c=<clientId>
router.get("/versions", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  const clientId = String(req.query.c || "").trim();
  const clientIp = req.ip || req.socket.remoteAddress || "127.0.0.1";

  if (!checkSyncRateLimit(clientId, clientIp)) {
    res.setHeader("Retry-After", "2");
    return res.status(429).json({ error: "Too many sync requests" });
  }

  const syncEnabled = process.env.SYNC_ENABLED !== "false";
  const defaultInterval = Math.max(5, Number(process.env.SYNC_NEXT_SECONDS || 15));
  const rolloutPercent = Math.min(100, Math.max(0, Number(process.env.SYNC_ROLLOUT_PERCENT || 100)));

  const isRolledOut =
    rolloutPercent >= 100 || (clientId ? hashClientId(clientId) % 100 < rolloutPercent : true);

  if (!syncEnabled || !isRolledOut) {
    return res.json({
      enabled: false,
      next: 300,
      t: Date.now(),
      v: {},
    });
  }

  const v = await fetchAllVersions();

  res.json({
    enabled: true,
    next: defaultInterval,
    t: Date.now(),
    v,
  });
});

export default router;
