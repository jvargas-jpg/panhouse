import { eq,inArray,sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { externalIntegrations,projectDriveWorkspaces,projectWorkspaceRequests,proyectos } from '../../db/schema/index.js';
import type { ProjectWorkspaceSummary } from '../../../shared/projectWorkspace.js';
import { especialistaActualSql } from '../../helpers/carga.js';
import type { Tx } from '../../helpers/tx.js';

export const emptyWorkspace = ():ProjectWorkspaceSummary=>({id:null,status:'NOT_CONFIGURED',rootName:null,rootFolderUrl:null,templateKey:null,templateVersion:null,
  createdAt:null,readyAt:null,lastVerifiedAt:null,folderCount:0,expectedFolderCount:0,contextChanged:false,sharingStatus:'PENDING_VALIDATION',lastErrorCode:null,message:null,legacy:false,canRetry:false});
export const workspaceErrorMessage=(code:string|null)=>code==='CRUDO_SUBTYPE_REQUIRED'?'No se pudo preparar el espacio documental: falta definir el subtipo de Crudo.':
  ['NOT_CONNECTED','NOT_CONFIGURED','REAUTH_REQUIRED','INVALID_CLIENT','TOKEN_ENCRYPTION_ERROR','DRIVE_ACCESS_DENIED'].includes(code??'')?'Google Drive no está disponible. Solicita a Dirección revisar la integración.':
  code==='ROOT_NOT_CONFIGURED'?'Falta configurar la carpeta de proyectos. Solicita a Dirección completar la configuración.':
  code==='CONTEXT_CHANGED'?'Este espacio pertenece a una conexión anterior. Dirección debe revisar el acceso antes de continuar.':
  code==='ADMIN_RECOVERY_REQUIRED'?'Pendiente de configuración del sistema. Solicita a Dirección revisar el espacio documental.':
  code==='UNSUPPORTED_SERVICE'?'El servicio requiere una estructura documental validada por Dirección.':
  code==='PROJECT_CLOSED'?'El proyecto está cerrado.':code?'No se pudo completar la estructura documental. Puedes reintentar conservando las carpetas creadas.':null;

export const specialistCanRetry=(code:string|null)=>['GOOGLE_UNAVAILABLE','RATE_LIMITED','BUSY','INVALID_RESPONSE'].includes(code??'');

export async function workspaceSummaries(ids:string[],client:typeof db|Tx=db) {
  const result=new Map<string,ProjectWorkspaceSummary>();if(!ids.length)return result;
  const rows=await client.select({w:projectDriveWorkspaces,r:projectWorkspaceRequests,projectId:proyectos.id,currentContext:externalIntegrations.storageContextId,assignedTo:especialistaActualSql,
    folderCount:sql<number>`(select count(*)::int from project_drive_folders f where f.workspace_id=${projectDriveWorkspaces.id} and f.status='READY')`,
  }).from(proyectos).leftJoin(projectDriveWorkspaces,eq(projectDriveWorkspaces.projectId,proyectos.id))
    .leftJoin(projectWorkspaceRequests,eq(projectWorkspaceRequests.projectId,proyectos.id))
    .leftJoin(externalIntegrations,eq(externalIntegrations.id,projectDriveWorkspaces.integrationId)).where(inArray(proyectos.id,ids));
  for(const {w,r,projectId,currentContext,assignedTo,folderCount}of rows){
    const contextChanged=!!w&&w.storageContextId!==currentContext;
    const sharingStatus=w?.sharingStatus==='GRANTED'&&w.sharedWithUserId!==assignedTo?'REASSIGNMENT_REVIEW':w?.sharingStatus??'PENDING_VALIDATION';
    const current:ProjectWorkspaceSummary=w?{id:w.id,status:w.status,rootName:w.plan.find(f=>f.key==='ROOT')?.displayName??null,rootFolderUrl:w.rootFolderUrl,
      templateKey:w.templateKey,templateVersion:w.templateVersion,createdAt:w.createdAt.toISOString(),readyAt:w.readyAt?.toISOString()??null,
      lastVerifiedAt:w.lastVerifiedAt?.toISOString()??null,folderCount:Number(folderCount),expectedFolderCount:w.plan.length,contextChanged,sharingStatus,
      legacy:false,canRetry:!contextChanged&&w.status==='ERROR'&&specialistCanRetry(w.lastErrorCode),
      lastErrorCode:contextChanged?'CONTEXT_CHANGED':w.lastErrorCode,message:workspaceErrorMessage(contextChanged?'CONTEXT_CHANGED':w.lastErrorCode)}:emptyWorkspace();
    if(r&&current.status!=='READY'&&!current.contextChanged){
      current.status=r.status;current.lastErrorCode=r.lastErrorCode;
      current.message=workspaceErrorMessage(r.lastErrorCode);
      current.canRetry=r.status==='ERROR'&&specialistCanRetry(r.lastErrorCode);
    }
    current.legacy=!r&&!current.id&&!!assignedTo;
    result.set(projectId,current);
  }
  return result;
}
