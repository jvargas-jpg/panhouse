import { date, integer, numeric, pgTable, text, time, timestamp, uuid } from 'drizzle-orm/pg-core';
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

  observaciones: text('observaciones'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
