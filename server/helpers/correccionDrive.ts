import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { projectDriveFolders, projectDriveWorkspaces } from '../db/schema/index.js';
import { withCorporateDrive, type CorporateDriveOperation } from '../modules/integrations/google-drive/corporate.js';
import { FOLDER_MIME } from '../modules/integrations/google-drive/adapter.js';
import { parseEditorialDriveId } from './editorDrive.js';
import { correctorError, correctorWorkContext } from './correctorAccess.js';

// Mismo parseo de enlace de Drive que Editor (editorDrive.ts) -- es una
// función pura, sin nada específico de Edición; reutilizarla evita
// duplicar la misma regex/validación de URL en un segundo archivo.
export const parseCorreccionDriveId = parseEditorialDriveId;

// Carpetas reales de Corrección (server/modules/project-workspaces/templates.ts)
// -- nunca rutas hardcodeadas. Solo dos llaves existen hoy para esta
// intervención: material de entrada y carpeta de entrega.
export const CORRECCION_FOLDER_KEYS: { key: string; label: string }[] = [
  { key: 'CORRECTION_INPUT', label: 'Para corregir' },
  { key: 'CORRECTION_OUTPUT', label: 'Corregido' },
];

async function context(workItemId: string, actorId: string) {
  const { item, correccion } = await correctorWorkContext(workItemId, actorId);
  const [workspace] = await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId, item.proyectoId));
  if (!workspace || workspace.status !== 'READY') throw correctorError('El espacio documental del proyecto aún no está disponible');
  const folders = await db.select().from(projectDriveFolders).where(and(eq(projectDriveFolders.workspaceId, workspace.id), eq(projectDriveFolders.status, 'READY')));
  return { item, correccion, workspace, folders };
}

// Mismo criterio de pertenencia por ascendencia que validateEditorialDriveFile
// (editorDrive.ts): un archivo compartido/ajeno o un shortcut no puede
// disfrazarse de material del proyecto con solo nombrar una carpeta conocida.
export async function validateCorreccionDriveFile(workItemId: string, actorId: string, url: string, operate: CorporateDriveOperation = withCorporateDrive) {
  const id = parseCorreccionDriveId(url);
  const c = await context(workItemId, actorId);
  return operate(async ({ integration, storage }) => {
    if (c.workspace.storageContextId !== integration.storageContextId || c.workspace.integrationId !== integration.id) throw correctorError('La conexión de Drive cambió; solicita la revisión del espacio documental');
    const file = await storage.getMetadata(id);
    if (file.trashed || file.mimeType === FOLDER_MIME || file.mimeType === 'application/vnd.google-apps.shortcut') throw correctorError('La entrega debe ser un archivo del proyecto', 400);
    const known = new Set(c.folders.map(f => f.driveFolderId));
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
    if (!belongs) throw correctorError('El archivo no pertenece al espacio documental de este proyecto', 403);
    return { driveFileId: file.providerFileId, driveUrl: `https://drive.google.com/file/d/${file.providerFileId}/view`, workspaceId: c.workspace.id, storageContextId: c.workspace.storageContextId };
  });
}

export async function listCorreccionDriveFiles(workItemId: string, actorId: string, folderKey: string, pageToken?: string, operate: CorporateDriveOperation = withCorporateDrive) {
  if (!CORRECCION_FOLDER_KEYS.some(f => f.key === folderKey)) throw correctorError('Carpeta no autorizada para esta intervención', 403);
  const c = await context(workItemId, actorId);
  const folder = c.folders.find(f => f.key === folderKey);
  if (!folder) throw correctorError('La carpeta de esta intervención no está disponible', 404);
  return operate(async ({ integration, storage }) => {
    if (integration.storageContextId !== c.workspace.storageContextId || integration.id !== c.workspace.integrationId) throw correctorError('La conexión de Drive cambió');
    if (!storage.listFiles) throw correctorError('La conexión no permite seleccionar archivos', 503);
    const result = await storage.listFiles({ parentFolderId: folder.driveFolderId, pageToken });
    return { items: result.items.map(f => ({ id: f.providerFileId, name: f.name, url: `https://drive.google.com/file/d/${f.providerFileId}/view` })), nextPageToken: result.nextPageToken };
  });
}
