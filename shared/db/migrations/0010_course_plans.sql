-- Course plans: Basic / Pro / Pro Max (CMS course form). Basic price stays in courses.price / original_price.
-- Safe to run more than once. The backend also creates these on first use (Backend/src/lib/mentorshipSchema.ts).
CREATE TABLE IF NOT EXISTS course_plans (
  course_id integer NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  plan varchar(10) NOT NULL CHECK (plan IN ('basic', 'pro', 'pro_max')),
  price integer,
  original_price integer,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, plan)
);

-- Plan bought with each Razorpay order
CREATE TABLE IF NOT EXISTS payment_plans (
  razorpay_order_id text PRIMARY KEY,
  plan varchar(10) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);