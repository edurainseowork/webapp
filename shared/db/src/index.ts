import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: Number(process.env.DB_POOL_MAX || 30),
  idleTimeoutMillis: 300_000,
  connectionTimeoutMillis: 30_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
} as any);

pool.on("error", (err) => {
  console.warn("[PostgreSQL Pool Warning] Idle client connection issue:", err.message);
});

// Keep connection pool warm so students never hit 4-second cold starts or connection timeouts
const pingTimer = setInterval(() => {
  pool.query("SELECT 1").catch(() => {});
}, 30_000);
if (pingTimer.unref) pingTimer.unref();

export const db = drizzle(pool, { schema });

export * from "./schema";
