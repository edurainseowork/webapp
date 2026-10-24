-- Mentorship: mentor profiles, student goals, availability slots, bookings, favourites.
-- Safe to run more than once. The backend also applies this automatically on first use
-- (Backend/src/lib/mentorshipSchema.ts), so running it by hand is optional.

CREATE TABLE IF NOT EXISTS staff_profiles (
  firebase_uid text PRIMARY KEY,
  about text,
  updated_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS headline text;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS institute text;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS achievement text;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS photo text;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS languages text;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS session_minutes integer NOT NULL DEFAULT 30;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS student_goals (
  user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  category_id integer NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mentor_slots (
  id serial PRIMARY KEY,
  mentor_uid text NOT NULL,
  starts_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'open',
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT mentor_slots_mentor_start_unique UNIQUE (mentor_uid, starts_at)
);
CREATE INDEX IF NOT EXISTS mentor_slots_starts_at_idx ON mentor_slots (starts_at);
-- 2-minute hold while a student is booking a slot
ALTER TABLE mentor_slots ADD COLUMN IF NOT EXISTS held_by_user_id integer;
ALTER TABLE mentor_slots ADD COLUMN IF NOT EXISTS held_until timestamptz;
CREATE TABLE IF NOT EXISTS mentor_bookings (
  id serial PRIMARY KEY,
  slot_id integer NOT NULL UNIQUE REFERENCES mentor_slots(id) ON DELETE CASCADE,
  mentor_uid text NOT NULL,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id integer REFERENCES courses(id) ON DELETE SET NULL,
  topic text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'confirmed',
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mentor_bookings_user_id_idx ON mentor_bookings (user_id);
CREATE INDEX IF NOT EXISTS mentor_bookings_mentor_uid_idx ON mentor_bookings (mentor_uid);

CREATE TABLE IF NOT EXISTS mentor_favorites (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentor_uid text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, mentor_uid)
);