import { check, index, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { autores } from './autores.js';
import { proyectos } from './proyectos.js';
import { users } from './users.js';
import { workItems } from './workItems.js';
export const authorDocuments = pgTable('author_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => autores.id),
  title: text('title').notNull(), version: text('version').notNull(),
  driveFileId: text('drive_file_id').notNull(), revisionId: text('revision_id').notNull(),
  mimeType: text('mime_type').notNull(), category: text('category').notNull().default('compartido'),
  sharedBy: uuid('shared_by').notNull().references(() => users.id),
  sharedAt: timestamp('shared_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, t => ({ author: index('author_documents_owner_idx').on(t.authorId,t.projectId) }));
export const approvalRequests = pgTable('approval_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => autores.id),
  type: text('type').notNull(), title: text('title').notNull(), instructions: text('instructions').notNull(),
  originId: uuid('origin_id').notNull(), originWorkItemId: uuid('origin_work_item_id').notNull().references(() => workItems.id),
  waitWorkItemId: uuid('wait_work_item_id').notNull().references(() => workItems.id),
  previousId: uuid('previous_id'), requestedBy: uuid('requested_by').notNull().references(() => users.id),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(), dueAt: timestamp('due_at', { withTimezone: true }),
  status: text('status').$type<'pending'|'approved'|'changes_requested'|'cancelled'>().notNull().default('pending'),
  feedback: text('feedback'), decidedAt: timestamp('decided_at', { withTimezone: true }),
  recordedBy: uuid('recorded_by').references(() => users.id),
  externalEvidence: jsonb('external_evidence').$type<{channel:string;receivedAt:string;evidence:string;reason:string}>(),
}, t => ({
  inbox: index('approval_requests_author_idx').on(t.authorId,t.status,t.requestedAt),
  active: uniqueIndex('approval_requests_active_unique').on(t.projectId,t.authorId,t.type,t.originId).where(sql`${t.status}='pending'`),
  state: check('approval_requests_decision_check',sql`(${t.status}='pending' AND ${t.decidedAt} IS NULL AND ${t.recordedBy} IS NULL) OR (${t.status} IN ('approved','changes_requested','cancelled') AND ${t.decidedAt} IS NOT NULL AND ${t.recordedBy} IS NOT NULL AND (${t.status}='approved' OR (${t.feedback} IS NOT NULL AND length(trim(${t.feedback}))>0)))`),
}));
export const approvalArtifacts = pgTable('approval_artifacts', {
  approvalId: uuid('approval_id').notNull().references(() => approvalRequests.id,{onDelete:'cascade'}),
  documentId: uuid('document_id').notNull().references(() => authorDocuments.id),
}, t => ({pk:primaryKey({columns:[t.approvalId,t.documentId]})}));
export const authorCredentialTokens = pgTable('author_credential_tokens', {
  hash: text('hash').primaryKey(), userId: uuid('user_id').notNull().references(() => users.id,{onDelete:'cascade'}),
  purpose: text('purpose').notNull(), expiresAt: timestamp('expires_at',{withTimezone:true}).notNull(),
  consumedAt: timestamp('consumed_at',{withTimezone:true}),
});
export const authorMailOutbox = pgTable('author_mail_outbox', {
  id: uuid('id').primaryKey().defaultRandom(), key: text('key').notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id,{onDelete:'cascade'}),
  projectId: uuid('project_id').references(() => proyectos.id,{onDelete:'cascade'}),
  subject: text('subject').notNull(), message: text('message').notNull(), path: text('path').notNull(),
  sentAt: timestamp('sent_at',{withTimezone:true}), nextAttemptAt: timestamp('next_attempt_at',{withTimezone:true}).notNull().defaultNow(),
  createdAt: timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
});
