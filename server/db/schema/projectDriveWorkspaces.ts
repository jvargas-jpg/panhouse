import { check, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { proyectos } from './proyectos.js';
import { users } from './users.js';
import { externalIntegrations } from './integrations.js';

export interface WorkspaceFolderPlan {key:string;parentKey:string|null;displayName:string;templatePath:string}
export const projectDriveWorkspaces = pgTable('project_drive_workspaces',{
  id:uuid('id').primaryKey().defaultRandom(),
  projectId:uuid('project_id').notNull().unique().references(()=>proyectos.id,{onDelete:'restrict'}),
  integrationId:uuid('integration_id').notNull().references(()=>externalIntegrations.id,{onDelete:'restrict'}),
  storageContextId:uuid('storage_context_id').notNull(),
  projectsRootFolderId:text('projects_root_folder_id').notNull(),
  rootFolderId:text('root_folder_id'),rootFolderUrl:text('root_folder_url'),
  templateKey:text('template_key').notNull(),templateVersion:text('template_version').notNull(),
  plan:jsonb('plan').$type<WorkspaceFolderPlan[]>().notNull(),
  status:text('status').$type<'PROVISIONING'|'READY'|'ERROR'>().notNull(),
  lastErrorCode:text('last_error_code'),attempts:integer('attempts').notNull().default(0),
  sharingStatus:text('sharing_status').$type<'PENDING_EMAIL'|'PENDING_VALIDATION'|'GRANTED'|'ERROR'>().notNull().default('PENDING_VALIDATION'),
  permissionId:text('permission_id'),sharedWithUserId:uuid('shared_with_user_id').references(()=>users.id,{onDelete:'set null'}),
  sharedWithEmail:text('shared_with_email'),sharedAt:timestamp('shared_at',{withTimezone:true}),
  createdByUserId:uuid('created_by_user_id').references(()=>users.id,{onDelete:'set null'}),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
  readyAt:timestamp('ready_at',{withTimezone:true}),lastVerifiedAt:timestamp('last_verified_at',{withTimezone:true}),
  updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},t=>({statusValid:check('project_drive_workspace_status_valid',sql`${t.status} in ('PROVISIONING','READY','ERROR')`),
  readyValid:check('project_drive_workspace_ready_valid',sql`${t.status}<>'READY' or (${t.rootFolderId} is not null and ${t.rootFolderUrl} is not null and ${t.readyAt} is not null)`),
  integration:index('project_drive_workspace_integration_idx').on(t.integrationId),
}));
export const projectDriveFolders = pgTable('project_drive_folders',{
  id:uuid('id').primaryKey().defaultRandom(),
  workspaceId:uuid('workspace_id').notNull().references(()=>projectDriveWorkspaces.id,{onDelete:'cascade'}),
  key:text('key').notNull(),parentFolderKey:text('parent_folder_key'),
  driveFolderId:text('drive_folder_id').notNull().unique(),driveUrl:text('drive_url'),
  displayName:text('display_name').notNull(),templatePath:text('template_path').notNull(),
  status:text('status').$type<'PLANNED'|'READY'>().notNull().default('PLANNED'),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),verifiedAt:timestamp('verified_at',{withTimezone:true}),
},t=>({folderKey:unique('project_drive_folder_key_unique').on(t.workspaceId,t.key),
  statusValid:check('project_drive_folder_status_valid',sql`${t.status} in ('PLANNED','READY')`),
}));
