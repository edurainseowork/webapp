-- The student's one active course (Your Enrolled Courses → Set as Active). Changing it also moves the goal.
-- Safe to run more than once. The backend also creates it on first use (Backend/src/lib/mentorshipSchema.ts).
CREATE TABLE IF NOT EXISTS active_courses (
  user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  course_id integer NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  updated_at timestamp NOT NULL DEFAULT now()
);