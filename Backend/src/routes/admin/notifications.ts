import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { count, desc, eq, ilike, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { adminNotificationsTable, notificationsTable, pushTokensTable, usersTable, userCoursesTable, coursesTable } from "@workspace/db/schema";
import { AdminNotificationBody, NOTIFICATION_IMAGE_MAX_BYTES } from "@workspace/api-zod";
import { HttpError } from "../../lib/http-error";
import { logger } from "../../lib/logger";
import { detectImageType, uploadPublicImage } from "../../lib/s3";
import { sendExpoPush } from "../../lib/expoPush";
import { rateLimit } from "../../middlewares/security";

// Admin notifications (CMS sidebar → Notifications). Separate from live class notifications.
// Mounted under /api/admin, so every route here already requires an admin token.
const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: NOTIFICATION_IMAGE_MAX_BYTES, files: 1, fields: 5 },
});

// Optional image arrives as multipart field "image"; plain JSON bodies are accepted too
const parseMultipart = (req: Request, res: Response, next: NextFunction) => {
  if (req.is("multipart/form-data")) {
    upload.single("image")(req, res, next);
    return;
  }
  next();
};

// Notifications already sent, newest first
router.get("/", async (_req, res) => {
  const rows = await db.select().from(adminNotificationsTable)
    .orderBy(desc(adminNotificationsTable.createdAt))
    .limit(50);
  res.json({ success: true, data: rows });
});

// Send a notification to every registered user: saved for the in-app history and pushed to all devices
router.post("/", rateLimit({ windowMs: 60_000, max: 10 }), parseMultipart, async (req, res) => {
  const { title, description, link } = AdminNotificationBody.parse(req.body ?? {});

  let imageUrl: string | null = null;
  if (req.file) {
    const type = detectImageType(req.file.buffer);
    if (!type) throw new HttpError(400, "Image must be a PNG, JPEG or WEBP file");
    try {
      imageUrl = await uploadPublicImage(req.file.buffer, type, "notifications");
    } catch (err) {
      logger.error({ err }, "Failed to upload notification image to S3");
      throw new HttpError(502, "Could not upload the image to S3. Check the AWS settings in .env.");
    }
  }

  // Save first, so it appears in the app's history even if push delivery fails
  const [{ value: recipientCount }] = await db.select({ value: count() }).from(usersTable);
  const [notification] = await db.insert(adminNotificationsTable).values({
    title,
    body: description,
    imageUrl,
    link: link || null,
    sentBy: req.auth?.email ?? null,
    recipientCount,
  }).returning();

  const tokens = (await db.select({ token: pushTokensTable.token }).from(pushTokensTable)).map((row) => row.token);
  const push = await sendExpoPush(tokens, {
    title,
    body: description,
    imageUrl,
    data: {
      type: "admin_notification",
      adminNotificationId: notification.id,
      link: link || undefined,
    },
  });

  const [updated] = await db.update(adminNotificationsTable)
    .set({ pushSentCount: push.sent, pushFailedCount: push.failed })
    .where(eq(adminNotificationsTable.id, notification.id))
    .returning();

  logger.info({ adminNotificationId: notification.id, recipientCount, ...push }, "Admin notification sent");
  res.status(201).json({ success: true, data: updated, devices: tokens.length });
});

