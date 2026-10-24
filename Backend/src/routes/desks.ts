import { Router, type Request } from "express";
import { z } from "zod";
import { and, asc, eq, gt, lt } from "drizzle-orm";
import { db, categoriesTable, coursesTable, mentorBookingsTable, mentorSlotsTable, usersTable } from "@workspace/db";
import { requireDeskRole } from "../middleware/auth";
import { rateLimit } from "../middlewares/security";
import { getStaffAbout } from "../lib/staffProfiles";
import { ensureMentorshipSchema } from "../lib/mentorshipSchema";
import { HttpError, parseId } from "../lib/http-error";
import { logger } from "../lib/logger";

// Mentor Desk and Teacher Assistance Desk APIs. Each router only admits its own role
// (requireDeskRole); desk accounts are blocked from every other API by restrictDeskRoles.

const deskProfile = (req: Request) => ({
  name: req.user?.name || (req.auth?.name as string | undefined) || req.auth?.email?.split("@")[0] || "",
  email: req.user?.email || req.auth?.email || "",
  role: req.user?.role,
});

const mentorUid = (req: Request) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpError(401, "Authentication required");
  return uid;
};

// /api/mentor-desk
export const mentorDeskRouter = Router();
mentorDeskRouter.use(requireDeskRole("mentor"));
// GET /api/mentor-desk/me — the signed-in mentor, with the "About Mentor" set when invited
mentorDeskRouter.get("/me", async (req, res) => {
  const uid = req.auth?.uid;
  const about = uid
    ? await getStaffAbout(uid).catch((err) => {
        logger.error({ err, uid }, "Could not load About Mentor");
        return null;
      })
    : null;
  res.json({ success: true, data: { ...deskProfile(req), about } });
});

const MIN_LEAD_MS = 30 * 60_000;
const MAX_AHEAD_DAYS = 60;

// GET /api/mentor-desk/slots — this mentor's availability (from yesterday on), with any booking
mentorDeskRouter.get("/slots", async (req, res) => {
  const uid = mentorUid(req);
  await ensureMentorshipSchema();
  const rows = await db
    .select({
      id: mentorSlotsTable.id,
      startsAt: mentorSlotsTable.startsAt,
      durationMinutes: mentorSlotsTable.durationMinutes,
      status: mentorSlotsTable.status,
      studentName: usersTable.name,
      topic: mentorBookingsTable.topic,
    })
    .from(mentorSlotsTable)
    .leftJoin(mentorBookingsTable, eq(mentorBookingsTable.slotId, mentorSlotsTable.id))
    .leftJoin(usersTable, eq(mentorBookingsTable.userId, usersTable.id))
    .where(and(eq(mentorSlotsTable.mentorUid, uid), gt(mentorSlotsTable.startsAt, new Date(Date.now() - 86_400_000))))
    .orderBy(asc(mentorSlotsTable.startsAt));
  res.json({ success: true, data: rows.map((r) => ({ ...r, startsAt: new Date(r.startsAt).toISOString() })) });
});

const SlotBody = z
  .object({
    startsAt: z.string().datetime({ offset: true, message: "Pick a valid date and time" }),
    durationMinutes: z.number().int().min(15, "Sessions are at least 15 minutes").max(120, "Sessions are at most 120 minutes"),
  })
  .strict();

