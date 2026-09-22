import { boolean, date, integer, numeric, pgTable, text, time, timestamp, uuid } from 'drizzle-orm/pg-core';
import { proyectos } from './proyectos.js';
import { users } from './users.js';

// Matriz de control de tiempos y movimientos de jefatura ("Seguimiento
// Corrección" en el Excel real): una fila por archivo asignado a un
// analista (tripa, preliminares, cubierta, etc.), independiente de las
// nueve secciones de fichas_trazabilidad — jefatura la usa para medir
// rendimiento real, no es parte del proceso editorial en sí. Se
// relaciona directo con `proyectos` (no con la ficha) porque es un
// registro operativo de jefatura, igual que las columnas de asignación
// de proyectos.ts. Ningún campo de contenido es obligatorio: el Excel
// real se llena progresivamente fila por fila, columna por columna.
export const seguimientoFases = pgTable('seguimiento_fases', {
  id: uuid('id').primaryKey().defaultRandom(),
  proyectoId: uuid('proyecto_id')
    .notNull()
    .references(() => proyectos.id, { onDelete: 'cascade' }),

  // Quién hizo el trabajo (el "analista"/corrector de la matriz real).
  // set null, no cascade: si el usuario se desactiva, el registro
  // histórico de tiempos debe sobrevivir.
  analistaId: uuid('analista_id').references(() => users.id, { onDelete: 'set null' }),

  // Texto libre a propósito (igual que fichaDisenoPropuestas.estado en
  // trazabilidad.ts): el conjunto cerrado de tipos de asignación
  // ("TRIPA COMPLETA", "CUBIERTA EXTENDIDA", ...) todavía no está
  // confirmado como catálogo formal.
  asignacionTipo: text('asignacion_tipo'),
  paginas: integer('paginas'),

  fechaAsignada: date('fecha_asignada'),
  horaRecibida: time('hora_recibida'),
  fechaInicio: date('fecha_inicio'),
  horaInicio: time('hora_inicio'),
  fechaEntrega: date('fecha_entrega'),
  horaEntrega: time('hora_entrega'),

  // Texto libre, mismo motivo que asignacionTipo: "Entregado"/"En
  // proceso" son los valores vistos en el Excel real, pero no hay
  // confirmación de que sea una lista cerrada y completa todavía.
  estatus: text('estatus'),

  // El Excel real trae días/horas totales ya calculados por fila (no
  // siempre son la resta exacta de fechaInicio/fechaEntrega — a veces
  // excluyen fines de semana u otras pausas) — se guardan tal cual
  // vienen, no se derivan en el backend.
  totalDias: numeric('total_dias', { precision: 6, scale: 2 }),
  totalHoras: numeric('total_horas', { precision: 6, scale: 2 }),
  // Texto libre a propósito (igual que tiempoCorrecto/cumplimiento más
  // abajo): en el Excel real esta columna llegaba vacía en la mayoría de
  // las filas, sin un conjunto de valores confirmado todavía como para
  // forzar un booleano o un enum.
  tiempoCorrecto: text('tiempo_correcto'),

  observaciones: text('observaciones'),

  // Quién hizo el trabajo de corrección/diagramación en sí (columna
  // "Especialista" del Excel real) — distinto de analistaId (columna
  // "Analista", quien valida/revisa después). Mismo criterio que
  // analistaId: FK a `users` sin filtrar por rol (los nombres reales del
  // Excel — Alejandra Flores, Daniela Marcano, etc. — no calzan con
  // ningún rol formal de ROLES todavía), set null en vez de cascade para
  // que el registro histórico sobreviva si la cuenta se desactiva.
  especialistaId: uuid('especialista_id').references(() => users.id, { onDelete: 'set null' }),
  // Texto libre: las cuatro etapas vistas en el Excel real (Validación/
  // Corrección/Fase de Calidad 1/Revisión Final) tampoco están
  // confirmadas como catálogo cerrado todavía — mismo criterio que
  // asignacionTipo/estatus arriba. "Unidad" del Excel real NO se
  // duplica acá: ya existe en proyectos.unidadId (mismo catálogo
  // `unidades` que el resto de la app), se resuelve por el join con
  // proyectos en listarSeguimiento en vez de repetirla por fila.
  tipoServicio: text('tipo_servicio'),

  // Columnas de pago a freelance (Excel real: "Freelance"/"Pago 80%"/
  // "Pago 20%", las tres booleanas VERDADERO/FALSO) — mismo criterio que
  // ingresoServicioAlianza/matrizContratoFirmado en trazabilidad.ts:
  // booleano real, no texto libre "Sí"/"No" sin filtro confiable.
  freelance: boolean('freelance').notNull().default(false),
  pago80: boolean('pago_80').notNull().default(false),
  pago20: boolean('pago_20').notNull().default(false),
  resultadosCorreccion: text('resultados_correccion'),
  cantidadComentarios: integer('cantidad_comentarios'),
  // Texto libre — ver el comentario de tiempoCorrecto más arriba, mismo
  // motivo: el Excel real llegaba vacío en la mayoría de las filas.
  cumplimiento: text('cumplimiento'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
