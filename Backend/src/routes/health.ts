import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import {
  emailDispatchQueue,
  getCircuitState,
  notificationBroadcastQueue,
  perfMetrics,
} from "../lib/perfEngine";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Real-time Performance, Cache, Rate-Limit, Circuit-Breaker & Queue Telemetry
router.get("/perf", (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: "ok",
    redisCircuitBreaker: getCircuitState(),
    metrics: perfMetrics,
    queues: {
      notifications: notificationBroadcastQueue.getStats(),
      emails: emailDispatchQueue.getStats(),
    },
    memoryMb: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    },
  });
});

export default router;
