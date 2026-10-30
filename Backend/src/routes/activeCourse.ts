import { Router, type Request } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/security";
import { HttpError } from "../lib/http-error";
import { logger } from "../lib/logger";
import { readActiveCourse, setActiveCourse } from "../lib/activeCourse";

// /api/me/active-course — the ONE course the student is studying now (Your Enrolled Courses).
// The student comes from the verified token; only courses they own can be made active.
const router = Router();
router.use(requireAuth);

const userIdOf = (req: Request) => {
  const id = req.user?.id;
  if (!id) throw new HttpError(401, "Could not load your account. Please log in again.");
  return id;
};

// GET /api/me/active-course → { activeCourseId: number | null }
router.get("/", async (req, res) => {
  res.json({ success: true, activeCourseId: await readActiveCourse(userIdOf(req)) });
});

const Body = z.object({ courseId: z.number({ invalid_type_error: "Choose a course" }).int().positive() }).strict();

// PUT /api/me/active-course { courseId } → { activeCourseId, goalCategoryId } (goal moves to the course's category)
router.put(
  "/",
  rateLimit({ windowMs: 60_000, limit: 30, keyPrefix: "rl:active-course:", keyStrategy: "ip+identifier", algorithm: "token-bucket" }),
  async (req, res) => {
    const userId = userIdOf(req);
    const { courseId } = Body.parse(req.body);
    const goalCategoryId = await setActiveCourse(userId, courseId);
    logger.info({ userId, courseId, goalCategoryId }, "Active course changed");
    res.json({ success: true, activeCourseId: courseId, goalCategoryId });
  },
);

export default router;