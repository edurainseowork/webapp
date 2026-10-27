import { Router } from "express";
import { HttpError, parseId } from "../../lib/http-error";
import { logger } from "../../lib/logger";
import {
  createSupportContact,
  deleteSupportContact,
  listSupportContacts,
  supportContactSchema,
  supportContactUpdateSchema,
  updateSupportContact,
} from "../../lib/supportContacts";

// CMS → Support Contacts. Mounted behind requireAdmin in routes/admin/index.ts.
const router = Router();

const MAX_CONTACTS = 20;

// GET /api/admin/support-contacts
router.get("/", async (_req, res) => {
  res.json({ success: true, data: await listSupportContacts() });
});

// POST /api/admin/support-contacts
router.post("/", async (req, res) => {
  const input = supportContactSchema.parse(req.body);
  if ((await listSupportContacts()).length >= MAX_CONTACTS) throw new HttpError(400, `You can add up to ${MAX_CONTACTS} support numbers`);
  const created = await createSupportContact(input);
  logger.info({ adminUid: req.auth?.uid, supportContactId: created.id }, "Support contact created");
  res.status(201).json({ success: true, data: created });
});

// PATCH /api/admin/support-contacts/:id
router.patch("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const input = supportContactUpdateSchema.parse(req.body);
  const updated = await updateSupportContact(id, input);
  logger.info({ adminUid: req.auth?.uid, supportContactId: id }, "Support contact updated");
  res.json({ success: true, data: updated });
});

// DELETE /api/admin/support-contacts/:id
router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  await deleteSupportContact(id);
  logger.info({ adminUid: req.auth?.uid, supportContactId: id }, "Support contact deleted");
  res.json({ success: true });
});

export default router;