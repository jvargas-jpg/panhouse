import { FOLDER_MIME } from '../integrations/google-drive/adapter.js';
import { safeDriveError } from '../integrations/google-drive/errors.js';
import type { ProjectDriveStorageProvider,StorageItem } from '../integrations/google-drive/provider.js';
import { WorkspaceError } from './errors.js';

export async function ensureReservedFolder(storage:ProjectDriveStorageProvider,input:{id:string;name:string;parentId?:string;alreadyReady:boolean;properties:Record<string,string>}) {
  let metadata:StorageItem|undefined;
  try{metadata=await storage.getMetadata(input.id);}catch(error){if(safeDriveError(error).code!=='NOT_FOUND')throw error;}
  if(!metadata){
    if(input.alreadyReady)throw new WorkspaceError('FOLDER_MISSING');
    try{metadata=await storage.createFolder({providerFileId:input.id,name:input.name,parentFolderId:input.parentId,appProperties:input.properties});}
    catch(error){
      // A lost response or create conflict is recovered by the reserved ID, never by name.
      try{metadata=await storage.getMetadata(input.id);}catch{throw error;}
    }
  }
  if(metadata.providerFileId!==input.id||metadata.mimeType!==FOLDER_MIME||
    input.parentId&&!metadata.parents.includes(input.parentId)||
    Object.entries(input.properties).some(([key,value])=>metadata!.appProperties[key]!==value))throw new WorkspaceError('FOLDER_MISMATCH');
  return metadata;
}
