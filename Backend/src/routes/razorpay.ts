import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { userCoursesTable, coursesTable, paymentsTable, usersTable } from "@workspace/db/schema";
import { CreatePaymentOrderBody, PaymentFailedBody, VerifyPaymentBody } from "@workspace/api-zod";
import { eq, and, sql } from "drizzle-orm";
import { calculateDiscount, checkCoupon, redeemCoupon } from "./coupons.js";
import { requireAuth } from "../middlewares/auth.js";
import { logger } from "../lib/logger";
import { reportAlternativeBillingToGoogle } from "./google-play.js";
import { PLAN_NAMES, planIdSchema, planPrice } from "../lib/coursePlans";
import { getRazorpayClient, getRazorpayCredentials } from "../lib/razorpayClient";
import { ensurePaymentsSchema } from "../lib/paymentsSchema";
import { checkOrderWithRazorpay, enroll, logPaymentEvent, settlePayment, type OrderCheck, type PaymentRow } from "../lib/paymentSettle";
import { sendSlackAlert } from "../lib/slackAlert";

const router = Router();
// Razorpay's webhook is mounted before the per-IP payment limiter (see routes/index.ts): all its calls come from Razorpay's few addresses
export const razorpayWebhookRouter = Router();

// Razorpay does not accept orders below ₹1
const MIN_AMOUNT_PAISE = 100;
// An unpaid order is handed out again for this long; after that a new one is made
const REUSE_ORDER_SECONDS = 2 * 3600;

const pgCode = (err: unknown) => (err as { code?: string; cause?: { code?: string } }).code ?? (err as { cause?: { code?: string } }).cause?.code;

const findUser = async (firebaseUid: string) => {
  const [user] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.firebaseUid, firebaseUid));
  return user ?? null;
};

// The signed-in student: already loaded by the sign-in check, so no second database lookup
const studentOf = async (req: { user?: { id: number; name: string | null; email: string }; auth?: { uid: string } }) =>
  req.user ? { id: req.user.id, name: req.user.name, email: req.user.email } : findUser(req.auth!.uid);

const isEnrolled = async (userId: number, courseId: number) => {
  const [row] = await db.select({ id: userCoursesTable.id }).from(userCoursesTable)
    .where(and(eq(userCoursesTable.userId, userId), eq(userCoursesTable.courseId, courseId)))
    .limit(1);
  return !!row;
};

const signatureIsValid = (orderId: string, paymentId: string, signature: string, secret: string) => {
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};

type OpenOrder = { id: number; razorpay_order_id: string; amount: number; currency: string; coupon_id: number | null; plan: string | null; age_s: number };

// The student's unpaid order for this course, if any (at most one: see payments_one_open_order in lib/paymentsSchema.ts)
const findOpenOrder = async (userId: number, courseId: number): Promise<OpenOrder | null> => {
  const { rows } = await db.execute<OpenOrder>(sql`
    SELECT p.id, p.razorpay_order_id, p.amount, p.currency, p.coupon_id, pp.plan,
           extract(epoch from (now() - p.created_at))::int AS age_s
    FROM payments p
    LEFT JOIN payment_plans pp ON pp.razorpay_order_id = p.razorpay_order_id
    WHERE p.user_id = ${userId} AND p.course_id = ${courseId} AND p.status = 'created' AND p.payment_provider = 'razorpay'
    ORDER BY p.id DESC LIMIT 1`);
  return rows[0] ?? null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Razorpay answers 429 / 5xx now and then, more so in a rush of orders: try again a little later
const createRazorpayOrder = async (razorpay: NonNullable<ReturnType<typeof getRazorpayClient>>, params: Parameters<typeof razorpay.orders.create>[0]) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await razorpay.orders.create(params);
    } catch (err) {
      const e = err as { statusCode?: number; code?: string; cause?: { code?: string } };
      const transient = e.statusCode === 429 || (e.statusCode ?? 0) >= 500 || ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"].includes(e.code ?? e.cause?.code ?? "");
      if (!transient || attempt >= 2) throw err;
      await sleep(300 * 3 ** attempt + Math.random() * 200);
    }
  }
};

