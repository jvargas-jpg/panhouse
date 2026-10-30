import { and, eq, ne } from 'drizzle-orm';
import { db } from '../db/client.js';
import { fichaDocumentalDatos, proyectos, projectDriveFolders, projectDriveWorkspaces, workItems } from '../db/schema/index.js';
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
  const [found] = await db.select({ item: workItems }).from(workItems).innerJoin(proyectos, eq(proyectos.id, workItems.proyectoId)).where(and(
    eq(workItems.id, workItemId), eq(workItems.tipo, 'soporte_digital'), ne(workItems.estado, 'cancelado'), ne(proyectos.estado, 'retirado'),
  ));
  if (!found) throw digitalWorkError('Tarea digital no encontrada');
  const { item } = found;
  const [material] = await db.select({ datos: fichaDocumentalDatos.datos }).from(fichaDocumentalDatos).where(and(eq(fichaDocumentalDatos.proyectoId, item.proyectoId), eq(fichaDocumentalDatos.seccion, 'diseno')));
  if (material?.datos.paqueteFinalCargado !== true) throw digitalWorkError('Diseño/Calidad aún no ha entregado el paquete final', 409);
  const [workspace] = await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId, item.proyectoId));
  if (!workspace || workspace.status !== 'READY') throw digitalWorkError('El espacio documental del proyecto aún no está disponible', 409);
  const [folder] = await db.select().from(projectDriveFolders).where(and(eq(projectDriveFolders.workspaceId, workspace.id), eq(projectDriveFolders.key, DIGITAL_FOLDER_KEY), eq(projectDriveFolders.status, 'READY')));
  return { item, workspace, folder };
}

export async function listDigitalDriveFiles(workItemId: string, pageToken?: string, operate: CorporateDriveOperation = withCorporateDrive) {
  const { workspace, folder } = await context(workItemId);
  if (!folder) return { items: [], nextPageToken: null, folderUrl: null };
  return operate(async ({ integration, storage }) => {
    if (integration.storageContextId !== workspace.storageContextId || integration.id !== workspace.integrationId) throw digitalWorkError('La conexión de Drive cambió', 409);
    if (!storage.listFiles) throw digitalWorkError('La conexión no permite consultar archivos', 503);
    const result = await storage.listFiles({ parentFolderId: folder.driveFolderId, pageToken });
    return { items: result.items.map(f => ({ id: f.providerFileId, name: f.name, url: `https://drive.google.com/file/d/${f.providerFileId}/view` })), nextPageToken: result.nextPageToken ?? null,
      folderUrl: `https://drive.google.com/drive/folders/${encodeURIComponent(folder.driveFolderId)}` };
  });
}
