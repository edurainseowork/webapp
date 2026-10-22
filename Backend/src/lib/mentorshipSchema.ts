import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

// Creates / extends the mentorship tables the first time they are needed, so a deploy works
// without a manual migration step. Same SQL as shared/db/migrations/0006_mentorship.sql; every
// statement is idempotent, so running it on an up-to-date database changes nothing.
const STATEMENTS = [
  sql`CREATE TABLE IF NOT EXISTS staff_profiles (firebase_uid text PRIMARY KEY, about text, updated_at timestamp NOT NULL DEFAULT now())`,
  sql`ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS headline text`,
  sql`ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS institute text`,
  sql`ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS achievement text`,
  sql`ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS photo text`,
  sql`ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS languages text`,
  sql`ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS session_minutes integer NOT NULL DEFAULT 30`,
  sql`ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false`,
  sql`ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true`,
  sql`CREATE TABLE IF NOT EXISTS student_goals (
        user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        category_id integer NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        updated_at timestamp NOT NULL DEFAULT now())`,
  sql`CREATE TABLE IF NOT EXISTS mentor_slots (
        id serial PRIMARY KEY,
        mentor_uid text NOT NULL,
        starts_at timestamptz NOT NULL,
        duration_minutes integer NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'open',
        created_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT mentor_slots_mentor_start_unique UNIQUE (mentor_uid, starts_at))`,
  sql`CREATE INDEX IF NOT EXISTS mentor_slots_starts_at_idx ON mentor_slots (starts_at)`,
  sql`ALTER TABLE mentor_slots ADD COLUMN IF NOT EXISTS held_by_user_id integer`,
  sql`ALTER TABLE mentor_slots ADD COLUMN IF NOT EXISTS held_until timestamptz`,
  sql`CREATE TABLE IF NOT EXISTS mentor_bookings (
        id serial PRIMARY KEY,
        slot_id integer NOT NULL UNIQUE REFERENCES mentor_slots(id) ON DELETE CASCADE,
        mentor_uid text NOT NULL,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id integer REFERENCES courses(id) ON DELETE SET NULL,
        topic text NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'confirmed',
        created_at timestamp NOT NULL DEFAULT now())`,
  sql`CREATE INDEX IF NOT EXISTS mentor_bookings_user_id_idx ON mentor_bookings (user_id)`,
  sql`CREATE INDEX IF NOT EXISTS mentor_bookings_mentor_uid_idx ON mentor_bookings (mentor_uid)`,
  sql`CREATE TABLE IF NOT EXISTS mentor_favorites (
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        mentor_uid text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, mentor_uid))`,
];

let ready: Promise<void> | null = null;

async function apply() {
  for (const statement of STATEMENTS) {
    try {
      await db.execute(statement);
    } catch (err) {
      // Two servers starting at once can race on CREATE ... IF NOT EXISTS; the other one won
      const code = (err as { code?: string; cause?: { code?: string } }).code ?? (err as { cause?: { code?: string } }).cause?.code;
      if (code !== "23505" && code !== "42P07" && code !== "42701") throw err;
    }
  }
}

/** Resolves once the mentorship tables exist. Retries on the next call if it failed. */
export function ensureMentorshipSchema(): Promise<void> {
  return (ready ??= apply().catch((err: unknown) => {
    ready = null;
    throw err;
  }));
}