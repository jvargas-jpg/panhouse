import {randomUUID} from 'node:crypto';
import {and,eq,sql} from 'drizzle-orm';
import {db,pool} from '../../db/client.js';
import {adminOperations,projectDriveFolders,projectDriveWorkspaces,externalIntegrations,securityEvents} from '../../db/schema/index.js';
import {googleDriveService} from '../integrations/google-drive/service.js';
import {withCorporateDrive,type CorporateDriveOperation} from '../integrations/google-drive/corporate.js';
import {safeDriveError} from '../integrations/google-drive/errors.js';
import {WorkspaceError} from '../project-workspaces/errors.js';
import {workspaceSummaries,emptyWorkspace} from '../project-workspaces/queries.js';
import {resolveWorkspaceTemplate} from '../project-workspaces/templates.js';
import {configureDevProjectsRoot} from '../project-workspaces/root.js';
import {env} from '../../config/env.js';
import {registrarEvento} from '../../helpers/auditLog.js';
import {adminAssert,safeAdminData} from './policy.js';
import {adminCommand,type AdminActor,type Command} from './commands.js';
import {pageQuery,type AdminFilters} from './queries.js';
export async function adminIntegrations(){const [drive,{rows:[stats]}]=await Promise.all([googleDriveService.status(),pool.query(`SELECT count(*)::int total,count(*) FILTER(WHERE status='READY')::int ready,count(*) FILTER(WHERE status='ERROR')::int failed,count(*) FILTER(WHERE status='PROVISIONING')::int provisioning FROM project_drive_workspaces`)]);
 return {drive,workspaceStats:stats,canConfigureDevRoot:env.NODE_ENV!=='production',payment:{status:'external_link',message:'El portal de pago usa enlace/SSO firmado; no hay health check del proveedor conectado.'},email:{status:'not_configured',message:'PanHouse no tiene un proveedor de email configurado.'}};
}
export async function adminWorkspaces(f:AdminFilters){const args:unknown[]=[],where:string[]=[];if(f.search){args.push(f.search);where.push(`strpos(lower(concat_ws(' ',project,code)),lower($${args.length}))>0`);}if(f.state){args.push(f.state);where.push(`status=$${args.length}`);}
 return pageQuery(`SELECT p.id,p.codigo code,coalesce(p.titulo_definitivo,p.titulo,'Proyecto editorial') project,coalesce(w.status,r.status,'NOT_CONFIGURED') status,coalesce(w.last_error_code,r.last_error_code) "errorCode",w.last_verified_at "verifiedAt",w.attempts,w.template_key "templateKey",w.template_version "templateVersion",w.root_folder_url "rootUrl" FROM proyectos p LEFT JOIN project_drive_workspaces w ON w.project_id=p.id LEFT JOIN project_workspace_requests r ON r.project_id=p.id`,where.join(' AND '),args,f,'code,id');}
