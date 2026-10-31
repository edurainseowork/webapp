import dns from 'node:dns';
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

import serverless from 'serverless-http';
import app from './app';
import { runPaymentTask } from './lib/paymentJobs';
import { initRedis } from './lib/redis';

initRedis();

const web = serverless(app);

// The EventBridge schedules in serverless.yml call this with { task: 'sweep' | 'reconcile' }; everything else is a web request
export const handler = async (event: any, context: any) => {
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }
  return event?.task === 'sweep' || event?.task === 'reconcile' ? runPaymentTask(event.task) : web(event, context);
};
