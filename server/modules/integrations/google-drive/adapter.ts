import { drive, type drive_v3 } from '@googleapis/drive';
import type { OAuth2Client } from 'google-auth-library';
import { DriveIntegrationError, safeDriveError } from './errors.js';
import type { DriveStorageProvider, StorageItem } from './provider.js';

export const FOLDER_MIME='application/vnd.google-apps.folder';
export const SMOKE_PURPOSE='panhouse_connection_smoke_v1';
const fields='id,name,mimeType,webViewLink,parents,appProperties';
const escapeQuery=(s:string)=>s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
function item(f:drive_v3.Schema$File):StorageItem {
  if(!f.id||!f.name||!f.mimeType)throw new DriveIntegrationError('INVALID_RESPONSE',502);
  return {providerFileId:f.id,name:f.name,mimeType:f.mimeType,webViewLink:f.webViewLink ?? null,parents:f.parents ?? [],appProperties:f.appProperties ?? {}};
}
export class GoogleDriveAdapter implements DriveStorageProvider {
  private client:drive_v3.Drive;
  constructor(auth:OAuth2Client) { this.client=drive({version:'v3',auth,timeout:15000,retry:false}); }
  async validateConnection() {
    try {const r=await this.client.about.get({fields:'user(emailAddress,permissionId)'});return {accountEmail:r.data.user?.emailAddress ?? null,accountId:r.data.user?.permissionId ?? null};}
    catch(e){throw safeDriveError(e);}
  }
  async createFolder(input:{name:string;parentFolderId?:string;appProperties?:Record<string,string>}) {
    try {
      const r=await this.client.files.create({requestBody:{name:input.name,mimeType:FOLDER_MIME,...(input.parentFolderId?{parents:[input.parentFolderId]}:{}),...(input.appProperties?{appProperties:input.appProperties}:{})},fields});
      return item(r.data);
    }catch(e){throw safeDriveError(e);}
  }
  async listFolders(input:{parentFolderId?:string;testRootsOnly?:boolean}) {
    const q=[`mimeType='${FOLDER_MIME}'`,'trashed=false'];
    if(input.parentFolderId)q.push(`'${escapeQuery(input.parentFolderId)}' in parents`);
    if(input.testRootsOnly)q.push(`appProperties has { key='panhousePurpose' and value='${SMOKE_PURPOSE}' }`);
    const results:StorageItem[]=[];let pageToken:string|undefined;
    try {
      do {const r=await this.client.files.list({q:q.join(' and '),fields:'nextPageToken,files('+fields+')',pageSize:100,...(pageToken?{pageToken}:{})});results.push(...(r.data.files ?? []).map(item));pageToken=r.data.nextPageToken ?? undefined;
        if(results.length>1000)throw new DriveIntegrationError('INVALID_RESPONSE',502);
      }while(pageToken);
      return results;
    }catch(e){throw safeDriveError(e);}
  }
  async getMetadata(id:string) {try{return item((await this.client.files.get({fileId:id,fields})).data);}catch(e){throw safeDriveError(e);}}
  async deleteFileOrFolder(id:string) {try{await this.client.files.delete({fileId:id});}catch(e){throw safeDriveError(e);}}
}
