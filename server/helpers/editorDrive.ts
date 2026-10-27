import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { projectDriveFolders, projectDriveWorkspaces } from '../db/schema/index.js';
import { withCorporateDrive, type CorporateDriveOperation } from '../modules/integrations/google-drive/corporate.js';
import { FOLDER_MIME } from '../modules/integrations/google-drive/adapter.js';
import { editorError, editorWorkProject } from './editorAccess.js';
import { folderKeysPara } from './editorWork.js';
import { editorialInterventions } from './editorialChief.js';
import { lockEditorWork } from './editorAccess.js';
import { registrarEvento } from './auditLog.js';

export function parseEditorialDriveId(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw editorError('Introduce un enlace de archivo de Google Drive', 400); }
  if (url.protocol !== 'https:' || !['drive.google.com','docs.google.com'].includes(url.hostname) || url.username || url.password || url.port) throw editorError('Usa un enlace HTTPS de Google Drive o Google Docs', 400);
  const id = url.pathname.match(/\/(?:file\/)?d\/([\w-]+)/)?.[1] ?? url.searchParams.get('id');
  if (!id || !/^[\w-]{3,200}$/.test(id) || url.pathname.includes('/folders/')) throw editorError('Selecciona un archivo, no una carpeta de Drive', 400);
  return id;
}

// Uses persisted folders/template version. Never provisions or migrates a workspace.
async function context(workItemId: string, actorId: string) {
  const { item } = await editorWorkProject(workItemId, actorId);
  const [workspace] = await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId, item.proyectoId));
  if (!workspace || workspace.status !== 'READY') throw editorError('El espacio documental del proyecto aún no está disponible');
  const folders = await db.select().from(projectDriveFolders).where(and(eq(projectDriveFolders.workspaceId, workspace.id), eq(projectDriveFolders.status, 'READY')));
  return { item, workspace, folders };
}

export async function validateEditorialDriveFile(workItemId: string, actorId: string, url: string, operate: CorporateDriveOperation = withCorporateDrive) {
  const id = parseEditorialDriveId(url);
  const c = await context(workItemId, actorId);
  return operate(async ({ integration, storage }) => {
    if (c.workspace.storageContextId !== integration.storageContextId || c.workspace.integrationId !== integration.id) throw editorError('La conexión de Drive cambió; solicita la revisión del espacio documental');
    const file = await storage.getMetadata(id);
    if (file.trashed || file.mimeType === FOLDER_MIME || file.mimeType === 'application/vnd.google-apps.shortcut') throw editorError('La entrega debe ser un archivo del proyecto', 400);
    const known = new Set(c.folders.map(f => f.driveFolderId));
    // Bound parent traversal; a shared/foreign file or shortcut cannot bypass ancestry.
    let parents = file.parents;
    const visited = new Set<string>();
    let belongs = parents.some(p => known.has(p));
    for (let depth = 0; !belongs && parents.length && depth < 12; depth++) {
      const next: string[] = [];
      for (const parent of parents) {
        if (visited.has(parent)) continue;
        visited.add(parent);
        next.push(...(await storage.getMetadata(parent)).parents);
      }
      belongs = next.some(p => known.has(p)); parents = next;
    }
    if (!belongs) throw editorError('El archivo no pertenece al espacio documental de este proyecto', 403);
    return { driveFileId: file.providerFileId, driveUrl: `https://drive.google.com/file/d/${file.providerFileId}/view`, workspaceId: c.workspace.id, storageContextId: c.workspace.storageContextId };
  });
}

