import { Queue } from 'bullmq';
import { redisConnection } from './connection.js';

export const WORKSPACE_QUEUE='project-drive-workspaces';
export const WORKSPACE_JOB='provision-project-drive-workspace';
export const workspaceJobId=(projectId:string)=>`project-drive-workspace-${projectId}`;
export const projectWorkspacesQueue=new Queue<{projectId:string}>(WORKSPACE_QUEUE,{connection:redisConnection});

export async function enqueueProjectWorkspace(projectId:string){
  const id=workspaceJobId(projectId),job=await projectWorkspacesQueue.getJob(id);
  if(job){
    const state=await job.getState();
    if(state==='failed'||state==='completed')await job.retry(state);
    return;
  }
  await projectWorkspacesQueue.add(WORKSPACE_JOB,{projectId},{jobId:id,attempts:4,
    backoff:{type:'exponential',delay:5000},removeOnComplete:{age:86400,count:1000},removeOnFail:{age:604800,count:1000}});
}
