import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { proyectos } from './proyectos.js';
import { users } from './users.js';

// Sistema de notificaciones global — hoy solo lo dispara la creación de
// un proyecto (comercial → alerta a jefe_area, ver crearProyecto en
// server/helpers/proyectos.ts), pero el modelo es genérico a propósito
// (rolDestino, no un destinatario fijo) para poder sumar otros
// disparadores sin otra migración. rolDestino queda como texto libre
// (no rolEnum) tal como se pidió — permite algo como "todos" más
// adelante sin forzar que sea, literalmente, un Rol de usuario.
//
// usuarioDestinoId (Fase 4, Foundation): nullable a propósito — null
// sigue siendo un broadcast a todo `rolDestino` (ej. "nuevo proyecto
// para rrpp", cualquiera de ellos lo puede tomar). No-null acota la
// notificación a UNA persona dentro de ese rol (ej. "se te asignó el
// proyecto X" al especialista específico, no a los otros 5) — sin esto,
// asignar un especialista notificaría por error a todo el equipo.
export const notificaciones = pgTable(
  'notificaciones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Opcional: nada obliga a que toda notificación futura esté atada a
    // un proyecto. onDelete cascade porque un proyecto eliminado (ver
    // DELETE /api/proyectos/:id) no debe dejar notificaciones colgando
    // con un enlace roto a "Ver proyecto".
    proyectoId: uuid('proyecto_id').references(() => proyectos.id, { onDelete: 'cascade' }),
    rolDestino: text('rol_destino').notNull(),
    usuarioDestinoId: uuid('usuario_destino_id').references(() => users.id, { onDelete: 'cascade' }),
    mensaje: text('mensaje').notNull(),
    leido: boolean('leido').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    porDestino: index('notificaciones_rol_usuario_idx').on(table.rolDestino, table.usuarioDestinoId),
  }),
);
