import type { ProjectDriveStorageProvider } from '../integrations/google-drive/provider.js';

// Una subcarpeta por capítulo, dentro de la carpeta de extracciones que YA
// trae la plantilla de Edición para EF (Edición/Extracciones de contenido —
// ver CONTENT_EXTRACTIONS en templates.ts; es también donde el Editor ve
// su "Material recibido" en folderKeysPara()). Nunca una carpeta aparte en
// la raíz: lo que produce la extracción vive dentro de Edición, con todo
// lo demás de esa fase. Se busca/crea por appProperties, no por nombre:
// withCorporateDrive ya serializa todas las operaciones de Drive con un
// lock global, así que no hay carrera entre dos editores subiendo a la vez.
export async function findOrCreateChapterInterviewFolder(storage: ProjectDriveStorageProvider, extraccionesFolderId: string, numero: number) {
  const key = `CAPITULO_${numero}`;
  const existentes = await storage.listFolders({ parentFolderId: extraccionesFolderId });
  const encontrada = existentes.find(f => f.appProperties.key === key && !f.trashed);
  if (encontrada) return encontrada;
  return storage.createFolder({ name: `Capítulo ${numero}`, parentFolderId: extraccionesFolderId, appProperties: { key } });
}
