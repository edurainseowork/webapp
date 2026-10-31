import { createClient } from "redis";
import { setRedisClient, type RedisLikeClient } from "./perfEngine";
import { logger } from "./logger";

let started = false;
let connectPromise: Promise<any> | null = null;

async function ensureConnected(c: any): Promise<boolean> {
  if (c.isReady) return true;
  if (!c.isOpen && !connectPromise) {
    connectPromise = c.connect().catch((e: any) => {
      logger.warn({ err: e.message }, "redis connect error");
    }).finally(() => {
      connectPromise = null;
    });
  }
  if (c.isReady) return true;

  const deadline = Date.now() + 3000;
  while (!c.isReady && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
  }
  return c.isReady;
}

/** Safe to call many times. No REDIS_URL / CACHE_ENABLED=false -> L1-only (local dev unchanged). */
export function initRedis(): void {
  const url = process.env.REDIS_URL?.trim();
  if (started || !url || process.env.CACHE_ENABLED === "false") return;
  started = true;

  // AWS ElastiCache private VPC endpoints cannot be reached from local laptop without VPN/SSH tunnel.
  // In local dev, fail-open cleanly to L1 RAM cache instead of spamming connection timeouts.
  const isAwsInternalEndpoint = url.includes(".cache.amazonaws.com");
  const isRunningLocally = !process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.LAMBDA_TASK_ROOT;
  if (isAwsInternalEndpoint && isRunningLocally) {
    logger.info("Local environment detected — AWS ElastiCache is VPC-internal. Operating in L1 RAM cache mode.");
    return;
  }

  const isTls = url.startsWith("rediss://");
  const c = createClient({
    url,
    socket: {
      family: 4,
      connectTimeout: 5000,
      reconnectStrategy: (retries: number) => Math.min(retries * 200, 2000),
      ...(isTls ? { tls: true, checkServerIdentity: () => undefined } : {}),
    },
  });

  c.on("error", (e: any) => logger.warn({ err: e.message }, "redis error"));
  c.on("ready", () => logger.info("Redis connection ready"));

  connectPromise = c.connect().catch((e: any) => {
    logger.warn({ err: e.message }, "redis connect error");
  }).finally(() => {
    connectPromise = null;
  });

  const adapter: RedisLikeClient = {
    get: async (k) => {
      if (!(await ensureConnected(c))) return null;
      return c.get(k);
    },
    setEx: async (k, ttl, v) => {
      if (!(await ensureConnected(c))) return;
      return c.setEx(k, ttl, v);
    },
    set: async (k, v, opts) => {
      if (!(await ensureConnected(c))) return;
      return (c as any).set(k, v, opts as any);
    },
    getWithPttl: async (k) => {
      if (!(await ensureConnected(c))) return [null, -1];
      const [v, t] = (await (c as any).multi().get(k).pTTL(k).exec()) as [any, any];
      return [v ? String(v) : null, Number(t)];
    },
    del: async (k) => {
      if (!(await ensureConnected(c))) return;
      return (c as any).unlink(k);
    },
    incr: async (k) => {
      if (!(await ensureConnected(c))) throw new Error("Redis not ready");
      return c.incr(k);
    },
    pexpire: async (k, ms) => {
      if (!(await ensureConnected(c))) return;
      return c.pExpire(k, ms);
    },
    mget: async (ks) => {
      if (!(await ensureConnected(c))) return ks.map(() => null);
      return c.mGet(ks);
    },
    setNx: async (k, v, px) => {
      if (!(await ensureConnected(c))) return false;
      return (await (c as any).set(k, v, { NX: true, PX: px })) === "OK";
    },
    eval: async (s, n, ...a) => {
      if (!(await ensureConnected(c))) throw new Error("Redis not ready");
      return (c as any).eval(s, { keys: a.slice(0, n).map(String), arguments: a.slice(n).map(String) });
    },
    ping: async () => {
      if (!(await ensureConnected(c))) throw new Error("Redis not ready");
      return c.ping();
    },
  };

  setRedisClient(adapter);
}
