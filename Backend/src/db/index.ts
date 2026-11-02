import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded if DATABASE_URL is not yet present in environment
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
  dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set in environment variables. Please check your .env file.",
  );
}

const { Pool } = pg;

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: Number(process.env.DB_POOL_MAX) || 30,
  idleTimeoutMillis: 300_000,
  connectionTimeoutMillis: 30_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
} as any);

pool.on("error", (err) => {
  console.warn("[PostgreSQL Pool Warning] Idle client connection issue:", err.message);
});

// Keep connection pool warm so students never hit cold starts or connection timeouts
const pingTimer = setInterval(() => {
  pool.query("SELECT 1").catch(() => {});
}, 30_000);
if (pingTimer.unref) pingTimer.unref();

export const db = drizzle(pool, { schema });

export * from "./schema";
export default db;
