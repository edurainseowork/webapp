import crypto from "crypto";

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

interface UserDailyUsage {
  date: string; // YYYY-MM-DD in UTC/IST
  questionsUsed: number;
  activeSeconds: number;
  lastHeartbeat: number;
}

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

class HybridQuotaTracker {
  private usage = new Map<string, UserDailyUsage>();

  private getTodayString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getUserRecord(userId: string | number): UserDailyUsage {
    const key = String(userId);
    const today = this.getTodayString();
    let record = this.usage.get(key);

    if (!record || record.date !== today) {
      record = {
        date: today,
        questionsUsed: 0,
        activeSeconds: 0,
        lastHeartbeat: Date.now(),
      };
      this.usage.set(key, record);
    }

    return record;
  }

  getUserQuota(userId: string | number): UserQuotaStatus {
    const record = this.getUserRecord(userId);
    const minutesUsed = Math.floor(record.activeSeconds / 60);

    const questionsLeft = Math.max(0, DAILY_QUESTION_LIMIT - record.questionsUsed);
    const minutesLeft = Math.max(0, DAILY_MINUTES_LIMIT - minutesUsed);

    const questionsExhausted = questionsLeft <= 0;
    const timeExhausted = minutesLeft <= 0;

    const isAllowed = !questionsExhausted && !timeExhausted;
    let reason: string | null = null;

    if (questionsExhausted) {
      reason = `Aapka daily limit (${DAILY_QUESTION_LIMIT} questions) pura ho gaya hai. Kal naye doubts unlock honge.`;
    } else if (timeExhausted) {
      reason = `Aapka daily 1 hour study limit pura ho gaya hai. Kal naye doubts unlock honge.`;
    }

    return {
      isAllowed,
      reason,
      questionsUsed: record.questionsUsed,
      questionsLimit: DAILY_QUESTION_LIMIT,
      questionsLeft,
      minutesUsed,
      minutesLimit: DAILY_MINUTES_LIMIT,
      minutesLeft,
    };
  }

  consumeQuestion(userId: string | number): { success: boolean; quota: UserQuotaStatus } {
    const quota = this.getUserQuota(userId);
    if (!quota.isAllowed) {
      return { success: false, quota };
    }

    const record = this.getUserRecord(userId);
    record.questionsUsed += 1;
    return { success: true, quota: this.getUserQuota(userId) };
  }

  recordHeartbeat(userId: string | number, secondsToAdd = 30): UserQuotaStatus {
    const record = this.getUserRecord(userId);
    const now = Date.now();

    // Prevent abuse: heartbeat must not be called faster than every 10 seconds
    const diffMs = now - record.lastHeartbeat;
    if (diffMs >= 8000) {
      record.activeSeconds += Math.min(secondsToAdd, Math.floor(diffMs / 1000));
      record.lastHeartbeat = now;
    }

    return this.getUserQuota(userId);
  }
}

export const hybridQuotaTracker = new HybridQuotaTracker();
