import { Router, type Request } from "express";
import { z } from "zod";
import { and, asc, count, eq, gt, lt, ne } from "drizzle-orm";
import {
  db,
  categoriesTable,
  coursesTable,
  mentorBookingsTable,
  mentorFavoritesTable,
  mentorSlotsTable,
  studentGoalsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { rateLimit } from "../middlewares/security";
import { HttpError } from "../lib/http-error";
import { logger } from "../lib/logger";
import { ensureMentorshipSchema } from "../lib/mentorshipSchema";
import {
  BOOKING_LEAD_MS,
  BOOKING_WINDOW_DAYS,
  loadCourseMentorLinks,
  loadFavoriteUids,
  loadMentorProfiles,
  loadSlotSummary,
  toMentorCard,
} from "../lib/mentorship";

// /api/mentorship — 1:1 mentorship for signed-in students: course mentors for the student's goal,
// mentor details with real slots, favourites and booking. The student is always req.user (from
// the verified token); ids in the request are validated against the database.
const router = Router();
router.use(requireAuth);

const MAX_UPCOMING_BOOKINGS = 5;
/** How long a slot stays reserved for the student who picked it */
const HOLD_MS = 2 * 60_000;
const UID_RE = /^[\w-]{1,128}$/;

const userIdOf = (req: Request) => {
  const id = req.user?.id;
  if (!id) throw new HttpError(401, "Could not load your account. Please log in again.");
  return id;
};
const mentorUidParam = (req: Request) => {
  const uid = String(req.params.mentorId ?? "");
  if (!UID_RE.test(uid)) throw new HttpError(400, "Invalid mentor");
  return uid;
};
const optionalId = (v: unknown) => {
  if (v === undefined || v === "" || v === "all") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Invalid filter");
  return n;
};

/** The student's saved goal (category id), if any. */
async function savedGoalId(userId: number): Promise<number | null> {
  await ensureMentorshipSchema();
  const [row] = await db.select({ categoryId: studentGoalsTable.categoryId }).from(studentGoalsTable).where(eq(studentGoalsTable.userId, userId)).limit(1);
  return row?.categoryId ?? null;
}

// GET /api/mentorship/mentors?categoryId=&courseId=&q=
// Mentors of the published courses of a goal (default: the student's saved goal), each mentor
// once even when linked to several courses. Also returns the goal's courses for the course filter.
router.get("/mentors", async (req, res) => {
  const userId = userIdOf(req);
  const requested = optionalId(req.query.categoryId);
  const categoryId = requested ?? (await savedGoalId(userId));
  const courseId = optionalId(req.query.courseId);
  const q = String(req.query.q ?? "").trim().toLowerCase().slice(0, 100);

  const [goal] = categoryId
    ? await db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, categoryId)).limit(1)
    : [];
  if (requested && !goal) throw new HttpError(404, "Goal not found");

  const { courses, byMentor } = await loadCourseMentorLinks(goal?.id ?? null);
  const uids = [...byMentor.keys()];
  const [profiles, slots, favorites] = await Promise.all([loadMentorProfiles(uids), loadSlotSummary(uids), loadFavoriteUids(userId)]);

  const all = uids
    .filter((uid) => profiles.has(uid))
    .map((uid) => toMentorCard(req, uid, profiles.get(uid)!, byMentor.get(uid), slots.get(uid), favorites));

  // Course filter options: only courses that have at least one active mentor
  const courseOptions = courses
    .map((c) => ({ id: c.id, title: c.title, mentorCount: all.filter((m) => m.courses.some((mc) => mc.id === c.id)).length }))
    .filter((c) => c.mentorCount > 0);

  const mentors = all
    .filter((m) => !courseId || m.courses.some((c) => c.id === courseId))
    .filter(
      (m) =>
        !q ||
        [m.name, m.institute, m.headline, m.achievement, ...m.courses.map((c) => c.title)].some((v) => v?.toLowerCase().includes(q)),
    )
    // Mentors with the soonest free slot first, then by name
    .sort((a, b) => (a.nextSlotAt ?? "9").localeCompare(b.nextSlotAt ?? "9") || a.name.localeCompare(b.name));

  res.json({ success: true, goal: goal ?? null, courses: courseOptions, total: all.length, mentors });
});

