import { pgTable, text, timestamp, uuid, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { correcciones } from './correcciones.js';
import { users } from './users.js';
export const contratosCorreccion = pgTable('contratos_correccion', {
  id: uuid('id').primaryKey().defaultRandom(),
  correccionId: uuid('correccion_id').notNull().references(() => correcciones.id, { onDelete: 'cascade' }),
  ronda: integer('ronda').notNull(),
  correctorNombre: text('corrector_nombre').notNull(),
  requestedById: uuid('requested_by_id').notNull().references(() => users.id),
  estado: text('estado').notNull().default('pendiente'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedById: uuid('resolved_by_id').references(() => users.id),
  motivo: text('motivo'),
}, t => ({ rondaUnica: uniqueIndex('contrato_correccion_ronda_unique').on(t.correccionId,t.ronda), abiertaUnica: uniqueIndex('contrato_correccion_abierto_unique').on(t.correccionId).where(sql`${t.estado} in ('pendiente','en_revision','requiere_informacion')`) }));
export const informacionContrato = pgTable('informacion_contrato', {
  id: uuid('id').primaryKey().defaultRandom(),
  contratoId: uuid('contrato_id').notNull().references(() => contratosCorreccion.id, { onDelete: 'cascade' }),
  pregunta: text('pregunta').notNull(), askedById: uuid('asked_by_id').notNull().references(() => users.id),
  askedAt: timestamp('asked_at', { withTimezone: true }).notNull().defaultNow(),
  respuesta: text('respuesta'), answeredById: uuid('answered_by_id').references(() => users.id),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
}, t => ({ contratoIndex: index('informacion_contrato_idx').on(t.contratoId), abiertaUnica: uniqueIndex('informacion_contrato_abierta_unique').on(t.contratoId).where(sql`${t.answeredAt} is null`) }));
