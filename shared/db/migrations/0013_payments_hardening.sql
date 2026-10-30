-- Payments hardening. The app creates all of this itself the first time it is needed (Backend/src/lib/paymentsSchema.ts);
-- run this file by hand only if you prefer to do it as a deploy step. Every statement is safe to run again.

CREATE TABLE IF NOT EXISTS payment_events (
  id bigserial PRIMARY KEY,
  razorpay_order_id text NOT NULL,
  event text NOT NULL,
  source text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_events_order_idx ON payment_events (razorpay_order_id, id);

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id text PRIMARY KEY,
  event text NOT NULL,
  razorpay_order_id text,
  razorpay_payment_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS payments_status_created_idx ON payments (status, created_at);
CREATE INDEX IF NOT EXISTS payments_payment_id_idx ON payments (razorpay_payment_id);

-- One open (unpaid) order per student and course. Orders the old flow left open (a new one per click) are closed first, newest kept.
UPDATE payments p SET status = 'expired', updated_at = now()
WHERE p.status = 'created'
  AND EXISTS (SELECT 1 FROM payments q WHERE q.user_id = p.user_id AND q.course_id = p.course_id AND q.status = 'created' AND q.id > p.id);
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_open_order ON payments (user_id, course_id) WHERE status = 'created';

-- A student owns a course once. First look for duplicates:
--   SELECT user_id, course_id, count(*) FROM user_courses GROUP BY 1, 2 HAVING count(*) > 1;
-- If that returns rows, remove the extra copies (keeps the oldest) after checking them, then create the rule:
--   DELETE FROM user_courses a USING user_courses b WHERE a.user_id = b.user_id AND a.course_id = b.course_id AND a.id > b.id;
CREATE UNIQUE INDEX IF NOT EXISTS user_courses_user_course_uq ON user_courses (user_id, course_id);
