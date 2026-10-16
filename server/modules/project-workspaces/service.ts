import { eq,and,inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { autores,fichasTrazabilidad,projectDriveFolders,projectDriveWorkspaces,proyectos,proyectosAutores,servicios,preparacionesProyecto } from '../../db/schema/index.js';
import { verificarAccesoFichaViva } from '../../helpers/fichaViva.js';
import { obtenerEspecialistaActual } from '../../helpers/carga.js';
import { registrarEvento } from '../../helpers/auditLog.js';
import { crearWorkItemSiNoExiste,transicionarWorkItemPorId } from '../../helpers/workItems.js';
import { proyectarPreparacion } from '../../helpers/preparacionInicial.js';
import type { ActorFicha } from '../../helpers/intakeRrpp.js';
import { withCorporateDrive,type CorporateDriveOperation } from '../integrations/google-drive/corporate.js';
import { safeDriveError } from '../integrations/google-drive/errors.js';
import { FOLDER_MIME } from '../integrations/google-drive/adapter.js';
import { resolveWorkspaceTemplate } from './templates.js';
import { emptyWorkspace,workspaceSummaries } from './queries.js';
import { WorkspaceError } from './errors.js';
import { ensureReservedFolder } from './folders.js';

export async function workspaceAccess(projectId:string,actor:ActorFicha,write=false,client:typeof db= db){
  if(!['especialista','jefe_area','rrpp','direccion'].includes(actor.rol)||write&&!['especialista','direccion'].includes(actor.rol))throw new WorkspaceError('FORBIDDEN',403,'No autorizado para esta operación documental.');
  const project=await verificarAccesoFichaViva(projectId,actor,client);
  if(write&&['culminado','retirado'].includes(project.estado))throw new WorkspaceError('PROJECT_CLOSED');
  return project;
}
export async function getProjectWorkspace(projectId:string,actor:ActorFicha){await workspaceAccess(projectId,actor);return (await workspaceSummaries([projectId])).get(projectId)??emptyWorkspace();}
export async function getProjectWorkspaceFolders(projectId:string,actor:ActorFicha){
  await workspaceAccess(projectId,actor);
  return db.select({key:projectDriveFolders.key,parentFolderKey:projectDriveFolders.parentFolderKey,displayName:projectDriveFolders.displayName,
    templatePath:projectDriveFolders.templatePath,driveFolderId:projectDriveFolders.driveFolderId,driveUrl:projectDriveFolders.driveUrl})
    .from(projectDriveFolders).innerJoin(projectDriveWorkspaces,eq(projectDriveWorkspaces.id,projectDriveFolders.workspaceId))
    .where(and(eq(projectDriveWorkspaces.projectId,projectId),eq(projectDriveFolders.status,'READY'))).orderBy(projectDriveFolders.templatePath);
}

export class ProjectWorkspaceService {
  constructor(private operate:CorporateDriveOperation=withCorporateDrive){}
  async create(projectId:string,actor:ActorFicha){
    await workspaceAccess(projectId,actor,true);
    const current=await getProjectWorkspace(projectId,actor);
    if(current.contextChanged)throw new WorkspaceError('CONTEXT_CHANGED');
    if(current.status==='READY')return current;
    try{return await this.operate(async({integration,storage})=>{
      await workspaceAccess(projectId,actor,true);
      if(!integration.projectsRootReady||!integration.projectsRootFolderId)throw new WorkspaceError('ROOT_NOT_CONFIGURED');
      const configuredRoot=await storage.getMetadata(integration.projectsRootFolderId);
      if(configuredRoot.mimeType!==FOLDER_MIME)throw new WorkspaceError('ROOT_NOT_CONFIGURED');
      let [workspace]=await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId,projectId));
      if(workspace&&(workspace.storageContextId!==integration.storageContextId||workspace.integrationId!==integration.id))throw new WorkspaceError('CONTEXT_CHANGED');
      if(workspace?.status==='READY')return (await workspaceSummaries([projectId])).get(projectId)!;
      if(!workspace){
        const project=await workspaceAccess(projectId,actor,true);
        if(!await obtenerEspecialistaActual(projectId,project.especialistaId))throw new WorkspaceError('SPECIALIST_REQUIRED',409,'Jefatura debe asignar un Especialista antes de configurar el espacio.');
        const [service]=await db.select().from(servicios).where(eq(servicios.id,project.servicioId));
        const [ficha]=await db.select().from(fichasTrazabilidad).where(eq(fichasTrazabilidad.proyectoId,projectId));
        let authors=await db.select({id:autores.id,name:autores.nombre,artistic:autores.nombreArtistico}).from(proyectosAutores).innerJoin(autores,eq(autores.id,proyectosAutores.autorId)).where(eq(proyectosAutores.proyectoId,projectId));
        if(!authors.length)authors=await db.select({id:autores.id,name:autores.nombre,artistic:autores.nombreArtistico}).from(autores).where(eq(autores.id,project.autorId));
        authors.sort((a,b)=>Number(b.id===project.autorId)-Number(a.id===project.autorId)||a.id.localeCompare(b.id));
        const template=resolveWorkspaceTemplate({serviceCode:service?.codigo??'',crudoSubtype:ficha?.ingresoServicioSubtipoCrudo??null,
          authorName:authors.map(a=>a.artistic?.trim()||a.name).join(' y '),projectCode:project.codigo,conditions:ficha?.condicionesEspeciales??[]});
        [workspace]=await db.insert(projectDriveWorkspaces).values({projectId,integrationId:integration.id,storageContextId:integration.storageContextId,
          projectsRootFolderId:integration.projectsRootFolderId,templateKey:template.key,templateVersion:template.version,plan:template.plan,status:'PROVISIONING',createdByUserId:actor.id}).returning();
      }
      if(!workspace)throw new WorkspaceError('INVALID_RESPONSE',502);
      const w=workspace,retry=w.attempts>0;
      await db.transaction(async tx=>{
        await tx.update(projectDriveWorkspaces).set({status:'PROVISIONING',attempts:w.attempts+1,lastErrorCode:null,updatedAt:new Date()}).where(eq(projectDriveWorkspaces.id,w.id));
        await registrarEvento(tx,{actorId:actor.id,accion:'PROJECT_WORKSPACE_INICIADO',entityType:'proyecto',entityId:projectId,proyectoId:projectId,detalles:{workspaceId:w.id,retry}});
      });
      try {
        let folders=await db.select().from(projectDriveFolders).where(eq(projectDriveFolders.workspaceId,w.id));
        const missing=w.plan.filter(node=>!folders.some(f=>f.key===node.key));
        if(missing.length){
          const ids=await storage.allocateFolderIds(missing.length);
          if(ids.length!==missing.length)throw new WorkspaceError('INVALID_RESPONSE',502);
          await db.insert(projectDriveFolders).values(missing.map((node,index)=>({workspaceId:w.id,key:node.key,parentFolderKey:node.parentKey,
            driveFolderId:ids[index]!,displayName:node.displayName,templatePath:node.templatePath})));
          folders=await db.select().from(projectDriveFolders).where(eq(projectDriveFolders.workspaceId,w.id));
        }
        for(const node of w.plan){
          const folder=folders.find(f=>f.key===node.key)!;
          const parentId=node.parentKey?folders.find(f=>f.key===node.parentKey)?.driveFolderId:w.projectsRootFolderId;
          if(!parentId)throw new WorkspaceError('INVALID_PLAN');
          const actual=await ensureReservedFolder(storage,{id:folder.driveFolderId,name:folder.displayName,parentId,alreadyReady:folder.status==='READY',
            properties:{panhouseWorkspace:w.id,panhouseFolderKey:node.key}});
          const url=actual.webViewLink??`https://drive.google.com/drive/folders/${actual.providerFileId}`;
          await db.transaction(async tx=>{
            await tx.update(projectDriveFolders).set({status:'READY',driveUrl:url,verifiedAt:new Date()}).where(eq(projectDriveFolders.id,folder.id));
            if(node.key==='ROOT')await tx.update(projectDriveWorkspaces).set({rootFolderId:folder.driveFolderId,rootFolderUrl:url,updatedAt:new Date()}).where(eq(projectDriveWorkspaces.id,w.id));
          });
        }
        await db.transaction(async tx=>{
          const now=new Date();
          await tx.update(projectDriveWorkspaces).set({status:'READY',readyAt:now,lastVerifiedAt:now,lastErrorCode:null,sharingStatus:'PENDING_VALIDATION',updatedAt:now}).where(eq(projectDriveWorkspaces.id,w.id));
          const [preparation]=await tx.select().from(preparacionesProyecto).where(eq(preparacionesProyecto.proyectoId,projectId));
          const completed=proyectarPreparacion(preparation,null,true,{...emptyWorkspace(),status:'READY'}).estado==='Completo';
          const wi=await crearWorkItemSiNoExiste(tx,{proyectoId:projectId,tipo:'preparacion_inicial'});
          await transicionarWorkItemPorId(tx,wi,completed?'completado':'en_progreso');
          await registrarEvento(tx,{actorId:actor.id,accion:retry?'PROJECT_WORKSPACE_REINTENTO_EXITOSO':'PROJECT_WORKSPACE_CONFIGURADO',entityType:'proyecto',entityId:projectId,proyectoId:projectId,
            detalles:{workspaceId:w.id,templateKey:w.templateKey,templateVersion:w.templateVersion,folderCount:w.plan.length}});
        });
      }catch(error){
        const code=error instanceof WorkspaceError?error.code:safeDriveError(error).code;
        await db.transaction(async tx=>{
          await tx.update(projectDriveWorkspaces).set({status:'ERROR',lastErrorCode:code,updatedAt:new Date()}).where(eq(projectDriveWorkspaces.id,w.id));
          await registrarEvento(tx,{actorId:actor.id,accion:'PROJECT_WORKSPACE_FALLIDO',entityType:'proyecto',entityId:projectId,proyectoId:projectId,detalles:{workspaceId:w.id,code}});
        });
        throw new WorkspaceError(code,503);
      }
      return (await workspaceSummaries([projectId])).get(projectId)!;
    });}catch(error){
      if(error instanceof WorkspaceError){
        if(error.code==='CRUDO_SUBTYPE_REQUIRED')await db.transaction(tx=>registrarEvento(tx,{actorId:actor.id,accion:'PROJECT_WORKSPACE_INCONSISTENCIA',entityType:'proyecto',entityId:projectId,proyectoId:projectId,detalles:{code:error.code}}));
        throw error;
      }
      const safe=safeDriveError(error);throw new WorkspaceError(safe.code,safe.statusCode);
    }
  }
}
export const projectWorkspaceService=new ProjectWorkspaceService();
