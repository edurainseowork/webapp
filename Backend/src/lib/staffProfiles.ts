import { inArray } from "drizzle-orm";
import { ensureMentorshipSchema } from "./mentorshipSchema";
import { db, staffProfilesTable } from "@workspace/db";

// "About Mentor" and other staff profile text, stored in the staff_profiles table against the
// Firebase uid. Kept out of Firebase custom claims on purpose: claims are limited to 1000 bytes
// and are sent with every request.

export const ABOUT_MAX_LENGTH = 1000;

// The table is created / extended on first use (lib/mentorshipSchema.ts)
const ensureTable = ensureMentorshipSchema;

/** Saves (or replaces) the description for one account. An empty value clears it. */
export async function setStaffAbout(firebaseUid: string, about: string): Promise<void> {
  await ensureTable();
  const value = about.trim() || null;
  await db
    .insert(staffProfilesTable)
    .values({ firebaseUid, about: value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: staffProfilesTable.firebaseUid, set: { about: value, updatedAt: new Date() } });
}

/** Description per Firebase uid, for the given accounts (missing = no description). */
export async function getStaffAbouts(firebaseUids: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!firebaseUids.length) return result;
  await ensureTable();
  const rows = await db
    .select({ uid: staffProfilesTable.firebaseUid, about: staffProfilesTable.about })
    .from(staffProfilesTable)
    .where(inArray(staffProfilesTable.firebaseUid, firebaseUids));
  for (const row of rows) if (row.about) result.set(row.uid, row.about);
  return result;
}

export async function getStaffAbout(firebaseUid: string): Promise<string | null> {
  return (await getStaffAbouts([firebaseUid])).get(firebaseUid) ?? null;
}

export type StaffProfile = {
  about: string | null;
  headline: string | null;
  institute: string | null;
  achievement: string | null;
  photo: string | null;
  languages: string | null;
  sessionMinutes: number;
  verified: boolean;
  active: boolean;
};

const PROFILE_DEFAULTS: StaffProfile = {
  about: null,
  headline: null,
  institute: null,
  achievement: null,
  photo: null,
  languages: null,
  sessionMinutes: 30,
  verified: false,
  active: true,
};

/** Full mentor profile per Firebase uid (defaults for accounts without a row yet). */
export async function getStaffProfiles(firebaseUids: string[]): Promise<Map<string, StaffProfile>> {
  const result = new Map<string, StaffProfile>();
  if (!firebaseUids.length) return result;
  await ensureTable();
  const rows = await db
    .select({
      uid: staffProfilesTable.firebaseUid,
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
    .from(staffProfilesTable)
    .where(inArray(staffProfilesTable.firebaseUid, firebaseUids));
  for (const { uid, ...profile } of rows) result.set(uid, profile);
  for (const uid of firebaseUids) if (!result.has(uid)) result.set(uid, { ...PROFILE_DEFAULTS });
  return result;
}

/** Updates only the given fields of one account's profile (creates the row if needed). */
export async function updateStaffProfile(firebaseUid: string, patch: Partial<StaffProfile>): Promise<void> {
  await ensureTable();
  const values = { ...patch, updatedAt: new Date() };
  await db
    .insert(staffProfilesTable)
    .values({ firebaseUid, ...values })
    .onConflictDoUpdate({ target: staffProfilesTable.firebaseUid, set: values });
}