// GET /api/mentorship/mentors/:mentorId — profile, courses and the bookable slots (next 30 days)
router.get("/mentors/:mentorId", async (req, res) => {
  const userId = userIdOf(req);
  const uid = mentorUidParam(req);
  const { byMentor } = await loadCourseMentorLinks(null);
  const profiles = await loadMentorProfiles([uid]);
  const profile = profiles.get(uid);
  if (!profile || !byMentor.has(uid)) throw new HttpError(404, "Mentor not found");

  const now = new Date();
  const [summary, favorites] = await Promise.all([loadSlotSummary([uid], now), loadFavoriteUids(userId)]);
  const slots = await db
    .select({
      id: mentorSlotsTable.id,
      startsAt: mentorSlotsTable.startsAt,
      durationMinutes: mentorSlotsTable.durationMinutes,
      status: mentorSlotsTable.status,
      heldByUserId: mentorSlotsTable.heldByUserId,
      heldUntil: mentorSlotsTable.heldUntil,
    })
    .from(mentorSlotsTable)
    .where(
      and(
        eq(mentorSlotsTable.mentorUid, uid),
        gt(mentorSlotsTable.startsAt, now),
        lt(mentorSlotsTable.startsAt, new Date(now.getTime() + BOOKING_WINDOW_DAYS * 86_400_000)),
      ),
    )
    .orderBy(asc(mentorSlotsTable.startsAt));

  const bookable = now.getTime() + BOOKING_LEAD_MS;
  res.json({
    success: true,
    mentor: toMentorCard(req, uid, profile, byMentor.get(uid), summary.get(uid), favorites),
    slots: slots.map((s) => {
      const holdActive = !!s.heldUntil && new Date(s.heldUntil).getTime() > now.getTime();
      const heldByMe = holdActive && s.heldByUserId === userId;
      const heldByOther = holdActive && !heldByMe;
      return {
        id: s.id,
        startsAt: new Date(s.startsAt).toISOString(),
        durationMinutes: s.durationMinutes,
        available: s.status === "open" && new Date(s.startsAt).getTime() > bookable && !heldByOther,
        // Another student has picked this time and is booking it right now
        held: s.status === "open" && heldByOther,
        heldUntil: heldByMe ? new Date(s.heldUntil!).toISOString() : null,
      };
    }),
  });
});

/** Throws 404 unless uid is an active mentor linked to a published course. */
async function requireListedMentor(uid: string) {
  const { byMentor } = await loadCourseMentorLinks(null);
  const profiles = await loadMentorProfiles([uid]);
  if (!profiles.has(uid) || !byMentor.has(uid)) throw new HttpError(404, "Mentor not found");
  return { profile: profiles.get(uid)!, courses: byMentor.get(uid)!.courses };
}

const slotIdParam = (req: Request) => {
  const id = Number(req.params.slotId);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid slot");
  return id;
};

