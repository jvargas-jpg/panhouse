import { boolean, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { proyectos } from './proyectos.js';
import { users } from './users.js';
import { workItems } from './workItems.js';
import { direccionesCreativas } from './direccionCreativa.js';
import { correcciones } from './correcciones.js';
import { fichaCalidadFases } from './trazabilidad.js';

// Manual §4.2: instancias de ejecución distintas de los conceptos de 5C.
// Brief/concepto/recursos se leen por FK canónica; no se copian.
export const disenos = pgTable('disenos', {
  id: uuid('id').primaryKey().defaultRandom(),
  proyectoId: uuid('proyecto_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),
  workItemId: uuid('work_item_id').notNull().unique().references(() => workItems.id, { onDelete: 'cascade' }),
  direccionCreativaId: uuid('direccion_creativa_id').notNull().references(() => direccionesCreativas.id),
  tipo: text('tipo').notNull(),
  solicitudKey: uuid('solicitud_key').notNull(),
  fuenteUrl: text('fuente_url').notNull(), // Tripa preparada / complementos, no copia del brief.
  correccionId: uuid('correccion_id').references(() => correcciones.id),
  aprobacionEdicionUrl: text('aprobacion_edicion_url'), // Evidencia de aprobación por correo (Manual §4.2.2).
  preparacionConfirmada: boolean('preparacion_confirmada').notNull().default(false),
  capitulosMuestra: integer('capitulos_muestra'),
  diasReferencia: integer('dias_referencia'), // Calendario no definido: nunca se transforma en dueAt implícitamente.
  solicitadoEn: timestamp('solicitado_en', { withTimezone: true }).notNull().defaultNow(),
  dueAt: timestamp('due_at', { withTimezone: true }),
  cerradoEn: timestamp('cerrado_en', { withTimezone: true }),
}, (t) => ({ solicitudUnica: unique('disenos_proyecto_solicitud_unique').on(t.proyectoId, t.solicitudKey) }));

// Versiones de EJECUCIÓN. ficha_diseno_propuestas sigue representando conceptos.
// Entrega inmutable; feedback y revisiones están ligados a ESTA versión.
export const disenoVersiones = pgTable('diseno_versiones', {
  id: uuid('id').primaryKey().defaultRandom(),
  disenoId: uuid('diseno_id').notNull().references(() => disenos.id, { onDelete: 'cascade' }),
  numero: integer('numero').notNull(),
  entregaKey: uuid('entrega_key').notNull(),
  enlace: text('enlace').notNull(),
  entregadoPorId: uuid('entregado_por_id').notNull().references(() => users.id),
  entregadoEn: timestamp('entregado_en', { withTimezone: true }).notNull().defaultNow(),
  feedback: text('feedback'),
  feedbackEn: timestamp('feedback_en', { withTimezone: true }),
  cantidadComentarios: integer('cantidad_comentarios'),
  enviadaAutorEn: timestamp('enviada_autor_en', { withTimezone: true }),
  feedbackAutorDueAt: timestamp('feedback_autor_due_at', { withTimezone: true }),
  aprobadaAutorEn: timestamp('aprobada_autor_en', { withTimezone: true }),
  revisionCreativaId: uuid('revision_creativa_id').references(() => direccionesCreativas.id),
  revisionInternaWorkItemId: uuid('revision_interna_work_item_id').references(() => workItems.id),
  aprobadaInternaEn: timestamp('aprobada_interna_en', { withTimezone: true }),
  handoffEn: timestamp('handoff_en', { withTimezone: true }),
  calidadWorkItemId: uuid('calidad_work_item_id').references(() => workItems.id),
  calidadFaseId: uuid('calidad_fase_id').references(() => fichaCalidadFases.id),
}, (t) => ({ numeroUnico: unique('diseno_versiones_numero_unique').on(t.disenoId, t.numero), entregaUnica: unique('diseno_versiones_entrega_unique').on(t.disenoId, t.entregaKey) }));
