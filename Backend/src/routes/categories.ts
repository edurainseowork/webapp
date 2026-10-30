import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable } from "@workspace/db/schema";
import { asc } from "drizzle-orm";
import { getOrSetCache } from "../lib/perfEngine";

// Public category list for the mobile & web app's filter pills.
const router = Router();

router.get("/", async (_req, res) => {
  const categories = await getOrSetCache("edurain:categories:all", 900, async () => {
    return db
      .select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        slug: categoriesTable.slug,
        sortOrder: categoriesTable.sortOrder,
      })
      .from(categoriesTable)
      .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name));
  });

  res.setHeader("Cache-Control", "public, max-age=120, s-maxage=600, stale-while-revalidate=1200");
  res.json(categories);
});

export default router;
