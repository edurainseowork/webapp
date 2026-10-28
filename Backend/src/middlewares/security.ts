import type { Request, Response, NextFunction } from "express";
import type { CorsOptions } from "cors";
import { perfMetrics } from "../lib/perfEngine.ts";

const isProduction = process.env.NODE_ENV === "production";

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  // Thumbnails are rendered by the CMS (another origin) and the mobile app.
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

/** JSON API responses never need to load anything. Public GET routes override Cache-Control. */
export function apiContentSecurityPolicy(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  if (!res.getHeader("Cache-Control")) {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
}

/**
 * CORS_ORIGINS is a comma-separated allow-list, e.g. "https://cms.edurain.in".
 * Native mobile requests send no Origin header and are always allowed (CORS is a
 * browser control; real protection is the bearer token). Without CORS_ORIGINS,
 * every origin is allowed in development and none in production.
 */
export function corsOptions(): CorsOptions {
  const allowList = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowList.includes("*") || allowList.includes(origin)) return callback(null, true);
      if (!isProduction && allowList.length === 0) return callback(null, true);
      return callback(null, false);
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  };
}

export interface RateLimitOptions {
  windowMs: number;
  max?: number;
  limit?: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

/**
 * Sliding-window / bucket rate limiter with standard RateLimit-* and Retry-After headers.
 * Supports IP-based and User-based (`keyGenerator`) budgets.
 */
export function rateLimit(opts: RateLimitOptions) {
  const maxAllowed = opts.limit ?? opts.max ?? 100;
  const { windowMs, keyGenerator, message } = opts;
  const hits = new Map<string, { timestamps: number[]; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const windowStart = now - windowMs;
    const key = keyGenerator ? keyGenerator(req) : (req.ip ?? "unknown");

    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { timestamps: [], resetAt: now + windowMs };
      hits.set(key, entry);
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      }
    }

    // Sliding window filter: keep only requests within the active windowMs
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    if (entry.timestamps.length >= maxAllowed) {
      perfMetrics.rateLimitBlocks += 1;
      const oldestInWindow = entry.timestamps[0] ?? now;
      const retryAfterSec = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      res.setHeader("RateLimit-Limit", String(maxAllowed));
      res.setHeader("RateLimit-Remaining", "0");
      res.setHeader("RateLimit-Reset", String(retryAfterSec));
      res.status(429).json({
        error: message || "Too many requests, please try again later",
        retryAfter: retryAfterSec,
      });
      return;
    }

    entry.timestamps.push(now);
    entry.resetAt = now + windowMs;
    res.setHeader("RateLimit-Limit", String(maxAllowed));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, maxAllowed - entry.timestamps.length)));
    next();
  };
}

/**
 * Backpressure & Load Shedding Middleware (Reel 2: "1,000 IN • 100 OUT").
 * Protects Node.js and PostgreSQL from unbounded in-flight request accumulation and OOM crashes.
 */
export function backpressureGuard(options?: { maxConcurrent?: number }) {
  const maxConcurrent = options?.maxConcurrent ?? 400;
  let activeInFlight = 0;

  return (_req: Request, res: Response, next: NextFunction) => {
    if (activeInFlight >= maxConcurrent) {
      perfMetrics.backpressureSheds += 1;
      res.setHeader("Retry-After", "10");
      res.status(503).json({
        error: "Server is at capacity (backpressure load shedding active). Please retry shortly.",
        retryAfter: 10,
      });
      return;
    }

    activeInFlight += 1;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        activeInFlight = Math.max(0, activeInFlight - 1);
      }
    };

    res.on("finish", release);
    res.on("close", release);
    next();
  };
}
