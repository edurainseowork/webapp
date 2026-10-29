import { Router } from "express";
import { db } from "@workspace/db";
import { adminNotificationsTable, coursesTable, liveClassesTable, notificationsTable, testsTable } from "@workspace/db/schema";
import { getLiveClassStatus } from "@workspace/api-zod";
import { and, desc, eq, not, like } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { testStatusSql } from "../lib/testAttempts";
import { findDbUserId, requireAuth } from "../middlewares/auth.js";
import { MAX_NOTIFICATIONS_PER_USER } from "./liveClasses.js";
import { enrolledCourseIds } from "../lib/liveClasses";
const router = Router();
const testCourses = alias(coursesTable, "test_courses");

router.use(requireAuth);

// Get the signed-in student's latest notifications (personal + broadcast), newest first
router.get("/", async (req, res) => {
  try {
    const userId = await findDbUserId(req.auth!.uid);

    const [personalRows, broadcastRows] = await Promise.all([
      userId !== null
        ? db.select({
            notification: notificationsTable,
            liveClass: liveClassesTable,
            courseTitle: coursesTable.title,
            test: {
              id: testsTable.id,
              courseId: testsTable.courseId,
              courseTitle: testCourses.title,
              title: testsTable.title,
              publishTime: testsTable.publishTime,
              closeTime: testsTable.closeTime,
              durationMinutes: testsTable.durationMinutes,
              status: testStatusSql,
            },
          })
            .from(notificationsTable)
            .leftJoin(liveClassesTable, eq(notificationsTable.liveClassId, liveClassesTable.id))
            .leftJoin(coursesTable, eq(liveClassesTable.courseId, coursesTable.id))
            .leftJoin(testsTable, eq(notificationsTable.testId, testsTable.id))
            .leftJoin(testCourses, eq(testsTable.courseId, testCourses.id))
            .where(eq(notificationsTable.userId, userId))
            .orderBy(desc(notificationsTable.createdAt), desc(notificationsTable.id))
            .limit(MAX_NOTIFICATIONS_PER_USER)
        : Promise.resolve([]),
      db.select({
        id: adminNotificationsTable.id,
        title: adminNotificationsTable.title,
        body: adminNotificationsTable.body,
        imageUrl: adminNotificationsTable.imageUrl,
        link: adminNotificationsTable.link,
        createdAt: adminNotificationsTable.createdAt,
      })
        .from(adminNotificationsTable)
        .where(not(like(adminNotificationsTable.title, "[%] %")))
        .orderBy(desc(adminNotificationsTable.createdAt), desc(adminNotificationsTable.id))
        .limit(30),
    ]);

    // The Google Meet link goes only to students still enrolled in that course, and only until the class ends
    const liveCourseIds = [...new Set(personalRows.flatMap(({ liveClass }) => (liveClass ? [liveClass.courseId] : [])))];
    const stillEnrolled = userId !== null ? await enrolledCourseIds(userId, liveCourseIds) : new Set<number>();

    const personalItems = personalRows.map(({ notification, liveClass, courseTitle, test }) => ({
      ...notification,
      imageUrl: null as string | null,
      link: null as string | null,
      // Drafts and archived tests are no longer shown to students
      test: test && test.id !== null && test.status !== "DRAFT" && test.status !== "ARCHIVED" ? test : null,
      liveClass: liveClass
        ? (() => {
            const status = getLiveClassStatus(liveClass.startTime, liveClass.endTime);
            const meetUrl = status !== "ended" && stillEnrolled.has(liveClass.courseId) ? liveClass.meetUrl : null;
            return { ...liveClass, meetUrl, courseTitle, status };
          })()
        : null,
    }));

    const broadcastItems = broadcastRows.map((b) => ({
      id: -b.id, // negative ID distinguishes broadcast items from personal notificationsTable IDs
      broadcastId: b.id,
      userId: userId ?? 0,
      type: "broadcast",
      title: b.title,
      body: b.body,
      imageUrl: b.imageUrl ?? null,
      link: b.link ?? null,
      liveClassId: null,
      testId: null,
      isRead: false,
      createdAt: b.createdAt,
      test: null,
      liveClass: null,
    }));

    const combined = [...personalItems, ...broadcastItems]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_NOTIFICATIONS_PER_USER);

    res.json({
      success: true,
      data: combined,
    });
  } catch (error) {
    console.error("Failed to fetch notifications", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Mark all of the signed-in student's notifications as read
router.post("/read-all", async (req, res) => {
  try {
    const userId = await findDbUserId(req.auth!.uid);
    if (userId !== null) {
      await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.userId, userId));
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to update notifications", error);
    res.status(500).json({ error: "Failed to update notifications" });
  }
});

// Mark a single notification as read
router.post("/:id/read", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid notification ID" });
    return;
  }

  try {
    const userId = await findDbUserId(req.auth!.uid);
    if (userId !== null) {
      await db.update(notificationsTable).set({ isRead: true })
        .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)));
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to update notification", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

export default router;
