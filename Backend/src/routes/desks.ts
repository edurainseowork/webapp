import { Router, type Request } from "express";
import { requireDeskRole } from "../middleware/auth";
import ticketsRouter from "./tickets.js";

// Mentor Desk and Teacher Assistance Desk APIs.
const deskProfile = (req: Request) => ({
  name: req.user?.name || (req.auth?.name as string | undefined) || req.auth?.email?.split("@")[0] || "",
  email: req.user?.email || req.auth?.email || "",
  role: req.user?.role,
});

// /api/mentor-desk
export const mentorDeskRouter = Router();
mentorDeskRouter.use(requireDeskRole("mentor"));
// GET /api/mentor-desk/me — the signed-in mentor
mentorDeskRouter.get("/me", (req, res) => {
  res.json({ success: true, data: deskProfile(req) });
});

// /api/teacher-assistant-desk
export const teacherAssistantDeskRouter = Router();
teacherAssistantDeskRouter.use(requireDeskRole("teacher_assistant"));
// Tickets API for Teacher Assistant Desk
teacherAssistantDeskRouter.use("/tickets", ticketsRouter);
// GET /api/teacher-assistant-desk/me
teacherAssistantDeskRouter.get("/me", (req, res) => {
  res.json({ success: true, data: deskProfile(req) });
});