// Step 1: create the order (or hand back the one already open) for the checkout window.
router.post("/order", requireAuth, async (req, res) => {
  const parsed = CreatePaymentOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
    return;
  }
  const { courseId, couponCode } = parsed.data;
  // Basic / Pro / Pro Max (optional; apps that don't send it buy Basic = the course price)
  const planParsed = planIdSchema.safeParse(req.body?.plan ?? "basic");
  if (!planParsed.success) {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }
  const plan = planParsed.data;
  try {
    await ensurePaymentsSchema();
    const user = await studentOf(req);
    if (!user) {
      res.status(404).json({ error: "User not found. Please log in again." });
      return;
    }
    const [course] = await db.select({ id: coursesTable.id, title: coursesTable.title, price: coursesTable.price, isPublished: coursesTable.isPublished })
      .from(coursesTable)
      .where(eq(coursesTable.id, courseId));
    if (!course || !course.isPublished) {
      res.status(404).json({ error: "Course not found" });
      return;
    }
    if (await isEnrolled(user.id, courseId)) {
      res.status(409).json({ error: "You already own this course" });
      return;
    }

    const listPrice = await planPrice(courseId, course.price, plan);
    if (listPrice === null) {
      res.status(400).json({ error: `This course has no ${PLAN_NAMES[plan]} plan` });
      return;
    }
    let amount = listPrice;
    let couponId: number | null = null;
    if (couponCode) {
      const result = await checkCoupon(couponCode, courseId);
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      amount = calculateDiscount(listPrice, result.coupon.discountPercent, result.coupon.maxDiscountAmount).finalPrice;
      couponId = result.coupon.id;
    }

    // Free after coupon (e.g. 100% off): no payment needed
    if (amount <= 0) {
      await db.transaction(async (tx) => {
        await enroll(tx, user.id, courseId);
        if (couponId) await redeemCoupon(tx, couponId, { courseId, firebaseUid: req.auth!.uid });
      });
      res.json({ success: true, free: true, courseId });
      return;
    }
    if (amount < MIN_AMOUNT_PAISE) {
      res.status(400).json({ error: "The amount after discount is below ₹1, which cannot be paid online" });
      return;
    }

    const { keyId } = getRazorpayCredentials();
    const razorpay = getRazorpayClient();
    if (!razorpay || !keyId) {
      res.status(500).json({ error: "Payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_SECRET in .env." });
      return;
    }

    const courseTitle = plan === "basic" ? course.title : `${course.title} (${PLAN_NAMES[plan]})`;
    const answer = (o: { orderId: string; amount: number; currency: string }, reused: boolean) => ({
      success: true,
      free: false,
      orderId: o.orderId,
      amount: o.amount,
      currency: o.currency,
      keyId, // public key id only, safe for the app
      courseTitle,
      plan,
      prefill: { name: user.name ?? "", email: user.email },
      ...(reused ? { reused: true } : {}),
    });
    const sameOrder = (open: OpenOrder) => open.plan === plan && open.coupon_id === couponId && Number(open.amount) === amount;

    // One open order per student and course: another click, or a retry after a timeout, gets the same order back.
    // Razorpay takes payment for an order once, so a second payment for it cannot happen.
    const open = await findOpenOrder(user.id, courseId);
    if (open) {
      if (sameOrder(open) && open.age_s < REUSE_ORDER_SECONDS) {
        res.json(answer({ orderId: open.razorpay_order_id, amount: Number(open.amount), currency: open.currency }, true));
        return;
      }
      // The plan, coupon or price changed (or it is old): close it. A payment that still arrives for it is honoured.
      const closed = await db.update(paymentsTable).set({ status: "expired", updatedAt: new Date() })
        .where(and(eq(paymentsTable.id, open.id), eq(paymentsTable.status, "created")))
        .returning({ id: paymentsTable.id });
      if (closed.length) await logPaymentEvent(db, open.razorpay_order_id, "expired", "order", { reason: "plan, coupon, price or age changed" });
    }

    const order = await createRazorpayOrder(razorpay, {
      amount,
      currency: "INR",
      receipt: `c${courseId}_u${user.id}_${Date.now()}`.slice(0, 40),
      notes: { courseId: String(courseId), userId: String(user.id), plan, ...(couponId ? { couponId: String(couponId) } : {}) },
    });

    try {
      await db.transaction(async (tx) => {
        await tx.insert(paymentsTable).values({ userId: user.id, courseId, razorpayOrderId: order.id, amount, currency: "INR", couponId });
        // Which plan this order is for (payments has no plan column; payment_plans is set up by ensureMentorshipSchema)
        await tx.execute(sql`INSERT INTO payment_plans (razorpay_order_id, plan) VALUES (${order.id}, ${plan}) ON CONFLICT DO NOTHING`);
        await logPaymentEvent(tx, order.id, "created", "order", { amount, plan, couponId });
      });
    } catch (err) {
      if (pgCode(err) !== "23505") throw err;
      // A parallel request opened the order first: use theirs (the Razorpay order made here stays unpaid and is ignored)
      const winner = await findOpenOrder(user.id, courseId);
      if (winner && sameOrder(winner)) {
        res.json(answer({ orderId: winner.razorpay_order_id, amount: Number(winner.amount), currency: winner.currency }, true));
        return;
      }
      res.status(409).json({ error: "Another payment for this course is open. Please try again in a moment." });
      return;
    }

    res.json(answer({ orderId: order.id, amount, currency: "INR" }, false));
  } catch (error: any) {
    const errorDescription = error?.error?.description || error?.message || "Failed to create payment order";
    logger.error({ err: error }, `Failed to create Razorpay order: ${errorDescription}`);
    res.status(500).json({ error: errorDescription });
  }
});

