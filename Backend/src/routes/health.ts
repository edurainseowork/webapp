import { Router, type IRouter } from "express";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pool, db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { HealthCheckResponse } from "@workspace/api-zod";
import {
  emailDispatchQueue,
  getCircuitState,
  getRedisClient,
  notificationBroadcastQueue,
  perfMetrics,
} from "../lib/perfEngine";

const router: IRouter = Router();

// Track Node.js Event Loop Lag (PRD Section 8: Monitoring & Telemetry)
const loopHistogram = monitorEventLoopDelay({ resolution: 10 });
loopHistogram.enable();

router.get(["/", "/healthz"], (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Real-time Performance, Event-Loop Lag, DB Pool, Cache, Rate-Limit & Queue Telemetry
router.get("/perf", async (req, res) => {
  const mem = process.memoryUsage();
  let pgStatActivity: Array<{ state: string | null; count: number }> | undefined;

  if (req.query.dbStats === "true") {
    try {
      const { rows } = await db.execute<{ state: string | null; count: number }>(
        sql`SELECT state, count(*)::int AS count FROM pg_stat_activity GROUP BY state`
      );
      pgStatActivity = rows;
    } catch {
      pgStatActivity = [];
    }
  }

  const client = getRedisClient();
  let redisPingMs: number | null = null;
  let redisConnected = false;
  let redisError: string | null = null;

  if (client?.ping) {
    const start = performance.now();
    try {
      await Promise.race([
        client.ping(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout (4s)")), 4000)),
      ]);
      redisPingMs = Number((performance.now() - start).toFixed(2));
      redisConnected = true;
    } catch (e: any) {
      redisConnected = false;
      redisError = e?.message || String(e);
    }
  }

  res.json({
    status: "ok",
    redisCircuitBreaker: getCircuitState(),
    redis: {
      configured: !!process.env.REDIS_URL,
      connected: redisConnected,
      pingMs: redisPingMs,
      error: redisError,
      breaker: getCircuitState(),
      epoch: process.env.CACHE_EPOCH?.trim() || "1",
    },
    eventLoopLagMs: {
      p50: Number((loopHistogram.percentile(50) / 1e6).toFixed(2)),
      p95: Number((loopHistogram.percentile(95) / 1e6).toFixed(2)),
      p99: Number((loopHistogram.percentile(99) / 1e6).toFixed(2)),
      max: Number((loopHistogram.max / 1e6).toFixed(2)),
    },
    dbPool: {
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingClients: pool.waitingCount,
      ...(pgStatActivity ? { pgStatActivity } : {}),
    },
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
