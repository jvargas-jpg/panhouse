import { boolean, date, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { proyectos } from './proyectos.js';
import { workItems } from './workItems.js';

// Fase 5 (5C Dirección Creativa) — detalle real de UNA intervención
// creativa, 1:1 con su work_item ('direccion_creativa'). Mismo criterio
// que `correcciones`/`capitulos`: el work_item lleva el lifecycle
// genérico, esta tabla lleva los campos de negocio específicos,
// verificados contra "DIRECCIÓN CREATIVA.xlsx" (hoja "GENERAL 25-26")
// y el Manual del Especialista §4.1.
export const direccionesCreativas = pgTable('direcciones_creativas', {
  id: uuid('id').primaryKey().defaultRandom(),
  proyectoId: uuid('proyecto_id')
    .notNull()
    .references(() => proyectos.id, { onDelete: 'cascade' }),
  workItemId: uuid('work_item_id')
    .notNull()
    .references(() => workItems.id, { onDelete: 'cascade' }),

  // 'concepto_portada' (ciclo completo: reunión→brief→conceptos→
  // aprobación, implementado esta ronda) | 'revision_cubierta' (Manual:
  // "Una vez que diseño entregue la cubierta extendida, debe ser
  // enviada al líder creativo para su verificación" — posterior a 5D,
  // el modelo queda listo para esa segunda intervención repetible pero
  // su backend NO se implementa todavía, a propósito — master prompt
  // 5C §18/§38: "no implementes 5D de forma accidental ahora"). Texto
  // libre, no pgEnum — mismo criterio que workItems.tipo.
  tipo: text('tipo').notNull().default('concepto_portada'),

  fechaSolicitud: date('fecha_solicitud'),

  // 4.1 Reunión creativa.
  fechaReunion: date('fecha_reunion'),
  reunionRealizada: boolean('reunion_realizada').notNull().default(false),
  // Manual: "Se transcribe y se graba la reunión. Se envía
  // transcripción al líder creativo." Drive sigue siendo storage —
  // solo el enlace.
  enlaceGrabacion: text('enlace_grabacion'),

  // 4.1.1 Brief creativo — "Lo elabora el líder creativo" (texto
  // completo vive en Drive como documento, la Matriz solo registra
  // FECHAS de envío/aprobación, nunca el contenido — por eso no hay un
  // campo briefTexto: no hay evidencia real de que el sistema deba
  // reconstruir el contenido del brief, solo su enlace y su recorrido).
  briefEnlace: text('brief_enlace'),
  fechaBriefEnviadoEspecialista: date('fecha_brief_enviado_especialista'),
  // El especialista lo envía al autor (Autor sin Portal todavía — el
  // especialista registra en su nombre, master prompt 5C §13).
  fechaBriefEnviadoAutor: date('fecha_brief_enviado_autor'),
  fechaBriefAprobadoAutor: date('fecha_brief_aprobado_autor'),

  // Entregables del líder creativo tras un concepto aprobado (Manual
  // §4.1.2: "Imagen de freepik. Concepto de portada en PDF.") — para
  // que Diseño (5D) los consuma, nunca binarios en Postgres.
  recursoImagenUrl: text('recurso_imagen_url'),
  recursoConceptoPdfUrl: text('recurso_concepto_pdf_url'),

  // Cierre histórico (master prompt 5C §15): no se deriva solo del
  // último estado mutable de las propuestas — queda fijado acá cuándo
  // y con qué resultado se cerró el ciclo completo.
  resultadoFinal: text('resultado_final'),
  fechaCierre: date('fecha_cierre'),
  observaciones: text('observaciones'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