// Step 2: after checkout succeeds, verify Razorpay's signature and unlock the course.
// Safe to call more than once for the same order.
router.post("/verify", requireAuth, async (req, res) => {
  const parsed = VerifyPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid payment details" });
    return;
  }
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature, googleAlternativeBillingToken } = parsed.data;
  const { keySecret } = getRazorpayCredentials();
  if (!keySecret) {
    res.status(500).json({ error: "Payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_SECRET in .env." });
    return;
  }

  try {
    await ensurePaymentsSchema();
    const user = await studentOf(req);
    const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.razorpayOrderId, orderId));
    // Same response for unknown orders and other users' orders
    if (!user || !payment || payment.userId !== user.id) {
      res.status(404).json({ error: "Payment order not found" });
      return;
    }
    if (!signatureIsValid(orderId, paymentId, signature, keySecret)) {
      logger.warn({ orderId, userId: user.id }, "Razorpay signature mismatch");
      res.status(400).json({ success: false, error: "Payment could not be verified" });
      return;
    }

    const settled = await settlePayment(orderId, paymentId, { source: "verify", redeemUid: req.auth!.uid, googleToken: googleAlternativeBillingToken, payment });
    // Report to Google Play for User Choice Billing compliance if token was provided
    if (settled === "settled" && googleAlternativeBillingToken) {
      reportAlternativeBillingToGoogle({
        externalTransactionId: `rzp_${paymentId}`,
        originalAlternativeBillingToken: googleAlternativeBillingToken,
        amountInPaise: payment.amount,
        currency: payment.currency,
      }).catch((err) => logger.error({ err }, "Background reporting to Google Play failed"));
    }

    res.json({ success: true, message: "Payment verified successfully", courseId: payment.courseId });
  } catch (error) {
    logger.error({ err: error, orderId }, "Payment verification failed");
    res.status(500).json({ error: "Payment verification failed" });
  }
});

