import serverless from 'serverless-http';
import app from './app';
import { runPaymentTask } from './lib/paymentJobs';

const web = serverless(app);

// The EventBridge schedules in serverless.yml call this with { task: 'sweep' | 'reconcile' }; everything else is a web request
export const handler = async (event: any, context: any) =>
  event?.task === 'sweep' || event?.task === 'reconcile' ? runPaymentTask(event.task) : web(event, context);
