import { boolean, date, pgTable, timestamp, unique, uuid, integer } from 'drizzle-orm/pg-core';
import { proyectos } from './proyectos.js';

// Reuniones de extracción (Escritura Fantasma): sub-paso de Preparación
// Inicial, distinto de la reunión operativa — ver server/helpers/projectGuide.ts.
// Una fila por reunión (numero 1, 2, 3...), registrada por el Especialista.
export const reunionesExtraccion = pgTable('reuniones_extraccion', {
  id: uuid('id').primaryKey().defaultRandom(),
  proyectoId: uuid('proyecto_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),
  numero: integer('numero').notNull(),
  fecha: date('fecha'),
  realizada: boolean('realizada').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  proyectoNumeroUnico: unique('reuniones_extraccion_proyecto_numero_unique').on(table.proyectoId, table.numero),
}));
