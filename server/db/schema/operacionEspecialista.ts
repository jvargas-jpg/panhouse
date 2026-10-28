import { boolean, check, index, integer, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { proyectos } from './proyectos.js';
import { users } from './users.js';
import { workItems } from './workItems.js';

// Preparación posterior a la asignación. Las fechas de RRPP no se reutilizan.
export const preparacionesProyecto = pgTable('preparaciones_proyecto', {
  proyectoId: uuid('proyecto_id').primaryKey().references(() => proyectos.id, { onDelete: 'cascade' }),
  recibidoEn: timestamp('recibido_en', { withTimezone: true }),
  expedienteRevisadoEn: timestamp('expediente_revisado_en', { withTimezone: true }),
  primerContactoEn: timestamp('primer_contacto_en', { withTimezone: true }),
  reunionOperativaFecha: timestamp('reunion_operativa_fecha', { withTimezone: true }),
  reunionOperativaRealizada: boolean('reunion_operativa_realizada').notNull().default(false),
  grabacionUrl: text('grabacion_url'),
  transcripcionUrl: text('transcripcion_url'),
  minutaUrl: text('minuta_url'),
  cronogramaUrl: text('cronograma_url'),
  driveCarpetaUrl: text('drive_carpeta_url'),
  observaciones: text('observaciones'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Handoff, independiente del estado posterior del proceso. Solo comandos de dominio crean filas.
export const solicitudesArea = pgTable('solicitudes_area', {
  id: uuid('id').primaryKey().defaultRandom(),
  proyectoId: uuid('proyecto_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),
  // Creative intake converts on acceptance. Earlier area handoffs retain their required work item.
  workItemId: uuid('work_item_id').references(() => workItems.id, { onDelete: 'cascade' }),
  // 'editor': el Especialista solicita que Jefatura de Edición asigne un
  // Editor (semántica preexistente, intocada). 'editor_apoyo'/
  // 'editor_reasignacion'/'editor_aclaracion': el PROPIO Editor solicita
  // algo sobre un work item ya asignado -- nunca el mismo tipo 'editor',
  // que significaría otra cosa (ver docs/arquitectura/30-editor.md).
  // 'corrector_material'/'corrector_aclaracion'/'corrector_tecnico': el
  // PROPIO Corrector reporta algo sobre una corrección ya asignada --
  // mismo patrón que editor_*, siempre dirigido al Especialista
  // coordinador (ver docs/arquitectura/35-corrector-mis-solicitudes.md).
  // calidad_*: el Validador reporta una necesidad sobre una ronda real;
  // se conserva workItemId y de allí su identidad única en Calidad.
  tipo: text('tipo').$type<'lanzamiento' | 'impresion' | 'creativa' | 'editor' | 'editor_apoyo' | 'editor_reasignacion' | 'editor_aclaracion' | 'corrector_material' | 'corrector_aclaracion' | 'corrector_tecnico' | 'calidad_material' | 'calidad_aclaracion' | 'calidad_tecnico'>().notNull(),
  businessKey: text('business_key').notNull(),
  // Null only for imported creative history whose originating actor was never recorded.
  requestedById: uuid('requested_by_id').references(() => users.id, { onDelete: 'restrict' }),
  targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'restrict' }),
  descripcion: text('descripcion'),
  asunto: text('asunto'),
  estado: text('estado').$type<'pendiente' | 'en_revision' | 'requiere_informacion' | 'resuelta' | 'rechazada' | 'cancelada'>().notNull().default('pendiente'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedById: uuid('resolved_by_id').references(() => users.id, { onDelete: 'set null' }),
  outcome: text('outcome'),
  motivo: text('motivo'),
  version: integer('version').notNull().default(1),
}, t => ({ instancia: unique('solicitudes_area_instancia_unique').on(t.proyectoId, t.tipo, t.businessKey), bandeja: index('solicitudes_area_estado_idx').on(t.estado, t.tipo),
  calidadAbierta: uniqueIndex('solicitudes_calidad_abierta_unique').on(t.requestedById, t.workItemId, t.tipo)
    .where(sql`${t.tipo} IN ('calidad_material','calidad_aclaracion','calidad_tecnico') AND ${t.estado} IN ('pendiente','en_revision','requiere_informacion')`),
  calidadEnvio: uniqueIndex('solicitudes_calidad_envio_unique').on(t.requestedById, t.businessKey)
    .where(sql`${t.tipo} IN ('calidad_material','calidad_aclaracion','calidad_tecnico')`),
  calidadRequester: index('solicitudes_calidad_requester_idx').on(t.requestedById, t.requestedAt.desc())
    .where(sql`${t.tipo} IN ('calidad_material','calidad_aclaracion','calidad_tecnico')`),
  conversion: check('solicitudes_area_conversion_valid',sql`(${t.tipo}='creativa' or (${t.workItemId} is not null and ${t.requestedById} is not null)) and (${t.tipo}<>'creativa' or ${t.estado}<>'resuelta' or ${t.workItemId} is not null)`),
}));

export const informacionSolicitudArea = pgTable('informacion_solicitud_area', {
  id: uuid('id').primaryKey().defaultRandom(),
  solicitudId: uuid('solicitud_id').notNull().references(() => solicitudesArea.id, { onDelete: 'cascade' }),
  pregunta: text('pregunta').notNull(),
  askedById: uuid('asked_by_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  askedAt: timestamp('asked_at', { withTimezone: true }).notNull().defaultNow(),
  respuesta: text('respuesta'),
  answeredById: uuid('answered_by_id').references(() => users.id, { onDelete: 'set null' }),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
}, t => ({ solicitud: index('informacion_solicitud_area_idx').on(t.solicitudId, t.askedAt) }));
