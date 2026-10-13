// Contrato de infraestructura. No hay implementación OAuth ni archivos ficticios.
// PanHouse persiste la entrega/versionado mediante los comandos de cada área.
export interface DriveDocumento {
  fileId: string; carpetaId: string; nombre: string; url: string; mimeType: string;
}
export interface GoogleDriveAdapter {
  crearEspacioProyecto(input: { proyectoId: string; nombre: string; carpetas: string[] }): Promise<{ carpetaId: string; url: string }>;
  guardarEntregable(input: { carpetaId: string; nombre: string; mimeType: string; contenido: Uint8Array }): Promise<DriveDocumento>;
  obtenerDocumento(fileId: string): Promise<DriveDocumento>;
}
export interface EntregaDocumental {
  proyectoId: string; workItemId: string; submittedById: string; submittedAt: string;
  version: string; fechaLimite: string | null; estado: 'entregada'; documento: DriveDocumento;
}
