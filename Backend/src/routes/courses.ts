import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable, coursesTable } from "@workspace/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { publicCourseColumns, withPublicThumbnail } from "../lib/course-view";
import { withCoursePlans } from "../lib/coursePlans";
import { publicCourseQuerySchema } from "../lib/course-schemas";
import { HttpError, parseId } from "../lib/http-error";
import { optionalAuth } from "../middlewares/auth";
import { fetchCourseContentTree } from "./content.js";
import { getOrSetCache } from "../lib/perfEngine";
import { parsePagination, sendPaginatedResponse } from "../lib/pagination";

// Public catalog used by the mobile app & web app. Only published courses are ever returned.
// Admin CRUD lives in routes/admin/courses.ts.
const router = Router();

// GET /api/courses?category=<slug>
router.get("/", async (req, res) => {
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

  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
  const pagination = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });
  const allFormatted = coursesWithPlans.map((c) => withPublicThumbnail(c, req));
  const paginatedItems = pagination.isExplicitPagination
    ? allFormatted.slice(pagination.offset, pagination.offset + pagination.limit)
    : allFormatted;

  return sendPaginatedResponse(res, req, paginatedItems, allFormatted.length, pagination);
});

// GET /api/courses/:id/content — Return items for a given course filtered optionally by parentId, sorted ascending by order
router.get("/:id/content", optionalAuth, async (req, res) => {
  const courseId = parseId(req.params.id);
  const rawParentId = req.query.parentId !== undefined ? req.query.parentId : req.query.parent_id;
  const parentId = rawParentId !== undefined && rawParentId !== null ? String(rawParentId) : undefined;
  const items = await fetchCourseContentTree(courseId, parentId, req);
  res.json({ success: true, data: items, content: items });
});

// GET /api/courses/:id
router.get("/:id", async (req, res) => {
  const courseId = parseId(req.params.id);
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

  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
  res.json(withPublicThumbnail(withPlans, req));
});

export default router;