// POST /api/mentorship/slots/:slotId/hold — reserve a time for 2 minutes while the student books
// it. A student holds one slot at a time; another student's active hold can't be taken over.
router.post("/slots/:slotId/hold", rateLimit({ windowMs: 60_000, max: 30 }), async (req, res) => {
  const userId = userIdOf(req);
  const slotId = slotIdParam(req);
  await ensureMentorshipSchema();

  const [info] = await db.select({ mentorUid: mentorSlotsTable.mentorUid }).from(mentorSlotsTable).where(eq(mentorSlotsTable.id, slotId)).limit(1);
  if (!info) throw new HttpError(404, "This time slot no longer exists. Please pick another one.");
  await requireListedMentor(info.mentorUid);

  const heldUntil = await db.transaction(async (tx) => {
    const [slot] = await tx.select().from(mentorSlotsTable).where(eq(mentorSlotsTable.id, slotId)).for("update");
    const now = Date.now();
    if (!slot || slot.status !== "open") throw new HttpError(409, "Sorry, this slot was just booked. Please pick another time.");
    if (new Date(slot.startsAt).getTime() <= now + BOOKING_LEAD_MS) throw new HttpError(409, "This slot starts too soon to book. Please pick a later time.");
    if (slot.heldUntil && new Date(slot.heldUntil).getTime() > now && slot.heldByUserId !== userId) {
      throw new HttpError(409, "Another student is booking this slot right now. Please pick another time, or try again in 2 minutes.");
    }
    // One hold per student: release any other slot this student was holding
    await tx
      .update(mentorSlotsTable)
      .set({ heldByUserId: null, heldUntil: null })
      .where(and(eq(mentorSlotsTable.heldByUserId, userId), ne(mentorSlotsTable.id, slotId)));
    const until = new Date(now + HOLD_MS);
    await tx.update(mentorSlotsTable).set({ heldByUserId: userId, heldUntil: until }).where(eq(mentorSlotsTable.id, slotId));
    return until;
  });
  res.json({ success: true, slotId, heldUntil: heldUntil.toISOString() });
});

// DELETE /api/mentorship/slots/:slotId/hold — give the time back (student picked another or left)
router.delete("/slots/:slotId/hold", async (req, res) => {
  const userId = userIdOf(req);
  const slotId = slotIdParam(req);
  await ensureMentorshipSchema();
  await db
    .update(mentorSlotsTable)
    .set({ heldByUserId: null, heldUntil: null })
    .where(and(eq(mentorSlotsTable.id, slotId), eq(mentorSlotsTable.heldByUserId, userId)));
  res.json({ success: true });
});

// PUT /api/mentorship/mentors/:mentorId/favorite — add to the student's favourites
router.put("/mentors/:mentorId/favorite", rateLimit({ windowMs: 60_000, max: 60 }), async (req, res) => {
  const userId = userIdOf(req);
  const uid = mentorUidParam(req);
  await requireListedMentor(uid);
  await db.insert(mentorFavoritesTable).values({ userId, mentorUid: uid }).onConflictDoNothing();
  res.json({ success: true, isFavorite: true });
});

// DELETE /api/mentorship/mentors/:mentorId/favorite — remove from favourites
router.delete("/mentors/:mentorId/favorite", rateLimit({ windowMs: 60_000, max: 60 }), async (req, res) => {
  const userId = userIdOf(req);
  const uid = mentorUidParam(req);
  await ensureMentorshipSchema();
  await db.delete(mentorFavoritesTable).where(and(eq(mentorFavoritesTable.userId, userId), eq(mentorFavoritesTable.mentorUid, uid)));
  res.json({ success: true, isFavorite: false });
});

const BookingBody = z
  .object({
    slotId: z.number().int().positive(),
    topic: z.string().trim().min(3, "Tell your mentor what you would like to discuss").max(100, "Topic is too long"),
    courseId: z.number().int().positive().nullable().optional(),
  })
  .strict();

