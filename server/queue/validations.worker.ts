import { Queue, Worker } from 'bullmq';
import { redisConnection } from './connection.js';
import { deliverValidationMail, detectValidationDeliveries } from '../helpers/validationDrive.js';
import { detectWorkflowDeliveries } from '../helpers/workflowDrive.js';
const queue = new Queue('validation-drive', { connection: redisConnection });
await queue.upsertJobScheduler('validation-drive-tick', { every: 60000 }, { name: 'tick', data: {}, opts: { removeOnComplete: 20, removeOnFail: 50 } });
export const validationsWorker = new Worker('validation-drive', async () => {
 // A Drive outage must not prevent delivery of already queued notices.
 const results = await Promise.allSettled([deliverValidationMail(),detectValidationDeliveries(),detectWorkflowDeliveries()]);
 return results.map(r=>r.status==='fulfilled'?r.value:{status:'retry_pending'});
}, { connection: redisConnection, concurrency: 1 });
