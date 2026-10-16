import { eq,inArray,sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { externalIntegrations,projectDriveWorkspaces,proyectos } from '../../db/schema/index.js';
import type { ProjectWorkspaceSummary } from '../../../shared/projectWorkspace.js';
import { especialistaActualSql } from '../../helpers/carga.js';

export const emptyWorkspace = ():ProjectWorkspaceSummary=>({id:null,status:'NOT_CONFIGURED',rootName:null,rootFolderUrl:null,templateKey:null,templateVersion:null,
  createdAt:null,readyAt:null,lastVerifiedAt:null,folderCount:0,expectedFolderCount:0,contextChanged:false,sharingStatus:'PENDING_VALIDATION',lastErrorCode:null,message:null});
export const workspaceErrorMessage=(code:string|null)=>code==='CRUDO_SUBTYPE_REQUIRED'?'No se puede crear el espacio documental: falta definir el subtipo de Crudo.':
  code==='NOT_CONNECTED'||code==='NOT_CONFIGURED'?'Google Drive no está disponible. Solicita a Dirección revisar la integración.':
  code==='ROOT_NOT_CONFIGURED'?'Falta configurar la carpeta de proyectos. Solicita a Dirección completar la configuración.':
  code==='CONTEXT_CHANGED'?'Este espacio pertenece a una conexión anterior. Dirección debe revisar el acceso antes de continuar.':
  code==='PROJECT_CLOSED'?'El proyecto está cerrado.':code?'No se pudo completar la estructura documental. Puedes reintentar conservando las carpetas creadas.':null;

export async function workspaceSummaries(ids:string[],client:typeof db=db) {
  const result=new Map<string,ProjectWorkspaceSummary>();if(!ids.length)return result;
  const rows=await client.select({w:projectDriveWorkspaces,currentContext:externalIntegrations.storageContextId,assignedTo:especialistaActualSql,
    folderCount:sql<number>`(select count(*)::int from project_drive_folders f where f.workspace_id=${projectDriveWorkspaces.id} and f.status='READY')`,
  }).from(projectDriveWorkspaces).innerJoin(externalIntegrations,eq(externalIntegrations.id,projectDriveWorkspaces.integrationId))
    .innerJoin(proyectos,eq(proyectos.id,projectDriveWorkspaces.projectId)).where(inArray(projectDriveWorkspaces.projectId,ids));
  for(const {w,currentContext,assignedTo,folderCount}of rows){
    const contextChanged=w.storageContextId!==currentContext;
    const sharingStatus=w.sharingStatus==='GRANTED'&&w.sharedWithUserId!==assignedTo?'REASSIGNMENT_REVIEW':w.sharingStatus;
    result.set(w.projectId,{id:w.id,status:w.status,rootName:w.plan.find(f=>f.key==='ROOT')?.displayName??null,rootFolderUrl:w.rootFolderUrl,
      templateKey:w.templateKey,templateVersion:w.templateVersion,createdAt:w.createdAt.toISOString(),readyAt:w.readyAt?.toISOString()??null,
      lastVerifiedAt:w.lastVerifiedAt?.toISOString()??null,folderCount:Number(folderCount),expectedFolderCount:w.plan.length,contextChanged,sharingStatus,
      lastErrorCode:contextChanged?'CONTEXT_CHANGED':w.lastErrorCode,message:workspaceErrorMessage(contextChanged?'CONTEXT_CHANGED':w.lastErrorCode)});
  }return result;
}
