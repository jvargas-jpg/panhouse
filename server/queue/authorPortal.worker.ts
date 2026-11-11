import { Worker, Queue } from 'bullmq';
import { redisConnection } from './connection.js';
import { processAuthorReminders, deliverAuthorMail, processAuthorMilestones } from '../helpers/authorMail.js';
const queue=new Queue('author-portal',{connection:redisConnection});
await queue.upsertJobScheduler('author-portal-tick',{every:60000},{name:'tick',data:{},opts:{removeOnComplete:20,removeOnFail:20}});
export const authorPortalWorker=new Worker('author-portal',async()=>{await processAuthorReminders();await processAuthorMilestones();await deliverAuthorMail();},{connection:redisConnection,concurrency:1});
