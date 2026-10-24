import type { Request } from "express";
import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";
import {
  db,
  categoriesTable,
  coursesTable,
  mentorFavoritesTable,
  mentorSlotsTable,
  staffProfilesTable,
  usersTable,
  type CourseMentor,
} from "@workspace/db";
import { ensureMentorshipSchema } from "./mentorshipSchema";
import { toPublicUrl } from "./media";

// Mentors shown to students are invited mentor accounts (users.role = 'mentor') that are linked
// to a published course (courses.mentors[].uid, picked in the CMS course form). Their profile
// comes from staff_profiles; availability from mentor_slots. Nothing here is hardcoded.

/** Slots must start at least this far ahead to be bookable. */
export const BOOKING_LEAD_MS = 30 * 60_000;
/** How far ahead students can see and book slots. */
export const BOOKING_WINDOW_DAYS = 30;

export type MentorCourse = { id: number; title: string; categoryId: number | null; category: string | null };

export type MentorCard = {
  id: string;
  name: string;
  photo: string | null;
  headline: string | null;
  about: string | null;
  institute: string | null;
  achievement: string | null;
  languages: string | null;
  verified: boolean;
  sessionMinutes: number;
  courses: { id: number; title: string }[];
  goals: string[];
  openSlots: number;
  nextSlotAt: string | null;
  isFavorite: boolean;
};

type CourseRow = { id: number; title: string; categoryId: number | null; category: string | null; mentors: CourseMentor[] | null };

/** Published courses (optionally of one goal) and, per mentor uid, the courses they are linked to. */
export async function loadCourseMentorLinks(categoryId: number | null) {
  const courses: CourseRow[] = await db
    .select({
      id: coursesTable.id,
      title: coursesTable.title,
      categoryId: coursesTable.categoryId,
      category: categoriesTable.name,
      mentors: coursesTable.mentors,
    })
    .from(coursesTable)
    .leftJoin(categoriesTable, eq(coursesTable.categoryId, categoriesTable.id))
    .where(and(eq(coursesTable.isPublished, true), categoryId ? eq(coursesTable.categoryId, categoryId) : undefined))
    .orderBy(coursesTable.title);

  const byMentor = new Map<string, { courses: MentorCourse[]; photo: string | null }>();
  for (const course of courses) {
    for (const m of course.mentors ?? []) {
      if (!m?.uid) continue; // mentors typed in by hand have no account
      const entry = byMentor.get(m.uid) ?? { courses: [], photo: null };
      if (!entry.courses.some((c) => c.id === course.id)) {
        entry.courses.push({ id: course.id, title: course.title, categoryId: course.categoryId, category: course.category });
      }
      entry.photo ??= m.photo ?? null; // course photo as a fallback for the profile photo
      byMentor.set(m.uid, entry);
    }
  }
  return { courses, byMentor };
}

/** Active mentor accounts with their profile, for the given uids. */
export async function loadMentorProfiles(uids: string[]) {
  if (!uids.length) return new Map<string, Awaited<ReturnType<typeof queryProfiles>>[number]>();
  await ensureMentorshipSchema();
  const rows = await queryProfiles(uids);
  return new Map(rows.filter((r) => r.active !== false).map((r) => [r.uid, r]));
}

const queryProfiles = (uids: string[]) =>
  db
    .select({
      uid: usersTable.firebaseUid,
      name: usersTable.name,
      email: usersTable.email,
      about: staffProfilesTable.about,
      headline: staffProfilesTable.headline,
      institute: staffProfilesTable.institute,
      achievement: staffProfilesTable.achievement,
      photo: staffProfilesTable.photo,
      languages: staffProfilesTable.languages,
      sessionMinutes: staffProfilesTable.sessionMinutes,
      verified: staffProfilesTable.verified,
      active: staffProfilesTable.active,
    })
    .from(usersTable)
    .leftJoin(staffProfilesTable, eq(staffProfilesTable.firebaseUid, usersTable.firebaseUid))
    .where(and(inArray(usersTable.firebaseUid, uids), sql`lower(${usersTable.role}) = 'mentor'`));

/** Open, bookable slots per mentor: count and the earliest start. */
export async function loadSlotSummary(uids: string[], now = new Date()) {
  const result = new Map<string, { count: number; next: Date | null }>();
  if (!uids.length) return result;
  await ensureMentorshipSchema();
  const from = new Date(now.getTime() + BOOKING_LEAD_MS);
  const to = new Date(now.getTime() + BOOKING_WINDOW_DAYS * 86_400_000);
  const rows = await db
    .select({
      uid: mentorSlotsTable.mentorUid,
      count: sql<number>`count(*)::int`,
      next: sql<Date | string | null>`min(${mentorSlotsTable.startsAt})`,
    })
    .from(mentorSlotsTable)
    .where(
      and(
        inArray(mentorSlotsTable.mentorUid, uids),
        eq(mentorSlotsTable.status, "open"),
        gt(mentorSlotsTable.startsAt, from),
        lt(mentorSlotsTable.startsAt, to),
      ),
    )
    .groupBy(mentorSlotsTable.mentorUid);
  for (const r of rows) result.set(r.uid, { count: Number(r.count), next: r.next ? new Date(r.next) : null });
  return result;
}

export async function loadFavoriteUids(userId: number | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  await ensureMentorshipSchema();
  const rows = await db.select({ uid: mentorFavoritesTable.mentorUid }).from(mentorFavoritesTable).where(eq(mentorFavoritesTable.userId, userId));
  return new Set(rows.map((r) => r.uid));
}

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

export function toMentorCard(
  req: Request,
  uid: string,
  profile: NonNullable<Awaited<ReturnType<typeof queryProfiles>>[number]>,
  link: { courses: MentorCourse[]; photo: string | null } | undefined,
  slots: { count: number; next: Date | null } | undefined,
  favorites: Set<string>,
): MentorCard {
  const photo = clean(profile.photo) ?? clean(link?.photo);
  const goals = [...new Set((link?.courses ?? []).map((c) => c.category).filter((c): c is string => !!c))];
  return {
    id: uid,
    name: clean(profile.name) ?? profile.email.split("@")[0],
    photo: photo ? toPublicUrl(photo, req) : null,
    headline: clean(profile.headline),
    about: clean(profile.about),
    institute: clean(profile.institute),
    achievement: clean(profile.achievement),
    languages: clean(profile.languages),
    verified: profile.verified === true,
    sessionMinutes: profile.sessionMinutes ?? 30,
    courses: (link?.courses ?? []).map((c) => ({ id: c.id, title: c.title })),
    goals,
    openSlots: slots?.count ?? 0,
    nextSlotAt: slots?.next ? slots.next.toISOString() : null,
    isFavorite: favorites.has(uid),
  };
}