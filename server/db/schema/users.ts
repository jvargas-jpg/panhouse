import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { autores } from './autores.js';
import { rolEnum } from './enums.js';

export const users = pgTable('usuarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  nombre: text('nombre').notNull(),
  rol: rolEnum('rol').notNull(),
  activo: boolean('activo').notNull().default(true),
  // Vínculo entre la cuenta de login (rol 'autor') y la entidad autores
  // que gestiona Comercial — hasta ahora eran dos tablas sin relación:
  // autores.email lo usaba solo el SSO del portal de pago (ver
  // server/helpers/pagos.ts, un JWT sin sesión real), nunca hizo falta
  // un login de verdad. El Portal del Autor sí lo necesita: sin esto no
  // hay forma de resolver "los libros de quién" a partir de una sesión.
  // Solo tiene sentido cuando rol = 'autor'; nadie más lo usa.
  autorId: uuid('autor_id').references(() => autores.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
