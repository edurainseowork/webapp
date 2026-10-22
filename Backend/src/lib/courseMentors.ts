import { and, inArray, sql } from "drizzle-orm";
import { db, usersTable, type CourseMentor } from "@workspace/db";
import { HttpError } from "./http-error";

/**
 * Mentors picked for a course are invited mentor accounts (users.role = 'mentor'). Checks that each
 * picked uid still is one and takes the name from that account, so a course always shows the
 * mentor's current name. Entries without a uid (typed in by hand earlier) are kept as they are.
 */
export async function resolveCourseMentors(mentors: CourseMentor[]): Promise<CourseMentor[]> {
  const uids = mentors.map((m) => m.uid).filter((uid): uid is string => !!uid);
  if (!uids.length) return mentors.map((m) => ({ ...m, uid: m.uid ?? null }));

  const rows = await db
    .select({ uid: usersTable.firebaseUid, name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(and(inArray(usersTable.firebaseUid, uids), sql`lower(${usersTable.role}) = 'mentor'`));
  const byUid = new Map(rows.map((r) => [r.uid, r]));

  const missing = mentors.filter((m) => m.uid && !byUid.has(m.uid));
  if (missing.length) {
    throw new HttpError(400, `${missing.map((m) => m.name).join(", ")} ${missing.length === 1 ? "is" : "are"} no longer a mentor. Remove them from this course and save again.`);
  }

  return mentors.map((m) => {
    if (!m.uid) return { ...m, uid: null };
    const row = byUid.get(m.uid)!;
    return { ...m, name: row.name?.trim() || m.name || row.email.split("@")[0] };
  });
}