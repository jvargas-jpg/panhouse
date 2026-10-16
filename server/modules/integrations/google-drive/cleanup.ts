import type { DriveStorageProvider } from './provider.js';
import { DriveIntegrationError, safeDriveError } from './errors.js';

/** Drive metadata can briefly remain visible after a successful delete. Bounded confirmation, never a guessed success. */
export async function confirmDriveDeletion(storage: DriveStorageProvider, id:string,
  pause:(ms:number)=>Promise<void> = ms=>new Promise(resolve=>setTimeout(resolve,ms))) {
  for (const delay of [0,250,500,1000,2000]) {
    if(delay)await pause(delay);
    try { await storage.getMetadata(id); }
    catch(error) { if(safeDriveError(error).code==='NOT_FOUND')return; throw error; }
  }
  throw new DriveIntegrationError('CLEANUP_FAILED');
}
