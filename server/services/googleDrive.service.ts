// MOCK: sin credenciales todavía. Reemplazar por la integración real de
// Google Drive cuando estén disponibles.

export interface ArchivoDrive {
  id: string;
  nombre: string;
  url: string;
}

export async function crearCarpetaProyecto(nombreProyecto: string): Promise<{ carpetaId: string; url: string }> {
  return {
    carpetaId: `mock-folder-${Date.now()}`,
    url: `https://drive.google.com/drive/folders/mock-${encodeURIComponent(nombreProyecto)}`,
  };
}

export async function subirArchivo(carpetaId: string, nombreArchivo: string): Promise<ArchivoDrive> {
  return {
    id: `mock-file-${Date.now()}`,
    nombre: nombreArchivo,
    url: `https://drive.google.com/file/mock-${carpetaId}`,
  };
}

export async function listarArchivos(_carpetaId: string): Promise<ArchivoDrive[]> {
  return [];
}
