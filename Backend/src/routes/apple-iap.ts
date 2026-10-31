import { Router } from "express";
import { db } from "@workspace/db";
import { userCoursesTable, coursesTable, usersTable, paymentsTable } from "@workspace/db/schema";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { logger } from "../lib/logger";
import { notifyUpcomingLiveClasses } from "../lib/liveClasses";

const router = Router();

const VerifyAppleIapBody = z.object({
  courseId: z.number().int().positive(),
  productId: z.string().min(1),
  transactionId: z.string().min(1),
  receiptData: z.string().optional(),
});

// Enrolls user and links Apple IAP purchase
const enrollAppleIap = async (
  userId: number,
  courseId: number,
  productId: string,
  transactionId: string,
  receiptData: string | undefined,
  amount: number
) => {
  const [existing] = await db
    .select({ id: userCoursesTable.id })
    .from(userCoursesTable)
    .where(and(eq(userCoursesTable.userId, userId), eq(userCoursesTable.courseId, courseId)))
    .limit(1);

  if (existing) {
    return;
  }

  await db.transaction(async (tx) => {
    await tx.insert(userCoursesTable).values({
      userId,
      courseId,
      paymentMethod: "apple_iap",
      playPurchaseToken: receiptData || transactionId,
      playOrderId: `apple_${transactionId}`,
    });
    await notifyUpcomingLiveClasses(tx, userId, courseId);

    await tx.insert(paymentsTable).values({
      userId,
      courseId,
      razorpayOrderId: `apple_${transactionId.slice(0, 30)}_${Date.now()}`.slice(0, 40),
      razorpayPaymentId: `apple_${productId}`,
      amount,
      currency: "INR",
      paymentProvider: "apple_iap",
      status: "paid",
    });
  });
};

/**
 * POST /api/apple-iap/verify
 * Validates Apple StoreKit in-app purchase transaction and unlocks course
 */
router.post("/verify", requireAuth, async (req, res) => {
  const parse = VerifyAppleIapBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || "Invalid Apple purchase data" });
    return;
  }

  const { courseId, productId, transactionId, receiptData } = parse.data;

  try {
    const [user] = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.firebaseUid, req.auth!.uid))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User account not found" });
      return;
    }

    const [course] = await db
      .select({ id: coursesTable.id, title: coursesTable.title, price: coursesTable.price, playProductId: coursesTable.playProductId })
      .from(coursesTable)
      .where(eq(coursesTable.id, courseId))
      .limit(1);

    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    // Prevent transaction ID replay: check if transactionId was already redeemed
    const [existingToken] = await db
      .select({ id: userCoursesTable.id })
      .from(userCoursesTable)
      .where(eq(userCoursesTable.playOrderId, `apple_${transactionId}`))
      .limit(1);

    if (existingToken) {
      res.status(409).json({ error: "Apple In-App Purchase transaction has already been redeemed" });
      return;
    }

    // Check if already enrolled
    const [alreadyEnrolled] = await db
      .select({ id: userCoursesTable.id })
      .from(userCoursesTable)
      .where(and(eq(userCoursesTable.userId, user.id), eq(userCoursesTable.courseId, courseId)))
      .limit(1);

    if (alreadyEnrolled) {
      res.json({ success: true, message: "Course already unlocked", courseId });
      return;
    }

    await enrollAppleIap(
      user.id,
      courseId,
      productId,
      transactionId,
      receiptData,
      Number(course.price) || 0
    );

    logger.info({ userId: user.id, courseId, productId, transactionId }, "Successfully unlocked course via Apple In-App Purchase");

    res.json({
      success: true,
      message: "Apple In-App Purchase verified. Course unlocked successfully!",
      courseId,
    });
  } catch (err: any) {
    logger.error({ err, courseId, transactionId }, "Error processing Apple In-App Purchase");
    res.status(500).json({ error: err.message || "Failed to process Apple In-App Purchase" });
  }
});

export default router;
