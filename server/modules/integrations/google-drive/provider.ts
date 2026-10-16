export interface StorageItem {
  providerFileId:string;name:string;mimeType:string;webViewLink:string|null;parents:string[];appProperties:Record<string,string>;
}
export interface DriveStorageProvider {
  validateConnection():Promise<{accountEmail:string|null;accountId:string|null}>;
  createFolder(input:{name:string;parentFolderId?:string;appProperties?:Record<string,string>}):Promise<StorageItem>;
  listFolders(input:{parentFolderId?:string;testRootsOnly?:boolean}):Promise<StorageItem[]>;
  getMetadata(id:string):Promise<StorageItem>;
  deleteFileOrFolder(id:string):Promise<void>;
}
