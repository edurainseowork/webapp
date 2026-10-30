// Checks the payment flow end to end against a running backend that talks to tools/fake-razorpay.cjs, and can load it.
//   node --env-file=.env tools/payments-check.mjs                  functional checks (about 30 seconds)
//   node --env-file=.env tools/payments-check.mjs --load 2000      also: 2000 students order and pay at the same time
// Needs on the backend AND here: RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, CRON_SECRET (any test values), DATABASE_URL
// (a test database, never the real one), PAYMENT_JOBS=off on the backend, and NODE_ENV not "production" (test tokens).
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback; };
const API = (arg('api', process.env.CHECK_API || 'http://localhost:5000')).replace(/\/+$/, '') + '/api';
const FAKE = arg('fake', 'http://127.0.0.1:5555');
const LOAD = Number(arg('load', 0));
const CONCURRENCY = Number(arg('concurrency', 300));
const need = (n) => { if (!process.env[n]) { console.error(`Set ${n} (same value as the backend uses)`); process.exit(1); } return process.env[n]; };
const KEY_SECRET = need('RAZORPAY_KEY_SECRET'), WEBHOOK_SECRET = need('RAZORPAY_WEBHOOK_SECRET'), CRON_SECRET = need('CRON_SECRET');
const db = new pg.Pool({ connectionString: need('DATABASE_URL'), max: 5 });
const q = async (text, params) => (await db.query(text, params)).rows;

