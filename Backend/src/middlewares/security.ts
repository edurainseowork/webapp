import type { Request, Response, NextFunction } from "express";
import type { CorsOptions } from "cors";
import { getRedisClient, perfMetrics } from "../lib/perfEngine.ts";

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

/**
 * Atomic Redis Lua Token Bucket Script (Sections 28 & 29 of Rate Limiting PRD).
 * Prevents INCR/EXPIRE race conditions in multi-server deployments.
 */
export const LUA_TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(bucket[1]) or capacity
local lastRefill = tonumber(bucket[2]) or now

local elapsed = math.max(0, now - lastRefill)
local refilledTokens = math.floor(elapsed * refillRate)
if refilledTokens > 0 then
  tokens = math.min(capacity, tokens + refilledTokens)
  lastRefill = now
end

if tokens >= 1 then
  tokens = tokens - 1
  redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
  redis.call('PEXPIRE', key, math.ceil((capacity / refillRate) * 1000))
  return { 1, tokens }
end
return { 0, tokens }
`;

export type RateLimitAlgorithm = "token-bucket" | "sliding-window" | "fixed-window" | "leaky-bucket";
export type RateLimitKeyStrategy = "ip" | "user" | "ip+identifier";

export interface RateLimitOptions {
  windowMs: number;
  max?: number;
  limit?: number;
  algorithm?: RateLimitAlgorithm;
  keyStrategy?: RateLimitKeyStrategy;
  keyPrefix?: string;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

function resolveClientIp(req: Request): string {
  return req.ip || (req.socket?.remoteAddress ?? "unknown");
}

function resolveUserKey(req: any): string {
  if (req.user?.id) return `uid:${req.user.id}`;
  if (req.auth?.uid) return `fuid:${req.auth.uid}`;
  return `ip:${resolveClientIp(req)}`;
}

function resolveIdentifierFromBody(req: any): string | null {
  const body = req.body;
  if (!body || typeof body !== "object") return null;
  const raw = body.email || body.phone || body.username || body.identifier;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().toLowerCase();
  }
  return null;
}

function setRateLimitHeaders(
  res: Response,
  limit: number,
  remaining: number,
  resetEpochSeconds: number,
  retryAfterSec?: number
) {
  const safeRemaining = Math.max(0, Math.floor(remaining));
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(safeRemaining));
  res.setHeader("X-RateLimit-Reset", String(resetEpochSeconds));
  res.setHeader("RateLimit-Limit", String(limit));
  res.setHeader("RateLimit-Remaining", String(safeRemaining));
  res.setHeader("RateLimit-Reset", String( Math.max(1, resetEpochSeconds - Math.floor(Date.now() / 1000)) ));
  if (retryAfterSec !== undefined) {
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil(retryAfterSec))));
  }
}

interface BucketState {
  // Fixed Window
  count: number;
  startTime: number;
  // Sliding Window Log
  timestamps: number[];
  // Token Bucket & Leaky Bucket
  tokens: number;
  lastRefillMs: number;
}

/**
 * Multi-Algorithm Production Rate Limiter (PRD Sections 4–32).
 * Supports:
 * - Token Bucket (with Atomic Redis Lua Script + In-Memory fallback)
 * - Sliding Window Log (zero boundary bursts for auth/sensitive endpoints)
 * - Leaky Bucket (constant outflow rate for heavy uploads)
 * - Fixed Window (lightweight counter)
 * - Dual Key Brute-Force Protection (`ip+identifier` checks both IP and Email/Phone)
 */
export function rateLimit(opts: RateLimitOptions) {
  const maxAllowed = opts.limit ?? opts.max ?? 100;
  const {
    windowMs,
    algorithm = "sliding-window",
    keyStrategy = "ip",
    keyPrefix = "rl",
    keyGenerator,
    message,
  } = opts;

  const refillRatePerSec = maxAllowed / (windowMs / 1000);
  const store = new Map<string, BucketState>();

  function evaluateKeyInMemory(key: string, nowMs: number): {
    allowed: boolean;
    remaining: number;
    resetEpochSeconds: number;
    retryAfterSec: number;
  } {
    if (store.size > 15_000 && !store.has(key)) {
      const firstKey = store.keys().next().value;
      if (firstKey !== undefined) store.delete(firstKey);
    }

    let state = store.get(key);
    if (!state) {
      state = {
        count: 0,
        startTime: nowMs,
        timestamps: [],
        tokens: maxAllowed,
        lastRefillMs: nowMs,
      };
      store.set(key, state);
    }

    if (algorithm === "fixed-window") {
      if (nowMs - state.startTime >= windowMs) {
        state.count = 0;
        state.startTime = nowMs;
      }
      const resetMs = state.startTime + windowMs;
      const retryAfterSec = Math.max(1, Math.ceil((resetMs - nowMs) / 1000));
      const resetEpochSeconds = Math.ceil(resetMs / 1000);

      if (state.count >= maxAllowed) {
        return { allowed: false, remaining: 0, resetEpochSeconds, retryAfterSec };
      }
      state.count += 1;
      return {
        allowed: true,
        remaining: maxAllowed - state.count,
        resetEpochSeconds,
        retryAfterSec,
      };
    }

    if (algorithm === "token-bucket" || algorithm === "leaky-bucket") {
      const elapsedSec = Math.max(0, (nowMs - state.lastRefillMs) / 1000);
      const refilled = elapsedSec * refillRatePerSec;
      if (refilled >= 1) {
        state.tokens = Math.min(maxAllowed, state.tokens + Math.floor(refilled));
        state.lastRefillMs = nowMs;
      }

      const secondsUntilNextToken = Math.max(1, Math.ceil(1 / refillRatePerSec));
      const resetEpochSeconds = Math.ceil((nowMs + windowMs) / 1000);

      if (state.tokens < 1) {
        return {
          allowed: false,
          remaining: 0,
          resetEpochSeconds,
          retryAfterSec: secondsUntilNextToken,
        };
      }

      state.tokens -= 1;
      return {
        allowed: true,
        remaining: Math.floor(state.tokens),
        resetEpochSeconds,
        retryAfterSec: secondsUntilNextToken,
      };
    }

    // Default: Sliding Window Log (exact accuracy, zero boundary burst)
    const windowStart = nowMs - windowMs;
    state.timestamps = state.timestamps.filter((ts) => ts > windowStart);

    const oldest = state.timestamps[0] ?? nowMs;
    const resetMs = oldest + windowMs;
    const retryAfterSec = Math.max(1, Math.ceil((resetMs - nowMs) / 1000));
    const resetEpochSeconds = Math.ceil(resetMs / 1000);

    if (state.timestamps.length >= maxAllowed) {
      return { allowed: false, remaining: 0, resetEpochSeconds, retryAfterSec };
    }

    state.timestamps.push(nowMs);
    return {
      allowed: true,
      remaining: maxAllowed - state.timestamps.length,
      resetEpochSeconds,
      retryAfterSec,
    };
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    const nowMs = Date.now();
    const keysToCheck: string[] = [];

    if (keyGenerator) {
      keysToCheck.push(`${keyPrefix}:${keyGenerator(req)}`);
    } else if (keyStrategy === "user") {
      keysToCheck.push(`${keyPrefix}:${resolveUserKey(req)}`);
    } else if (keyStrategy === "ip+identifier") {
      // Section 13 & 14 PRD: Brute-force protection by IP AND Username/Email/Phone
      keysToCheck.push(`${keyPrefix}:ip:${resolveClientIp(req)}`);
      const id = resolveIdentifierFromBody(req);
      if (id) keysToCheck.push(`${keyPrefix}:acct:${id}`);
    } else {
      keysToCheck.push(`${keyPrefix}:ip:${resolveClientIp(req)}`);
    }

    // Try Distributed Redis Lua Token Bucket if Redis client with eval is connected
    const redis = getRedisClient();
    if (redis && typeof (redis as any).eval === "function") {
      try {
        const nowSec = Math.floor(nowMs / 1000);
        for (const k of keysToCheck) {
          const result = (await (redis as any).eval(
            LUA_TOKEN_BUCKET_SCRIPT,
            1,
            k,
            maxAllowed,
            refillRatePerSec,
            nowSec
          )) as [number, number];
          const [allowedFlag, remainingTokens] = result;
          const resetEpoch = nowSec + Math.ceil(windowMs / 1000);
          if (allowedFlag === 0) {
            perfMetrics.rateLimitBlocks += 1;
            const retrySec = Math.max(1, Math.ceil(1 / refillRatePerSec));
            setRateLimitHeaders(res, maxAllowed, 0, resetEpoch, retrySec);
            res.status(429).json({
              error: message || "Too many requests, please try again later",
              retryAfter: retrySec,
            });
            return;
          }
          setRateLimitHeaders(res, maxAllowed, remainingTokens, resetEpoch);
        }
        next();
        return;
      } catch {
        // Section 9 & 10 PRD: Fail open to local in-memory limiter if Redis errors
      }
    }

    // Evaluate all keys in local memory
    let minRemaining = maxAllowed;
    let maxResetEpoch = Math.ceil((nowMs + windowMs) / 1000);

    for (const k of keysToCheck) {
      const verdict = evaluateKeyInMemory(k, nowMs);
      if (!verdict.allowed) {
        perfMetrics.rateLimitBlocks += 1;
        setRateLimitHeaders(res, maxAllowed, 0, verdict.resetEpochSeconds, verdict.retryAfterSec);
        res.status(429).json({
          error: message || "Too many requests, please try again later",
          retryAfter: verdict.retryAfterSec,
        });
        return;
      }
      if (verdict.remaining < minRemaining) minRemaining = verdict.remaining;
      if (verdict.resetEpochSeconds > maxResetEpoch) maxResetEpoch = verdict.resetEpochSeconds;
    }

    setRateLimitHeaders(res, maxAllowed, minRemaining, maxResetEpoch);
    next();
  };
}

/* ========================================================================== */
/*  PRE-CONFIGURED ROUTE-SPECIFIC LIMITERS (Section 16 of Rate Limiting PRD)  */
/* ========================================================================== */

/** 1. Auth & Brute-Force Protection (5 attempts / 60s by IP AND Email/Phone) */
export const authBruteForceLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  algorithm: "sliding-window",
  keyStrategy: "ip+identifier",
  keyPrefix: "rl:auth",
  message: "Too many authentication attempts. Please wait before trying again.",
});

/** 2. Payment & Checkout Protection (20 req / 60s per User/IP — Token Bucket) */
export const paymentRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  algorithm: "token-bucket",
  keyStrategy: "user",
  keyPrefix: "rl:payment",
  message: "Too many payment requests. Please wait a moment before retrying.",
});

/** 3. AI Doubt Solver Protection (10 req / 60s per Student — Token Bucket) */
export const aiRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  algorithm: "token-bucket",
  keyStrategy: "user",
  keyPrefix: "rl:ai",
  message: "AI Mentor rate limit reached (10 queries/min). Please wait a moment.",
});

/** 4. Media & Video Uploads (20 req / 60s — Leaky Bucket constant rate) */
export const uploadLeakyLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  algorithm: "leaky-bucket",
  keyStrategy: "user",
  keyPrefix: "rl:upload",
  message: "Upload rate limit reached. Please wait before uploading more files.",
});

/** 5. Public Catalog Reads (100 req / 60s per IP — Token Bucket) */
export const catalogReadLimiter = rateLimit({
  windowMs: 60_000,
  limit: 100,
  algorithm: "token-bucket",
  keyStrategy: "ip",
  keyPrefix: "rl:catalog",
  message: "Too many catalog requests from this IP, please slow down.",
});

/** 6. Student Write/Action Endpoints (60 req / 60s per User — Token Bucket) */
export const studentActionLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  algorithm: "token-bucket",
  keyStrategy: "user",
  keyPrefix: "rl:student",
  message: "Too many actions per minute. Please slow down.",
});

/** 7. Admin & CMS Portal Operations (120 req / 60s per Admin — Token Bucket) */
export const adminApiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  algorithm: "token-bucket",
  keyStrategy: "user",
  keyPrefix: "rl:admin",
  message: "CMS rate limit exceeded. Please wait a moment.",
});

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
