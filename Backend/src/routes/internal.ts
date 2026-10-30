import crypto from "node:crypto";
import { Router } from "express";
import { runPaymentTask } from "../lib/paymentJobs";

// Lets a scheduler outside the app (cron, GitHub Actions, uptime tools) run the payment safety nets:
//   curl -X POST -H "x-cron-secret: $CRON_SECRET" https://API/api/internal/payments/sweep
// Off (404) unless CRON_SECRET is set.
const router = Router();

router.post("/payments/:task", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const given = req.headers["x-cron-secret"];
  const same = !!secret && typeof given === "string" && given.length === secret.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  const task = req.params.task;
  if (!same || (task !== "sweep" && task !== "reconcile")) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ success: true, task, result: await runPaymentTask(task) });
});

export default router;
