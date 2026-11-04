import type { NextFunction, Request, Response } from "express";
import { pool } from "@workspace/db";
import { extractUserRole } from "../middleware/auth.js";

// Paid features (doubt tickets, 1:1 mentorship, EduAI Tutor) need at least one bought course.
// Staff always pass. Runs after sign-in middleware, so req.user is the caller's database row.
const STAFF_ROLES = new Set(["admin", "faculty", "mentor", "teacher_assistant"]);

export async function hasAnyCourse(userId: number | undefined): Promise<boolean> {
  if (!userId) return false;
  const { rows } = await pool.query("SELECT 1 FROM user_courses WHERE user_id = $1 LIMIT 1", [userId]);
  return rows.length > 0;
}

/** 402 { error, code: "ENROLLMENT_REQUIRED" } for a student without a course. */
export const requireEnrolled = (feature: string) => async (req: Request, res: Response, next: NextFunction) => {
  if (STAFF_ROLES.has(extractUserRole(req))) return next();
  if (await hasAnyCourse(req.user?.id)) return next();
  const message = `${feature} unlocks after you enroll in a course.`;
  res.status(402).json({ error: message, message, code: "ENROLLMENT_REQUIRED" });
};
