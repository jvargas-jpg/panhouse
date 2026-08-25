import { boolean, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { servicios } from './servicios.js';

// Definición de fases: catálogo reutilizable entre servicios. El flujo
// real de cada servicio (qué fases aplican, en qué orden) vive en
// `servicioFases`, nunca hardcodeado en el código de la aplicación.
export const fases = pgTable('fases', {
  id: uuid('id').primaryKey().defaultRandom(),
  codigo: text('codigo').notNull().unique(),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion'),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pasos = pgTable(
  'pasos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    faseId: uuid('fase_id')
      .notNull()
      .references(() => fases.id, { onDelete: 'cascade' }),
    codigo: text('codigo').notNull(),
    nombre: text('nombre').notNull(),
    orden: integer('orden').notNull(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    faseCodigoUnico: unique('pasos_fase_codigo_unique').on(table.faseId, table.codigo),
  }),
);

// Aplicabilidad de fases por servicio. Dos fases del mismo servicio con
// el mismo valor de `orden` corren en paralelo; valores distintos son
// secuenciales (debe completarse el menor antes de iniciar el
// siguiente). Única fuente de verdad del flujo por servicio.
export const servicioFases = pgTable(
  'servicio_fases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    servicioId: uuid('servicio_id')
      .notNull()
      .references(() => servicios.id, { onDelete: 'cascade' }),
    faseId: uuid('fase_id')
      .notNull()
      .references(() => fases.id, { onDelete: 'cascade' }),
    orden: integer('orden').notNull(),
    activo: boolean('activo').notNull().default(true),
  },
  (table) => ({
    servicioFaseUnico: unique('servicio_fases_unique').on(table.servicioId, table.faseId),
  }),
);
