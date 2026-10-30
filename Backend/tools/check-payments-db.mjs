// Read-only check before/after the payment hardening goes live. Changes nothing in the database.
//   node --env-file=.env tools/check-payments-db.mjs
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 });

async function one(sql) {
  return (await pool.query(sql)).rows;
}

try {
  const dupes = await one(`SELECT user_id, course_id, count(*)::int AS rows FROM user_courses GROUP BY 1,2 HAVING count(*) > 1 ORDER BY 3 DESC LIMIT 50`);
  const idx = await one(`SELECT indexname FROM pg_indexes WHERE indexname IN ('user_courses_user_course_uq','payments_one_open_order')`);
  const tables = await one(`SELECT table_name FROM information_schema.tables WHERE table_name IN ('payment_events','webhook_events')`);
  const has = (rows, key, name) => rows.some((r) => r[key] === name);

  console.log(dupes.length ? `DUPLICATES: ${dupes.length} student+course pair(s) enrolled more than once (first 50 below). Send this to Claude:` : 'OK  user_courses has no duplicate student+course rows');
  if (dupes.length) console.table(dupes);
  console.log(has(idx, 'indexname', 'user_courses_user_course_uq') ? 'OK  unique index user_courses_user_course_uq exists' : 'not yet  unique index user_courses_user_course_uq (the backend adds it by itself once there are no duplicates)');
  console.log(has(idx, 'indexname', 'payments_one_open_order') ? 'OK  one-open-order-per-student-and-course index exists' : 'not yet  payments_one_open_order (created on the first payment request after deploy)');
  console.log(has(tables, 'table_name', 'payment_events') && has(tables, 'table_name', 'webhook_events') ? 'OK  payment_events and webhook_events tables exist' : 'not yet  payment_events / webhook_events tables (created on the first payment request after deploy)');
} catch (e) {
  console.error('Could not check:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
