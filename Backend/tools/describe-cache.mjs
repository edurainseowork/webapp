import crypto from 'node:crypto';

function sign(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}

function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = sign('AWS4' + key, dateStamp);
  const kRegion = sign(kDate, regionName);
  const kService = sign(kRegion, serviceName);
  return sign(kService, 'aws4_request');
}

async function getLambdaConfig(funcName) {
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = 'ap-south-1';
  const service = 'lambda';
  const host = `lambda.${region}.amazonaws.com`;
  const canonicalUri = `/2015-03-31/functions/${funcName}/configuration`;
  const endpoint = `https://${host}${canonicalUri}`;

  const now = new Date();
  const amzdate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const datestamp = amzdate.slice(0, 8);

  const method = 'GET';
  const canonicalQueryString = '';
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzdate}\n`;
  const signedHeaders = 'host;x-amz-date';
  const payloadHash = crypto.createHash('sha256').update('').digest('hex');

  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${datestamp}/${region}/${service}/aws4_request`;
  const stringToSign = `${algorithm}\n${amzdate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

  const signingKey = getSignatureKey(secretKey, datestamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authHeader = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(endpoint, {
    headers: {
      'host': host,
      'x-amz-date': amzdate,
      'Authorization': authHeader
    }
  });

  const json = await res.json();
  console.log('LastModified:', json.LastModified);
  console.log('State:', json.State);
  console.log('VpcConfig:', json.VpcConfig);
  console.log('Environment variables:');
  const env = json.Environment?.Variables || {};
  for (const [k, v] of Object.entries(env)) {
    if (k === 'DATABASE_URL' || k === 'REDIS_URL') {
      console.log(`  ${k}: ${v.replace(/:[^:@]+@/, ':***@')}`);
    } else {
      console.log(`  ${k}: ${v.slice(0, 20)}...`);
    }
  }
}

getLambdaConfig('edurain-api-dev-api').catch(console.error);
