// Preload for the backend (node --require): every https call to *.razorpay.com goes to tools/fake-razorpay.cjs instead.
const https = require('https');
const http = require('http');
const original = https.request;
https.request = function (options, callback) {
  const host = typeof options === 'object' ? options.hostname || options.host : '';
  if (/razorpay\.com$/.test(host)) {
    return http.request({ ...options, protocol: 'http:', hostname: '127.0.0.1', host: '127.0.0.1', port: 5555, agent: undefined }, callback);
  }
  return original.apply(this, arguments);
};
