import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { fichaCalidadFases } from './trazabilidad.js';
import { disenoVersiones } from './diseno.js';
// Transactional external notification outbox. Workflow remains in canonical rounds.
export const validationDeliveryOutbox = pgTable('validation_delivery_outbox', {
 id: uuid('id').primaryKey().defaultRandom(),
 phaseId: uuid('phase_id').unique().references(() => fichaCalidadFases.id, { onDelete: 'cascade' }),
 versionId: uuid('version_id').unique().references(() => disenoVersiones.id, { onDelete: 'cascade' }),
 recipient: text('recipient').notNull(), subject: text('subject').notNull(), message: text('message').notNull(),
 sentAt: timestamp('sent_at', { withTimezone: true }), attempts: integer('attempts').notNull().default(0),
 nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
 createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