// POST /api/mentor-desk/slots { startsAt, durationMinutes } — offer a time for 1:1 sessions
mentorDeskRouter.post("/slots", rateLimit({ windowMs: 60_000, max: 60 }), async (req, res) => {
  const uid = mentorUid(req);
  const { startsAt, durationMinutes } = SlotBody.parse(req.body);
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  if (start.getTime() < Date.now() + MIN_LEAD_MS) throw new HttpError(400, "Pick a time at least 30 minutes from now");
  if (start.getTime() > Date.now() + MAX_AHEAD_DAYS * 86_400_000) throw new HttpError(400, `Slots can be added up to ${MAX_AHEAD_DAYS} days ahead`);

  await ensureMentorshipSchema();
  // No overlapping slots for the same mentor (2 hours back covers the longest session)
  const nearby = await db
    .select({ startsAt: mentorSlotsTable.startsAt, durationMinutes: mentorSlotsTable.durationMinutes })
    .from(mentorSlotsTable)
    .where(and(eq(mentorSlotsTable.mentorUid, uid), gt(mentorSlotsTable.startsAt, new Date(start.getTime() - 120 * 60_000)), lt(mentorSlotsTable.startsAt, end)));
  if (nearby.some((s) => new Date(s.startsAt).getTime() + s.durationMinutes * 60_000 > start.getTime())) {
    throw new HttpError(409, "This time overlaps a slot you already added");
  }

  const [slot] = await db.insert(mentorSlotsTable).values({ mentorUid: uid, startsAt: start, durationMinutes }).returning();
  res.status(201).json({ success: true, data: { ...slot, startsAt: new Date(slot.startsAt).toISOString() } });
});

// DELETE /api/mentor-desk/slots/:id — remove an open slot (booked ones stay)
mentorDeskRouter.delete("/slots/:id", async (req, res) => {
  const uid = mentorUid(req);
  const id = parseId(req.params.id);
  await ensureMentorshipSchema();
  const [slot] = await db.select({ status: mentorSlotsTable.status }).from(mentorSlotsTable).where(and(eq(mentorSlotsTable.id, id), eq(mentorSlotsTable.mentorUid, uid))).limit(1);
  if (!slot) throw new HttpError(404, "Slot not found");
  if (slot.status !== "open") throw new HttpError(409, "A student has booked this slot, so it can't be removed");
  await db.delete(mentorSlotsTable).where(and(eq(mentorSlotsTable.id, id), eq(mentorSlotsTable.mentorUid, uid), eq(mentorSlotsTable.status, "open")));
  res.json({ success: true });
});

// GET /api/mentor-desk/sessions — sessions students booked with this mentor (from yesterday on)
mentorDeskRouter.get("/sessions", async (req, res) => {
  const uid = mentorUid(req);
  await ensureMentorshipSchema();
  const rows = await db
    .select({
      id: mentorBookingsTable.id,
      topic: mentorBookingsTable.topic,
      studentName: usersTable.name,
      studentEmail: usersTable.email,
      courseTitle: coursesTable.title,
      category: categoriesTable.name,
      startsAt: mentorSlotsTable.startsAt,
      durationMinutes: mentorSlotsTable.durationMinutes,
    })
    .from(mentorBookingsTable)
    .innerJoin(mentorSlotsTable, eq(mentorBookingsTable.slotId, mentorSlotsTable.id))
    .innerJoin(usersTable, eq(mentorBookingsTable.userId, usersTable.id))
    .leftJoin(coursesTable, eq(mentorBookingsTable.courseId, coursesTable.id))
    .leftJoin(categoriesTable, eq(coursesTable.categoryId, categoriesTable.id))
    .where(and(eq(mentorBookingsTable.mentorUid, uid), eq(mentorBookingsTable.status, "confirmed"), gt(mentorSlotsTable.startsAt, new Date(Date.now() - 86_400_000))))
    .orderBy(asc(mentorSlotsTable.startsAt));
  res.json({
    success: true,
    data: rows.map((r) => {
      const start = new Date(r.startsAt);
      return {
        id: String(r.id),
        className: r.category ?? "",
        batchName: r.courseTitle ?? "",
        topic: r.topic,
        studentName: r.studentName?.trim() || r.studentEmail.split("@")[0],
        startTime: start.toISOString(),
        endTime: new Date(start.getTime() + r.durationMinutes * 60_000).toISOString(),
        meetLink: null,
      };
    }),
  });
});

// /api/teacher-assistant-desk
export const teacherAssistantDeskRouter = Router();
teacherAssistantDeskRouter.use(requireDeskRole("teacher_assistant"));
// GET /api/teacher-assistant-desk/me — the signed-in teacher assistance user
teacherAssistantDeskRouter.get("/me", (req, res) => {
  res.json({ success: true, data: deskProfile(req) });
});