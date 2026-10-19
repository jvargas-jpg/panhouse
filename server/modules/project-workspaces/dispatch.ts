import { eq,inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { projectWorkspaceRequests } from '../../db/schema/index.js';

/** Post-commit, fire-and-forget. PostgreSQL retains intent if Redis is down. */
export function dispatchProjectWorkspace(projectId:string){
  void dispatchPendingWorkspaces(projectId).catch(()=>{
    console.warn('Workspace dispatch pendiente; se recuperará desde PostgreSQL.');
  });
}
export async function dispatchPendingWorkspaces(projectId?:string){
  const requests=await db.select().from(projectWorkspaceRequests).where(projectId?
    eq(projectWorkspaceRequests.projectId,projectId):inArray(projectWorkspaceRequests.status,['PENDING','PROVISIONING']));
  const pending=requests.filter(r=>r.status==='PENDING'||r.status==='PROVISIONING');
  if(!pending.length)return;
  const {enqueueProjectWorkspace}=await import('../../queue/projectWorkspaces.queue.js');
  for(const request of pending)await enqueueProjectWorkspace(request.projectId);
}
