import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { env } from '../../config/env.js';
import { externalIntegrations } from '../../db/schema/index.js';
import type { ActorFicha } from '../../helpers/intakeRrpp.js';
import { registrarEvento } from '../../helpers/auditLog.js';
import { withCorporateDrive,type CorporateDriveOperation } from '../integrations/google-drive/corporate.js';
import { WorkspaceError } from './errors.js';
import { ensureReservedFolder } from './folders.js';
export const DEV_PROJECTS_ROOT_NAME='PANHOUSE - PROYECTOS EDITORIALES - DEV';
export async function configureDevProjectsRoot(actor:ActorFicha,operate:CorporateDriveOperation=withCorporateDrive){
  if(!['direccion','admin'].includes(actor.rol))throw new WorkspaceError('FORBIDDEN',403,'Solo Dirección o Administración puede configurar la raíz documental.');
  if(env.NODE_ENV==='production')throw new WorkspaceError('DEV_ROOT_ONLY',409,'Configura una raíz de producción mediante administración antes de crear workspaces.');
  return operate(async({integration,storage})=>{
    let id=integration.projectsRootFolderId;
    if(!id){
      const reserved=(await storage.allocateFolderIds(1))[0];if(!reserved)throw new WorkspaceError('INVALID_RESPONSE',502);id=reserved;
      await db.update(externalIntegrations).set({projectsRootFolderId:id,projectsRootReady:false,updatedAt:new Date()}).where(eq(externalIntegrations.id,integration.id));
    }
    const folder=await ensureReservedFolder(storage,{id,name:DEV_PROJECTS_ROOT_NAME,alreadyReady:integration.projectsRootReady,
      properties:{panhousePurpose:'project_workspace_dev_root',panhouseContext:integration.storageContextId}});
    const url=folder.webViewLink??`https://drive.google.com/drive/folders/${id}`;
    await db.transaction(async tx=>{
      await tx.update(externalIntegrations).set({projectsRootReady:true,projectsRootFolderUrl:url,updatedAt:new Date()}).where(eq(externalIntegrations.id,integration.id));
      if(!integration.projectsRootReady)await registrarEvento(tx,{actorId:actor.id,accion:'DRIVE_PROJECTS_ROOT_CONFIGURADA',entityType:'external_integration',entityId:integration.id,detalles:{folderId:id}});
    });
    return {folderId:id,folderUrl:url,name:folder.name,ready:true};
  });
}
