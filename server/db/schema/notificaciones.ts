import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { proyectos } from './proyectos.js';

// Sistema de notificaciones global — hoy solo lo dispara la creación de
// un proyecto (comercial → alerta a jefe_area, ver crearProyecto en
// server/helpers/proyectos.ts), pero el modelo es genérico a propósito
// (rolDestino, no un destinatario fijo) para poder sumar otros
// disparadores sin otra migración. rolDestino queda como texto libre
// (no rolEnum) tal como se pidió — permite algo como "todos" más
// adelante sin forzar que sea, literalmente, un Rol de usuario.
export const notificaciones = pgTable('notificaciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Opcional: nada obliga a que toda notificación futura esté atada a
  // un proyecto. onDelete cascade porque un proyecto eliminado (ver
  // DELETE /api/proyectos/:id) no debe dejar notificaciones colgando
  // con un enlace roto a "Ver proyecto".
  proyectoId: uuid('proyecto_id').references(() => proyectos.id, { onDelete: 'cascade' }),
  rolDestino: text('rol_destino').notNull(),
  mensaje: text('mensaje').notNull(),
  leido: boolean('leido').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
