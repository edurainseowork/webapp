import { Router } from "express";
import { listSupportContacts } from "../lib/supportContacts";

// Public list of support numbers (set in CMS → Support Contacts) for the study website and app.
const router = Router();

// GET /api/support-contacts
router.get("/", async (_req, res) => {
  res.set("Cache-Control", "no-cache");
  res.json({ success: true, data: await listSupportContacts() });
});

export default router;