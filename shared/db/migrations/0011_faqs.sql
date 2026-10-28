-- Course FAQs (CMS → FAQs). An FAQ shows on chosen courses (faq_courses) or on every course (all_courses).
-- Safe to run more than once. The backend also creates these on first use (Backend/src/lib/mentorshipSchema.ts).
CREATE TABLE IF NOT EXISTS faqs (
  id serial PRIMARY KEY,
  question varchar(300) NOT NULL,
  answer text NOT NULL,
  all_courses boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS faq_courses (
  faq_id integer NOT NULL REFERENCES faqs(id) ON DELETE CASCADE,
  course_id integer NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY (faq_id, course_id)
);
CREATE INDEX IF NOT EXISTS faq_courses_course_id_idx ON faq_courses (course_id);