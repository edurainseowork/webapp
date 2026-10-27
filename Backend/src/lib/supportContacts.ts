import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { ensureMentorshipSchema } from "./mentorshipSchema";
import { HttpError } from "./http-error";

// Support phone numbers managed in the CMS (Support Contacts) and shown on the study website.
// Table: support_contacts (created on first use, see lib/mentorshipSchema.ts).

export type SupportContact = {
  id: number;
  label: string;
  phone: string;
  whatsapp: boolean;
  sortOrder: number;
};

/** Spaces, dashes, dots and brackets are removed; what is left must be an optional + and 7–15 digits. */
const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s().-]/g, ""))
  .refine((v) => /^\+?[0-9]{7,15}$/.test(v), "Enter a valid phone number (7 to 15 digits, + allowed at the start)");

export const supportContactSchema = z
  .object({
    label: z.string().trim().min(2, "Label must be at least 2 characters").max(60),
    phone,
    whatsapp: z.boolean().default(false),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
  })
  .strict();

export const supportContactUpdateSchema = supportContactSchema.partial().strict();

const COLUMNS = sql`id, label, phone, whatsapp, sort_order AS "sortOrder"`;

export async function listSupportContacts(): Promise<SupportContact[]> {
  await ensureMentorshipSchema();
  const { rows } = await db.execute<SupportContact>(sql`SELECT ${COLUMNS} FROM support_contacts ORDER BY sort_order, id`);
  return rows;
}

export async function createSupportContact(input: z.infer<typeof supportContactSchema>): Promise<SupportContact> {
  await ensureMentorshipSchema();
  const { rows } = await db.execute<SupportContact>(sql`
    INSERT INTO support_contacts (label, phone, whatsapp, sort_order)
    VALUES (${input.label}, ${input.phone}, ${input.whatsapp}, ${input.sortOrder})
    RETURNING ${COLUMNS}`);
  return rows[0];
}

export async function updateSupportContact(id: number, input: z.infer<typeof supportContactUpdateSchema>): Promise<SupportContact> {
  await ensureMentorshipSchema();
  const { rows } = await db.execute<SupportContact>(sql`
    UPDATE support_contacts SET
      label = COALESCE(${input.label ?? null}, label),
      phone = COALESCE(${input.phone ?? null}, phone),
      whatsapp = COALESCE(${input.whatsapp ?? null}::boolean, whatsapp),
      sort_order = COALESCE(${input.sortOrder ?? null}::integer, sort_order),
      updated_at = now()
    WHERE id = ${id}
    RETURNING ${COLUMNS}`);
  if (!rows[0]) throw new HttpError(404, "Support contact not found");
  return rows[0];
}

export async function deleteSupportContact(id: number): Promise<void> {
  await ensureMentorshipSchema();
  const { rows } = await db.execute(sql`DELETE FROM support_contacts WHERE id = ${id} RETURNING id`);
  if (!rows[0]) throw new HttpError(404, "Support contact not found");
}