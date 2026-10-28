import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { projectDriveFolders, projectDriveWorkspaces, workItems } from '../db/schema/index.js';
import { withCorporateDrive, type CorporateDriveOperation } from '../modules/integrations/google-drive/corporate.js';
import { digitalWorkError } from './soporteDigitalWork.js';

// Soporte Digital nunca entrega archivos (el paquete final lo arma
// Diseño) -- solo necesita CONSULTAR la carpeta real donde Diseño ya
// dejó los archivos para probar en KDP. Una sola carpeta real hoy
// (server/modules/project-workspaces/templates.ts): 'KDP', hija de
// 'Paquete final'. Bandeja compartida: cualquier soporte_digital puede
// abrir cualquier tarea, sin chequeo de dueño individual.
export const DIGITAL_FOLDER_KEY = 'FINAL_PACKAGE_KDP';

async function context(workItemId: string) {
  const [item] = await db.select().from(workItems).where(eq(workItems.id, workItemId));
  if (!item || item.tipo !== 'soporte_digital') throw digitalWorkError('Tarea digital no encontrada');
  const [workspace] = await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId, item.proyectoId));
  if (!workspace || workspace.status !== 'READY') throw digitalWorkError('El espacio documental del proyecto aún no está disponible', 409);
  const [folder] = await db.select().from(projectDriveFolders).where(and(eq(projectDriveFolders.workspaceId, workspace.id), eq(projectDriveFolders.key, DIGITAL_FOLDER_KEY), eq(projectDriveFolders.status, 'READY')));
  return { item, workspace, folder };
}

export async function listDigitalDriveFiles(workItemId: string, pageToken?: string, operate: CorporateDriveOperation = withCorporateDrive) {
  const { workspace, folder } = await context(workItemId);
  if (!folder) return { items: [], nextPageToken: null };
  return operate(async ({ integration, storage }) => {
    if (integration.storageContextId !== workspace.storageContextId || integration.id !== workspace.integrationId) throw digitalWorkError('La conexión de Drive cambió', 409);
    if (!storage.listFiles) throw digitalWorkError('La conexión no permite consultar archivos', 503);
    const result = await storage.listFiles({ parentFolderId: folder.driveFolderId, pageToken });
    return { items: result.items.map(f => ({ id: f.providerFileId, name: f.name, url: `https://drive.google.com/file/d/${f.providerFileId}/view` })), nextPageToken: result.nextPageToken ?? null };
  });
}
