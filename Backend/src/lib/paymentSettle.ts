import { sql, eq, and, ne } from "drizzle-orm";
import { db } from "@workspace/db";
import { paymentsTable, userCoursesTable } from "@workspace/db/schema";
import { redeemCoupon } from "../routes/coupons.js";
import { getRazorpayClient } from "./razorpayClient";
import { logger } from "./logger";

export type PaymentRow = typeof paymentsTable.$inferSelect;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = Pick<typeof db, "execute">;

/** Where a payment update came from. Kept in payment_events so a stuck payment can be traced. */
export type PaymentSource = "order" | "app" | "verify" | "webhook" | "status" | "sweep" | "reconcile";

export async function logPaymentEvent(executor: Executor, orderId: string, event: string, source: PaymentSource, detail?: Record<string, unknown>) {
  await executor.execute(sql`
    INSERT INTO payment_events (razorpay_order_id, event, source, detail)
    VALUES (${orderId}, ${event}, ${source}, ${detail ? JSON.stringify(detail) : null}::jsonb)`);
}

/** Adds the course to the student's purchases unless it is already there. */
export const enroll = async (tx: Tx, userId: number, courseId: number, payment?: { orderId: string; paymentId: string }) => {
  const [existing] = await tx.select({ id: userCoursesTable.id }).from(userCoursesTable)
    .where(and(eq(userCoursesTable.userId, userId), eq(userCoursesTable.courseId, courseId)))
    .limit(1);
  if (existing) return;
  await tx.insert(userCoursesTable).values({
    userId,
    courseId,
    razorpayOrderId: payment?.orderId ?? null,
    razorpayPaymentId: payment?.paymentId ?? null,
  }).onConflictDoNothing();
};

/**
 * Money was taken for this order: mark it paid, unlock the course and count the coupon, all in one transaction.
 * The one place that does this (the app's verify call, Razorpay's webhook, the status check and the sweeper all use it).
 * Safe to call again and from several places at once: the first caller claims the order, the rest do nothing.
 */
export async function settlePayment(
  orderId: string,
  paymentId: string,
  opts: { source: PaymentSource; redeemUid?: string; googleToken?: string | null; payment?: PaymentRow },
): Promise<"settled" | "already" | "missing"> {
  // A caller that has just read the row passes it in (saves a query); the claim below is what keeps this safe either way
  const [payment] = opts.payment ? [opts.payment] : await db.select().from(paymentsTable).where(eq(paymentsTable.razorpayOrderId, orderId));
  if (!payment) return "missing";
  if (payment.status === "paid") return "already";

  const settled = await db.transaction(async (tx) => {
    const [claimed] = await tx.update(paymentsTable)
      .set({
        status: "paid",
        razorpayPaymentId: paymentId,
        failureReason: null,
        ...(opts.googleToken ? { googleAlternativeBillingToken: opts.googleToken } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(paymentsTable.id, payment.id), ne(paymentsTable.status, "paid")))
      .returning({ id: paymentsTable.id });
    if (!claimed) return false;
    await enroll(tx, payment.userId, payment.courseId, { orderId, paymentId });
    // Count the coupon use once per order. The limit was checked when the order was created,
    // so a payment that completes after the last slot was taken is still honoured.
    if (payment.couponId) {
      await redeemCoupon(tx, payment.couponId, { courseId: payment.courseId, firebaseUid: opts.redeemUid ?? `webhook-${payment.userId}`, razorpayOrderId: orderId }, { enforceLimit: false });
    }
    await logPaymentEvent(tx, orderId, "paid", opts.source, { paymentId, wasStatus: payment.status });
    return true;
  });
  if (settled) logger.info({ orderId, paymentId, userId: payment.userId, courseId: payment.courseId, source: opts.source }, "Payment settled");
  return settled ? "settled" : "already";
}

export type OrderCheck = { status: "paid" | "failed" | "pending"; attempts: number };

/**
 * Asks Razorpay what happened to an order and settles it when the money is in.
 * paid = a captured payment for the full amount. failed = every attempt failed (the student may still try again).
 */
export async function checkOrderWithRazorpay(payment: PaymentRow, source: PaymentSource, redeemUid?: string): Promise<OrderCheck> {
  const razorpay = getRazorpayClient();
  if (!razorpay) throw new Error("Payments are not configured");
  const orderId = payment.razorpayOrderId;
  const { items } = await razorpay.orders.fetchPayments(orderId);

  const captured = items.find((p) => p.status === "captured" && Number(p.amount) >= payment.amount);
  if (captured) {
    await settlePayment(orderId, captured.id, { source, redeemUid, payment });
    return { status: "paid", attempts: items.length };
  }
  if (items.length > 0 && items.every((p) => p.status === "failed")) {
    const reason = items[items.length - 1]?.error_description ?? "Payment failed";
    const marked = await db.update(paymentsTable)
      .set({ status: "failed", failureReason: reason, updatedAt: new Date() })
      .where(and(eq(paymentsTable.id, payment.id), eq(paymentsTable.status, "created")))
      .returning({ id: paymentsTable.id });
    if (marked.length) await logPaymentEvent(db, orderId, "failed", source, { attempts: items.length, reason });
    return { status: "failed", attempts: items.length };
  }
  return { status: "pending", attempts: items.length };
}
