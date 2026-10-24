-- Lessons a student has opened (= done), for "Overall Syllabus Velocity" on the student profile.
-- Safe to run more than once. The backend also creates it on first use (Backend/src/lib/mentorshipSchema.ts).
CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id integer NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  content_id text NOT NULL,
  completed_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, content_id)
);
CREATE INDEX IF NOT EXISTS lesson_progress_user_course_idx ON lesson_progress (user_id, course_id);