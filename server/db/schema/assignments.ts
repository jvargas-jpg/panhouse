import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tipoAsignacionEnum } from './enums.js';
import { proyectos } from './proyectos.js';
import { users } from './users.js';
import { workItems } from './workItems.js';

// Historial formal y consultable de asignaciones — responde "quién
// estuvo asignado a qué, durante qué período, quién lo asignó y por
// qué terminó", algo que hoy NO existe (proyectos.especialistaId etc.
// son UPDATE simples sin historial, ver docs/arquitectura/
// 11-fase2-modelo-canonico.md §E). Las columnas FK de `proyectos`
// (especialistaId/editorId/correctorId/disenadorId/jefeAreaId) se
// mantienen intactas como el puntero "actual" — siguen siendo la
// lectura rápida para carga (carga.ts) y ownership
// (verificarAccesoAProyecto), sin JOIN extra en esos hot paths. Esta
// tabla es el historial, no el reemplazo del puntero.
//
// Unicidad por SCOPE, no universal (a pedido explícito): una asignación
// de PROYECTO (workItemId null — especialista/jefe_area/editor/
// disenador, roles exclusivos "uno a la vez" según el modelo actual) es
// única y activa por (proyectoId, tipo). Una asignación de WORK ITEM
// (workItemId no null — corrector/validador/lider_creativo cuando se
// ligan a una tarea puntual, ej. una ronda de calidad) es única y
// activa por (workItemId, tipo) — no bloquea otras tareas del mismo
// tipo en el mismo proyecto. Dos índices únicos parciales (WHERE
// finalizadoEn IS NULL) en vez de un único constraint universal.
export const projectAssignments = pgTable(
  'project_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    proyectoId: uuid('proyecto_id')
      .notNull()
      .references(() => proyectos.id, { onDelete: 'cascade' }),
    // Null = asignación a nivel de proyecto. No null = asignación ligada
    // a una pieza de trabajo puntual (ej. corrector de esta ronda).
    workItemId: uuid('work_item_id').references(() => workItems.id, { onDelete: 'cascade' }),
    tipo: tipoAsignacionEnum('tipo').notNull(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    asignadoPorId: uuid('asignado_por_id').references(() => users.id, { onDelete: 'set null' }),
    asignadoEn: timestamp('asignado_en', { withTimezone: true }).notNull().defaultNow(),
    // Null = asignación activa (es la que responde "quién está asignado
    // ahora"); no null = historial ("quién estuvo antes").
    finalizadoEn: timestamp('finalizado_en', { withTimezone: true }),
    // Texto libre, no enum: "por qué terminó/reasignó" todavía no tiene
    // un catálogo cerrado confirmado por el negocio (mismo criterio que
    // el resto de observaciones de texto libre en este sistema).
    motivoFin: text('motivo_fin'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    activaPorProyecto: uniqueIndex('project_assignments_activa_proyecto_unique')
      .on(table.proyectoId, table.tipo)
      .where(sql`${table.workItemId} IS NULL AND ${table.finalizadoEn} IS NULL`),
    activaPorWorkItem: uniqueIndex('project_assignments_activa_work_item_unique')
      .on(table.workItemId, table.tipo)
      .where(sql`${table.workItemId} IS NOT NULL AND ${table.finalizadoEn} IS NULL`),
    // "Historial de asignaciones de esta persona" — consulta real que
    // pide la Fase 2 (ver §M de 11-fase2-modelo-canonico.md).
    porUsuario: index('project_assignments_usuario_idx').on(table.usuarioId, table.finalizadoEn),
    porProyecto: index('project_assignments_proyecto_idx').on(table.proyectoId),
  }),
);
