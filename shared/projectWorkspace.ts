export interface ProjectWorkspaceSummary {
  id:string|null;status:'NOT_CONFIGURED'|'PROVISIONING'|'READY'|'ERROR';
  rootName:string|null;rootFolderUrl:string|null;templateKey:string|null;templateVersion:string|null;
  createdAt:string|null;readyAt:string|null;lastVerifiedAt:string|null;
  folderCount:number;expectedFolderCount:number;contextChanged:boolean;
  sharingStatus:'PENDING_EMAIL'|'PENDING_VALIDATION'|'GRANTED'|'ERROR'|'REASSIGNMENT_REVIEW';
  lastErrorCode:string|null;message:string|null;
}
export interface ProjectWorkspaceFolder {key:string;parentFolderKey:string|null;displayName:string;templatePath:string;driveFolderId:string;driveUrl:string|null}