// Send a targeted in-app notification directly to a specific student
router.post("/direct", rateLimit({ windowMs: 60_000, max: 30 }), async (req, res) => {
  const { userId, title, description, link } = req.body ?? {};
  const numUserId = Number(userId);
  if (!numUserId || Number.isNaN(numUserId) || numUserId <= 0) {
    throw new HttpError(400, "Valid student userId is required");
  }
  if (!title || typeof title !== "string" || !title.trim()) {
    throw new HttpError(400, "Notification title is required");
  }
  if (!description || typeof description !== "string" || !description.trim()) {
    throw new HttpError(400, "Notification message is required");
  }

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, numUserId)).limit(1);
  if (!targetUser) {
    throw new HttpError(404, "Student not found");
  }

  const [notification] = await db.insert(notificationsTable).values({
    userId: numUserId,
    type: "admin",
    title: title.trim(),
    body: description.trim(),
    isRead: false,
  }).returning();

  const tokens = (await db.select({ token: pushTokensTable.token }).from(pushTokensTable).where(eq(pushTokensTable.userId, numUserId))).map((r) => r.token);
  let push = { sent: 0, failed: 0 };
  if (tokens.length > 0) {
    push = await sendExpoPush(tokens, {
      title: title.trim(),
      body: description.trim(),
      data: {
        type: "direct_admin_notification",
        notificationId: notification.id,
        link: link || undefined,
      },
    });
  }

  logger.info({ studentId: numUserId, studentEmail: targetUser.email, notificationId: notification.id, ...push }, "Direct student notification sent");
  res.status(201).json({
    success: true,
    data: notification,
    pushSentCount: push.sent,
    targetUser: { id: targetUser.id, name: targetUser.name, email: targetUser.email },
  });
});

// Send targeted notification to all students enrolled in a specific category (JEE, NEET, Foundation, etc.)
router.post("/category", rateLimit({ windowMs: 60_000, max: 15 }), async (req, res) => {
  const { category, title, description, link } = req.body ?? {};
  if (!category || typeof category !== "string" || !category.trim()) {
    throw new HttpError(400, "Category name is required");
  }
  if (!title || typeof title !== "string" || !title.trim()) {
    throw new HttpError(400, "Notification title is required");
  }
  if (!description || typeof description !== "string" || !description.trim()) {
    throw new HttpError(400, "Notification message is required");
  }

  const enrolledRows = await db.selectDistinct({ userId: userCoursesTable.userId })
    .from(userCoursesTable)
    .innerJoin(coursesTable, eq(userCoursesTable.courseId, coursesTable.id))
    .where(ilike(coursesTable.category, category.trim()));

  const userIds = enrolledRows.map((r) => r.userId);
  if (userIds.length === 0) {
    res.json({
      success: true,
      recipientCount: 0,
      pushSentCount: 0,
      message: `No active students found in ${category} category courses.`,
    });
    return;
  }

  // Insert notification for each student
  await db.insert(notificationsTable).values(
    userIds.map((uid) => ({
      userId: uid,
      type: "admin",
      title: title.trim(),
      body: description.trim(),
      isRead: false,
    }))
  );

  // Send push notifications
  const tokens = (await db.select({ token: pushTokensTable.token }).from(pushTokensTable).where(inArray(pushTokensTable.userId, userIds))).map((r) => r.token);
  let push = { sent: 0, failed: 0 };
  if (tokens.length > 0) {
    push = await sendExpoPush(tokens, {
      title: title.trim(),
      body: description.trim(),
      data: {
        type: "category_admin_notification",
        category: category.trim(),
        link: link || undefined,
      },
    });
  }

  const [notification] = await db.insert(adminNotificationsTable).values({
    title: `[${category.trim()}] ${title.trim()}`,
    body: description.trim(),
    link: link || null,
    sentBy: req.auth?.email ?? null,
    recipientCount: userIds.length,
    pushSentCount: push.sent,
    pushFailedCount: push.failed,
  }).returning();

  logger.info({ category, recipientCount: userIds.length, ...push }, "Category notification sent");
  res.status(201).json({
    success: true,
    data: notification,
    recipientCount: userIds.length,
    pushSentCount: push.sent,
  });
});

// Delete an admin notification (CMS): removes it so it disappears from students' in-app notifications
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    throw new HttpError(400, "Invalid notification ID");
  }

  const [deleted] = await db
    .delete(adminNotificationsTable)
    .where(eq(adminNotificationsTable.id, id))
    .returning();

  if (!deleted) {
    throw new HttpError(404, "Notification not found");
  }

  logger.info({ adminNotificationId: id, adminEmail: req.auth?.email }, "Admin notification deleted");
  res.json({ success: true, message: "Notification deleted successfully" });
});

export default router;
