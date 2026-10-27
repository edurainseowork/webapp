import { logger } from "./logger.js";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export interface ModerationDecision {
  isLocked: boolean;
  strikeCount: number;
  lockoutUntil: number | null;
  statusCode: 200 | 400 | 403;
  action: 'CLEAN' | 'WARN_1' | 'WARN_2' | 'LOCKED_24H';
  message: string;
}

interface StrikeState {
  strikeCount: number;
  lastStrikeAt: number;
  lockoutUntil: number | null;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000; // 72 Hours clean activity auto-resets strikes

// In-memory fast cache with DB sync
const userModerationStore = new Map<string, StrikeState>();

let dbTablesEnsured = false;
export async function ensureModerationDbTables(): Promise<void> {
  if (dbTablesEnsured) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_user_moderation (
        user_id VARCHAR(64) PRIMARY KEY,
        strike_count INT NOT NULL DEFAULT 0,
        last_strike_at TIMESTAMPTZ,
        lockout_until TIMESTAMPTZ,
        total_bans_count INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_moderation_audit_log (
        id BIGSERIAL PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        student_name VARCHAR(128),
        blocked_text TEXT NOT NULL,
        matched_token VARCHAR(64),
        strike_number INT NOT NULL,
        action_taken VARCHAR(32) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    dbTablesEnsured = true;
  } catch (err) {
    logger.warn({ err }, "Could not ensure ai_user_moderation tables, using robust in-memory fallback");
  }
}

/**
 * Fires Slack alert to configured webhook when 24h lockout or severe threat occurs.
 */
export async function sendSlackBanAlert(payload: {
  userId: string;
  studentName?: string;
  offendingText: string;
  matchedToken: string | null;
  lockoutUntil: number;
}): Promise<void> {
  const webhook = process.env.ALERT_WEBHOOK_URL || process.env.SLACK_MODERATION_WEBHOOK_URL;
  if (!webhook) return;

  const untilStr = new Date(payload.lockoutUntil).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🚨 *EduRain AI Mentor 24-Hour Account Lockout Triggered*\n• *Student ID:* \`${payload.userId}\` (${payload.studentName || 'Student'})\n• *Violation Token:* \`${payload.matchedToken || 'Violent Threat'}\`\n• *Raw Input:* "${payload.offendingText.slice(0, 100)}"\n• *Locked Until:* ${untilStr} IST\n• *Status:* HTTP 403 Forbidden active on AI Mentor.`,
      }),
    });
  } catch (err) {
    logger.error({ err }, "Failed to send Slack moderation ban alert");
  }
}

/**
 * Check if the user is currently locked out of AI Mentor.
 */
export async function checkUserLockStatus(userId: string): Promise<ModerationDecision> {
  const now = Date.now();
  let state = userModerationStore.get(userId);

  // Attempt DB read if missing in-memory
  if (!state) {
    try {
      await ensureModerationDbTables();
      const res: any = await db.execute(
        sql`SELECT strike_count, last_strike_at, lockout_until FROM ai_user_moderation WHERE user_id = ${userId}`
      );
      const rows = res?.rows || res;
      if (Array.isArray(rows) && rows.length > 0) {
        const row = rows[0];
        state = {
          strikeCount: Number(row.strike_count) || 0,
          lastStrikeAt: row.last_strike_at ? new Date(row.last_strike_at).getTime() : 0,
          lockoutUntil: row.lockout_until ? new Date(row.lockout_until).getTime() : null,
        };
        userModerationStore.set(userId, state);
      }
    } catch {
      // Fallback in-memory
    }
  }

  // Active Lockout check
  if (state?.lockoutUntil && state.lockoutUntil > now) {
    const remainingMs = state.lockoutUntil - now;
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      isLocked: true,
      strikeCount: state.strikeCount,
      lockoutUntil: state.lockoutUntil,
      statusCode: 403,
      action: 'LOCKED_24H',
      message: `Access Suspended: Your AI Mentor access is locked for 24 hours due to community guidelines violation. Time remaining: ${hours}h ${mins}m.`,
    };
  }

  // Lockout expired: auto unlock & reset strikes
  if (state?.lockoutUntil && state.lockoutUntil <= now) {
    state.strikeCount = 0;
    state.lockoutUntil = null;
    userModerationStore.set(userId, state);
    try {
      await db.execute(
        sql`UPDATE ai_user_moderation SET strike_count = 0, lockout_until = NULL, updated_at = NOW() WHERE user_id = ${userId}`
      );
    } catch {
      // safe
    }
  }

  // 72 Hours Clean activity: auto strike decay
  if (state && state.lastStrikeAt > 0 && now - state.lastStrikeAt > SEVENTY_TWO_HOURS_MS) {
    state.strikeCount = 0;
    userModerationStore.set(userId, state);
    try {
      await db.execute(
        sql`UPDATE ai_user_moderation SET strike_count = 0, updated_at = NOW() WHERE user_id = ${userId}`
      );
    } catch {
      // safe
    }
  }

  return {
    isLocked: false,
    strikeCount: state?.strikeCount || 0,
    lockoutUntil: null,
    statusCode: 200,
    action: 'CLEAN',
    message: '',
  };
}