export async function adminWorkspaceDiagnostics(projectId:string){const {rows:[project]}=await pool.query(`SELECT id,codigo code FROM proyectos WHERE id=$1`,[projectId]);adminAssert(project,'Proyecto no encontrado',404);
 const [map,folders]=await Promise.all([workspaceSummaries([projectId]),pool.query(`SELECT f.key,f.parent_folder_key "parentKey",f.drive_folder_id "folderId",f.display_name name,f.template_path path,f.status,f.verified_at "verifiedAt",f.drive_url url FROM project_drive_folders f JOIN project_drive_workspaces w ON w.id=f.workspace_id WHERE w.project_id=$1 ORDER BY f.template_path`,[projectId])]);
 return {project,workspace:map.get(projectId)??emptyWorkspace(),folders:folders.rows};
}
export async function adminFolderFiles(projectId:string,key:string,pageToken?:string,operate:CorporateDriveOperation=withCorporateDrive){
 const [association]=await db.select({f:projectDriveFolders,w:projectDriveWorkspaces}).from(projectDriveFolders).innerJoin(projectDriveWorkspaces,eq(projectDriveWorkspaces.id,projectDriveFolders.workspaceId)).where(and(eq(projectDriveWorkspaces.projectId,projectId),eq(projectDriveFolders.key,key)));
 adminAssert(association&&association.f.status==='READY','Carpeta vinculada no encontrada',404);
 return operate(async({integration,storage})=>{
  const {w,f}=association;adminAssert(w.integrationId===integration.id&&w.storageContextId===integration.storageContextId&&w.projectsRootFolderId===integration.projectsRootFolderId,'El workspace pertenece a otra conexión');
  const parent=f.parentFolderKey?(await db.select({id:projectDriveFolders.driveFolderId}).from(projectDriveFolders).where(and(eq(projectDriveFolders.workspaceId,w.id),eq(projectDriveFolders.key,f.parentFolderKey))))[0]?.id:w.projectsRootFolderId;
  const metadata=await storage.getMetadata(f.driveFolderId);adminAssert(!metadata.trashed&&metadata.parents.includes(parent??'')&&metadata.mimeType==='application/vnd.google-apps.folder','La asociación documental cambió');
  adminAssert(storage.listFiles,'El proveedor no permite listar archivos',409);const result=await storage.listFiles({parentFolderId:f.driveFolderId,pageToken});
  return {items:result.items.filter(i=>!i.trashed&&i.parents.includes(f.driveFolderId)).map(i=>({id:i.providerFileId,name:i.name,mimeType:i.mimeType,url:`https://drive.google.com/file/d/${encodeURIComponent(i.providerFileId)}/view`})),nextPageToken:result.nextPageToken};
 });
}
export function adminDriveTemplates(){return ['EF','SE','EEC','EET'].map(serviceCode=>{const t=resolveWorkspaceTemplate({serviceCode,crudoSubtype:null,authorName:'Autor',projectCode:'Código',conditions:[]});return {serviceCode,key:t.key,version:t.version,folders:t.plan.map(f=>({key:f.key,parentKey:f.parentKey,path:f.templatePath}))};});}
export async function adminIntegrationAction(actor:AdminActor,action:'connect'|'disconnect'|'test'|'configure_root',input:Command,sessionToken:string){
 const operationId=randomUUID();const started=await adminCommand(actor,'integration_'+action,input,async tx=>{
  await registrarEvento(tx,{actorId:actor.id,accion:'ADMIN_INTEGRATION_ACTION',entityType:'admin_operation',entityId:operationId,detalles:{reason:input.reason,action,result:'requested'}});
  return {operationId,status:'running'};
 });
 if(started.reused){adminAssert(started.status==='completed'&&action!=='connect','La operación ya fue solicitada; consulta su estado antes de iniciar otra');return started.outcome;}
 try{
  const outcome=action==='connect'?await googleDriveService.connect(actor.id,sessionToken):action==='disconnect'?await googleDriveService.disconnect(actor.id):action==='test'?await googleDriveService.test(actor.id):await configureDevProjectsRoot({id:actor.id,rol:'admin'});
  await db.transaction(async tx=>{const saved={operationId,status:'completed',outcome:action==='connect'?{authorizationIssued:true}:safeAdminData(outcome)};
   await tx.update(adminOperations).set({result:saved}).where(and(eq(adminOperations.actorId,actor.id),eq(adminOperations.requestKey,input.requestKey)));
   await registrarEvento(tx,{actorId:actor.id,accion:'ADMIN_INTEGRATION_ACTION',entityType:'admin_operation',entityId:operationId,detalles:{reason:input.reason,action,result:'completed',after:action==='connect'?{authorizationIssued:true}:safeAdminData(outcome)}});
  });return outcome;
 }catch(error){const safe=error instanceof WorkspaceError?{code:error.code,statusCode:error.statusCode}:safeDriveError(error);
  await db.transaction(async tx=>{await tx.update(adminOperations).set({result:{operationId,status:'failed',errorCode:safe.code}}).where(and(eq(adminOperations.actorId,actor.id),eq(adminOperations.requestKey,input.requestKey)));
   await registrarEvento(tx,{actorId:actor.id,accion:'ADMIN_INTEGRATION_ACTION',entityType:'admin_operation',entityId:operationId,detalles:{reason:input.reason,action,result:'failed',errorCode:safe.code}});
   await tx.insert(securityEvents).values({action:'INTEGRATION_ACTION_FAILED',actorId:actor.id});
  });throw Object.assign(new Error('No se pudo completar la operación de integración. Código: '+safe.code),{statusCode:safe.statusCode});
 }
}
