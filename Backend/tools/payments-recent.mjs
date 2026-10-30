// Read-only: the latest payments with the trail of what happened to each (order, verify, webhook, status, sweep...).
//   node --env-file=.env tools/payments-recent.mjs        (last 15)    |    ... payments-recent.mjs 40
import pg from 'pg';

const limit = Math.min(Number(process.argv[2]) || 15, 200);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 });

try {
  const { rows } = await pool.query(
    `SELECT p.id, p.user_id, p.status, p.amount / 100.0 AS rupees, u.email, p.course_id,
            to_char(p.created_at, 'YYYY-MM-DD HH24:MI') AS created,
            p.razorpay_payment_id AS payment_id,
            EXISTS (SELECT 1 FROM user_courses uc WHERE uc.user_id = p.user_id AND uc.course_id = p.course_id) AS unlocked,
            (SELECT string_agg(e.event || '(' || e.source || ')', ' > ' ORDER BY e.id) FROM payment_events e WHERE e.razorpay_order_id = p.razorpay_order_id) AS trail,
            (SELECT string_agg(DISTINCT w.event, ', ') FROM webhook_events w WHERE w.razorpay_payment_id = p.razorpay_payment_id) AS webhooks
       FROM payments p LEFT JOIN users u ON u.id = p.user_id
      ORDER BY p.id DESC LIMIT $1`, [limit]);
  if (!rows.length) console.log('No payments yet.');
  for (const r of rows) {
    const warn = r.status === 'paid' && !r.unlocked ? '   <-- PAID BUT COURSE NOT UNLOCKED' : '';
    console.log(`#${r.id}  ${r.created}  Rs ${Number(r.rupees)}  ${r.status.toUpperCase()}  unlocked=${r.unlocked}  ${r.email ?? 'user ' + r.user_id}  course ${r.course_id}  ${r.payment_id ?? ''}${warn}\n     ${r.trail ?? '(no events)'}   | Razorpay webhooks received: ${r.webhooks ?? 'none'}`);
  }
  const [c] = (await pool.query(`SELECT count(*)::int AS n FROM payments WHERE status = 'created' AND created_at < now() - interval '30 minutes'`)).rows;
  console.log(`\nOpen orders older than 30 minutes: ${c.n}${c.n ? '  (the sweep job closes or settles these every 5 minutes)' : ''}`);
} catch (e) {
  console.error('Could not read:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