export async function listEditorialDriveFiles(workItemId: string, actorId: string, folderKey: string, pageToken?: string, operate: CorporateDriveOperation = withCorporateDrive) {
  const c = await context(workItemId, actorId);
  const [item] = await editorialInterventions(undefined, undefined, actorId, workItemId);
  if (!item || !folderKeysPara(item).some(f => f.key === folderKey)) throw editorError('Carpeta no autorizada para esta intervención', 403);
  const folder = c.folders.find(f => f.key === folderKey);
  if (!folder) throw editorError('La carpeta de esta intervención no está disponible', 404);
  return operate(async ({integration, storage}) => {
    if (integration.storageContextId !== c.workspace.storageContextId || integration.id !== c.workspace.integrationId) throw editorError('La conexión de Drive cambió');
    if (!storage.listFiles) throw editorError('La conexión no permite seleccionar archivos', 503);
    const result = await storage.listFiles({parentFolderId: folder.driveFolderId, pageToken});
    return {items: result.items.map(f => ({id:f.providerFileId,name:f.name,url:`https://drive.google.com/file/d/${f.providerFileId}/view`})),nextPageToken:result.nextPageToken};
  });
}

// A narrow upload into the persisted work folder also makes human-created
// files usable with drive.file. This does not register a delivery or browse Drive.
export async function uploadEditorialDriveFile(workItemId:string,actorId:string,input:{folderKey:string;name:string;mimeType:string;contentBase64:string},operate:CorporateDriveOperation=withCorporateDrive){
  const c=await context(workItemId,actorId);
  const [item]=await editorialInterventions(undefined,undefined,actorId,workItemId);
  if(!item?.actionable||item.state==='Bloqueadas')throw editorError('La intervención no admite archivos de trabajo en este momento');
  const allowed=folderKeysPara(item).filter(f=>['EDITING','EDITING_OUTPUT','EDITING_FEEDBACK_APPLIED'].includes(f.key));
  const folder=c.folders.find(f=>f.key===input.folderKey&&allowed.some(a=>a.key===f.key));
  if(!folder)throw editorError('Selecciona una carpeta de trabajo autorizada',403);
  if(!/^[^\\/\x00-\x1f]{1,180}$/.test(input.name)||!/\.(docx?|pdf|odt|rtf|txt)$/i.test(input.name))throw editorError('Selecciona un documento Word, PDF, ODT, RTF o TXT',400);
  if(input.contentBase64.length>12_000_000||!/^[A-Za-z0-9+/]*={0,2}$/.test(input.contentBase64))throw editorError('El archivo supera el tamaño permitido o es inválido',400);
  const content=Buffer.from(input.contentBase64,'base64');
  if(!content.length||content.length>8*1024*1024)throw editorError('El archivo debe pesar entre 1 byte y 8 MB',400);
  return operate(async({integration,storage})=>{
    if(integration.storageContextId!==c.workspace.storageContextId||integration.id!==c.workspace.integrationId)throw editorError('La conexión de Drive cambió');
    if(!storage.uploadFile)throw editorError('La conexión no admite carga de archivos',503);
    const created=await storage.uploadFile({parentFolderId:folder.driveFolderId,name:input.name,mimeType:({doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pdf:'application/pdf',odt:'application/vnd.oasis.opendocument.text',rtf:'application/rtf',txt:'text/plain'} as Record<string,string>)[input.name.split('.').pop()!.toLowerCase()]!,content});
    try{
      await db.transaction(async tx=>{
        const latest=await lockEditorWork(tx,workItemId,actorId);
        if(['completado','cancelado','bloqueado'].includes(latest.item.estado)||['pausado','stand_by'].includes(latest.project.estado))throw editorError('La intervención cambió durante la carga');
        await registrarEvento(tx,{actorId,accion:'EDITOR_ARCHIVO_CARGADO',entityType:'work_item',entityId:workItemId,proyectoId:c.item.proyectoId,detalles:{driveFileId:created.providerFileId,folderKey:folder.key}});
      });
    }catch(error){await storage.deleteFileOrFolder(created.providerFileId);throw error;}
    return {id:created.providerFileId,name:created.name,url:`https://drive.google.com/file/d/${created.providerFileId}/view`};
  });
}
