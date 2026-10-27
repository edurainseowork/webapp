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
  // Lessons a student opened (profile → Overall Syllabus Velocity); see migrations/0007_lesson_progress.sql
  sql`CREATE TABLE IF NOT EXISTS lesson_progress (
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id integer NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        content_id text NOT NULL,
        completed_at timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, content_id))`,
  sql`CREATE INDEX IF NOT EXISTS lesson_progress_user_course_idx ON lesson_progress (user_id, course_id)`,
  sql`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_discount_amount integer`,
  sql`ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS link text`,
  sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_purchased_banner boolean NOT NULL DEFAULT false`,
  sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS banner_image text`,
  sql`ALTER TABLE banners ADD COLUMN IF NOT EXISTS placement varchar(50) NOT NULL DEFAULT 'home'`,
  sql`ALTER TABLE banners ADD COLUMN IF NOT EXISTS course_id integer`,
  sql`ALTER TABLE banners ADD COLUMN IF NOT EXISTS title text`,
  sql`ALTER TABLE banners ADD COLUMN IF NOT EXISTS link_url text`,
  // CMS → Support Contacts; see migrations/0009_support_contacts.sql
  sql`CREATE TABLE IF NOT EXISTS support_contacts (
        id serial PRIMARY KEY,
        label varchar(60) NOT NULL,
        phone varchar(20) NOT NULL,
        whatsapp boolean NOT NULL DEFAULT false,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now())`,
  // Course plans (Basic / Pro / Pro Max); see migrations/0010_course_plans.sql
  sql`CREATE TABLE IF NOT EXISTS course_plans (
        course_id integer NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        plan varchar(10) NOT NULL CHECK (plan IN ('basic', 'pro', 'pro_max')),
        price integer,
        original_price integer,
        features jsonb NOT NULL DEFAULT '[]'::jsonb,
        updated_at timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY (course_id, plan))`,
  // Plan bought with each Razorpay order (Basic / Pro / Pro Max)
  sql`CREATE TABLE IF NOT EXISTS payment_plans (
        razorpay_order_id text PRIMARY KEY,
        plan varchar(10) NOT NULL,
        created_at timestamp NOT NULL DEFAULT now())`,
  // Ensure billing & course columns exist across all environments
  sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS play_product_id text`,
  sql`ALTER TABLE user_courses ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'razorpay'`,
  sql`ALTER TABLE user_courses ADD COLUMN IF NOT EXISTS play_purchase_token text`,
  sql`ALTER TABLE user_courses ADD COLUMN IF NOT EXISTS play_order_id text`,
  sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'razorpay'`,
  sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS google_alternative_billing_token text`,
  // High-concurrency indexes for 100k+ active students
  sql`CREATE INDEX IF NOT EXISTS user_courses_user_id_idx ON user_courses (user_id)`,
  sql`CREATE INDEX IF NOT EXISTS user_courses_course_id_idx ON user_courses (course_id)`,
  sql`CREATE INDEX IF NOT EXISTS users_email_idx ON users (email)`,
  sql`CREATE INDEX IF NOT EXISTS users_role_idx ON users (role)`,
  sql`CREATE INDEX IF NOT EXISTS banners_placement_idx ON banners (placement, created_at DESC)`,
  sql`CREATE INDEX IF NOT EXISTS admin_notifications_created_at_idx ON admin_notifications (created_at DESC)`,
  sql`CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications (user_id, is_read, created_at DESC)`,
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