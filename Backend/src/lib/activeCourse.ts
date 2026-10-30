import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { ensureMentorshipSchema } from "./mentorshipSchema";
import { HttpError } from "./http-error";
import { getOrSetCache, invalidateCachePrefix } from "./perfEngine";

// The student's ONE active course among the courses they own (Your Enrolled Courses → Set as Active).
// Making a course active also moves the student's goal (cohort) to that course's category, and a
// goal change picks an active course in the new category (see syncActiveCourseToGoal).
// Table: active_courses (created on first use, see lib/mentorshipSchema.ts).

const cacheKey = (userId: number) => `edurain:active-course:${userId}`;

/** Active course id, or null (none chosen / no longer owned). Cached per student. */
export async function readActiveCourse(userId: number): Promise<number | null> {
  return getOrSetCache(cacheKey(userId), 300, async () => {
    await ensureMentorshipSchema();
    const { rows } = await db.execute<{ course_id: number }>(sql`
      SELECT ac.course_id FROM active_courses ac
      WHERE ac.user_id = ${userId}
        AND EXISTS (SELECT 1 FROM user_courses uc WHERE uc.user_id = ac.user_id AND uc.course_id = ac.course_id)`);
    return rows[0] ? Number(rows[0].course_id) : null;
  });
}

/** Makes an owned course active and moves the goal to its category. Returns the new goal category id (or null). */
export async function setActiveCourse(userId: number, courseId: number): Promise<number | null> {
  await ensureMentorshipSchema();
  const { rows } = await db.execute<{ category_id: number | null }>(sql`
    SELECT c.category_id FROM user_courses uc JOIN courses c ON c.id = uc.course_id
    WHERE uc.user_id = ${userId} AND uc.course_id = ${courseId} LIMIT 1`);
  if (!rows[0]) throw new HttpError(403, "You can only make a course you are enrolled in active");
  const categoryId = rows[0].category_id == null ? null : Number(rows[0].category_id);

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      INSERT INTO active_courses (user_id, course_id, updated_at) VALUES (${userId}, ${courseId}, now())
      ON CONFLICT (user_id) DO UPDATE SET course_id = EXCLUDED.course_id, updated_at = now()`);
    if (categoryId) {
      await tx.execute(sql`
        INSERT INTO student_goals (user_id, category_id, updated_at) VALUES (${userId}, ${categoryId}, now())
        ON CONFLICT (user_id) DO UPDATE SET category_id = EXCLUDED.category_id, updated_at = now()`);
    }
  });
  await invalidateCachePrefix(cacheKey(userId));
  return categoryId;
}

/**
 * After the goal changes (goal popup): keep the active course if it belongs to the new category,
 * otherwise switch to the student's most recently bought course in that category, or clear it.
 */
export async function syncActiveCourseToGoal(userId: number, categoryId: number): Promise<number | null> {
  await ensureMentorshipSchema();
  const current = await readActiveCourse(userId);
  if (current) {
    const { rows } = await db.execute(sql`SELECT 1 FROM courses WHERE id = ${current} AND category_id = ${categoryId}`);
    if (rows[0]) return current;
  }
  const { rows } = await db.execute<{ course_id: number }>(sql`
    SELECT uc.course_id FROM user_courses uc JOIN courses c ON c.id = uc.course_id
    WHERE uc.user_id = ${userId} AND c.category_id = ${categoryId}
    ORDER BY uc.purchased_at DESC NULLS LAST, uc.id DESC LIMIT 1`);
  const next = rows[0] ? Number(rows[0].course_id) : null;
  if (next) {
    await db.execute(sql`
      INSERT INTO active_courses (user_id, course_id, updated_at) VALUES (${userId}, ${next}, now())
      ON CONFLICT (user_id) DO UPDATE SET course_id = EXCLUDED.course_id, updated_at = now()`);
  } else {
    await db.execute(sql`DELETE FROM active_courses WHERE user_id = ${userId}`);
  }
  await invalidateCachePrefix(cacheKey(userId));
  return next;
}