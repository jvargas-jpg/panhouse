/** Explicit read-only verification of the QA workspace. Never creates or deletes Drive objects. */
import {readFile,writeFile} from 'node:fs/promises';
import {eq} from 'drizzle-orm';
import {db,pool} from '../server/db/client.js';
import {projectDriveWorkspaces,projectDriveFolders,projectWorkspaceRequests,auditLogs} from '../server/db/schema/index.js';
import {withCorporateDrive} from '../server/modules/integrations/google-drive/corporate.js';
import {projectWorkspacesQueue,workspaceJobId} from '../server/queue/projectWorkspaces.queue.js';
import {redisConnection} from '../server/queue/connection.js';
try{
  const fixture=JSON.parse(await readFile('secrets/project-workspace-assignment-qa.local.json','utf8'));
  const [w]=await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId,fixture.projectId));
  if(!w||w.status!=='READY')throw Error('QA workspace must be READY');
  const folders=await db.select().from(projectDriveFolders).where(eq(projectDriveFolders.workspaceId,w.id));
  const checked=await withCorporateDrive(async({integration,storage})=>{
    if(integration.projectsRootFolderId!==w.projectsRootFolderId)throw Error('Configured root mismatch');
    const root=await storage.getMetadata(w.projectsRootFolderId),checks=[],actualIds=new Set<string>([w.rootFolderId!]);
    for(const f of folders){
      const actual=await storage.getMetadata(f.driveFolderId),expectedParent=f.parentFolderKey?folders.find(p=>p.key===f.parentFolderKey)!.driveFolderId:w.projectsRootFolderId;
      checks.push({key:f.key,id:f.driveFolderId,name:f.displayName,parentId:expectedParent,url:f.driveUrl,
        valid:actual.providerFileId===f.driveFolderId&&actual.parents.includes(expectedParent)&&actual.name===f.displayName&&actual.appProperties.panhouseWorkspace===w.id});
      for(const child of await storage.listFolders({parentFolderId:f.driveFolderId}))actualIds.add(child.providerFileId);
    }
    return {rootName:root.name,checks,actualCount:actualIds.size,unexpected:[...actualIds].filter(id=>!folders.some(f=>f.driveFolderId===id))};
  });
  const job=await projectWorkspacesQueue.getJob(workspaceJobId(w.projectId));
  const events=await db.select({action:auditLogs.accion,at:auditLogs.createdAt}).from(auditLogs).where(eq(auditLogs.proyectoId,w.projectId));
  const result={verifiedAt:new Date().toISOString(),projectId:w.projectId,projectCode:fixture.projectCode,workspaceId:w.id,rootFolderId:w.rootFolderId,
    webViewLink:w.rootFolderUrl,projectsRoot:checked.rootName,template:w.templateKey,templateVersion:w.templateVersion,
    expected:w.plan.length,persisted:folders.length,actualVerified:checked.checks.filter(c=>c.valid).length,missing:checked.checks.filter(c=>!c.valid).length,
    actualFolderCount:checked.actualCount,unexpectedFolderIds:checked.unexpected,
    queue:'project-drive-workspaces',job:'provision-project-drive-workspace',jobId:job?.id,jobState:await job?.getState(),payloadKeys:Object.keys(job?.data??{}),
    queuedAt:job?.timestamp,processedAt:job?.processedOn,finishedAt:job?.finishedOn,events,folders:checked.checks,sharing:w.sharingStatus,retained:true};
  await writeFile('docs/evidencias/project-workspace-assignment/real-drive-verification.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify({...result,folders:undefined,events:undefined}));
  if(result.missing||result.expected!==result.actualVerified||result.unexpectedFolderIds.length||result.actualFolderCount!==result.expected)process.exitCode=1;
}finally{await projectWorkspacesQueue.close();await redisConnection.quit();await pool.end();}
