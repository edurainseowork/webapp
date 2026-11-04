import crypto from "crypto";
import { pool } from "@workspace/db";

/* ------------------------------------------------------------------ */
/*  1. IN-MEMORY LRU CACHE FOR EXACT PROMPTS                          */
/* ------------------------------------------------------------------ */

interface CacheEntry {
  answer: string;
  createdAt: number;
}

class InMemoryLruCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize = 5000, ttlHours = 48) {
    this.maxSize = maxSize;
    this.ttlMs = ttlHours * 60 * 60 * 1000;
  }

  static hashPrompt(prompt: string): string {
    const normalized = prompt.trim().toLowerCase().replace(/\s+/g, " ");
    return crypto.createHash("sha256").update(normalized).digest("hex");
  }

  get(hash: string): string | null {
    const entry = this.cache.get(hash);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(hash);
      return null;
    }

    // Refresh LRU order (delete & re-insert)
    this.cache.delete(hash);
    this.cache.set(hash, entry);
    return entry.answer;
  }

  set(hash: string, answer: string): void {
    if (this.cache.has(hash)) {
      this.cache.delete(hash);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest item
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(hash, {
      answer,
      createdAt: Date.now(),
    });
  }

  size(): number {
    return this.cache.size;
  }
}

export const aiCache = new InMemoryLruCache();

/* ------------------------------------------------------------------ */
/*  2. HYBRID RATE LIMITER (30 Questions / Day AND 1 Hour / Day)      */
/* ------------------------------------------------------------------ */

export const DAILY_QUESTION_LIMIT = 30;
export const DAILY_MINUTES_LIMIT = 60;

export interface UserQuotaStatus {
  isAllowed: boolean;
  reason: string | null;
  questionsUsed: number;
  questionsLimit: number;
  questionsLeft: number;
  minutesUsed: number;
  minutesLimit: number;
  minutesLeft: number;
}

// Counts live in Postgres (one row per student per IST day), so every Lambda instance sees the
// same numbers and leaving the screen or a cold start never resets them. Resets at midnight IST.
const QUOTA_TIME_ZONE = process.env.APP_TIME_ZONE || "Asia/Kolkata";
const DAILY_SECONDS_LIMIT = DAILY_MINUTES_LIMIT * 60;

let tableReady: Promise<void> | null = null;
const ensureQuotaTable = () =>
  (tableReady ??= pool
    .query(`
      CREATE TABLE IF NOT EXISTS ai_daily_usage (
        user_key VARCHAR(64) NOT NULL,
        usage_day DATE NOT NULL,
        questions_used INTEGER NOT NULL DEFAULT 0,
        active_seconds INTEGER NOT NULL DEFAULT 0,
        last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_key, usage_day)
      )`)
    .then(() => undefined)
    .catch((err) => {
      // Two Lambdas creating the table at the same moment: the loser gets one of these; the table exists
      if (err?.code === "23505" || err?.code === "42P07") return;
      tableReady = null;
      throw err;
    }));

const TODAY = `(NOW() AT TIME ZONE $2)::date`;

export function quotaStatus(questionsUsed: number, activeSeconds: number): UserQuotaStatus {
  const minutesUsed = Math.floor(activeSeconds / 60);
  const questionsLeft = Math.max(0, DAILY_QUESTION_LIMIT - questionsUsed);
  const minutesLeft = Math.max(0, DAILY_MINUTES_LIMIT - minutesUsed);

  let reason: string | null = null;
  if (questionsLeft <= 0) {
    reason = `Aapka daily limit (${DAILY_QUESTION_LIMIT} questions) pura ho gaya hai. Kal naye doubts unlock honge.`;
  } else if (minutesLeft <= 0) {
    reason = `Aapka daily 1 hour study limit pura ho gaya hai. Kal naye doubts unlock honge.`;
  }

  return {
    isAllowed: reason === null,
    reason,
    questionsUsed,
    questionsLimit: DAILY_QUESTION_LIMIT,
    questionsLeft,
    minutesUsed,
    minutesLimit: DAILY_MINUTES_LIMIT,
    minutesLeft,
  };
}

export const hybridQuotaTracker = {
  async getUserQuota(userId: string | number): Promise<UserQuotaStatus> {
    await ensureQuotaTable();
    const { rows } = await pool.query(
      `SELECT questions_used, active_seconds FROM ai_daily_usage WHERE user_key = $1 AND usage_day = ${TODAY}`,
      [String(userId), QUOTA_TIME_ZONE],
    );
    return quotaStatus(rows[0]?.questions_used ?? 0, rows[0]?.active_seconds ?? 0);
  },

  /** Takes one question if the student has any left today. Safe when two requests race. */
  async consumeQuestion(userId: string | number): Promise<{ success: boolean; quota: UserQuotaStatus }> {
    await ensureQuotaTable();
    const { rows } = await pool.query(
      `INSERT INTO ai_daily_usage (user_key, usage_day, questions_used) VALUES ($1, ${TODAY}, 1)
       ON CONFLICT (user_key, usage_day) DO UPDATE SET questions_used = ai_daily_usage.questions_used + 1
       WHERE ai_daily_usage.questions_used < $3 AND ai_daily_usage.active_seconds < $4
       RETURNING questions_used, active_seconds`,
      [String(userId), QUOTA_TIME_ZONE, DAILY_QUESTION_LIMIT, DAILY_SECONDS_LIMIT],
    );
    if (!rows[0]) return { success: false, quota: await this.getUserQuota(userId) };
    return { success: true, quota: quotaStatus(rows[0].questions_used, rows[0].active_seconds) };
  },

  /** Adds active study time; heartbeats closer than 8 s apart are ignored. */
  async recordHeartbeat(userId: string | number, secondsToAdd = 30): Promise<UserQuotaStatus> {
    await ensureQuotaTable();
    await pool.query(
      `INSERT INTO ai_daily_usage (user_key, usage_day) VALUES ($1, ${TODAY})
       ON CONFLICT (user_key, usage_day) DO UPDATE SET
         active_seconds = ai_daily_usage.active_seconds
           + LEAST($3, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM NOW() - ai_daily_usage.last_heartbeat)))::int),
         last_heartbeat = NOW()
       WHERE NOW() - ai_daily_usage.last_heartbeat >= INTERVAL '8 seconds'`,
      [String(userId), QUOTA_TIME_ZONE, secondsToAdd],
    );
    return this.getUserQuota(userId);
  },
};
