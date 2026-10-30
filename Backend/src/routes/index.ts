import { Router, type RequestHandler } from "express";
import healthRouter from "./health.js";
import coursesRouter from "./courses.js";
import couponsRouter from "./coupons.js";
import razorpayRouter from "./razorpay.js";
import internalRouter from "./internal.js";
import googlePlayRouter from "./google-play.js";
import contentRouter from "./content.js";
import uploadRouter from "./upload.js";
import bannersRouter from "./banners.js";
import { authRouter } from "./auth.js";
import statsRouter from "./stats.js";
import categoriesRouter from "./categories.js";
import adminRouter from "./admin/index.js";
import liveClassesRouter from "./liveClasses.js";
import notificationsRouter from "./notifications.js";
import enrollmentsRouter from "./enrollments.js";
import adminNotificationsRouter from "./adminNotifications.js";
import profileRouter from "./profile.js";
import bunnyRouter from "./bunny.routes.js";
import cmsTestsRouter from "./cmsTests.js";
import testsRouter from "./tests.js";
import cmsAdminsRouter from "./cmsAdmins.js";
import ticketsRouter from "./tickets.js";
import { mentorDeskRouter, teacherAssistantDeskRouter } from "./desks.js";
import studentGoalRouter from "./studentGoal.js";
import activeCourseRouter from "./activeCourse.js";
import mentorshipRouter from "./mentorship.js";
import progressRouter from "./progress.js";
import ebooksRouter from "./ebooks.js";
import aiDoubtRouter from "./aiDoubt.js";
import supportContactsRouter from "./supportContacts.js";
import { restrictDeskRoles, authenticateToken, verifyToken } from "../middleware/auth.js";
import {
  adminApiLimiter,
  aiRateLimiter,
  catalogReadLimiter,
  paymentRateLimiter,
  studentActionLimiter,
  uploadLeakyLimiter,
} from "../middlewares/security.js";

const router = Router();

// The payment limiter counts per student, but it runs before the routes sign the request in, so it only ever saw
// the IP address: every student on one college Wi-Fi shared 20 payment calls a minute. This tells it who is calling
// (signature check only, no database); a missing or bad token still falls back to the IP.
const identifyStudent: RequestHandler = async (req, _res, next) => {
  try {
    const decoded = await verifyToken(req, false);
    if (decoded) req.auth = decoded;
  } catch {
    // The route's own sign-in check answers 401
  }
  next();
};

// Mentor / Teacher Assistance accounts may only reach /auth/me and their own desk API
router.use(restrictDeskRoles);

router.use("/health", healthRouter);
router.use("/healthz", healthRouter);

// 1. Public Catalog & Read Endpoints (100 req / 60s Token Bucket per IP)
router.use("/courses", catalogReadLimiter, coursesRouter);
router.use("/categories", catalogReadLimiter, categoriesRouter);
router.use("/banners", catalogReadLimiter, bannersRouter);
router.use("/ebooks", catalogReadLimiter, ebooksRouter);
router.use("/content", catalogReadLimiter, contentRouter);
router.use("/tests", catalogReadLimiter, testsRouter);
router.use("/support-contacts", catalogReadLimiter, supportContactsRouter);

// 2. Payment, Coupon & Enrollment Endpoints (20 req / 60s Token Bucket per User/IP)
router.use("/coupons", identifyStudent, paymentRateLimiter, couponsRouter);
router.use("/razorpay", identifyStudent, paymentRateLimiter, razorpayRouter);
router.use("/internal", internalRouter);
router.use("/google-play", identifyStudent, paymentRateLimiter, googlePlayRouter);
router.use("/enrollments", identifyStudent, paymentRateLimiter, enrollmentsRouter);

// 3. Heavy Media & Video Upload Endpoints (20 req / 60s Leaky Bucket per User)
router.use("/upload", uploadLeakyLimiter, uploadRouter);

// 4. Authentication Endpoints (Strict Sliding Window IP + Identifier inside authRouter)
router.use("/auth", authRouter);

// 5. Student Write & Interactive Endpoints (60 req / 60s Token Bucket per User)
router.use("/profile", studentActionLimiter, profileRouter);
router.use("/tickets", authenticateToken, studentActionLimiter, ticketsRouter);
router.use("/me/goal", studentActionLimiter, studentGoalRouter);
// The one active course among the student's courses
router.use("/me/active-course", activeCourseRouter); // PUT has its own token-bucket limit
router.use("/mentorship", studentActionLimiter, mentorshipRouter);
router.use("/progress", studentActionLimiter, progressRouter);
router.use("/notifications", studentActionLimiter, notificationsRouter);
router.use("/admin-notifications", studentActionLimiter, adminNotificationsRouter);

// 6. Admin, CMS & Staff Desk Endpoints (120 req / 60s Token Bucket per Admin/Staff)
router.use("/admin", adminApiLimiter, adminRouter);
router.use("/stats", adminApiLimiter, statsRouter);
router.use("/cms/tests", adminApiLimiter, cmsTestsRouter);
router.use("/cms/admins", adminApiLimiter, cmsAdminsRouter);
router.use("/mentor-desk", adminApiLimiter, mentorDeskRouter);
router.use("/teacher-assistant-desk", adminApiLimiter, teacherAssistantDeskRouter);

// 7. AI Doubt Solver Endpoints (10 req / 60s Token Bucket per Student)
router.use("/ai/doubt", aiRateLimiter, aiDoubtRouter);
router.use("/ai", aiRateLimiter, aiDoubtRouter);

// Mounted at root: live classes & bunny video streaming
router.use(liveClassesRouter);
router.use(bunnyRouter);

export default router;
