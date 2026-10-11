import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { correcciones } from './correcciones.js';
import { fichaCalidadFases } from './trazabilidad.js';
import { proyectos } from './proyectos.js';
import { users } from './users.js';
import { workItems } from './workItems.js';

// Jefatura · Decisiones (docs/arquitectura/17-jefatura-decisiones.md) —
// Casos humanos ligados a un gate real o a una escalación contextual.
// Corrección queda bloqueada; la escalación de Calidad no agrega un gate.
// Esto NO es `notificaciones`
// (informa, no exige resolución) ni `audit_logs` (historia, no cola
// pendiente) — tiene lifecycle propio (ver `status`/`resolutionType`
// abajo).
//
// Un solo origin por fila, nunca genérico `entityType/entityId`: solo
// existen dos orígenes respaldados por los workflows existentes —
//   1. `originCorreccionId`: GATE-06 (revisión previa >120 páginas),
//      el Especialista ya NO autoconfirma `correcciones.revisionPreviaConfirmada`
//      (ver server/helpers/correcciones.ts) — esa columna ahora SOLO la
//      escribe la resolución de una decisión de este tipo.
//   2. `originCalidadFaseId`: colección inconsistente, escalada por
//      Soporte Editorial al declarar explícitamente una discrepancia en F1/F3.
// Un tercer caso del prompt original ("consulta a Jefatura para
// corrección de portada") NO se implementa: el código ya confirmado de
// 5B Corrección (asignarCorrector, con comentario explícito "lo decide
// el propio Especialista... confirmado contra el Manual") contradice
// esa premisa, y fuentes-negocio/ no está disponible en este checkout
// para re-verificarla — documentado como PENDIENTE_VALIDACION_DOCUMENTAL
// en vez de productivizarlo sin respaldo (ver doc de arquitectura).
//
// Exactamente un origen según el tipo. UNIQUE y CHECK se aplican en DB;
// las escrituras autorizadas validan además ámbito, versión y lifecycle.
export const decisiones = pgTable(
  'decisiones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    proyectoId: uuid('proyecto_id')
      .notNull()
      .references(() => proyectos.id, { onDelete: 'cascade' }),

    // Texto libre, no pgEnum — mismo criterio que workItems.tipo: agregar
    // un tipo de decisión nuevo es un cambio de código (union type en
    // server/helpers/decisiones.ts), nunca un ALTER TYPE.
    tipo: text('tipo').notNull(),

    originWorkItemId: uuid('origin_work_item_id').references(
      () => workItems.id,
      { onDelete: 'cascade' },
    ),
    originCorreccionId: uuid('origin_correccion_id')
      .references(() => correcciones.id, { onDelete: 'cascade' })
      .unique(),
    originCalidadFaseId: uuid('origin_calidad_fase_id')
      .references(() => fichaCalidadFases.id, { onDelete: 'cascade' })
      .unique(),

    // Siempre 'jefe_area' hoy (único target real confirmado) — texto, no
    // hardcode de rol en cada query, para no tener que tocar esta tabla
    // si algún día Jefatura delega un tipo a otro rol.
    targetRole: text('target_role').notNull().default('jefe_area'),

    requestedByUserId: uuid('requested_by_user_id')
      .notNull()
      .references(() => users.id),
    // Quién está activamente revisando (opcional) — distinto de "quién
    // puede resolver" (eso es RBAC por targetRole, ver server/helpers/decisiones.ts).
    assignedDecisionMakerId: uuid('assigned_decision_maker_id').references(
      () => users.id,
    ),

    // pendiente -> en_revision -> resuelta, con el subflujo
    // en_revision -> informacion_solicitada -> (pendiente|en_revision) -> resuelta.
    // Lifecycle SIMPLE a propósito (prompt §16): NUNCA "Aprobada"/"Rechazada"
    // como status técnico — eso vive en `resolutionType`, separado del lifecycle.
    status: text('status').notNull().default('pendiente'),
    resolutionType: text('resolution_type'), // approved | rejected | cancelled — null hasta 'resuelta'.

    subject: text('subject').notNull(), // Título humano: "Revisión previa de Corrección".
    requestMessage: text('request_message'), // Motivo/mensaje de quien originó la escalación.
    resolutionMessage: text('resolution_message'), // Justificación de Jefatura al resolver.

    requestedInfoMessage: text('requested_info_message'),
    requestedInfoAt: timestamp('requested_info_at', { withTimezone: true }),
    requestedInfoById: uuid('requested_info_by_id').references(() => users.id),
    respondedInfoMessage: text('responded_info_message'),
    respondedInfoAt: timestamp('responded_info_at', { withTimezone: true }),

    // Snapshot MÍNIMO (prompt §14) — SOLO la condición que originó el
    // caso, documentada acá y en el doc de arquitectura. NUNCA un
    // snapshot completo del proyecto (eso se consulta por join).
    // >120: { paginas: number }. Colección: { coleccionRegistrada: string | null, motivo: string }.
    contextSnapshot: jsonb('context_snapshot').$type<Record<string, unknown>>(),

    requestedAt: timestamp('requested_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewStartedAt: timestamp('review_started_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id),

    // Concurrencia optimista (prompt §73): dos Jefatura abren el mismo
    // caso, uno aprueba, el segundo intenta rechazar con una versión
    // vieja -> 409, mismo patrón ya usado en seguimiento_fases.
    version: integer('version').notNull().default(1),

    // Permite reabrir sin mutar historia (prompt §21/55): si llegara a
    // hacer falta, se marca acá en vez de sobrescribir resolutionType.
    reabiertaDesdeId: uuid('reabierta_desde_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    origen: check(
      'decisiones_origen_tipo_check',
      sql`(${t.tipo}='revision_previa_correccion' AND ${t.originCorreccionId} IS NOT NULL AND ${t.originCalidadFaseId} IS NULL) OR (${t.tipo}='coleccion_inconsistente' AND ${t.originCalidadFaseId} IS NOT NULL AND ${t.originCorreccionId} IS NULL)`,
    ),
    estado: check(
      'decisiones_estado_check',
      sql`${t.status} IN ('pendiente','en_revision','informacion_solicitada','resuelta')`,
    ),
    versionPositiva: check('decisiones_version_check', sql`${t.version} > 0`),
    resolucion: check(
      'decisiones_resolucion_check',
      sql`(${t.status}='resuelta' AND ${t.resolutionType} IN ('approved','rejected','cancelled') AND ${t.resolvedAt} IS NOT NULL AND ${t.resolvedByUserId} IS NOT NULL) OR (${t.status}<>'resuelta' AND ${t.resolutionType} IS NULL AND ${t.resolvedAt} IS NULL AND ${t.resolvedByUserId} IS NULL)`,
    ),
    bandeja: index('decisiones_bandeja_idx').on(
      t.targetRole,
      t.status,
      t.requestedAt,
      t.id,
    ),
    proyecto: index('decisiones_proyecto_idx').on(t.proyectoId, t.status),
    workItem: index('decisiones_work_item_idx').on(
      t.originWorkItemId,
      t.status,
    ),
  }),
);

// Verdad de que "atenderla" no duplica el gate — deja de notificarse
// como pendiente apenas Jefatura empieza a mirarla, sin perder su lugar
// en la bandeja (sigue siendo pendiente/en_revision para el filtro).
export const DECISION_STATUSES = [
  'pendiente',
  'en_revision',
  'informacion_solicitada',
  'resuelta',
] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const DECISION_RESOLUTIONS = [
  'approved',
  'rejected',
  'cancelled',
] as const;
export type DecisionResolution = (typeof DECISION_RESOLUTIONS)[number];