// Optional: the app reports a failed or cancelled checkout so the order shows as failed
router.post("/failed", requireAuth, async (req, res) => {
  const parsed = PaymentFailedBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
    return;
  }
  try {
    await ensurePaymentsSchema();
    const user = await studentOf(req);
    if (user) {
      const marked = await db.update(paymentsTable)
        .set({ status: "failed", failureReason: parsed.data.reason ?? null, updatedAt: new Date() })
        .where(and(
          eq(paymentsTable.razorpayOrderId, parsed.data.razorpay_order_id),
          eq(paymentsTable.userId, user.id),
          eq(paymentsTable.status, "created"),
        ))
        .returning({ id: paymentsTable.id });
      if (marked.length) await logPaymentEvent(db, parsed.data.razorpay_order_id, "failed", "app", { reason: parsed.data.reason ?? null });
    }
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to record payment failure");
    res.status(500).json({ error: "Failed to update payment" });
  }
});

// Course ids the signed-in student has bought, so the app can unlock them on any device
router.get("/my-courses", requireAuth, async (req, res) => {
  try {
    const user = await studentOf(req);
    if (!user) {
      res.json({ success: true, data: [] });
      return;
    }
    const rows = await db.selectDistinct({ courseId: userCoursesTable.courseId })
      .from(userCoursesTable)
      .where(eq(userCoursesTable.userId, user.id));
    res.json({ success: true, data: rows.map((row) => row.courseId) });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch purchased courses");
    res.status(500).json({ error: "Failed to fetch purchased courses" });
  }
});

// Many students poll the same busy moment: ask Razorpay about one order at most once per few seconds, and only once at a time
const RECENT_CHECK_MS = 3000;
const checksRunning = new Map<string, Promise<OrderCheck>>();
const recentChecks = new Map<string, { at: number; check: OrderCheck }>();

const askRazorpay = (payment: PaymentRow, uid: string): Promise<OrderCheck> => {
  const key = payment.razorpayOrderId;
  const recent = recentChecks.get(key);
  if (recent && Date.now() - recent.at < RECENT_CHECK_MS && recent.check.status !== "paid") return Promise.resolve(recent.check);
  let running = checksRunning.get(key);
  if (!running) {
    running = checkOrderWithRazorpay(payment, "status", uid)
      .then((check) => {
        recentChecks.set(key, { at: Date.now(), check });
        setTimeout(() => recentChecks.delete(key), RECENT_CHECK_MS).unref();
        return check;
      })
      .finally(() => checksRunning.delete(key));
    checksRunning.set(key, running);
  }
  return running;
};

// Pending payments (UPI waiting for the bank, window closed early): the app asks here again and again, 1s, 2s, 4s ...
// Our own database answers first (the webhook may already have settled it); only then is Razorpay asked.
router.get("/status/:orderId", requireAuth, async (req, res) => {
  const orderId = String(req.params.orderId);
  if (!/^order_[A-Za-z0-9]+$/.test(orderId)) {
    res.status(400).json({ error: "Invalid order" });
    return;
  }
  try {
    await ensurePaymentsSchema();
    const user = await studentOf(req);
    const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.razorpayOrderId, orderId));
    // Same answer for unknown orders and other students' orders
    if (!user || !payment || payment.userId !== user.id) {
      res.status(404).json({ error: "Payment order not found" });
      return;
    }
    if (payment.status === "paid") {
      res.json({ success: true, status: "paid", courseId: payment.courseId });
      return;
    }
    if (!getRazorpayClient()) {
      res.status(500).json({ error: "Payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_SECRET in .env." });
      return;
    }
    const check = await askRazorpay(payment, req.auth!.uid);
    res.json({ success: true, status: check.status, attempts: check.attempts, ...(check.status === "paid" ? { courseId: payment.courseId } : {}) });
  } catch (error) {
    logger.error({ err: error, orderId }, "Payment status check failed");
    res.status(500).json({ error: "Could not check the payment status" });
  }
});

