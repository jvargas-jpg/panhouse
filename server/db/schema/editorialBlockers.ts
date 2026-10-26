import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { workItems } from './workItems.js';

// Bloqueo EXPLÍCITO reportado por un actor humano (típicamente el Editor),
// con lifecycle propio (reason/createdBy/createdAt/resolvedBy/resolvedAt) --
// distinto de `work_items.gate_bloqueante`, que es un código de gate
// SISTÉMICO de solo lectura (ver server/helpers/gates.ts), nunca algo que
// un humano explique o resuelva. Reportar un bloqueo SÍ escribe en
// gate_bloqueante (motivo legible, mismo campo libre que ya existía) y en
// work_items.estado='bloqueado' -- así 'Bloqueadas' aparece automáticamente
// en editorialChief.ts (Inicio/Asignaciones/Seguimiento/Indicadores) sin
// tocar esa consulta compartida.
//
// Único bloqueo ABIERTO a la vez por work item (índice único parcial):
// reportar uno nuevo mientras el anterior sigue abierto no tiene sentido de
// negocio -- primero se resuelve el que hay.
export const editorialBlockers = pgTable('editorial_blockers', {
  id: uuid('id').primaryKey().defaultRandom(),
  workItemId: uuid('work_item_id').notNull().references(() => workItems.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolution: text('resolution'),
}, t => ({
  unaAbierta: uniqueIndex('editorial_blockers_open_unique').on(t.workItemId).where(sql`${t.resolvedAt} IS NULL`),
}));
