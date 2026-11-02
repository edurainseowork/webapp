import { Router, type Request } from "express";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, categoriesTable, studentGoalsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/security";
import { HttpError } from "../lib/http-error";
import { ensureMentorshipSchema } from "../lib/mentorshipSchema";
import { syncActiveCourseToGoal } from "../lib/activeCourse";
// /api/me/goal — the signed-in student's goal (exam / cohort). Goals are the CMS categories
// (GET /api/categories). The user comes from the verified token, never from the request body.
const router = Router();
router.use(requireAuth);

const userIdOf = (req: Request) => {
  const id = req.user?.id;
  if (!id) throw new HttpError(401, "Could not load your account. Please log in again.");
  return id;
};

async function readGoal(userId: number) {
  await ensureMentorshipSchema();
  const [row] = await db
    .select({ id: categoriesTable.id, name: categoriesTable.name, slug: categoriesTable.slug })
    .from(studentGoalsTable)
    .innerJoin(categoriesTable, eq(studentGoalsTable.categoryId, categoriesTable.id))
    .where(eq(studentGoalsTable.userId, userId))
    .limit(1);
  if (row) return row;

  // Fallback 1: Derive goal from active course if already chosen
  const { rows: activeRows } = await db.execute<{ id: number; name: string; slug: string }>(sql`
    SELECT cat.id, cat.name, cat.slug
    FROM active_courses ac
    JOIN courses c ON c.id = ac.course_id
    JOIN categories cat ON cat.id = c.category_id
    WHERE ac.user_id = ${userId}
    LIMIT 1`);
  if (activeRows[0]) {
    await db.execute(sql`
      INSERT INTO student_goals (user_id, category_id, updated_at)
      VALUES (${userId}, ${activeRows[0].id}, now())
      ON CONFLICT (user_id) DO UPDATE SET category_id = EXCLUDED.category_id, updated_at = now()`);
    return { id: Number(activeRows[0].id), name: activeRows[0].name, slug: activeRows[0].slug };
  }

  // Fallback 2: Derive goal from student's enrolled courses (auto-sync enrolled course target)
  const { rows: enrolledRows } = await db.execute<{ id: number; name: string; slug: string; course_id: number }>(sql`
    SELECT cat.id, cat.name, cat.slug, uc.course_id
    FROM user_courses uc
    JOIN courses c ON c.id = uc.course_id
    JOIN categories cat ON cat.id = c.category_id
    WHERE uc.user_id = ${userId}
    ORDER BY uc.purchased_at DESC NULLS LAST, uc.id DESC
    LIMIT 1`);
  if (enrolledRows[0]) {
    await db.execute(sql`
      INSERT INTO student_goals (user_id, category_id, updated_at)
      VALUES (${userId}, ${enrolledRows[0].id}, now())
      ON CONFLICT (user_id) DO UPDATE SET category_id = EXCLUDED.category_id, updated_at = now()`);
    await db.execute(sql`
      INSERT INTO active_courses (user_id, course_id, updated_at)
      VALUES (${userId}, ${enrolledRows[0].course_id}, now())
      ON CONFLICT (user_id) DO UPDATE SET course_id = EXCLUDED.course_id, updated_at = now()`);
    return { id: Number(enrolledRows[0].id), name: enrolledRows[0].name, slug: enrolledRows[0].slug };
  }

  return null;
}

// GET /api/me/goal → { goal: { id, name, slug } | null }
router.get("/", async (req, res) => {
  res.json({ success: true, goal: await readGoal(userIdOf(req)) });
});

const SaveGoalBody = z.object({ categoryId: z.number({ invalid_type_error: "Choose a goal" }).int().positive() }).strict();

// PUT /api/me/goal { categoryId } → saves (or changes) the goal
router.put("/", rateLimit({ windowMs: 60_000, max: 20 }), async (req, res) => {
  const userId = userIdOf(req);
  const { categoryId } = SaveGoalBody.parse(req.body);
  const [category] = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.id, categoryId)).limit(1);
  if (!category) throw new HttpError(400, "This goal is no longer available. Please pick another one.");

  await ensureMentorshipSchema();
  await db
    .insert(studentGoalsTable)
    .values({ userId, categoryId, updatedAt: new Date() })
    .onConflictDoUpdate({ target: studentGoalsTable.userId, set: { categoryId, updatedAt: new Date() } });
  // Keep the active course in the new cohort (or pick one from it)
  const activeCourseId = await syncActiveCourseToGoal(userId, categoryId);
  res.json({ success: true, goal: await readGoal(userId), activeCourseId });
});

export default router;