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
  max: Number(process.env.DB_POOL_MAX || 20),
  idleTimeoutMillis: 300_000,
  // Fail fast: API Gateway gives up after ~30 s anyway, so a longer wait only stacks requests behind a dead DB.
  // Slow home internet? Raise it in .env (DB_CONNECT_TIMEOUT_MS=20000), not here.
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10_000),
  // A stuck query must not hold one of the few connections forever. query_timeout, not statement_timeout:
  // pg sends statement_timeout in the connection's startup packet, and RDS Proxy refuses it, so every query
  // through the proxy failed. query_timeout is counted by this client, so it works with or without the proxy.
  query_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS || 30_000),
  application_name: process.env.AWS_LAMBDA_FUNCTION_NAME ? "edurain-lambda" : "edurain-local",
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
