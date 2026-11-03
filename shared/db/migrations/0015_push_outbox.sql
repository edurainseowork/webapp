-- Notifications for big audiences waiting to be sent by the scheduled "push" job (Backend/src/lib/expoPush.ts).
-- The app creates this table itself the first time it is needed; run this by hand only if you prefer it as a deploy step.

CREATE TABLE IF NOT EXISTS push_outbox (
  id bigserial PRIMARY KEY,
  tokens text[] NOT NULL,
  message jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
