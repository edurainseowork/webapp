import { Router } from "express";
import { db } from "@workspace/db";
import { bannersTable } from "@workspace/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

// Get all banners (optional ?placement=home|purchases|all)
// When placement is omitted (e.g. mobile app calling GET /api/banners), default to 'home'
// so 'purchases' banners never appear on mobile app home screen.
router.get("/", async (req, res) => {
  try {
    const placement = typeof req.query.placement === "string" ? req.query.placement : undefined;
    if (placement === "all") {
      const banners = await db
        .select()
        .from(bannersTable)
        .orderBy(asc(bannersTable.sortOrder), desc(bannersTable.createdAt));
      return res.json({ success: true, data: banners });
    }

    const targetPlacement = placement || "home";
    const banners = await db
      .select()
      .from(bannersTable)
      .where(eq(bannersTable.placement, targetPlacement))
      .orderBy(asc(bannersTable.sortOrder), desc(bannersTable.createdAt));
    res.json({ success: true, data: banners });
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
  
  try {
    const existing = await db
      .select()
      .from(bannersTable)
      .where(eq(bannersTable.placement, placement));
    if (existing.length >= 5) {
      return res.status(400).json({ error: `Maximum 5 banners allowed for ${placement}. Delete one first.` });
    }

    const bannerSortOrder = sortOrder != null ? Number(sortOrder) : existing.length;

    const newBanner = await db
      .insert(bannersTable)
      .values({
        imageUrl,
        placement,
        courseId: courseId ? Number(courseId) : null,
        title: title ? String(title).trim() : null,
        linkUrl: linkUrl ? String(linkUrl).trim() : null,
        sortOrder: bannerSortOrder,
      })
      .returning();
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
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete banner" });
  }
});

export default router;