// Step 3 (backup for step 2): Razorpay tells us itself. HMAC-SHA256 signature check, and every delivery
// (x-razorpay-event-id) is handled once: Razorpay sends at least once, so repeats are answered and dropped.
razorpayWebhookRouter.post("/", async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_SECRET || process.env.RAZORPAY_KEY_SECRET;
  const signature = req.headers["x-razorpay-signature"];

  if (!webhookSecret || !signature || typeof signature !== "string") {
    logger.warn("Razorpay webhook request missing signature or webhook secret is unconfigured");
    res.status(400).json({ error: "Missing signature or unconfigured secret" });
    return;
  }

  const rawPayload = (req as any).rawBody ? (req as any).rawBody.toString("utf8") : JSON.stringify(req.body);
  const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(rawPayload).digest("hex");
  const signatureMatches = expectedSignature.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  if (!signatureMatches) {
    logger.error("Razorpay webhook signature validation failed - unauthorized payload");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  const event: string | undefined = req.body?.event;
  const paymentEntity = req.body?.payload?.payment?.entity;
  const refundEntity = req.body?.payload?.refund?.entity;
  const orderId: string | undefined = paymentEntity?.order_id ?? req.body?.payload?.order?.entity?.id;
  const paymentId: string | undefined = paymentEntity?.id ?? refundEntity?.payment_id;
  const headerId = req.headers["x-razorpay-event-id"];
  const eventId = typeof headerId === "string" && headerId ? headerId : crypto.createHash("sha256").update(rawPayload).digest("hex");

  try {
    await ensurePaymentsSchema();
    const { rows: fresh } = await db.execute<{ event_id: string }>(sql`
      INSERT INTO webhook_events (event_id, event, razorpay_order_id, razorpay_payment_id)
      VALUES (${eventId}, ${event ?? "unknown"}, ${orderId ?? null}, ${paymentId ?? null})
      ON CONFLICT (event_id) DO NOTHING RETURNING event_id`);
    if (!fresh.length) {
      // Seen before. Done if it was processed; if the first try crashed half way, process it again (settling is safe to repeat)
      const { rows } = await db.execute<{ processed_at: string | null }>(sql`SELECT processed_at FROM webhook_events WHERE event_id = ${eventId}`);
      if (rows[0]?.processed_at) {
        res.status(200).json({ status: "duplicate" });
        return;
      }
    }

    if ((event === "payment.captured" || event === "order.paid") && orderId && paymentId) {
      const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.razorpayOrderId, orderId));
      if (payment && payment.status !== "paid") {
        const amount = Number(paymentEntity?.amount);
        if (amount && amount < payment.amount) {
          // Paid less than the order: do not unlock. Retrying would not change that, so answer 200 and raise the alarm.
          await logPaymentEvent(db, orderId, "amount_mismatch", "webhook", { paid: amount, expected: payment.amount, paymentId });
          await sendSlackAlert("Razorpay payment is below the order amount", new Error(`order ${orderId}: paid ${amount}, expected ${payment.amount}`), { orderId, paymentId });
        } else {
          await settlePayment(orderId, paymentId, { source: "webhook", payment });
        }
      }
    } else if (event === "payment.failed" && orderId) {
      // One failed attempt is not the end of the order (the student can retry); the reason is kept for support
      await db.update(paymentsTable).set({ failureReason: paymentEntity?.error_description ?? "Payment failed", updatedAt: new Date() })
        .where(and(eq(paymentsTable.razorpayOrderId, orderId), eq(paymentsTable.status, "created")));
      await logPaymentEvent(db, orderId, "attempt_failed", "webhook", { paymentId, reason: paymentEntity?.error_description ?? null });
    } else if (event?.startsWith("refund.") && orderId) {
      await logPaymentEvent(db, orderId, event, "webhook", { refundId: refundEntity?.id, paymentId, amount: refundEntity?.amount });
    }

    await db.execute(sql`UPDATE webhook_events SET processed_at = now() WHERE event_id = ${eventId}`);
    res.status(200).json({ status: "ok" });
  } catch (error) {
    // 500 makes Razorpay deliver this event again later
    logger.error({ err: error, eventId, event }, "Razorpay webhook processing failed");
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
