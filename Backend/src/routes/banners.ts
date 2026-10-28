import { Router } from "express";
import { db } from "@workspace/db";
import { bannersTable } from "@workspace/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

// In-memory cache for high-concurrency (20,000+ DAU)
// Invalidated instantly whenever CMS modifies banners
const bannerCache = new Map<string, { data: any[]; expiry: number }>();
const CACHE_TTL_MS = 60 * 1000; // 60s fallback TTL

function invalidateBannerCache() {
  bannerCache.clear();
}

// Allowed placements across Web & Mobile platforms
const VALID_PLACEMENTS = new Set(["home", "mobile_home", "web_home", "purchases", "courses"]);

// Get all banners (optional ?placement=home|mobile_home|web_home|purchases|courses|all)
// When placement is omitted (e.g. mobile app calling GET /api/banners), default to 'home'
// so web/purchases/courses banners never appear on mobile app home screen.
router.get("/", async (req, res) => {
  try {
    const rawPlacement = typeof req.query.placement === "string" ? req.query.placement.trim() : undefined;
    const cacheKey = rawPlacement || "home";
    const now = Date.now();
    const cached = bannerCache.get(cacheKey);

    if (cached && cached.expiry > now) {
      res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      return res.json({ success: true, data: cached.data });
    }

    let banners;
    if (rawPlacement === "all") {
      banners = await db
        .select()
        .from(bannersTable)
        .orderBy(asc(bannersTable.sortOrder), desc(bannersTable.createdAt));
    } else {
      const targetPlacement = rawPlacement || "home";
      banners = await db
        .select()
        .from(bannersTable)
        .where(eq(bannersTable.placement, targetPlacement))
        .orderBy(asc(bannersTable.sortOrder), desc(bannersTable.createdAt));
    }

    bannerCache.set(cacheKey, { data: banners, expiry: now + CACHE_TTL_MS });
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return res.json({ success: true, data: banners });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch banners" });
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

    invalidateBannerCache();
    return res.json({ success: true, data: newBanner[0] });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to create banner: " + error.message });
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
    invalidateBannerCache();
    return res.json({ success: true, message: "Banner order updated successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to reorder banners: " + error.message });
  }
});

// Delete a banner
router.delete("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.delete(bannersTable).where(eq(bannersTable.id, parseInt(String(id))));
    invalidateBannerCache();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete banner" });
  }
});

export default router;
