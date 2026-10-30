import { Router, type Request } from "express";
import { and, eq, ne, sql } from "drizzle-orm";
import { db, courseContentTable, lessonProgressTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { verifyCourseEntitlement } from "../middleware/auth";
import { rateLimit } from "../middlewares/security";
import { HttpError, parseId } from "../lib/http-error";
import { ensureMentorshipSchema } from "../lib/mentorshipSchema";

// /api/progress — which lessons the signed-in student has opened (used for the profile's
// "Overall Syllabus Velocity" and the ✓ marks in the course syllabus). Student = the login token.
const router = Router();
router.use(requireAuth);

const userIdOf = (req: Request) => {
  const id = req.user?.id;
  if (!id) throw new HttpError(401, "Could not load your account. Please log in again.");
  return id;
};

// GET /api/progress/:courseId → { completed: [contentId, …] }
router.get("/:courseId", async (req, res) => {
  const userId = userIdOf(req);
  const courseId = parseId(req.params.courseId);
  await ensureMentorshipSchema();
  const rows = await db
    .select({ contentId: lessonProgressTable.contentId })
    .from(lessonProgressTable)
    .where(and(eq(lessonProgressTable.userId, userId), eq(lessonProgressTable.courseId, courseId)));
  res.json({ success: true, completed: rows.map((r) => r.contentId) });
});

// POST /api/progress/:courseId/lessons/:contentId — the student opened this lesson (idempotent)
router.post("/:courseId/lessons/:contentId", rateLimit({ windowMs: 60_000, max: 120 }), async (req, res) => {
  const userId = userIdOf(req);
  const courseId = parseId(req.params.courseId);
  const contentId = String(req.params.contentId ?? "");
  if (!/^[\w-]{1,64}$/.test(contentId)) throw new HttpError(400, "Invalid lesson");

  if (!(await verifyCourseEntitlement(userId, courseId))) throw new HttpError(403, "Enrol in this course to track your progress");
  const [lesson] = await db
    .select({ id: courseContentTable.id })
    .from(courseContentTable)
    .where(and(sql`${courseContentTable.id}::text = ${contentId}`, eq(courseContentTable.courseId, courseId), ne(courseContentTable.type, "folder")))
    .limit(1);
  if (!lesson) throw new HttpError(404, "Lesson not found");

  await ensureMentorshipSchema();
  await db.insert(lessonProgressTable).values({ userId, courseId, contentId }).onConflictDoNothing();
  res.json({ success: true });
});

export default router;