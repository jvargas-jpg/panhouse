import { boolean, date, integer, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { proyectos } from './proyectos.js';

// Cronograma de extracciones (Escritura Fantasma): sub-paso de Preparación
// Inicial, distinto de la reunión operativa — ver server/helpers/projectGuide.ts.
// Una fila por sesión programada (numero 1, 2, 3...); el Editor NO se guarda
// aquí — se deriva del Editor asignado al proyecto en Edición (un único
// editor por proyecto, no uno distinto por sesión; ver projectGuide.ts).
export const reunionesExtraccion = pgTable('reuniones_extraccion', {
  id: uuid('id').primaryKey().defaultRandom(),
  proyectoId: uuid('proyecto_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),
  numero: integer('numero').notNull(),
  // "fecha" queda sin usar (reemplazada por fecha_hora, que combina fecha y
  // hora); no se elimina la columna para no depender del generador
  // interactivo de drizzle-kit por un cambio de nombre/tipo.
  fecha: date('fecha'),
  fechaHora: timestamp('fecha_hora', { withTimezone: true }),
  duracionMinutos: integer('duracion_minutos'),
  realizada: boolean('realizada').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  proyectoNumeroUnico: unique('reuniones_extraccion_proyecto_numero_unique').on(table.proyectoId, table.numero),
}));
