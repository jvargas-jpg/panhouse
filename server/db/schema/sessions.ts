import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const sessions = pgTable('sesiones', {
  // Hash SHA-256 del token enviado en la cookie httpOnly; nunca se
  // guarda el token en texto plano.
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  publicId: uuid('public_id').notNull().defaultRandom().unique(),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),
  ip: text('ip'),
  userAgent: text('user_agent'),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedById: uuid('revoked_by_id').references(() => users.id, { onDelete: 'set null' }),
  revokeReason: text('revoke_reason'),
  viewAsUserId: uuid('view_as_user_id').references(() => users.id, { onDelete: 'set null' }),
});
