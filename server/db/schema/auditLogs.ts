import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { proyectos } from './proyectos.js';
import { users } from './users.js';

// Historia/forense: "quién hizo qué, sobre qué, cuándo" — NO es event
// sourcing (la DB relacional sigue siendo la fuente del estado actual;
// esto nunca se reproduce para reconstruir el sistema) y NO es la
// fuente de asignaciones formales (eso es project_assignments — ver
// docs/arquitectura/11-fase2-modelo-canonico.md §E/§G). Cada fila es un
// evento puntual e inmutable: nunca se actualiza ni se borra.
//
// entityType/entityId generalizan más allá de "proyecto": una fila de
// project_assignments, de work_items o de pausas también puede ser el
// sujeto de un evento, sin forzar todo a tener proyectoId como único
// ancla (aunque proyectoId sí se duplica cuando aplica, precisamente
// para no tener que hacer JOIN solo para pintar el timeline de un
// proyecto — es la consulta más frecuente).
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    accion: text('accion').notNull(), // ej. 'ESPECIALISTA_ASIGNADO', 'TITULO_APROBADO' — catálogo en código, no enum DB (se amplía sin migración)
    entityType: text('entity_type').notNull(), // ej. 'proyecto', 'project_assignment', 'work_item'
    entityId: uuid('entity_id').notNull(),
    // Duplicado deliberado de proyectoId (ver comentario de arriba) —
    // nullable porque no todo evento de auditoría está ligado a un
    // proyecto (ej. futuros eventos de usuarios/catálogos).
    proyectoId: uuid('proyecto_id').references(() => proyectos.id, { onDelete: 'cascade' }),
    // Diff mínimo (anterior/nuevo), nunca el estado completo del
    // sistema ni secretos (password_hash, tokens) — ver §13/§14 del
    // master prompt de rearquitectura.
    detalles: jsonb('detalles'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    porProyecto: index('audit_logs_proyecto_created_idx').on(table.proyectoId, table.createdAt),
    porEntidad: index('audit_logs_entity_idx').on(table.entityType, table.entityId),
  }),
);
