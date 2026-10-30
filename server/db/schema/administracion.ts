import { index, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.js';
export const adminOperations = pgTable('admin_operations', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').notNull().references(() => users.id, { onDelete:'restrict' }),
  requestKey: uuid('request_key').notNull(), action:text('action').notNull(), inputHash:text('input_hash').notNull(),
  result:jsonb('result').$type<Record<string,unknown>>().notNull(),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>({retry:unique('admin_operations_retry_unique').on(t.actorId,t.requestKey)}));
export const securityEvents = pgTable('security_events', {
  id:uuid('id').primaryKey().defaultRandom(), action:text('action').notNull(),
  actorId:uuid('actor_id').references(()=>users.id,{onDelete:'set null'}),
  targetUserId:uuid('target_user_id').references(()=>users.id,{onDelete:'set null'}),
  sessionPublicId:uuid('session_public_id'), ip:text('ip'), userAgent:text('user_agent'),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>({recent:index('security_events_created_idx').on(t.createdAt.desc()),user:index('security_events_target_created_idx').on(t.targetUserId,t.createdAt.desc())}));
