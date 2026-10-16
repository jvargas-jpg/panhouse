import { env } from '../../../config/env.js';
import { decodeEncryptionKey } from './encryption.js';
import { DriveIntegrationError } from './errors.js';
export const DRIVE_FILE_SCOPE='https://www.googleapis.com/auth/drive.file';
export const DRIVE_UI_PATH='/configuracion/integraciones/google-drive';
export interface GoogleDriveConfig {clientId:string;clientSecret:string;redirectUri:string;scope:string;encryptionKey:Buffer;frontendUrl:string}
export function googleDriveConfig(): GoogleDriveConfig {
  try {
    const clientId=env.GOOGLE_CLIENT_ID?.trim(),clientSecret=env.GOOGLE_CLIENT_SECRET?.trim();
    const redirect=new URL(env.GOOGLE_REDIRECT_URI),frontend=new URL(env.APP_FRONTEND_URL);
    if(!clientId||!clientSecret||env.GOOGLE_DRIVE_SCOPE!==DRIVE_FILE_SCOPE||redirect.pathname!=='/api/auth/google/callback'||redirect.search||redirect.hash||frontend.search||frontend.hash||frontend.pathname!=='/'||redirect.username||redirect.password||frontend.username||frontend.password)throw new Error('Invalid config');
    for(const u of [redirect,frontend])if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw new Error('HTTPS required');
    return {clientId,clientSecret,redirectUri:redirect.toString(),scope:DRIVE_FILE_SCOPE,encryptionKey:decodeEncryptionKey(env.GOOGLE_TOKEN_ENCRYPTION_KEY),frontendUrl:frontend.origin};
  }catch{throw new DriveIntegrationError('NOT_CONFIGURED',503);}
}
export function isGoogleDriveConfigured() {try{googleDriveConfig();return true;}catch{return false;}}
