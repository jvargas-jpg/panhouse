export interface StorageItem {
  trashed?:boolean;providerFileId:string;name:string;mimeType:string;webViewLink:string|null;parents:string[];appProperties:Record<string,string>;
}
export interface DriveStorageProvider {
  validateConnection():Promise<{accountEmail:string|null;accountId:string|null}>;
  createFolder(input:{name:string;parentFolderId?:string;appProperties?:Record<string,string>}):Promise<StorageItem>;
  listFolders(input:{parentFolderId?:string;testRootsOnly?:boolean}):Promise<StorageItem[]>;
  getMetadata(id:string):Promise<StorageItem>;
  deleteFileOrFolder(id:string):Promise<void>;
}
export interface ProjectDriveStorageProvider extends DriveStorageProvider {
  uploadFile?(input:{name:string;mimeType:string;parentFolderId:string;content:Buffer}):Promise<StorageItem>;
  listFiles?(input:{parentFolderId:string;pageToken?:string}):Promise<{items:StorageItem[];nextPageToken:string|null}>;
  allocateFolderIds(count:number):Promise<string[]>;
  createFolder(input:{name:string;parentFolderId?:string;appProperties?:Record<string,string>;providerFileId?:string}):Promise<StorageItem>;
  shareFolder(id:string,email:string):Promise<{permissionId:string;email:string;role:string}>;
  listFolderPermissions(id:string):Promise<{permissionId:string;email:string|null;role:string}[]>;
}