/**
 * Issue a moderation strike when abuse or profanity is detected.
 * Strike 1 -> Warning 1/2
 * Strike 2 -> Final Warning 2/2
 * Strike 3 or Severe Threat -> 24-Hour Account Lockout + Slack Alert
 */
export async function issueModerationStrike(params: {
  userId: string;
  studentName?: string;
  rawInput: string;
  matchedToken: string | null;
  immediateBan?: boolean;
}): Promise<ModerationDecision> {
  const now = Date.now();
  const current = await checkUserLockStatus(params.userId);
  if (current.isLocked) return current;

  let record = userModerationStore.get(params.userId) || {
    strikeCount: 0,
    lastStrikeAt: 0,
    lockoutUntil: null,
  };

  if (record.lastStrikeAt > 0 && now - record.lastStrikeAt > SEVENTY_TWO_HOURS_MS) {
    record.strikeCount = 0;
  }

  record.strikeCount = params.immediateBan ? 3 : record.strikeCount + 1;
  record.lastStrikeAt = now;

  let decision: ModerationDecision;

  if (record.strikeCount === 1) {
    userModerationStore.set(params.userId, record);
    decision = {
      isLocked: false,
      strikeCount: 1,
      lockoutUntil: null,
      statusCode: 400,
      action: 'WARN_1',
      message: '⚠️ Warning 1/2: Abusive or inappropriate language is strictly prohibited. Please maintain academic discipline.',
    };
  } else if (record.strikeCount === 2) {
    userModerationStore.set(params.userId, record);
    decision = {
      isLocked: false,
      strikeCount: 2,
      lockoutUntil: null,
      statusCode: 400,
      action: 'WARN_2',
      message: '⚠️ Final Warning 2/2: Repeated abusive language detected. One more violation will immediately lock your AI Mentor access for 24 hours.',
    };
  } else {
    // Strike 3 or Immediate Ban
    const lockoutUntil = now + TWENTY_FOUR_HOURS_MS;
    record.strikeCount = 3;
    record.lockoutUntil = lockoutUntil;
    userModerationStore.set(params.userId, record);

    sendSlackBanAlert({
      userId: params.userId,
      studentName: params.studentName,
      offendingText: params.rawInput,
      matchedToken: params.matchedToken,
      lockoutUntil,
    }).catch(() => {});

    decision = {
      isLocked: true,
      strikeCount: 3,
      lockoutUntil,
      statusCode: 403,
      action: 'LOCKED_24H',
      message: '⛔ Access Suspended: Your AI Mentor access is locked for 24 hours due to community guidelines violation. Unlocks in 24 hours.',
    };
  }

  // Persist to DB in background
  (async () => {
    try {
      await ensureModerationDbTables();
      const lastStrikeIso = new Date(record.lastStrikeAt).toISOString();
      const lockoutIso = record.lockoutUntil ? new Date(record.lockoutUntil).toISOString() : null;

      await db.execute(sql`
        INSERT INTO ai_user_moderation (user_id, strike_count, last_strike_at, lockout_until, updated_at)
        VALUES (
          ${params.userId},
          ${record.strikeCount},
          ${lastStrikeIso}::timestamptz,
          ${lockoutIso}::timestamptz,
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          strike_count = EXCLUDED.strike_count,
          last_strike_at = EXCLUDED.last_strike_at,
          lockout_until = EXCLUDED.lockout_until,
          updated_at = NOW()
      `);

      await db.execute(sql`
        INSERT INTO ai_moderation_audit_log (user_id, student_name, blocked_text, matched_token, strike_number, action_taken)
        VALUES (
          ${params.userId},
          ${params.studentName || null},
          ${params.rawInput.slice(0, 500)},
          ${params.matchedToken || 'unknown'},
          ${record.strikeCount},
          ${decision.action}
        )
      `);
    } catch (err) {
      logger.error({ err }, "Could not persist moderation strike to DB");
    }
  })();

  return decision;
}
