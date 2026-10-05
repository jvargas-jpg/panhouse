import { date, numeric, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { estadoWorkItemEnum } from './enums.js';
import { pasos } from './fases.js';
import { proyectos } from './proyectos.js';

// Instancia runtime de una pieza de trabajo para un proyecto — NO una
// definición de workflow (eso vive en fases/pasos/servicio_fases, la
// CONFIGURACIÓN; ver el comentario de `pasoId` más abajo) y NO un
// reemplazo de `proyectos.estado` (macro, salud/condición legal del
// proyecto completo). Un proyecto 'en_proceso' puede tener varios
// work_items abiertos a la vez (edición en_progreso + diseño pendiente
// + lanzamiento bloqueado) — el paralelismo es estructural (filas
// independientes), no un enum plano.
//
// tipo: texto libre a propósito (Fase 5, checkpoint) — NO un pgEnum.
// "El proceso cambia": agregar un tipo de trabajo nuevo (ej. una ronda
// de Dirección Creativa que hoy no existe) debe ser un cambio de
// código (el union type TipoWorkItem en server/helpers/workItems.ts),
// nunca un ALTER TYPE. Mismo criterio que notificaciones.rolDestino o
// fichaCalidadFases.estado en el resto de este sistema.
//
// businessKey + el UNIQUE de abajo: resuelven idempotencia sin una
// restricción universal (proyecto, tipo) que bloquearía instancias
// repetibles (validación ronda 2, segunda corrección, retrabajo de
// cubierta...). Los tipos SINGLETON (intake_rrpp, asignacion_especialista)
// usan el default 'default' — dos intentos de crearlos colisionan en el
// mismo valor y el índice los deduplica. Los tipos REPEATABLE pasan su
// propia clave (ej. 'ronda-2', 'correccion-2') — cada valor distinto es
// una instancia nueva, pero repetir la MISMA clave sigue siendo
// idempotente. Ver server/helpers/workItems.ts (crearWorkItem).
export const workItems = pgTable(
  'work_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    proyectoId: uuid('proyecto_id')
      .notNull()
      .references(() => proyectos.id, { onDelete: 'cascade' }),
    tipo: text('tipo').notNull(),
    businessKey: text('business_key').notNull().default('default'),

    // Workflow DEFINITION → INSTANCE (Fase 5, checkpoint §11): enlace
    // opcional al paso de fases/pasos/servicio_fases que originó esta
    // instancia — nullable porque no todo work item corresponde a un
    // paso formal del catálogo (ej. 'asignacion_especialista' es
    // administrativo, no una etapa editorial). set null, no cascade: si
    // el catálogo se reordena/retira un paso, las instancias históricas
    // sobreviven (ver §13, servicios/pasos retirados no se borran).
    pasoId: uuid('paso_id').references(() => pasos.id, { onDelete: 'set null' }),

    estado: estadoWorkItemEnum('estado').notNull().default('pendiente'),

    // Código del gate que lo condiciona (ver server/helpers/gates.ts) —
    // texto libre a propósito, igual que el resto de este archivo:
    // gates vive en código, no en una tabla, así que esto es solo una
    // referencia legible para UI/debug, nunca una FK.
    gateBloqueante: text('gate_bloqueante'),

    fechaInicioPautada: date('fecha_inicio_pautada'),
    fechaFinPautada: date('fecha_fin_pautada'),
    fechaInicioReal: date('fecha_inicio_real'),
    fechaFinReal: date('fecha_fin_real'),

    // Mismo criterio que seguimiento_fases.totalDias: el negocio no
    // siempre calcula esto como una resta exacta de fechas (excluye
    // fines de semana, pausas, etc.) — se guarda tal cual se registre,
    // no se deriva en el backend.
    totalDias: numeric('total_dias', { precision: 6, scale: 2 }),
    observaciones: text('observaciones'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    instanciaUnica: unique('work_items_proyecto_tipo_business_key_unique').on(table.proyectoId, table.tipo, table.businessKey),
  }),
);
