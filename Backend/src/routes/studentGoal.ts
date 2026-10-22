import { Router, type Request } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, categoriesTable, studentGoalsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/security";
import { HttpError } from "../lib/http-error";
import { ensureMentorshipSchema } from "../lib/mentorshipSchema";

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
  return row ?? null;
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
  res.json({ success: true, goal: await readGoal(userId) });
});

export default router;