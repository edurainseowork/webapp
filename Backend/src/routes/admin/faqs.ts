import { Router } from "express";
import { parseId } from "../../lib/http-error";
import { logger } from "../../lib/logger";
import { rateLimit } from "../../middlewares/security";
import { createFaq, deleteFaq, faqQuerySchema, faqSchema, listFaqs, updateFaq } from "../../lib/faqs";

// CMS → FAQs. Mounted behind requireAdmin in routes/admin/index.ts.
const router = Router();

const writeLimit = rateLimit({ windowMs: 60_000, limit: 60, keyPrefix: "rl:admin-faqs:", keyStrategy: "ip+identifier", algorithm: "token-bucket" });

// GET /api/admin/faqs?courseId=&q=
router.get("/", async (req, res) => {
  res.json({ success: true, data: await listFaqs(faqQuerySchema.parse(req.query)) });
});

// POST /api/admin/faqs
router.post("/", writeLimit, async (req, res) => {
  const faq = await createFaq(faqSchema.parse(req.body));
  logger.info({ adminUid: req.auth?.uid, faqId: faq.id }, "FAQ created");
  res.status(201).json({ success: true, data: faq });
});

// PUT /api/admin/faqs/:id
router.put("/:id", writeLimit, async (req, res) => {
  const id = parseId(req.params.id);
  const faq = await updateFaq(id, faqSchema.parse(req.body));
  logger.info({ adminUid: req.auth?.uid, faqId: id }, "FAQ updated");
  res.json({ success: true, data: faq });
});

// DELETE /api/admin/faqs/:id
router.delete("/:id", writeLimit, async (req, res) => {
  const id = parseId(req.params.id);
  await deleteFaq(id);
  logger.info({ adminUid: req.auth?.uid, faqId: id }, "FAQ deleted");
  res.json({ success: true });
});

export default router;