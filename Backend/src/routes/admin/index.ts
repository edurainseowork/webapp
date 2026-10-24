import { Router } from "express";
import { requireAdmin } from "../../middlewares/auth";
import coursesRouter from "./courses.js";
import categoriesRouter from "./categories.js";
import notificationsRouter from "./notifications.js";
import mentorsRouter from "./mentors.js";
// Everything under /api/admin requires a verified Firebase token with the admin claim.
const router = Router();

router.use(requireAdmin);
router.use("/courses", coursesRouter);
router.use("/categories", categoriesRouter);
router.use("/notifications", notificationsRouter);
router.use("/mentors", mentorsRouter);
export default router;
