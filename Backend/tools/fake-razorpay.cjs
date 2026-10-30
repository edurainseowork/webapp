// A stand-in for api.razorpay.com, to test the payment flow (and load it) without Razorpay or real money.
//   node tools/fake-razorpay.cjs                      (listens on 127.0.0.1:5555)
// Start the backend with tools/fake-razorpay-redirect.cjs so its Razorpay calls go here:
//   node --require ./tools/fake-razorpay-redirect.cjs --env-file=.env ./dist/index.mjs
// A test sets what Razorpay would answer: POST /__scenario {"orderId":"order_x","items":[{id,status,amount}]}
const http = require('http');
const scenarios = new Map();
const calls = {};
let counter = 0;
const rand = () => Math.random().toString(36).slice(2, 8);

http.createServer((req, res) => {
  let body = '';
  req.on('data', (d) => (body += d));
  req.on('end', () => {
    const send = (o, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    const url = new URL(req.url, 'http://x');
    const json = body ? JSON.parse(body) : {};
    const key = `${req.method} ${url.pathname.replace(/order_\w+/, ':order')}`;
    calls[key] = (calls[key] || 0) + 1;

    if (url.pathname === '/__calls') return send(calls);
    if (url.pathname === '/__reset') { scenarios.clear(); for (const k of Object.keys(calls)) delete calls[k]; return send({ ok: 1 }); }
    if (url.pathname === '/__scenario') { scenarios.set(json.orderId, (json.items || []).map((i) => ({ entity: 'payment', order_id: json.orderId, currency: 'INR', ...i }))); return send({ ok: 1 }); }
    if (req.method === 'POST' && url.pathname === '/v1/orders') {
      return send({ id: `order_T${++counter}${rand()}`, entity: 'order', amount: json.amount, currency: json.currency, receipt: json.receipt, status: 'created' });
    }
    const m = url.pathname.match(/^\/v1\/orders\/(order_\w+)\/payments$/);
    if (m) { const items = scenarios.get(m[1]) || []; return send({ entity: 'collection', count: items.length, items }); }
    if (url.pathname === '/v1/payments') {
      const all = [...scenarios.values()].flat();
      const skip = Number(url.searchParams.get('skip') || 0), count = Number(url.searchParams.get('count') || 10);
      const items = all.slice(skip, skip + count);
      return send({ entity: 'collection', count: items.length, items });
    }
    send({ error: { description: `not faked: ${req.method} ${req.url}` } }, 404);
  });
}).listen(5555, '127.0.0.1', () => console.log('fake Razorpay listening on 127.0.0.1:5555'));
