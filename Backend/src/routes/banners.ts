import { Router } from "express";
import { db } from "@workspace/db";
import { bannersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

// Get all banners (optional ?placement=home|purchases)
router.get("/", async (req, res) => {
  try {
    const placement = typeof req.query.placement === "string" ? req.query.placement : undefined;
    if (placement) {
      const banners = await db
        .select()
        .from(bannersTable)
        .where(eq(bannersTable.placement, placement))
        .orderBy(desc(bannersTable.createdAt));
      return res.json({ success: true, data: banners });
    }
    const banners = await db.select().from(bannersTable).orderBy(desc(bannersTable.createdAt));
    res.json({ success: true, data: banners });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch banners" });
  }
});

// Create a banner
router.post("/", requireAdmin, async (req, res) => {
  const { imageUrl, placement = "home", courseId, title, linkUrl } = req.body;
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

    const newBanner = await db
      .insert(bannersTable)
      .values({
        imageUrl,
        placement,
        courseId: courseId ? Number(courseId) : null,
        title: title ? String(title).trim() : null,
        linkUrl: linkUrl ? String(linkUrl).trim() : null,
      })
      .returning();
    return res.json({ success: true, data: newBanner[0] });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to create banner: " + error.message });
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
