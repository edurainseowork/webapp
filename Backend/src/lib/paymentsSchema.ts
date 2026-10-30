import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { ensureMentorshipSchema } from "./mentorshipSchema";
import { logger } from "./logger";

// Tables and indexes the payment flow needs. Created the first time they are used (same idea as
// mentorshipSchema.ts), and every statement is safe to run again. Also in shared/db/migrations/0013_payments_hardening.sql.
const STATEMENTS = [
  // What happened to each order, in order: the answer to "why is this student's payment stuck?"
  sql`CREATE TABLE IF NOT EXISTS payment_events (
        id bigserial PRIMARY KEY,
        razorpay_order_id text NOT NULL,
        event text NOT NULL,
        source text NOT NULL,
        detail jsonb,
        created_at timestamptz NOT NULL DEFAULT now())`,
  sql`CREATE INDEX IF NOT EXISTS payment_events_order_idx ON payment_events (razorpay_order_id, id)`,
  // One row per Razorpay webhook delivery (x-razorpay-event-id): Razorpay sends at least once, so repeats are dropped here
  sql`CREATE TABLE IF NOT EXISTS webhook_events (
        event_id text PRIMARY KEY,
        event text NOT NULL,
        razorpay_order_id text,
        razorpay_payment_id text,
        received_at timestamptz NOT NULL DEFAULT now(),
        processed_at timestamptz)`,
  // The sweeper looks for old open orders
  sql`CREATE INDEX IF NOT EXISTS payments_status_created_idx ON payments (status, created_at)`,
  sql`CREATE INDEX IF NOT EXISTS payments_payment_id_idx ON payments (razorpay_payment_id)`,
];

async function createUniqueRules() {
  // One open (unpaid) order per student and course: a second click gets the same order, so nobody pays twice.
  const { rows } = await db.execute<{ found: number }>(sql`SELECT 1 AS found FROM pg_indexes WHERE indexname = 'payments_one_open_order'`);
  if (!rows.length) {
    // Orders left open by the old flow (a new one per click) are closed, newest kept. A late payment on one still unlocks the course.
    await db.execute(sql`
      UPDATE payments p SET status = 'expired', updated_at = now()
      WHERE p.status = 'created'
        AND EXISTS (SELECT 1 FROM payments q WHERE q.user_id = p.user_id AND q.course_id = p.course_id AND q.status = 'created' AND q.id > p.id)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS payments_one_open_order ON payments (user_id, course_id) WHERE status = 'created'`);
  }
  // A student owns a course once. This can fail if duplicate rows already exist: nothing is deleted automatically.
  try {
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS user_courses_user_course_uq ON user_courses (user_id, course_id)`);
  } catch (err) {
    logger.warn({ err }, "user_courses has duplicate (user, course) rows, so the unique rule was not created. See the cleanup query in shared/db/migrations/0013_payments_hardening.sql");
  }
}

let ready: Promise<void> | null = null;

/** Resolves once the payment tables and rules exist. Retries on the next call if it failed. */
export function ensurePaymentsSchema(): Promise<void> {
  return (ready ??= (async () => {
    await ensureMentorshipSchema(); // payment_plans lives there
    for (const statement of STATEMENTS) {
      try {
        await db.execute(statement);
      } catch (err) {
        // Two servers starting at once can race on CREATE ... IF NOT EXISTS; the other one won
        const code = (err as { code?: string; cause?: { code?: string } }).code ?? (err as { cause?: { code?: string } }).cause?.code;
        if (code !== "23505" && code !== "42P07" && code !== "42701") throw err;
      }
    }
    await createUniqueRules();
  })().catch((err: unknown) => {
    ready = null;
    throw err;
  }));
}