// POST /api/mentorship/bookings { slotId, topic, courseId? } — book one open slot
router.post("/bookings", rateLimit({ windowMs: 60_000, max: 10 }), async (req, res) => {
  const userId = userIdOf(req);
  const input = BookingBody.parse(req.body);
  await ensureMentorshipSchema();

  const [slotInfo] = await db.select({ mentorUid: mentorSlotsTable.mentorUid }).from(mentorSlotsTable).where(eq(mentorSlotsTable.id, input.slotId)).limit(1);
  if (!slotInfo) throw new HttpError(404, "This time slot no longer exists. Please pick another one.");
  const { profile, courses } = await requireListedMentor(slotInfo.mentorUid);
  if (input.courseId && !courses.some((c) => c.id === input.courseId)) throw new HttpError(400, "This mentor does not teach that course");

  const now = Date.now();
  const [upcoming] = await db
    .select({ value: count() })
    .from(mentorBookingsTable)
    .innerJoin(mentorSlotsTable, eq(mentorBookingsTable.slotId, mentorSlotsTable.id))
    .where(and(eq(mentorBookingsTable.userId, userId), eq(mentorBookingsTable.status, "confirmed"), gt(mentorSlotsTable.startsAt, new Date(now))));
  if (Number(upcoming?.value ?? 0) >= MAX_UPCOMING_BOOKINGS) {
    throw new HttpError(409, `You already have ${MAX_UPCOMING_BOOKINGS} upcoming sessions. Attend one before booking another.`);
  }

  const booking = await db.transaction(async (tx) => {
    // Lock the slot so two students can't book it at the same time
    const [slot] = await tx.select().from(mentorSlotsTable).where(eq(mentorSlotsTable.id, input.slotId)).for("update");
    if (!slot || slot.status !== "open") throw new HttpError(409, "Sorry, this slot was just booked. Please pick another time.");
    if (new Date(slot.startsAt).getTime() <= now + BOOKING_LEAD_MS) throw new HttpError(409, "This slot starts too soon to book. Please pick a later time.");
    if (slot.heldUntil && new Date(slot.heldUntil).getTime() > now && slot.heldByUserId !== userId) {
      throw new HttpError(409, "Another student is booking this slot right now. Please pick another time.");
    }

    await tx.update(mentorSlotsTable).set({ status: "booked", heldByUserId: null, heldUntil: null }).where(eq(mentorSlotsTable.id, slot.id));
    const [created] = await tx
      .insert(mentorBookingsTable)
      .values({ slotId: slot.id, mentorUid: slot.mentorUid, userId, courseId: input.courseId ?? courses[0]?.id ?? null, topic: input.topic })
      .returning({ id: mentorBookingsTable.id });
    return { id: created.id, startsAt: new Date(slot.startsAt).toISOString(), durationMinutes: slot.durationMinutes };
  });

  logger.info({ userId, bookingId: booking.id, mentorUid: slotInfo.mentorUid }, "Mentor session booked");
  res.status(201).json({ success: true, booking: { ...booking, topic: input.topic, mentorId: slotInfo.mentorUid, mentorName: profile.name ?? "" } });
});

// GET /api/mentorship/bookings — the student's upcoming sessions
router.get("/bookings", async (req, res) => {
  const userId = userIdOf(req);
  await ensureMentorshipSchema();
  const rows = await db
    .select({
      id: mentorBookingsTable.id,
      mentorId: mentorBookingsTable.mentorUid,
      topic: mentorBookingsTable.topic,
      startsAt: mentorSlotsTable.startsAt,
      durationMinutes: mentorSlotsTable.durationMinutes,
      courseTitle: coursesTable.title,
    })
    .from(mentorBookingsTable)
    .innerJoin(mentorSlotsTable, eq(mentorBookingsTable.slotId, mentorSlotsTable.id))
    .leftJoin(coursesTable, eq(mentorBookingsTable.courseId, coursesTable.id))
    .where(and(eq(mentorBookingsTable.userId, userId), eq(mentorBookingsTable.status, "confirmed"), gt(mentorSlotsTable.startsAt, new Date())))
    .orderBy(asc(mentorSlotsTable.startsAt));
  const profiles = await loadMentorProfiles([...new Set<string>(rows.map((r) => String(r.mentorId)))]);
  res.json({
    success: true,
    data: rows.map((r) => ({ ...r, startsAt: new Date(r.startsAt).toISOString(), mentorName: profiles.get(r.mentorId)?.name ?? null })),
  });
});

export default router;