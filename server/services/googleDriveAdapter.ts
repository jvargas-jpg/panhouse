// Frontera canónica de fase 1. Sin simulación ni automatización documental.
export type { DriveStorageProvider, StorageItem } from '../modules/integrations/google-drive/provider.js';
export { GoogleDriveAdapter } from '../modules/integrations/google-drive/adapter.js';
export interface DriveDocumento {
  fileId: string; carpetaId: string; nombre: string; url: string; mimeType: string;
}
export interface EntregaDocumental {
  proyectoId: string; workItemId: string; submittedById: string; submittedAt: string;
  version: string; fechaLimite: string | null; estado: 'entregada'; documento: DriveDocumento;
}
