import { UnrecoverableError,Worker } from 'bullmq';
import { redisConnection } from './connection.js';
import { WORKSPACE_QUEUE } from './projectWorkspaces.queue.js';
import { provisionProjectWorkspace } from '../modules/project-workspaces/provision.js';
import { dispatchPendingWorkspaces } from '../modules/project-workspaces/dispatch.js';
import { WorkspaceError } from '../modules/project-workspaces/errors.js';

export const workspaceWorker=new Worker<{projectId:string}>(WORKSPACE_QUEUE,async job=>{
  try{await provisionProjectWorkspace(job.data.projectId,{retryTransient:job.attemptsMade+1<(job.opts.attempts??1)});}
  catch(error){
    if(error instanceof WorkspaceError&&!['BUSY','GOOGLE_UNAVAILABLE','RATE_LIMITED','INVALID_RESPONSE'].includes(error.code))throw new UnrecoverableError(error.code);
    throw error;
  }
},{connection:redisConnection,concurrency:1});
workspaceWorker.on('error',()=>console.error('Worker documental: revisar disponibilidad de Redis.'));
let dispatching=false;
async function recover(){
  if(dispatching)return;dispatching=true;
  try{await dispatchPendingWorkspaces();}catch{console.warn('Cola documental pendiente de recuperación.');}
  finally{dispatching=false;}
}
const timer=setInterval(()=>void recover(),15000);timer.unref();void recover();
workspaceWorker.on('closed',()=>clearInterval(timer));
