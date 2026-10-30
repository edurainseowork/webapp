import { Router } from "express";
import { requireAdmin } from "../../middlewares/auth";
import coursesRouter from "./courses.js";
import categoriesRouter from "./categories.js";
import notificationsRouter from "./notifications.js";
import mentorsRouter from "./mentors.js";
import studentsRouter from "./students.js";
import supportContactsRouter from "./supportContacts.js";
import faqsRouter from "./faqs.js";
import { broadcastCatalogChange } from "../../lib/catalogSync";
// Everything under /api/admin requires a verified Firebase token with the admin claim.
const router = Router();

router.use(requireAdmin);
router.use("/courses", broadcastCatalogChange, coursesRouter);
router.use("/categories", broadcastCatalogChange, categoriesRouter);
router.use("/notifications", notificationsRouter);
router.use("/mentors", mentorsRouter);
router.use("/students", studentsRouter);
router.use("/support-contacts", supportContactsRouter);
router.use("/faqs", broadcastCatalogChange, faqsRouter);
export default router;
