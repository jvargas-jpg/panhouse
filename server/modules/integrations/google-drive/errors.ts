export type DriveErrorCode = 'NOT_CONFIGURED' | 'NOT_CONNECTED' | 'INVALID_STATE' | 'OAUTH_DENIED' | 'OAUTH_FAILED' |
  'REAUTH_REQUIRED' | 'INVALID_CLIENT' | 'REDIRECT_MISMATCH' | 'SCOPE_MISMATCH' | 'REFRESH_TOKEN_REQUIRED' |
  'DRIVE_ACCESS_DENIED' | 'NOT_FOUND' | 'GOOGLE_UNAVAILABLE' | 'RATE_LIMITED' | 'BUSY' | 'STALE_ATTEMPT' |
  'TOKEN_ENCRYPTION_ERROR' | 'INVALID_RESPONSE' | 'CLEANUP_FAILED';
const messages: Record<DriveErrorCode, string> = {
  NOT_CONFIGURED: 'Google Drive integration is not configured.',
  NOT_CONNECTED: 'Google Drive no está conectado.',
  INVALID_STATE: 'El intento de conexión no es válido, expiró o ya se utilizó. Inicia la conexión otra vez.',
  OAUTH_DENIED: 'Google Drive no fue autorizado. Puedes iniciar la conexión de nuevo.',
  OAUTH_FAILED: 'No se pudo autorizar Google Drive. Inicia la conexión de nuevo.',
  REAUTH_REQUIRED: 'Google revocó o rechazó la credencial. Conecta Google Drive de nuevo.',
  INVALID_CLIENT: 'Google rechazó la configuración OAuth. Revisa el cliente web configurado en el servidor.',
  REDIRECT_MISMATCH: 'El callback OAuth no coincide con el registrado en Google Cloud.',
  SCOPE_MISMATCH: 'Google no concedió exclusivamente el permiso drive.file requerido.',
  REFRESH_TOKEN_REQUIRED: 'No se recibió una credencial de acceso offline utilizable. Conecta de nuevo y concede el consentimiento.',
  DRIVE_ACCESS_DENIED: 'Google Drive rechazó el acceso. Revisa la cuenta corporativa y el permiso drive.file.',
  NOT_FOUND: 'El archivo o la carpeta de prueba no está disponible en Google Drive.',
  GOOGLE_UNAVAILABLE: 'Google no está disponible en este momento. Reintenta la operación.',
  RATE_LIMITED: 'Espera un momento antes de repetir esta operación de Google Drive.',
  BUSY: 'Hay otra operación de Google Drive en curso. Espera a que termine.',
  STALE_ATTEMPT: 'La integración cambió mientras se autorizaba. Inicia una conexión nueva.',
  TOKEN_ENCRYPTION_ERROR: 'No se pudo proteger o recuperar la credencial. Revisa la clave de cifrado del servidor.',
  INVALID_RESPONSE: 'Google Drive devolvió una respuesta incompleta. No se dio la operación por verificada.',
  CLEANUP_FAILED: 'No se pudo completar la limpieza de la carpeta de prueba. Repite la prueba para recuperarla.',
};
export class DriveIntegrationError extends Error {
  constructor(public code: DriveErrorCode, public statusCode = 409) { super(messages[code]); }
}
export const safeDriveError = (error: unknown): DriveIntegrationError => {
  if(error instanceof DriveIntegrationError)return error;
  const e=error as {code?:unknown;response?:{status?:number;data?:{error?:string|{status?:string;errors?:{reason?:string}[]}}}};
  const status=e?.response?.status,raw=e?.response?.data?.error;
  const code=typeof raw==='string'?raw:typeof e?.code==='string'?e.code:'';
  if(code==='invalid_grant')return new DriveIntegrationError('REAUTH_REQUIRED');
  if(code==='invalid_client'||code==='unauthorized_client')return new DriveIntegrationError('INVALID_CLIENT',503);
  if(code==='redirect_uri_mismatch')return new DriveIntegrationError('REDIRECT_MISMATCH',503);
  if(code==='access_denied')return new DriveIntegrationError('OAUTH_DENIED',403);
  if(status===401)return new DriveIntegrationError('REAUTH_REQUIRED');
  if(status===429 || typeof raw==='object'&&raw?.errors?.some(e=>['rateLimitExceeded','userRateLimitExceeded'].includes(e.reason ?? '')))return new DriveIntegrationError('RATE_LIMITED',429);
  if(status===403)return new DriveIntegrationError('DRIVE_ACCESS_DENIED',403);
  if(status===404)return new DriveIntegrationError('NOT_FOUND',404);
  return new DriveIntegrationError('GOOGLE_UNAVAILABLE',503);
};
