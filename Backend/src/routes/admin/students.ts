import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, userCoursesTable, coursesTable } from "@workspace/db/schema";
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { HttpError, parseId } from "../../lib/http-error";
import { logger } from "../../lib/logger";

const router = Router();

// GET /api/admin/students - list students with their enrolled courses
router.get("/", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    let query = db.select({
      id: usersTable.id,
      firebaseUid: usersTable.firebaseUid,
      email: usersTable.email,
      name: usersTable.name,
      phone: usersTable.phone,
      city: usersTable.city,
      state: usersTable.state,
      createdAt: usersTable.createdAt,
      lastActiveAt: usersTable.lastActiveAt,
    }).from(usersTable);

    if (q) {
      const pattern = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
      query = query.where(
        or(
          ilike(usersTable.name, pattern),
          ilike(usersTable.email, pattern),
          ilike(usersTable.phone, pattern)
        )
      ) as any;
    }

    const students = await query.orderBy(desc(usersTable.createdAt)).limit(100);

    if (students.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    // Notice: only select columns that exist in the physical PostgreSQL user_courses table
    // (user_courses does NOT have payment_method column in the db).
    const studentIds = students.map((s) => s.id);
    let enrollments: Array<{ id: number; userId: number; courseId: number; courseTitle: string; courseCategory: string | null; purchasedAt: Date | null }> = [];
    try {
      enrollments = await db.select({
        id: userCoursesTable.id,
        userId: userCoursesTable.userId,
        courseId: userCoursesTable.courseId,
        courseTitle: coursesTable.title,
        courseCategory: coursesTable.category,
        purchasedAt: userCoursesTable.purchasedAt,
      })
        .from(userCoursesTable)
        .innerJoin(coursesTable, eq(userCoursesTable.courseId, coursesTable.id))
        .where(inArray(userCoursesTable.userId, studentIds));
    } catch (err) {
      logger.warn({ err }, "Could not join user_courses with courses, falling back to empty enrollments");
    }

    const enrollmentMap = new Map<number, Array<{ id: number; courseId: number; courseTitle: string; courseCategory: string | null; purchasedAt: Date | null }>>();
    for (const en of enrollments) {
      const list = enrollmentMap.get(en.userId) || [];
      list.push(en);
      enrollmentMap.set(en.userId, list);
    }

    const result = students.map((s) => {
      const studentEnrollments = enrollmentMap.get(s.id) || [];
      const categories = Array.from(new Set(studentEnrollments.map((e) => e.courseCategory).filter(Boolean)));
      return {
        ...s,
        enrollments: studentEnrollments,
        categories,
      };
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch admin students");
    res.status(500).json({ error: "Failed to fetch students: " + (error?.message || "Internal error") });
  }
});

// POST /api/admin/students/:userId/revoke - revoke course access
router.post("/:userId/revoke", async (req, res) => {
  const userId = parseId(req.params.userId);
  const courseId = Number(req.body?.courseId);
  if (!Number.isInteger(courseId) || courseId <= 0) {
    throw new HttpError(400, "Valid courseId is required");
  }

  const [student] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!student) throw new HttpError(404, "Student not found");

  const [deleted] = await db.delete(userCoursesTable)
    .where(and(eq(userCoursesTable.userId, userId), eq(userCoursesTable.courseId, courseId)))
    .returning();

  if (!deleted) {
    throw new HttpError(404, "Student is not enrolled in this course");
  }

  logger.info({ studentId: userId, courseId, adminEmail: req.auth?.email }, "Student course access revoked by admin");
  res.json({ success: true, message: "Course access revoked successfully" });
});

// POST /api/admin/students/:userId/enroll - manually grant course access
router.post("/:userId/enroll", async (req, res) => {
  const userId = parseId(req.params.userId);
  const courseId = Number(req.body?.courseId);
  if (!Number.isInteger(courseId) || courseId <= 0) {
    throw new HttpError(400, "Valid courseId is required");
  }

  const [student] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!student) throw new HttpError(404, "Student not found");

  const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
  if (!course) throw new HttpError(404, "Course not found");

  const [existing] = await db.select().from(userCoursesTable)
    .where(and(eq(userCoursesTable.userId, userId), eq(userCoursesTable.courseId, courseId)))
    .limit(1);

  if (existing) {
    res.json({ success: true, message: "Student is already enrolled in this course" });
    return;
  }

  await db.insert(userCoursesTable).values({
    userId,
    courseId,
  });

  logger.info({ studentId: userId, courseId, adminEmail: req.auth?.email }, "Student course access granted by admin");
  res.json({ success: true, message: `Access granted to "${course.title}"` });
});

export default router;
