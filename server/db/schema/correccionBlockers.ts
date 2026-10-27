import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { workItems } from './workItems.js';

// Mismo patrón que editorial_blockers (server/db/schema/editorialBlockers.ts):
// bloqueo EXPLÍCITO reportado por el corrector ("Reportar problema", master
// prompt Mi trabajo §55-57), distinto del gate_bloqueante sistémico. Marca
// work_items.estado='bloqueado' + gate_bloqueante=reason, así que aparece
// donde ya se deriva ese estado sin tocar ninguna consulta compartida. Único
// bloqueo abierto a la vez por work item. Resolverlo pertenece a Seguimiento/
// Especialista (fuera del alcance de "Mi trabajo" — ver docs/auditoria).
export const correccionBlockers = pgTable('correccion_blockers', {
  id: uuid('id').primaryKey().defaultRandom(),
  workItemId: uuid('work_item_id').notNull().references(() => workItems.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolution: text('resolution'),
}, t => ({
  unaAbierta: uniqueIndex('correccion_blockers_open_unique').on(t.workItemId).where(sql`${t.resolvedAt} IS NULL`),
}));
