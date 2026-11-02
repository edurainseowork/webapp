import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable, coursesTable } from "@workspace/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { publicCourseColumns, withPublicThumbnail } from "../lib/course-view";
import { withCoursePlans } from "../lib/coursePlans";
import { publicCourseQuerySchema } from "../lib/course-schemas";
import { HttpError } from "../lib/http-error";
import { optionalAuth } from "../middlewares/auth";
import { fetchCourseContentTree } from "./content.js";
import { getOrSetCache, sendIfChanged } from "../lib/perfEngine";
import { courseFaqs } from "../lib/faqs";
import { parsePagination, sendPaginatedResponse } from "../lib/pagination";

// Public catalog used by the mobile app & web app. Only published courses are ever returned.
// Admin CRUD lives in routes/admin/courses.ts.
const router = Router();

// Helper to resolve numeric ID, slug with trailing ID, or title slug
async function resolveCourseId(param: string): Promise<number> {
  const cleanParam = decodeURIComponent(param).trim();
  if (/^\d+$/.test(cleanParam)) {
    return Number(cleanParam);
  }
  const trailingDigits = cleanParam.match(/-?(\d+)$/);
  if (trailingDigits) {
    const id = Number(trailingDigits[1]);
    const [c] = await db
      .select({ id: coursesTable.id })
      .from(coursesTable)
      .where(and(eq(coursesTable.id, id), eq(coursesTable.isPublished, true)));
    if (c) return c.id;
  }
  const cleanSearch = cleanParam.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cleanSearch) {
    const courses = await db
      .select({ id: coursesTable.id, title: coursesTable.title })
      .from(coursesTable)
      .where(eq(coursesTable.isPublished, true));
    const found = courses.find(
      (c) => c.title.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanSearch
    );
    if (found) return found.id;
  }
  throw new HttpError(404, "Course not found");
}

// GET /api/courses?category=<slug>
router.get("/", async (req, res) => {
  if (await sendIfChanged(req, res, ["edurain:courses", "edurain:categories"])) return;
  const { category } = publicCourseQuerySchema.parse(req.query);
  const cacheKey = `edurain:courses:list:${category || "all"}`;

  const coursesWithPlans = await getOrSetCache(cacheKey, 300, async () => {
    const courses = await db
      .select(publicCourseColumns)
      .from(coursesTable)
      .leftJoin(categoriesTable, eq(coursesTable.categoryId, categoriesTable.id))
      .where(
        and(
          eq(coursesTable.isPublished, true),
          category ? eq(categoriesTable.slug, category) : undefined,
        ),
      )
      .orderBy(asc(categoriesTable.sortOrder), desc(coursesTable.publishedAt), desc(coursesTable.id));

    return withCoursePlans(courses);
  });

  res.setHeader("Cache-Control", "no-cache");
  const pagination = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });
  const allFormatted = coursesWithPlans.map((c) => withPublicThumbnail(c, req));
  const paginatedItems = pagination.isExplicitPagination
    ? allFormatted.slice(pagination.offset, pagination.offset + pagination.limit)
    : allFormatted;

  return sendPaginatedResponse(res, req, paginatedItems, allFormatted.length, pagination);
});

// GET /api/courses/:id/faqs — FAQs from CMS → FAQs (this course + All courses), cached
router.get("/:id/faqs", async (req, res) => {
  const courseId = await resolveCourseId(req.params.id);
  res.json({ success: true, data: await courseFaqs(courseId) });
});

// GET /api/courses/:id/content — Return items for a given course filtered optionally by parentId, sorted ascending by order
router.get("/:id/content", optionalAuth, async (req, res) => {
  const courseId = await resolveCourseId(req.params.id);
  const rawParentId = req.query.parentId !== undefined ? req.query.parentId : req.query.parent_id;
  const parentId = rawParentId !== undefined && rawParentId !== null ? String(rawParentId) : undefined;
  const items = await fetchCourseContentTree(courseId, parentId, req);
  res.json({ success: true, data: items, content: items });
});

// GET /api/courses/:id
router.get("/:id", async (req, res) => {
  const courseId = await resolveCourseId(req.params.id);
  const cacheKey = `edurain:courses:detail:${courseId}`;

  const withPlans = await getOrSetCache(cacheKey, 300, async () => {
    const [course] = await db
      .select(publicCourseColumns)
      .from(coursesTable)
      .leftJoin(categoriesTable, eq(coursesTable.categoryId, categoriesTable.id))
      .where(and(eq(coursesTable.id, courseId), eq(coursesTable.isPublished, true)));

    if (!course) return null;
    const [enriched] = await withCoursePlans([course]);
    return enriched;
  });

  // Drafts answer 404, not 403, so their existence is not revealed.
  if (!withPlans) throw new HttpError(404, "Course not found");

  res.setHeader("Cache-Control", "no-cache");
  res.json(withPublicThumbnail(withPlans, req));
});

export default router;
