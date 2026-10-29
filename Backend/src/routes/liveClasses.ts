import { Router } from "express";
import { db } from "@workspace/db";
import { coursesTable, liveClassesTable, notificationsTable, userCoursesTable, type LiveClass } from "@workspace/db/schema";
import { CreateLiveClassBody, getLiveClassStatus } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { findDbUserId, requireAdmin, requireAuth } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/security";
import { logger } from "../lib/logger";
import {
  MAX_NOTIFICATIONS_PER_USER,
  canSeeLiveClasses,
  invalidateLiveClasses,
  listCourseLiveClasses,
  listMyLiveClasses,
  pruneOldNotifications,
  serializeLiveClass,
} from "../lib/liveClasses";

// Kept here as well: notifications.ts imports it from this file
export { MAX_NOTIFICATIONS_PER_USER, pruneOldNotifications };

const router = Router();

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// This router is mounted at /api (no prefix), so limits go on each route, never router.use()
const studentReadLimiter = rateLimit({ windowMs: 60_000, limit: 60, keyPrefix: "rl:live-classes:", keyStrategy: "ip+identifier", algorithm: "token-bucket" });

const parseId = (value: string) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Creates one in-app notification per enrolled student; students already notified are skipped
const notifyEnrolledStudents = async (tx: Tx, liveClass: LiveClass, courseTitle: string) => {
  const enrolled = await tx.selectDistinct({ userId: userCoursesTable.userId })
    .from(userCoursesTable)
    .where(eq(userCoursesTable.courseId, liveClass.courseId));
  if (enrolled.length === 0) return 0;

  const inserted = await tx.insert(notificationsTable).values(enrolled.map(({ userId }) => ({
    userId,
    type: "live_class",
    title: "New Live Class Scheduled",
    body: `${liveClass.title} · ${courseTitle}`,
    liveClassId: liveClass.id,
  }))).onConflictDoNothing().returning({ id: notificationsTable.id });

  await pruneOldNotifications(tx, enrolled.map(({ userId }) => userId));
  return inserted.length;
};

// Create a live class for a course and notify enrolled students (Admin)
router.post("/courses/:courseId/live-classes", requireAdmin, async (req, res) => {
  const courseId = parseId(req.params.courseId as string);
  if (!courseId) {
    res.status(400).json({ error: "Invalid course ID" });
    return;
  }

  const parsed = CreateLiveClassBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid live class details", issues: parsed.error.issues });
    return;
  }

  try {
    const [course] = await db.select({ id: coursesTable.id, title: coursesTable.title }).from(coursesTable).where(eq(coursesTable.id, courseId));
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    const { title, startTime, endTime, meetUrl } = parsed.data;
    const result = await db.transaction(async (tx) => {
      const [liveClass] = await tx.insert(liveClassesTable).values({
        courseId,
        title,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        meetUrl,
      }).returning();
      const notifiedCount = await notifyEnrolledStudents(tx, liveClass, course.title);
      return { liveClass, notifiedCount };
    });
    await invalidateLiveClasses(courseId);
    logger.info({ adminUid: req.auth?.uid, courseId, liveClassId: result.liveClass.id, notified: result.notifiedCount }, "Live class scheduled");

    res.status(201).json({ success: true, data: serializeLiveClass(result.liveClass), notifiedCount: result.notifiedCount });
  } catch (error: any) {
    logger.error({ err: error, courseId }, "Failed to create live class");
    res.status(500).json({ error: "Failed to create live class" });
  }
});

// Get live and upcoming classes for a course (Admin, or enrolled students)
router.get("/courses/:courseId/live-classes", requireAuth, studentReadLimiter, async (req, res) => {
  const courseId = parseId(req.params.courseId as string);
  if (!courseId) {
    res.status(400).json({ error: "Invalid course ID" });
    return;
  }

  try {
    if (!(await canSeeLiveClasses(req, courseId))) {
      res.status(403).json({ error: "You are not enrolled in this course" });
      return;
    }
    res.json({ success: true, data: await listCourseLiveClasses(courseId) });
  } catch (error) {
    logger.error({ err: error, courseId }, "Failed to fetch live classes");
    res.status(500).json({ error: "Failed to fetch live classes" });
  }
});

// Live and upcoming classes of every course the signed-in student is enrolled in (website "Your Live Class")
// Declared before /live-classes/:id so "my" is not read as an id
router.get("/live-classes/my", requireAuth, studentReadLimiter, async (req, res) => {
  try {
    const userId = req.user?.id ?? (await findDbUserId(req.auth!.uid));
    res.json({ success: true, data: userId ? await listMyLiveClasses(userId) : [] });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch the student's live classes");
    res.status(500).json({ error: "Failed to fetch live classes" });
  }
});

// Get a single live class (Admin, or students enrolled in its course)
router.get("/live-classes/:id", requireAuth, studentReadLimiter, async (req, res) => {
  const id = parseId(req.params.id as string);
  if (!id) {
    res.status(400).json({ error: "Invalid live class ID" });
    return;
  }

  try {
    const [liveClass] = await db.select().from(liveClassesTable).where(eq(liveClassesTable.id, id));
    // Same 404 for missing and not-enrolled so students cannot probe other courses' classes
    if (!liveClass || !(await canSeeLiveClasses(req, liveClass.courseId))) {
      res.status(404).json({ error: "Live class not found" });
      return;
    }
    res.json({ success: true, data: serializeLiveClass(liveClass) });
  } catch (error) {
    logger.error({ err: error, id }, "Failed to fetch live class");
    res.status(500).json({ error: "Failed to fetch live class" });
  }
});

// Re-send notifications, e.g. to students who enrolled after the class was scheduled (Admin)
router.post("/live-classes/:id/notify", requireAdmin, async (req, res) => {
  const id = parseId(req.params.id as string);
  if (!id) {
    res.status(400).json({ error: "Invalid live class ID" });
    return;
  }

  try {
    const [row] = await db.select({ liveClass: liveClassesTable, courseTitle: coursesTable.title })
      .from(liveClassesTable)
      .innerJoin(coursesTable, eq(liveClassesTable.courseId, coursesTable.id))
      .where(eq(liveClassesTable.id, id));
    if (!row) {
      res.status(404).json({ error: "Live class not found" });
      return;
    }
    if (getLiveClassStatus(row.liveClass.startTime, row.liveClass.endTime) === "ended") {
      res.status(400).json({ error: "This live class has already ended" });
      return;
    }

    const notifiedCount = await db.transaction((tx) => notifyEnrolledStudents(tx, row.liveClass, row.courseTitle));
    res.json({ success: true, notifiedCount });
  } catch (error) {
    logger.error({ err: error, id }, "Failed to send live class notifications");
    res.status(500).json({ error: "Failed to send notifications" });
  }
});

// Cancel a live class; its notifications are removed by the cascade (Admin)
router.delete("/live-classes/:id", requireAdmin, async (req, res) => {
  const id = parseId(req.params.id as string);
  if (!id) {
    res.status(400).json({ error: "Invalid live class ID" });
    return;
  }

  try {
    const [deleted] = await db.transaction(async (tx) => {
      await tx.delete(notificationsTable).where(eq(notificationsTable.liveClassId, id));
      return tx.delete(liveClassesTable).where(eq(liveClassesTable.id, id)).returning({ courseId: liveClassesTable.courseId });
    });
    await invalidateLiveClasses(deleted?.courseId);
    logger.info({ adminUid: req.auth?.uid, liveClassId: id }, "Live class cancelled");
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error, id }, "Failed to delete live class");
    res.status(500).json({ error: "Failed to delete live class" });
  }
});

export default router;