const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7) >>> 0;
const call = async (path, { token, method = 'GET', body, headers = {} } = {}) => {
  const t = performance.now();
  // Every student gets an address of their own (X-Forwarded-For), like real students on their own phones; Razorpay's webhook calls all share one
  const res = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer test-student-${token}`, 'x-forwarded-for': `10.${(hash(token) >> 16) & 255}.${(hash(token) >> 8) & 255}.${hash(token) & 255}` } : {}), ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  return { code: res.status, body: await res.json().catch(() => ({})), ms: performance.now() - t };
};
const fake = (path, body) => fetch(FAKE + path, { method: 'POST', body: JSON.stringify(body ?? {}) }).then((r) => r.json());
let eventCounter = 0;
const webhook = (event, payment, { eventId = `evt_${Date.now()}_${++eventCounter}`, secret = WEBHOOK_SECRET } = {}) => {
  const raw = JSON.stringify({ event, payload: { payment: { entity: payment } } });
  return call('/razorpay/webhook', { method: 'POST', body: raw, headers: { 'x-razorpay-signature': crypto.createHmac('sha256', secret).update(raw).digest('hex'), 'x-razorpay-event-id': eventId } });
};
const sign = (orderId, paymentId) => crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
const cron = (task) => call(`/internal/payments/${task}`, { method: 'POST', headers: { 'x-cron-secret': CRON_SECRET } });

// ---- setup: one test course, fresh students
const TITLE = '__payments_check__';
let [course] = await q('SELECT id, price FROM courses WHERE title = $1', [TITLE]);
if (!course) [course] = await q(`INSERT INTO courses (title, description, price, thumbnail, category, is_published) VALUES ($1, 'test', 199900, 't', 'TEST', true) RETURNING id, price`, [TITLE]);
await q('UPDATE courses SET price = 199900, is_published = true WHERE id = $1', [course.id]);
const AMOUNT = 199900;
const run = Date.now().toString(36);
let studentNo = 0;
const newStudent = async () => { const token = `${run}-${++studentNo}`; await call('/razorpay/my-courses', { token }); const [u] = await q('SELECT id FROM users WHERE firebase_uid = $1', [`test-student-uid-${token}`]); return { token, userId: u.id }; };
const order = async (s, plan = 'basic') => (await call('/razorpay/order', { token: s.token, method: 'POST', body: { courseId: course.id, plan } }));
const pay = (orderId, n = 1, amount = AMOUNT) => ({ id: `pay_${run}${orderId.slice(-6)}${n}`, order_id: orderId, status: 'captured', amount });
const row = async (orderId) => (await q('SELECT status, failure_reason, razorpay_payment_id FROM payments WHERE razorpay_order_id = $1', [orderId]))[0];
const owned = async (s) => Number((await q('SELECT count(*)::int AS n FROM user_courses WHERE user_id = $1 AND course_id = $2', [s.userId, course.id]))[0].n);
const events = async (orderId, event) => Number((await q('SELECT count(*)::int AS n FROM payment_events WHERE razorpay_order_id = $1 AND event = $2', [orderId, event]))[0].n);
const ok = (name) => console.log(`  PASS  ${name}`);

console.log(`Functional checks (course ${course.id}, api ${API})`);
await fake('/__reset');

{ // 1. the same student clicking again gets the same order
  const s = await newStudent(); const a = await order(s); const b = await order(s);
  assert.equal(a.code, 200, JSON.stringify(a.body)); assert.equal(b.body.orderId, a.body.orderId); assert.equal(b.body.reused, true);
  assert.equal((await q(`SELECT count(*)::int n FROM payments WHERE user_id = $1 AND status = 'created'`, [s.userId]))[0].n, 1);
  ok('second click returns the same open order (no second Razorpay order)');
}
{ // 2. 15 clicks at the same moment: still one order (a student is limited to 20 payment calls a minute, so no more than that)
  const s = await newStudent(); const all = await Promise.all(Array.from({ length: 15 }, () => order(s)));
  assert.ok(all.every((r) => r.code === 200), JSON.stringify(all.map((r) => r.code)));
  assert.equal(new Set(all.map((r) => r.body.orderId)).size, 1);
  assert.equal((await q(`SELECT count(*)::int n FROM payments WHERE user_id = $1 AND status = 'created'`, [s.userId]))[0].n, 1);
  ok('15 parallel clicks end with exactly one open order');
}
{ // 3. the price changed: the old order is closed, a new one made
  const s = await newStudent(); const a = await order(s);
  await q('UPDATE courses SET price = 149900 WHERE id = $1', [course.id]); const b = await order(s); await q('UPDATE courses SET price = $2 WHERE id = $1', [course.id, AMOUNT]);
  assert.notEqual(b.body.orderId, a.body.orderId); assert.equal(b.body.amount, 149900); assert.equal((await row(a.body.orderId)).status, 'expired');
  ok('a changed price closes the old order and opens a new one');
}
{ // 4. verify + three webhooks + three status checks at once: one unlock, one "paid" event
  const s = await newStudent(); const o = (await order(s)).body; const p = pay(o.orderId);
  await fake('/__scenario', { orderId: o.orderId, items: [p] });
  const results = await Promise.all([
    call('/razorpay/verify', { token: s.token, method: 'POST', body: { razorpay_order_id: o.orderId, razorpay_payment_id: p.id, razorpay_signature: sign(o.orderId, p.id) } }),
    webhook('payment.captured', p), webhook('payment.captured', p), webhook('order.paid', p),
    call(`/razorpay/status/${o.orderId}`, { token: s.token }), call(`/razorpay/status/${o.orderId}`, { token: s.token }), call(`/razorpay/status/${o.orderId}`, { token: s.token }),
  ]);
  assert.ok(results.every((r) => r.code === 200), JSON.stringify(results.map((r) => r.code)));
  assert.equal(await owned(s), 1); assert.equal((await row(o.orderId)).status, 'paid'); assert.equal(await events(o.orderId, 'paid'), 1);
  ok('verify, 3 webhooks and 3 status checks at once: course unlocked once, one "paid" record');
}
{ // 5. the same webhook delivered twice, and a bad signature
  const s = await newStudent(); const o = (await order(s)).body; const p = pay(o.orderId);
  const first = await webhook('payment.captured', p, { eventId: `evt_dup_${run}` }); const second = await webhook('payment.captured', p, { eventId: `evt_dup_${run}` });
  assert.equal(first.body.status, 'ok'); assert.equal(second.body.status, 'duplicate');
  assert.equal((await webhook('payment.captured', p, { secret: 'wrong' })).code, 400);
  ok('a repeated webhook is dropped; a wrong signature is refused (400)');
}
{ // 6. paid less than the order: not unlocked
  const s = await newStudent(); const o = (await order(s)).body;
  const r = await webhook('payment.captured', pay(o.orderId, 1, AMOUNT - 1000));
  assert.equal(r.code, 200); assert.equal(await owned(s), 0); assert.equal((await row(o.orderId)).status, 'created'); assert.equal(await events(o.orderId, 'amount_mismatch'), 1);
  ok('an underpaid webhook does not unlock the course and is recorded');
}
{ // 7. a failed attempt keeps the order open (the student may retry) and keeps the reason
  const s = await newStudent(); const o = (await order(s)).body;
  await webhook('payment.failed', { id: `pay_f${run}`, order_id: o.orderId, status: 'failed', amount: AMOUNT, error_description: 'Bank declined' });
  const r = await row(o.orderId); assert.equal(r.status, 'created'); assert.equal(r.failure_reason, 'Bank declined');
  ok('payment.failed keeps the order open and saves the reason');
}
{ // 8. sweep: a missed webhook is fixed; an order nobody paid for in a day is closed
  const s1 = await newStudent(), s2 = await newStudent(); const o1 = (await order(s1)).body, o2 = (await order(s2)).body;
  await fake('/__scenario', { orderId: o1.orderId, items: [pay(o1.orderId)] }); await fake('/__scenario', { orderId: o2.orderId, items: [] });
  await q(`UPDATE payments SET created_at = now() - interval '11 minutes' WHERE razorpay_order_id = $1`, [o1.orderId]);
  await q(`UPDATE payments SET created_at = now() - interval '25 hours' WHERE razorpay_order_id = $1`, [o2.orderId]);
  const r = await cron('sweep'); assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.equal((await row(o1.orderId)).status, 'paid'); assert.equal(await owned(s1), 1); assert.equal((await row(o2.orderId)).status, 'expired');
  ok('sweep unlocks a payment whose webhook never came, and closes an order nobody paid');
}
{ // 9. reconcile: Razorpay captured it, we never heard; plus a payment for an order we do not know
  const s = await newStudent(); const o = (await order(s)).body;
  await fake('/__reset'); await fake('/__scenario', { orderId: o.orderId, items: [pay(o.orderId)] }); await fake('/__scenario', { orderId: 'order_unknownXYZ', items: [{ id: 'pay_unknown1', status: 'captured', amount: 100 }] });
  const r = await cron('reconcile'); assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.equal((await row(o.orderId)).status, 'paid'); assert.equal(await owned(s), 1); assert.ok(r.body.result.fixed >= 1 && r.body.result.unknownOrders >= 1, JSON.stringify(r.body.result));
  ok('reconcile fixes a captured payment we missed and reports one for an unknown order');
}
{ // 10. the cron route is closed without the secret; the webhook is not throttled
  assert.equal((await call('/internal/payments/sweep', { method: 'POST' })).code, 404);
  const burst = await Promise.all(Array.from({ length: 400 }, () => webhook('payment.failed', { id: 'pay_x', order_id: 'order_nobody', status: 'failed', amount: 1 })));
  assert.ok(burst.every((r) => r.code === 200), JSON.stringify([...new Set(burst.map((r) => r.code))]));
  ok('cron route refuses calls without the secret; 400 webhooks in a minute from one address are all accepted');
}
console.log('FUNCTIONAL CHECKS OK');

if (LOAD) {
  const pct = (a, p) => (a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : 0);
  console.log(`\nLoad: ${LOAD} students order, pay (webhook sent twice) and check status, ${CONCURRENCY} at a time`);
  await fake('/__reset');
  const lat = { order: [], webhook: [], dupe: [], status: [] }; const errors = []; const orders = new Set();
  let next = 0; const t0 = performance.now();
  const one = async (i) => {
    const token = `${run}-L${i}`;
    const o = await call('/razorpay/order', { token, method: 'POST', body: { courseId: course.id, plan: 'basic' } }); lat.order.push(o.ms);
    if (o.code !== 200) return errors.push(`order ${o.code} ${JSON.stringify(o.body)}`);
    orders.add(o.body.orderId); const p = pay(o.body.orderId);
    await fake('/__scenario', { orderId: o.body.orderId, items: [p] });
    const id = `evt_load_${run}_${i}`;
    const w1 = await webhook('payment.captured', p, { eventId: id }); lat.webhook.push(w1.ms);
    const w2 = await webhook('payment.captured', p, { eventId: id }); lat.dupe.push(w2.ms);
    const st = await call(`/razorpay/status/${o.body.orderId}`, { token }); lat.status.push(st.ms);
    if (w1.code !== 200 || w2.body.status !== 'duplicate' || st.body.status !== 'paid') errors.push(`flow ${i}: webhook ${w1.code}/${w2.body.status}, status ${st.code}/${st.body.status}`);
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (next < LOAD) await one(next++); }));
  const sec = (performance.now() - t0) / 1000;
  const [{ n: unlocked }] = await q(`SELECT count(*)::int n FROM user_courses uc JOIN users u ON u.id = uc.user_id WHERE u.firebase_uid LIKE $1`, [`test-student-uid-${run}-L%`]);
  const [{ n: dupes }] = await q(`SELECT count(*)::int n FROM (SELECT user_id FROM user_courses WHERE course_id = $1 GROUP BY user_id HAVING count(*) > 1) d`, [course.id]);
  console.log(`  ${LOAD} full payments in ${sec.toFixed(1)}s = ${(LOAD / sec).toFixed(0)} payments/s | distinct orders ${orders.size} | unlocked ${unlocked} | students with a duplicate unlock ${dupes} | failed flows ${errors.length}`);
  for (const [k, v] of Object.entries(lat)) console.log(`  ${k.padEnd(8)} p50 ${pct(v, 50).toFixed(0)}ms  p95 ${pct(v, 95).toFixed(0)}ms  p99 ${pct(v, 99).toFixed(0)}ms  max ${Math.max(...v).toFixed(0)}ms`);
  if (errors.length) console.log('  first errors:', errors.slice(0, 5));
  assert.equal(unlocked, LOAD); assert.equal(dupes, 0); assert.equal(orders.size, LOAD); assert.equal(errors.length, 0);
  console.log('LOAD CHECK OK');
}
await db.end();
process.exit(0);
