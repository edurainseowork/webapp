import { inArray, sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { pushTokensTable } from "@workspace/db/schema";
import { logger } from "./logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100; // Expo accepts at most 100 messages per request

export type PushMessage = {
  title: string;
  body: string;
  imageUrl?: string | null;
  data?: Record<string, unknown>;
};

type ExpoTicket = { status: "ok" | "error"; id?: string; message?: string; details?: { error?: string } };

// Expo delivers at most 600 notifications per second per project, and a web request on Lambda (API Gateway)
// ends after 30 s, so a big audience can't be sent inside the request: 20,000 devices take ~35 s at best.
// Up to SEND_NOW devices go out right away; more are queued in push_outbox and sent by the scheduled "push"
// job (serverless.yml, every minute) at Expo's pace. A long-running server sends everything right away.
const SEND_NOW = 500;
const PER_SECOND_BATCHES = 6; // 6 x 100 = Expo's 600 per second
let outboxReady: Promise<unknown> | null = null;
const ensureOutbox = () =>
  (outboxReady ??= db
    .execute(
      sql`CREATE TABLE IF NOT EXISTS push_outbox (
            id bigserial PRIMARY KEY,
            tokens text[] NOT NULL,
            message jsonb NOT NULL,
            attempts integer NOT NULL DEFAULT 0,
            claimed_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT now())`,
    )
    .catch((err) => {
      outboxReady = null;
      throw err;
    }));

/** One request to Expo for up to 100 devices. ok=false when the request itself failed (worth retrying). */
async function sendBatch(batch: string[], message: PushMessage): Promise<{ ok: boolean; sent: number; failed: number; stale: string[] }> {
  const payload = batch.map((to) => ({
    to,
    title: message.title,
    body: message.body,
    sound: "default",
    priority: "high",
    channelId: "default",
    data: message.data ?? {},
    ...(message.imageUrl ? { richContent: { image: message.imageUrl } } : {}),
  }));
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        // Only needed if "Enhanced push security" is enabled for the Expo project
        ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: ExpoTicket[]; errors?: unknown };
    if (!res.ok || !Array.isArray(json.data)) {
      logger.error({ status: res.status, errors: json.errors }, "Expo push request failed");
      return { ok: false, sent: 0, failed: batch.length, stale: [] };
    }
    let sent = 0;
    const stale: string[] = [];
    json.data.forEach((ticket, index) => {
      if (ticket.status === "ok") sent++;
      else if (ticket.details?.error === "DeviceNotRegistered") stale.push(batch[index]);
      else logger.warn({ error: ticket.details?.error, message: ticket.message }, "Expo push ticket error");
    });
    return { ok: true, sent, failed: batch.length - sent, stale };
  } catch (err) {
    logger.error({ err }, "Expo push request errored");
    return { ok: false, sent: 0, failed: batch.length, stale: [] };
  }
}

const deleteStale = async (stale: string[]) => {
  if (stale.length > 0) await db.delete(pushTokensTable).where(inArray(pushTokensTable.token, stale));
};

/**
 * Sends one notification to many devices through the Expo Push Service (which delivers via FCM on
 * Android and APNs on iOS), so it arrives even when the app is in the background or closed.
 * Tokens Expo reports as no longer registered (app uninstalled) are deleted.
 * A big audience on Lambda is queued instead: `sent` then counts the devices queued for delivery.
 */
export async function sendExpoPush(tokens: string[], message: PushMessage): Promise<{ sent: number; failed: number }> {
  const uniqueTokens = [...new Set(tokens)];
  if (uniqueTokens.length > SEND_NOW && process.env.AWS_LAMBDA_FUNCTION_NAME) {
    await ensureOutbox();
    // 2,000 tokens per row (20 batches): one statement per row stays far below Postgres' 65,535 values
    for (let i = 0; i < uniqueTokens.length; i += 2000) {
      // pg sends a JS array as one Postgres array (drizzle's sql`` would spread it into separate values)
      await pool.query('INSERT INTO push_outbox (tokens, message) VALUES ($1, $2)', [uniqueTokens.slice(i, i + 2000), JSON.stringify(message)]);
    }
    logger.info({ queued: uniqueTokens.length }, "Push queued for the push job");
    return { sent: uniqueTokens.length, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const stale: string[] = [];
  for (let i = 0; i < uniqueTokens.length; i += BATCH_SIZE) {
    const result = await sendBatch(uniqueTokens.slice(i, i + BATCH_SIZE), message);
    sent += result.sent;
    failed += result.failed;
    stale.push(...result.stale);
  }
  await deleteStale(stale);
  return { sent, failed };
}

/**
 * The scheduled "push" job: sends queued notifications for up to `budgetMs`, at most 600 per second.
 * The job runs every minute, so 45 s keeps two runs from overlapping (together they would send twice as
 * fast as Expo allows); that is ~27,000 devices a minute. Rows are claimed with SKIP LOCKED, so two runs
 * never send the same row; a row claimed by a run that crashed is picked up again after 10 minutes, and a
 * row that keeps failing is dropped after 3 tries.
 */
export async function runPushOutbox(budgetMs = 45_000): Promise<{ sent: number; failed: number }> {
  await ensureOutbox();
  const deadline = Date.now() + budgetMs;
  let sent = 0;
  let failed = 0;
  while (Date.now() < deadline) {
    const { rows } = await db.execute<{ id: string; tokens: string[]; message: PushMessage; attempts: number }>(sql`
      UPDATE push_outbox SET claimed_at = now(), attempts = attempts + 1
       WHERE id = (SELECT id FROM push_outbox
                    WHERE claimed_at IS NULL OR claimed_at < now() - interval '10 minutes'
                    ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED)
       RETURNING id, tokens, message, attempts`);
    const row = rows[0];
    if (!row) break;
    const left: string[] = [];
    for (let i = 0; i < row.tokens.length; i += BATCH_SIZE * PER_SECOND_BATCHES) {
      const started = Date.now();
      const batches: string[][] = [];
      for (let j = i; j < Math.min(i + BATCH_SIZE * PER_SECOND_BATCHES, row.tokens.length); j += BATCH_SIZE) {
        batches.push(row.tokens.slice(j, j + BATCH_SIZE));
      }
      const results = await Promise.all(batches.map((batch) => sendBatch(batch, row.message)));
      results.forEach((result, k) => {
        sent += result.sent;
        failed += result.ok ? result.failed : 0;
        if (!result.ok) left.push(...batches[k]);
      });
      await deleteStale(results.flatMap((result) => result.stale));
      const wait = 1000 - (Date.now() - started);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    }
    if (left.length > 0 && row.attempts < 3) {
      // Expo or the network failed for some batches: keep only those, try again on a later run
      await pool.query('UPDATE push_outbox SET tokens = $1, claimed_at = NULL WHERE id = $2', [left, row.id]);
    } else {
      if (left.length > 0) {
        failed += left.length;
        logger.error({ id: row.id, devices: left.length }, "Push dropped after 3 tries");
      }
      await db.execute(sql`DELETE FROM push_outbox WHERE id = ${row.id}`);
    }
  }
  return { sent, failed };
}
