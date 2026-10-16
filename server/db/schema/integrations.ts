import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { sessions } from './sessions.js';

export interface DriveTestResult {
  success: boolean; checkedAt: string; cleanedUp: boolean; rootId: string | null; rootName: string | null;
  childId: string | null; errorCode: string | null; cleanupErrorCode: string | null;
}
export const externalIntegrations = pgTable('external_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: text('provider').notNull().unique(),
  storageContextId: uuid('storage_context_id').notNull().defaultRandom(),
  projectsRootFolderId: text('projects_root_folder_id'),
  projectsRootFolderUrl: text('projects_root_folder_url'),
  projectsRootReady: boolean('projects_root_ready').notNull().default(false),
  workspaceSharingEnabled: boolean('workspace_sharing_enabled').notNull().default(false),
  workspaceSharingTestedAt: timestamp('workspace_sharing_tested_at', { withTimezone:true }),
  status: text('status').$type<'connected' | 'disconnected' | 'error'>().notNull().default('disconnected'),
  encryptedRefreshToken: text('encrypted_refresh_token'),
  accountEmail: text('account_email'),
  accountId: text('account_id'),
  oauthClientId: text('oauth_client_id'),
  scope: text('scope').array().notNull().default(sql`'{}'::text[]`),
  connectedAt: timestamp('connected_at', { withTimezone: true }),
  connectedByUserId: uuid('connected_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  lastValidatedAt: timestamp('last_validated_at', { withTimezone: true }),
  disconnectedAt: timestamp('disconnected_at', { withTimezone: true }),
  lastErrorCode: text('last_error_code'),
  lastTestAt: timestamp('last_test_at', { withTimezone: true }),
  lastTestResult: jsonb('last_test_result').$type<DriveTestResult>(),
  revision: integer('revision').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  providerValid: check('external_integrations_provider_valid', sql`${t.provider}='google_drive'`),
  statusValid: check('external_integrations_status_valid', sql`${t.status} in ('connected','disconnected','error')`),
  usableToken: check('external_integrations_usable_token', sql`${t.status}<>'connected' or ${t.encryptedRefreshToken} is not null`),
}));

export const googleOAuthAttempts = pgTable('google_oauth_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  stateHash: text('state_hash').notNull().unique(),
  sessionHash: text('session_hash').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  encryptedCodeVerifier: text('encrypted_code_verifier').notNull(),
  integrationRevision: integer('integration_revision').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
}, t => ({ byUser: index('google_oauth_attempts_user_created_idx').on(t.userId, t.createdAt) }));
