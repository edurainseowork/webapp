import { and, asc, eq, sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { paymentsTable } from "@workspace/db/schema";
import { ensurePaymentsSchema } from "./paymentsSchema";
import { checkOrderWithRazorpay, enroll, logPaymentEvent, settlePayment } from "./paymentSettle";
import { getRazorpayClient } from "./razorpayClient";
import { sendSlackAlert } from "./slackAlert";
import { logger } from "./logger";

// Safety nets for payments that the app's verify call and Razorpay's webhook did not finish:
//  - sweep: open orders older than 10 minutes are checked with Razorpay (paid, failed, or left alone / expired)
//  - reconcile: every payment Razorpay captured in the last hours must be paid in our database; missing ones are fixed
// Both are safe to run from many servers at once: a database lock lets one run at a time.
const LOCK_SWEEP = 727001;
const LOCK_RECONCILE = 727002;
const SWEEP_AFTER_MINUTES = 10;
const EXPIRE_AFTER_HOURS = 24;

async function withLock<T>(key: number, work: () => Promise<T>): Promise<T | { skipped: string }> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [key]);
    if (!rows[0]?.ok) return { skipped: "another run is in progress" };
    try {
      return await work();
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [key]);
    }
  } finally {
    client.release();
  }
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

export async function sweepPendingPayments() {
  await ensurePaymentsSchema();
  return withLock(LOCK_SWEEP, async () => {
    // Ages are worked out inside the database, so the server's and the database's clocks and time zones never disagree
    const open = await db.select({ payment: paymentsTable, ageSeconds: sql<number>`extract(epoch from (now() - ${paymentsTable.createdAt}))` })
      .from(paymentsTable)
      .where(and(
        eq(paymentsTable.status, "created"),
        eq(paymentsTable.paymentProvider, "razorpay"),
        sql`${paymentsTable.createdAt} < now() - make_interval(mins => ${SWEEP_AFTER_MINUTES})`,
        sql`${paymentsTable.createdAt} > now() - interval '7 days'`,
      ))
      .orderBy(asc(paymentsTable.createdAt))
      .limit(300);
    const out = { checked: open.length, paid: 0, failed: 0, expired: 0, errors: 0 };
    await mapLimit(open, 5, async ({ payment, ageSeconds }) => {
      try {
        const res = await checkOrderWithRazorpay(payment, "sweep");
        if (res.status === "paid") out.paid++;
        else if (res.status === "failed") out.failed++;
        else if (res.attempts === 0 && Number(ageSeconds) > EXPIRE_AFTER_HOURS * 3600) {
          // Nobody ever tried to pay this order: close it (a payment that still arrives later is honoured)
          const closed = await db.update(paymentsTable).set({ status: "expired", updatedAt: new Date() })
            .where(and(eq(paymentsTable.id, payment.id), eq(paymentsTable.status, "created")))
            .returning({ id: paymentsTable.id });
          if (closed.length) {
            await logPaymentEvent(db, payment.razorpayOrderId, "expired", "sweep", { reason: "no payment attempt in 24 hours" });
            out.expired++;
          }
        }
      } catch (err) {
        out.errors++;
        logger.warn({ err, orderId: payment.razorpayOrderId }, "Sweep could not check an order");
      }
    });
    return out;
  });
}

export async function reconcileCapturedPayments(hours = 2) {
  await ensurePaymentsSchema();
  const razorpay = getRazorpayClient();
  if (!razorpay) return { skipped: "payments are not configured" };
  return withLock(LOCK_RECONCILE, async () => {
    const to = Math.floor(Date.now() / 1000);
    const from = to - hours * 3600;
    const out = { listed: 0, fixed: 0, unknownOrders: 0, paidWithoutCourse: 0 };
    const count = 100;
    for (let page = 0, skip = 0; page < 100; page++, skip += count) {
      const { items } = await razorpay.payments.all({ from, to, count, skip });
      for (const p of items) {
        out.listed++;
        if (p.status !== "captured" || !p.order_id) continue;
        const res = await settlePayment(p.order_id, p.id, { source: "reconcile" });
        if (res === "settled") out.fixed++;
        else if (res === "missing") out.unknownOrders++;
      }
      if (items.length < count) break;
    }
    // Paid in our database but the course never unlocked (should be impossible: both happen in one transaction)
    const { rows } = await db.execute<{ razorpay_order_id: string; razorpay_payment_id: string | null; user_id: number; course_id: number }>(sql`
      SELECT p.razorpay_order_id, p.razorpay_payment_id, p.user_id, p.course_id
      FROM payments p
      LEFT JOIN user_courses uc ON uc.user_id = p.user_id AND uc.course_id = p.course_id
      WHERE p.status = 'paid' AND p.payment_provider = 'razorpay' AND uc.id IS NULL AND p.updated_at > now() - interval '7 days'
      LIMIT 100`);
    for (const r of rows) {
      await db.transaction((tx) => enroll(tx, r.user_id, r.course_id, { orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id ?? "" }));
      await logPaymentEvent(db, r.razorpay_order_id, "enrolled_by_reconcile", "reconcile");
      out.paidWithoutCourse++;
    }
    if (out.fixed || out.unknownOrders || out.paidWithoutCourse) {
      await sendSlackAlert("Payment reconciliation found problems", new Error(JSON.stringify(out)), out);
    }
    return out;
  });
}

export type PaymentTask = "sweep" | "reconcile";

export const runPaymentTask = (task: PaymentTask) => (task === "reconcile" ? reconcileCapturedPayments(2) : sweepPendingPayments());

/** For a long-running server: run the safety nets on a timer. (On Lambda an EventBridge schedule calls runPaymentTask instead.) */
export function startPaymentJobs() {
  const run = (task: PaymentTask) => () => {
    runPaymentTask(task)
      .then((result) => logger.info({ task, result }, "Payment job finished"))
      .catch((err) => logger.error({ err, task }, "Payment job failed"));
  };
  setTimeout(run("sweep"), 60_000).unref();
  setInterval(run("sweep"), 5 * 60_000).unref();
  setInterval(run("reconcile"), 60 * 60_000).unref();
}
