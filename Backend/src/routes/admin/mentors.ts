import { Router } from "express";
import { sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { getStaffAbouts } from "../../lib/staffProfiles";
import { logger } from "../../lib/logger";

// GET /api/admin/mentors — every invited mentor (Manage Users), for picking a course's mentors.
// Admin only (mounted under /api/admin). Read-only: inviting and removing stays Super Admin only.
const router = Router();

router.get("/", async (_req, res) => {
  const rows = await db
    .select({ uid: usersTable.firebaseUid, name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(sql`lower(${usersTable.role}) = 'mentor'`)
    .orderBy(usersTable.name);

  const abouts = await getStaffAbouts(rows.map((r) => r.uid)).catch((err: unknown) => {
    logger.error({ err }, "Could not load mentor descriptions");
    return new Map<string, string>();
  });

  res.json({
    success: true,
    data: rows.map((r) => ({
      uid: r.uid,
      name: r.name?.trim() || r.email.split("@")[0],
      email: r.email,
      about: abouts.get(r.uid) ?? null,
    })),
  });
});

export default router;