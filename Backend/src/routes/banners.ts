import { Router } from "express";
import { db } from "@workspace/db";
import { bannersTable } from "@workspace/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { getOrSetCache, invalidateCachePrefix } from "../lib/perfEngine";
import { logger } from "../lib/logger";

const router = Router();

// Complete set of allowed placements across Web & Mobile platforms:
// Web (3.2:1 ratio): web_home, courses, purchases
// Mobile (1.8:1 ratio): home / mobile_home, mobile_courses, mobile_purchases
const VALID_PLACEMENTS = new Set([
  "home",
  "mobile_home",
  "mobile_courses",
  "mobile_purchases",
  "web_home",
  "purchases",
  "courses",
]);

// Get banners by placement (Singleflight + Stale-While-Revalidate + Jitter)
// When placement is omitted (e.g. legacy mobile app calling GET /api/banners), default to 'home'
router.get("/", async (req, res) => {
  try {
    const rawPlacement = typeof req.query.placement === "string" ? req.query.placement.trim() : undefined;

    // Admin / CMS dashboard requesting all banners: always fresh from DB, never cached by browser
    if (rawPlacement === "all") {
      const banners = await db
        .select()
        .from(bannersTable)
        .orderBy(asc(bannersTable.sortOrder), desc(bannersTable.createdAt));

      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      return res.json({ success: true, data: banners });
    }

    const targetKey = rawPlacement || "home";
    const cacheKey = `edurain:banners:${targetKey}`;

    const banners = await getOrSetCache(cacheKey, 600, async () => {
      return db
        .select()
        .from(bannersTable)
        .where(eq(bannersTable.placement, targetKey))
        .orderBy(asc(bannersTable.sortOrder), desc(bannersTable.createdAt));
    });

    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    return res.json({ success: true, data: banners });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch banners" });
  }
});

// Create a banner
router.post("/", requireAdmin, async (req, res) => {
  const { imageUrl, placement = "home", courseId, title, linkUrl, sortOrder } = req.body;
  if (!imageUrl) {
    return res.status(400).json({ error: "imageUrl is required" });
  }

  const normalizedPlacement = VALID_PLACEMENTS.has(placement) ? placement : "home";

  try {
    const existing = await db
      .select()
      .from(bannersTable)
      .where(eq(bannersTable.placement, normalizedPlacement));
    if (existing.length >= 5) {
      return res.status(400).json({ error: `Maximum 5 banners allowed for ${normalizedPlacement}. Delete one first.` });
    }

    const bannerSortOrder = sortOrder != null ? Number(sortOrder) : existing.length;

    const newBanner = await db
      .insert(bannersTable)
      .values({
        imageUrl,
        placement: normalizedPlacement,
        courseId: courseId ? Number(courseId) : null,
        title: title ? String(title).trim() : null,
        linkUrl: linkUrl ? String(linkUrl).trim() : null,
        sortOrder: bannerSortOrder,
      })
      .returning();

    await invalidateCachePrefix("edurain:banners");
    return res.json({ success: true, data: newBanner[0] });
  } catch (error: any) {
    logger.error({ err: error }, "[banners] Failed to create banner");
    return res.status(500).json({ error: "Failed to create banner" });
  }
});

// Update banner display order (sort order)
router.put("/reorder", requireAdmin, async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "items array is required" });
  }

  try {
    for (const item of items) {
      if (item && item.id != null && item.sortOrder != null) {
        await db
          .update(bannersTable)
          .set({ sortOrder: Number(item.sortOrder) })
          .where(eq(bannersTable.id, Number(item.id)));
      }
    }
    await invalidateCachePrefix("edurain:banners");
    return res.json({ success: true, message: "Banner order updated successfully" });
  } catch (error: any) {
    logger.error({ err: error }, "[banners] Failed to reorder banners");
    return res.status(500).json({ error: "Failed to reorder banners" });
  }
});

// Delete a banner
router.delete("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.delete(bannersTable).where(eq(bannersTable.id, parseInt(String(id))));
    await invalidateCachePrefix("edurain:banners");
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete banner" });
  }
});

export default router;
