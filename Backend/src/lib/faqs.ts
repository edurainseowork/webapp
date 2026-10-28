import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { ensureMentorshipSchema } from "./mentorshipSchema";
import { HttpError } from "./http-error";
import { getOrSetCache, invalidateCachePrefix } from "./perfEngine";

// Course FAQs written in CMS → FAQs and shown at the end of the course page on the website.
// An FAQ belongs to chosen courses (faq_courses) or to every course (all_courses).
// The answer is Markdown (bold, italic, lists, links); the website renders it without raw HTML.
// Tables: faqs, faq_courses (created on first use, see lib/mentorshipSchema.ts).

export type Faq = {
  id: number;
  question: string;
  answer: string;
  allCourses: boolean;
  courseIds: number[];
  sortOrder: number;
  updatedAt: string;
};

export type PublicFaq = Pick<Faq, "id" | "question" | "answer">;

const CACHE_PREFIX = "edurain:faqs";

export const faqSchema = z
  .object({
    question: z.string().trim().min(5, "Question must be at least 5 characters").max(300),
    answer: z.string().trim().min(2, "Write an answer").max(5000, "Answer can be up to 5000 characters"),
    allCourses: z.boolean().default(false),
    courseIds: z.array(z.number().int().positive()).max(500).default([]),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
  })
  .strict()
  .refine((f) => f.allCourses || f.courseIds.length > 0, { message: "Choose at least one course or All courses", path: ["courseIds"] });

export const faqQuerySchema = z.object({
  courseId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(100).optional(),
});

type FaqRow = { id: number; question: string; answer: string; all_courses: boolean; course_ids: number[] | null; sort_order: number; updated_at: Date };

const toFaq = (r: FaqRow): Faq => ({
  id: r.id,
  question: r.question,
  answer: r.answer,
  allCourses: r.all_courses,
  courseIds: (r.course_ids ?? []).map(Number),
  sortOrder: r.sort_order,
  updatedAt: new Date(r.updated_at).toISOString(),
});

const SELECT_FAQ = sql`
  SELECT f.id, f.question, f.answer, f.all_courses, f.sort_order, f.updated_at,
         COALESCE((SELECT array_agg(fc.course_id ORDER BY fc.course_id) FROM faq_courses fc WHERE fc.faq_id = f.id), '{}') AS course_ids
  FROM faqs f`;

const escapeLike = (v: string) => v.replace(/[\\%_]/g, (ch) => `\\${ch}`);

/** CMS list, optionally only the FAQs a course shows and / or matching a search. */
export async function listFaqs(filter: z.infer<typeof faqQuerySchema>): Promise<Faq[]> {
  await ensureMentorshipSchema();
  const where = [sql`TRUE`];
  if (filter.courseId) where.push(sql`(f.all_courses OR EXISTS (SELECT 1 FROM faq_courses fc WHERE fc.faq_id = f.id AND fc.course_id = ${filter.courseId}))`);
  if (filter.q) {
    const pattern = `%${escapeLike(filter.q)}%`;
    where.push(sql`(f.question ILIKE ${pattern} OR f.answer ILIKE ${pattern})`);
  }
  const { rows } = await db.execute<FaqRow>(sql`${SELECT_FAQ} WHERE ${sql.join(where, sql` AND `)} ORDER BY f.sort_order, f.id`);
  return rows.map(toFaq);
}

/** FAQs shown on a course page (its own + the All courses ones). Cached; cleared on every FAQ change. */
export async function courseFaqs(courseId: number): Promise<PublicFaq[]> {
  return getOrSetCache(`${CACHE_PREFIX}:course:${courseId}`, 600, async () => {
    await ensureMentorshipSchema();
    const { rows } = await db.execute<PublicFaq>(sql`
      SELECT f.id, f.question, f.answer FROM faqs f
      WHERE f.all_courses OR EXISTS (SELECT 1 FROM faq_courses fc WHERE fc.faq_id = f.id AND fc.course_id = ${courseId})
      ORDER BY f.sort_order, f.id`);
    return rows;
  });
}

type Executor = Pick<typeof db, "execute">;

async function requireCourses(tx: Executor, ids: number[]) {
  if (!ids.length) return;
  const { rows } = await tx.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM courses WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
  if (Number(rows[0]?.n) !== ids.length) throw new HttpError(400, "One of the selected courses no longer exists. Reload and try again.");
}

async function setCourses(tx: Executor, faqId: number, allCourses: boolean, ids: number[]) {
  await tx.execute(sql`DELETE FROM faq_courses WHERE faq_id = ${faqId}`);
  if (allCourses) return; // All courses: no per-course rows
  for (const courseId of ids) await tx.execute(sql`INSERT INTO faq_courses (faq_id, course_id) VALUES (${faqId}, ${courseId})`);
}

async function loadFaq(id: number): Promise<Faq> {
  const { rows } = await db.execute<FaqRow>(sql`${SELECT_FAQ} WHERE f.id = ${id}`);
  if (!rows[0]) throw new HttpError(404, "FAQ not found");
  return toFaq(rows[0]);
}

export async function createFaq(input: z.infer<typeof faqSchema>): Promise<Faq> {
  await ensureMentorshipSchema();
  const ids = [...new Set(input.courseIds)];
  const id = await db.transaction(async (tx) => {
    await requireCourses(tx, input.allCourses ? [] : ids);
    const { rows } = await tx.execute<{ id: number }>(sql`
      INSERT INTO faqs (question, answer, all_courses, sort_order)
      VALUES (${input.question}, ${input.answer}, ${input.allCourses}, ${input.sortOrder}) RETURNING id`);
    await setCourses(tx, rows[0].id, input.allCourses, ids);
    return rows[0].id;
  });
  await invalidateCachePrefix(CACHE_PREFIX);
  return loadFaq(id);
}

export async function updateFaq(id: number, input: z.infer<typeof faqSchema>): Promise<Faq> {
  await ensureMentorshipSchema();
  const ids = [...new Set(input.courseIds)];
  await db.transaction(async (tx) => {
    const { rows } = await tx.execute(sql`
      UPDATE faqs SET question = ${input.question}, answer = ${input.answer}, all_courses = ${input.allCourses},
                      sort_order = ${input.sortOrder}, updated_at = now()
      WHERE id = ${id} RETURNING id`);
    if (!rows[0]) throw new HttpError(404, "FAQ not found");
    await requireCourses(tx, input.allCourses ? [] : ids);
    await setCourses(tx, id, input.allCourses, ids);
  });
  await invalidateCachePrefix(CACHE_PREFIX);
  return loadFaq(id);
}

export async function deleteFaq(id: number): Promise<void> {
  await ensureMentorshipSchema();
  const { rows } = await db.execute(sql`DELETE FROM faqs WHERE id = ${id} RETURNING id`);
  if (!rows[0]) throw new HttpError(404, "FAQ not found");
  await invalidateCachePrefix(CACHE_PREFIX);
}