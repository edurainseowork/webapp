import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import type { Request } from "express";
import { db } from "@workspace/db";
import { coursesTable, liveClassesTable, notificationsTable, userCoursesTable, type LiveClass } from "@workspace/db/schema";
import { getLiveClassStatus } from "@workspace/api-zod";
import { findDbUserId } from "../middlewares/auth.js";
import { isAdminOrFaculty } from "../middleware/auth.js";
import { getOrSetCache, invalidateCachePrefix } from "./perfEngine";

// Live classes (CMS → Go Live) for students.
// Only students ENROLLED in the course (a row in user_courses) see a class and its Google Meet link.
// This deliberately does not use canAccessCourse: with ALLOW_FREE_ENROLLMENT=true that lets every
// signed-in user in, which would hand the Meet link to students who never enrolled.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

// Each student keeps only their most recent notifications; older ones are deleted
export const MAX_NOTIFICATIONS_PER_USER = 20;

const CACHE_PREFIX = "edurain:live-classes:";
const courseKey = (courseId: number) => `${CACHE_PREFIX}course:${courseId}`;

export const serializeLiveClass = (liveClass: LiveClass) => ({
  ...liveClass,
  status: getLiveClassStatus(liveClass.startTime, liveClass.endTime),
});

/** Live + upcoming classes of a course, soonest first. Cached for a minute; cleared when the CMS adds or cancels one. */
export async function listCourseLiveClasses(courseId: number) {
  const rows = await getOrSetCache(courseKey(courseId), 60, () =>
    db.select().from(liveClassesTable)
      .where(and(eq(liveClassesTable.courseId, courseId), gt(liveClassesTable.endTime, new Date())))
      .orderBy(asc(liveClassesTable.startTime)),
  );
  // A cached row can end while it sits in the cache: filter again on every read
  const now = Date.now();
  return rows.filter((row) => new Date(row.endTime).getTime() > now).map(serializeLiveClass);
}

export const invalidateLiveClasses = (courseId?: number) =>
  invalidateCachePrefix(courseId ? courseKey(courseId) : CACHE_PREFIX);

/** Course ids the student is actually enrolled in (user_courses), limited to `courseIds` when given. */
export async function enrolledCourseIds(userId: number, courseIds?: number[]): Promise<Set<number>> {
  if (courseIds && courseIds.length === 0) return new Set();
  const rows = await db.select({ courseId: userCoursesTable.courseId }).from(userCoursesTable)
    .where(courseIds ? and(eq(userCoursesTable.userId, userId), inArray(userCoursesTable.courseId, courseIds)) : eq(userCoursesTable.userId, userId));
  return new Set(rows.map((row) => row.courseId));
}

/** Admins / faculty see every course's classes; students only those of courses they are enrolled in. */
export async function canSeeLiveClasses(req: Request, courseId: number): Promise<boolean> {
  if (isAdminOrFaculty(req.auth, req.user as any)) return true;
  const userId = req.user?.id ?? (req.auth ? await findDbUserId(req.auth.uid) : null);
  if (!userId) return false;
  return (await enrolledCourseIds(userId, [courseId])).has(courseId);
}

/** Every live / upcoming class across the student's enrolled courses, soonest first, with the course title. */
export async function listMyLiveClasses(userId: number) {
  const owned = [...(await enrolledCourseIds(userId))];
  if (owned.length === 0) return [];
  const titles = new Map(
    (await db.select({ id: coursesTable.id, title: coursesTable.title }).from(coursesTable).where(inArray(coursesTable.id, owned)))
      .map((course) => [course.id, course.title]),
  );
  const perCourse = await Promise.all(owned.map((courseId) => listCourseLiveClasses(courseId)));
  return perCourse
    .flat()
    .map((liveClass) => ({ ...liveClass, courseTitle: titles.get(liveClass.courseId) ?? null }))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

// Deletes everything beyond each user's newest MAX_NOTIFICATIONS_PER_USER notifications
export const pruneOldNotifications = async (exec: Executor, userIds: number[]) => {
  if (userIds.length === 0) return;
  await exec.execute(sql`
    DELETE FROM ${notificationsTable}
    WHERE ${notificationsTable.id} IN (
      SELECT id FROM (
        SELECT ${notificationsTable.id} AS id,
               row_number() OVER (PARTITION BY ${notificationsTable.userId} ORDER BY ${notificationsTable.createdAt} DESC, ${notificationsTable.id} DESC) AS position
        FROM ${notificationsTable}
        WHERE ${notificationsTable.userId} IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})
      ) ranked
      WHERE position > ${MAX_NOTIFICATIONS_PER_USER}
    )
  `);
};

/**
 * A student who enrols after a class was scheduled gets the same "New Live Class Scheduled" notification
 * for every live / upcoming class of that course. Called from every enrolment path (free, coupon, Razorpay,
 * webhook, Google Play, admin grant). Already-notified classes are skipped.
 */
export async function notifyUpcomingLiveClasses(exec: Executor, userId: number, courseId: number): Promise<number> {
  const upcoming = await exec.select({ id: liveClassesTable.id, title: liveClassesTable.title, courseTitle: coursesTable.title })
    .from(liveClassesTable)
    .innerJoin(coursesTable, eq(liveClassesTable.courseId, coursesTable.id))
    .where(and(eq(liveClassesTable.courseId, courseId), gt(liveClassesTable.endTime, new Date())));
  if (upcoming.length === 0) return 0;
  const inserted = await exec.insert(notificationsTable).values(upcoming.map((liveClass) => ({
    userId,
    type: "live_class",
    title: "New Live Class Scheduled",
    body: `${liveClass.title} · ${liveClass.courseTitle}`,
    liveClassId: liveClass.id,
  }))).onConflictDoNothing().returning({ id: notificationsTable.id });
  await pruneOldNotifications(exec, [userId]);
  return inserted.length;
}