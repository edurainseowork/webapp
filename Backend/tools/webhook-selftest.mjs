// Checks that the live webhook URL is reachable and that its secret matches yours. No money, no student is touched:
// it sends a signed "payment.captured" for an order that does not exist (the server stores the event id and ignores it).
//   node --env-file=.env tools/webhook-selftest.mjs https://<id>.execute-api.ap-south-1.amazonaws.com
import crypto from 'node:crypto';

const base = (process.argv[2] || '').replace(/\/+$/, '').replace(/\/api\/razorpay\/webhook$/, '');
const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_SECRET || process.env.RAZORPAY_KEY_SECRET;
if (!base || !secret) {
  console.error('Usage: node --env-file=.env tools/webhook-selftest.mjs <api base url>   (RAZORPAY_WEBHOOK_SECRET must be in .env)');
  process.exit(1);
}

const body = JSON.stringify({
  event: 'payment.captured',
  payload: { payment: { entity: { id: 'pay_SELFTEST', order_id: 'order_SELFTEST', amount: 100, status: 'captured' } } },
});
const eventId = `selftest-${Date.now()}`;
const sign = (s) => crypto.createHmac('sha256', s).update(body).digest('hex');

async function send(signature, id) {
  const res = await fetch(`${base}/api/razorpay/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature, 'x-razorpay-event-id': id },
    body,
  });
  return { status: res.status, text: (await res.text()).slice(0, 120) };
}

let failed = false;
const check = (name, ok, got) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `   got ${got.status} ${got.text}`}`);
  if (!ok) failed = true;
};

const first = await send(sign(secret), eventId);
check('signed event accepted (secret matches, route and database work)', first.status === 200 && first.text.includes('"ok"'), first);
const again = await send(sign(secret), eventId);
check('same event id again is dropped as a duplicate', again.status === 200 && again.text.includes('duplicate'), again);
const bad = await send(sign(secret + 'x'), `${eventId}-bad`);
check('wrong signature is refused (400)', bad.status === 400, bad);

if (failed) {
  console.log('\nA 400 on the first line means the secret on the server is not the one in this .env (or the Razorpay dashboard). A 404 means the new code is not deployed. A 500 means a crash: read the Lambda log in CloudWatch.');
  process.exitCode = 1;
}
