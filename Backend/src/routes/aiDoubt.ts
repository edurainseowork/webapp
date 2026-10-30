import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { sendSlackAlert } from "../lib/slackAlert.js";
import { aiCache, hybridQuotaTracker } from "../lib/aiCacheAndQuota.js";
import {
  streamGeminiFlash,
  isGreetingQuery,
  getGreetingResponse,
  isOffTopicQuery,
  getOffTopicResponse,
  type AcademicCohort,
} from "../lib/geminiClient.js";
import { inspectStudentMessage } from "../lib/abuseGuardEngine.js";
import { rateLimit } from "../middlewares/security.js";
import {
  checkUserLockStatus,
  issueModerationStrike,
  ensureModerationDbTables,
} from "../lib/aiModeration.js";

const router = Router();

// Ensure PostgreSQL tables exist for chat and moderation
let tablesChecked = false;
async function ensureAiTables() {
  if (tablesChecked) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_chat_sessions (
        id VARCHAR(64) PRIMARY KEY,
        user_identifier VARCHAR(64) NOT NULL,
        title VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_chat_messages (
        id VARCHAR(64) PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
        role VARCHAR(16) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await ensureModerationDbTables();
    tablesChecked = true;
  } catch (err) {
    logger.warn({ err }, "Could not ensure AI tables, will rely on in-memory stores");
  }
}

/**
 * Resolves the student identifier from auth token, session, or IP
 */
function resolveUserIdentifier(req: any): string {
  if (req.user?.id) return `user_${req.user.id}`;
  if (req.auth?.uid) return `firebase_${req.auth.uid}`;

  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0] : req.socket?.remoteAddress || "local_guest";
  return `guest_${ip.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

/**
 * 1. GET /api/v1/ai/doubt/quota
 * Returns current hybrid quota status (30 questions & 60 mins active time)
 * plus 24-hour moderation lock status.
 */
router.get("/quota", async (req: Request, res: Response) => {
  const userId = resolveUserIdentifier(req);
  const quota = hybridQuotaTracker.getUserQuota(userId);
  const lockStatus = await checkUserLockStatus(userId);

  res.json({
    success: true,
    data: {
      ...quota,
      lockStatus,
    },
  });
});

/**
 * 2. POST /api/v1/ai/moderation/strike
 * Endpoint triggered when client-side pre-send filter detects abusive input
 * or when direct strike sync is requested.
 */
router.post("/moderation/strike", async (req: Request, res: Response) => {
  const userId = resolveUserIdentifier(req);
  const { prompt, matchedToken, studentName } = req.body || {};

  const scan = inspectStudentMessage(prompt || "");
  const decision = await issueModerationStrike({
    userId,
    studentName,
    rawInput: String(prompt || ""),
    matchedToken: matchedToken || scan.matchedToken,
    immediateBan: scan.severity === "SEVERE_THREAT",
  });

  res.status(decision.statusCode).json({
    success: decision.statusCode === 200,
    data: decision,
  });
});

/**
 * 3. POST /api/v1/ai/doubt/heartbeat
 * Logs 30 seconds of active study time to student's 1-hour quota
 */
router.post("/heartbeat", (req: Request, res: Response) => {
  const userId = resolveUserIdentifier(req);
  const quota = hybridQuotaTracker.recordHeartbeat(userId, 30);
  res.json({
    success: true,
    data: quota,
  });
});

/**
 * 4. GET /api/v1/ai/doubt/history
 * Returns the LAST 2 chat sessions with messages for the sidebar
 */
router.get("/history", async (req: Request, res: Response) => {
  await ensureAiTables();
  const userId = resolveUserIdentifier(req);

  try {
    const sessionsRes: any = await db.execute(sql`
      SELECT id, title, created_at, updated_at 
      FROM ai_chat_sessions 
      WHERE user_identifier = ${userId} 
      ORDER BY updated_at DESC 
      LIMIT 2
    `);

    const sessions = sessionsRes?.rows || sessionsRes || [];
    const result = [];

    for (const session of sessions) {
      const messagesRes: any = await db.execute(sql`
        SELECT id, role, content, created_at 
        FROM ai_chat_messages 
        WHERE session_id = ${session.id} 
        ORDER BY created_at ASC
      `);

      const messages = messagesRes?.rows || messagesRes || [];

      result.push({
        id: session.id,
        title: session.title,
        timestamp: new Date(session.updated_at).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        messages: messages.map((m: any) => ({
          id: m.id,
          sender: m.role,
          content: m.content,
          timestamp: new Date(m.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        })),
      });
    }

    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch AI chat history");
    await sendSlackAlert("Database History Fetch Error", err, { userId });
    res.status(500).json({ success: false, error: "Failed to fetch chat history" });
  }
});

/**
 * Helper to stream pre-computed responses (greetings / off-topic / cached answers)
 */
async function streamPrecomputedResponse(
  res: Response,
  sessionId: string,
  userId: string,
  title: string,
  fullText: string,
  quotaData: any
) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  // Send session event
  res.write(`event: session\ndata: ${JSON.stringify({ sessionId, title })}\n\n`);

  const words = fullText.split(" ");
  for (let i = 0; i < words.length; i++) {
    const chunk = (i === 0 ? "" : " ") + words[i];
    res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    await new Promise((r) => setTimeout(r, 14));
  }

  // Save to DB
  try {
    const assistantMsgId = `msg_${crypto.randomUUID().slice(0, 16)}`;
    await db.execute(sql`
      INSERT INTO ai_chat_messages (id, session_id, role, content, created_at)
      VALUES (${assistantMsgId}, ${sessionId}, 'assistant', ${fullText}, NOW())
    `);
  } catch {
    // safe
  }

  res.write(`event: end\ndata: ${JSON.stringify({ quota: quotaData })}\n\n`);
  res.end();
}

/**
 * 5. POST /api/v1/ai/doubt/stream
 * Core Server-Sent Events (SSE) streaming endpoint
 */
const aiStreamLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  keyGenerator: resolveUserIdentifier,
  message: "Too many AI doubt requests per minute. Please wait a moment.",
});

router.post("/stream", aiStreamLimiter, async (req: Request, res: Response) => {
  await ensureAiTables();
  const userId = resolveUserIdentifier(req);
  const { prompt, sessionId, cohort } = req.body || {};

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "Prompt is required." });
    return;
  }

  // 1. Check 24-Hour Moderation Lockout Status
  const lockStatus = await checkUserLockStatus(userId);
  if (lockStatus.isLocked) {
    res.status(403).json({
      error: "Access Suspended",
      message: lockStatus.message,
      lockStatus,
    });
    return;
  }

  // 2. Server-side Anti-Bypass Abuse & Profanity Filter
  const scan = inspectStudentMessage(prompt);
  if (scan.isAbusive) {
    const decision = await issueModerationStrike({
      userId,
      studentName: req.user?.name || req.auth?.name,
      rawInput: prompt,
      matchedToken: scan.matchedToken,
      immediateBan: scan.severity === "SEVERE_THREAT",
    });

    res.status(decision.statusCode).json({
      error: decision.action,
      message: decision.message,
      moderation: decision,
    });
    return;
  }

  const currentSessionId = sessionId || `session_${crypto.randomUUID().slice(0, 16)}`;
  const title = prompt.trim().length > 40 ? prompt.trim().slice(0, 37) + "..." : prompt.trim();

  // Upsert session & user message in DB
  try {
    await db.execute(sql`
      INSERT INTO ai_chat_sessions (id, user_identifier, title, created_at, updated_at)
      VALUES (${currentSessionId}, ${userId}, ${title}, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
    `);

    const userMsgId = `msg_${crypto.randomUUID().slice(0, 16)}`;
    await db.execute(sql`
      INSERT INTO ai_chat_messages (id, session_id, role, content, created_at)
      VALUES (${userMsgId}, ${currentSessionId}, 'user', ${prompt.trim()}, NOW())
    `);
  } catch (dbErr) {
    logger.warn({ dbErr }, "Could not record user chat turn to DB");
  }

  const currentQuota = hybridQuotaTracker.getUserQuota(userId);

  // 3. ZERO-QUOTA ROUTE: Greetings ("hi", "hello", "namaste")
  if (isGreetingQuery(prompt)) {
    const greetingText = getGreetingResponse();
    await streamPrecomputedResponse(res, currentSessionId, userId, title, greetingText, currentQuota);
    return;
  }

  // 4. ZERO-QUOTA ROUTE: Off-topic / Casual chit-chat
  if (isOffTopicQuery(prompt)) {
    const offTopicText = getOffTopicResponse();
    await streamPrecomputedResponse(res, currentSessionId, userId, title, offTopicText, currentQuota);
    return;
  }

  // 5. Consume Question Quota for legitimate academic query
  const quotaCheck = hybridQuotaTracker.consumeQuestion(userId);
  if (!quotaCheck.success) {
    res.status(429).json({
      error: "Quota Exceeded",
      message: quotaCheck.quota.reason,
      quota: quotaCheck.quota,
    });
    return;
  }

  // 6. Check Exact-Match LRU Cache
  const promptHash = (aiCache.constructor as any).hashPrompt(prompt);
  const cachedResponse = aiCache.get(promptHash);
  if (cachedResponse) {
    await streamPrecomputedResponse(res, currentSessionId, userId, title, cachedResponse, quotaCheck.quota);
    return;
  }

  // 7. Setup Live SSE Streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  res.write(`event: session\ndata: ${JSON.stringify({ sessionId: currentSessionId, title })}\n\n`);

  try {
    const prevMessagesRes: any = await db.execute(sql`
      SELECT role, content FROM ai_chat_messages 
      WHERE session_id = ${currentSessionId} 
      ORDER BY created_at DESC 
      LIMIT 4
    `);
    const rows = prevMessagesRes?.rows || prevMessagesRes || [];
    const history = rows.reverse().map((r: any) => ({
      role: r.role as "user" | "assistant",
      content: r.content as string,
    }));

    await streamGeminiFlash({
      prompt: prompt.trim(),
      cohort: (cohort as AcademicCohort) || "JEE_MAIN_ADV",
      history,
      onChunk: (chunk: string) => {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      },
      onComplete: async (fullText: string) => {
        try {
          aiCache.set(promptHash, fullText);
          const assistantMsgId = `msg_${crypto.randomUUID().slice(0, 16)}`;
          await db.execute(sql`
            INSERT INTO ai_chat_messages (id, session_id, role, content, created_at)
            VALUES (${assistantMsgId}, ${currentSessionId}, 'assistant', ${fullText}, NOW())
          `);

          res.write(`event: end\ndata: ${JSON.stringify({ quota: quotaCheck.quota })}\n\n`);
          res.end();
        } catch (saveErr) {
          logger.error({ err: saveErr }, "Error saving assistant response to DB");
          res.end();
        }
      },
      onError: async (err: any) => {
        logger.error({ err }, "Error during streaming");
        await sendSlackAlert("AI Stream Generation Failure", err, { userId, prompt });
        res.write(`event: error\ndata: ${JSON.stringify({ error: err?.message || "Generation error" })}\n\n`);
        res.end();
      },
    });
  } catch (err: any) {
    logger.error({ err }, "Error processing AI stream request");
    await sendSlackAlert("AI Stream Route Fatal Error", err, { userId, prompt });
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: "Internal server error" })}\n\n`);
      res.end();
    }
  }
});

export default router;
