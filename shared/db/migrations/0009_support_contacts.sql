-- Support phone numbers managed in CMS → Support Contacts and shown on the study website.
-- Safe to run more than once. The backend also creates it on first use (Backend/src/lib/mentorshipSchema.ts).
CREATE TABLE IF NOT EXISTS support_contacts (
  id serial PRIMARY KEY,
  label varchar(60) NOT NULL,
  phone varchar(20) NOT NULL,
  whatsapp boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);