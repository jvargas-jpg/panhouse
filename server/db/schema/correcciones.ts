import { boolean, date, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { proyectos } from './proyectos.js';
import { users } from './users.js';
import { workItems } from './workItems.js';

// Fase 5 (5B Corrección) — detalle real de UNA intervención de
// corrección, 1:1 con su work_item ('correccion'). Mismo criterio que
// `capitulos` para Edición: el work_item lleva el lifecycle genérico
// (pendiente/en_progreso/completado), esta tabla lleva los campos de
// NEGOCIO específicos de Corrección que ningún work_item genérico
// podría cargar. La sección "Matriz de Corrección" de la ficha de
// trazabilidad (fichasTrazabilidad.correccion*) sigue existiendo tal
// cual, sin tocar — es el resumen macro que ya llenaba el Especialista
// (ver SeccionCorreccion.tsx); esta tabla es el pipeline operativo real
// por intervención, verificado contra "Seguimiento Corrección -
// Innovación Editorial (1).xlsx".
export const correcciones = pgTable('correcciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  proyectoId: uuid('proyecto_id')
    .notNull()
    .references(() => proyectos.id, { onDelete: 'cascade' }),
  workItemId: uuid('work_item_id')
    .notNull()
    .references(() => workItems.id, { onDelete: 'cascade' }),

  // Columna "Asignación /tipo" de la Matriz — el objetivo que se corrige
  // dentro de ESTA intervención. Confirmado contra 17 meses reales de la
  // Matriz: solo 'tripa_completa' | 'preliminares' | 'cubierta_extendida'
  // llevan "Tipo de servicio" = "Corrección " ahí. "TRIPA DIAGRAMADA"
  // también aparece en "Asignación /tipo" pero SIEMPRE con "Tipo de
  // servicio" = "Fase de Calidad"/"Revisión Final" (pipeline de 5E, no
  // de acá) — por eso no está en esta lista. Texto libre, no pgEnum,
  // mismo criterio que workItems.tipo (agregar un alcance nuevo es un
  // cambio de código, ver server/helpers/correcciones.ts).
  alcance: text('alcance').notNull(),

  // Columna "Páginas" — además de informativa, dispara GATE-06 (revisión
  // previa) cuando supera 120 (Manual: "toda tripa que exceda las 120
  // páginas en Word deberá ser revisada previamente antes de su
  // asignación a corrección").
  paginas: integer('paginas'),

  // Snapshot de paginas > 120 al momento de SOLICITAR la corrección —
  // nunca se recalcula si `paginas` cambia después (mismo criterio que
  // el SLA de Crudo-Tripa: no se recalculan señales ya fijadas).
  requiereRevisionPrevia: boolean('requiere_revision_previa').notNull().default(false),
  // El Especialista confirma explícitamente que esa revisión previa ya
  // se hizo — gate manual, no automático: el Manual dice "previa
  // evaluación del proyecto y análisis particular", un costo/decisión
  // que esta ronda NO calcula (no está definido con una fórmula).
  revisionPreviaConfirmada: boolean('revision_previa_confirmada').notNull().default(false),

  // Quién corrige. Dos caminos reales confirmados por la Matriz: un
  // roster corto de analistas INTERNOS (con cuenta de sistema posible,
  // rol 'corrector') y un roster largo de correctores FREELANCE (sin
  // cuenta, columna "Freelance"=true en la Matriz desde Septiembre
  // 2025). correctorId y correctorNombre son mutuamente excluyentes en
  // la práctica (ver server/helpers/correcciones.ts), nunca se valida
  // con un CHECK de base de datos — mismo criterio laxo que el resto de
  // este sistema (ver portadaDecisionAutor).
  correctorId: uuid('corrector_id').references(() => users.id, { onDelete: 'set null' }),
  correctorNombre: text('corrector_nombre'),
  freelance: boolean('freelance'),
  // Hito de Talento Humano (Manual §3.1): "se espera a que talento
  // informe la recepción del contrato firmado". Sin esto en true, la
  // asignación formal no debería considerarse cerrada — lo marca el
  // Especialista (quien recibe el aviso de Talento por el grupo), no se
  // modela Talento Humano como actor del sistema.
  contratoConfirmado: boolean('contrato_confirmado').notNull().default(false),

  fechaAsignada: date('fecha_asignada'),
  // timestamp, no date (checkpoint 5B §0.1): algunos alcances tienen
  // SLA de 12h (medio día), no 1 día completo — un `date` solo puede
  // representar el día, perdiendo esa mitad. Derivado centralmente del
  // SLA por `alcance` al momento de asignar (ver
  // server/helpers/correccionSla.ts) — nunca en el frontend, nunca
  // recalculado después si el SLA de referencia cambia.
  dueAt: timestamp('due_at', { withTimezone: true }),
  fechaInicio: date('fecha_inicio'),
  fechaEntrega: date('fecha_entrega'),

  // PanHouse no es almacenamiento documental — Drive sigue siendo el
  // storage real, acá solo el enlace (mismo criterio que manuscritoUrl,
  // fichaDisenoPropuestas.enlace, pagos.comprobanteUrl).
  controlCambiosUrl: text('control_cambios_url'),
  informeTecnicoUrl: text('informe_tecnico_url'),

  // Columna "Resultados de la corrección" (hoja "Resultados corrección"):
  // 3 valores reales confirmados (Buena/Regular/Deficiente) + null =
  // todavía sin calificar ("A espera" en la fuente). Lo registra el
  // Especialista al cerrar, nunca el propio corrector.
  resultado: text('resultado'),
  observaciones: text('observaciones'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
