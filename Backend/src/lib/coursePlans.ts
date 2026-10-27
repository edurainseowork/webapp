import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { ensureMentorshipSchema } from "./mentorshipSchema";
import { logger } from "./logger";

// Course plans: Basic / Pro / Pro Max.
//  - Basic = the course's own price + originalPrice (courses table), unchanged for old apps.
//  - Pro and Pro Max have their own price + compare price, set in the CMS course form.
//  - Each plan can list what it includes (one line each).
// Stored in course_plans (created on first use, see lib/mentorshipSchema.ts). Prices are in paise.

export type PlanId = "basic" | "pro" | "proMax";
const DB_PLAN: Record<PlanId, string> = { basic: "basic", pro: "pro", proMax: "pro_max" };
const API_PLAN: Record<string, PlanId> = { basic: "basic", pro: "pro", pro_max: "proMax" };

export type PaidPlan = { price: number; originalPrice: number | null; features: string[] };
export type CoursePlans = { basic?: { features: string[] }; pro?: PaidPlan; proMax?: PaidPlan };

const paise = z.number().int("Price must be in whole paise").min(0).max(100_000_000);
const features = z.array(z.string().trim().min(1).max(120)).max(8, "Up to 8 lines per plan").default([]);

const paidPlan = z
  .object({ price: paise.min(100, "Plan price must be at least ₹1"), originalPrice: paise.nullable().default(null), features })
  .strict()
  .refine((p) => p.originalPrice == null || p.originalPrice >= p.price, {
    message: "Compare price must be greater than or equal to the plan price",
    path: ["originalPrice"],
  });

/** `plans` in the CMS course form. Sending it replaces the course's plan setup; null removes a plan. */
export const coursePlansInput = z
  .object({
    basic: z.object({ features }).strict().optional(),
    pro: paidPlan.nullable().optional(),
    proMax: paidPlan.nullable().optional(),
  })
  .strict();

export type CoursePlansInput = z.infer<typeof coursePlansInput>;

/** Replaces the plans of a course (inside the course save transaction when one is given). */
export async function saveCoursePlans(courseId: number, input: CoursePlansInput, executor: Pick<typeof db, "execute"> = db) {
  await ensureMentorshipSchema();
  const rows: { plan: PlanId; price: number | null; originalPrice: number | null; features: string[] }[] = [];
  if (input.basic && input.basic.features.length) rows.push({ plan: "basic", price: null, originalPrice: null, features: input.basic.features });
  if (input.pro) rows.push({ plan: "pro", ...input.pro });
  if (input.proMax) rows.push({ plan: "proMax", ...input.proMax });

  await executor.execute(sql`DELETE FROM course_plans WHERE course_id = ${courseId}`);
  for (const r of rows) {
    await executor.execute(sql`
      INSERT INTO course_plans (course_id, plan, price, original_price, features)
      VALUES (${courseId}, ${DB_PLAN[r.plan]}, ${r.price}, ${r.originalPrice}, ${JSON.stringify(r.features)}::jsonb)`);
  }
}

/** Plans of the given courses, keyed by course id. */
export async function loadCoursePlans(courseIds: number[]): Promise<Map<number, CoursePlans>> {
  const byCourse = new Map<number, CoursePlans>();
  if (!courseIds.length) return byCourse;
  await ensureMentorshipSchema();
  const { rows } = await db.execute<{ course_id: number; plan: string; price: number | null; original_price: number | null; features: string[] }>(sql`
    SELECT course_id, plan, price, original_price, features FROM course_plans
    WHERE course_id IN (${sql.join(courseIds.map((id) => sql`${id}`), sql`, `)})`);
  for (const r of rows) {
    const plans = byCourse.get(r.course_id) ?? {};
    const id = API_PLAN[r.plan];
    const list = Array.isArray(r.features) ? r.features : [];
    if (id === "basic") plans.basic = { features: list };
    else if (id && r.price != null) plans[id] = { price: Number(r.price), originalPrice: r.original_price == null ? null : Number(r.original_price), features: list };
    byCourse.set(r.course_id, plans);
  }
  return byCourse;
}

/** Adds `plans` to course rows. Never fails the course list: on error the courses show without plans. */
export async function withCoursePlans<T extends { id: number }>(courses: T[]): Promise<(T & { plans: CoursePlans })[]> {
  const byCourse = await loadCoursePlans(courses.map((c) => c.id)).catch((err: unknown) => {
    logger.error({ err }, "Could not load course plans");
    return new Map<number, CoursePlans>();
  });
  return courses.map((c) => ({ ...c, plans: byCourse.get(c.id) ?? {} }));
}

/** The price to charge for a plan of a course (paise), or null when the course does not offer that plan. */
export async function planPrice(courseId: number, basicPrice: number, plan: PlanId): Promise<number | null> {
  await ensureMentorshipSchema();
  if (plan === "basic") return basicPrice;
  const plans = (await loadCoursePlans([courseId])).get(courseId);
  return plans?.[plan]?.price ?? null;
}

export const planIdSchema = z.enum(["basic", "pro", "proMax"]);
export const PLAN_NAMES: Record<PlanId, string> = { basic: "Basic", pro: "Pro", proMax: "Pro Max" };