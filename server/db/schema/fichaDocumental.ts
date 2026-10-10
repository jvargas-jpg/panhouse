import { jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { proyectos } from './proyectos.js';
// Campos formales originales sin destino en los workflows existentes.
// Catálogo cerrado por área en fichaDocumentalCatalogo; no replica datos canónicos.
export type ValorDocumental = string | number | boolean | null;
export const fichaDocumentalDatos = pgTable('ficha_documental_datos', {
    proyectoId: uuid('proyecto_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),
    seccion: text('seccion').notNull(),
    datos: jsonb('datos').$type<Record<string, ValorDocumental>>().notNull().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, t => ({ pk: primaryKey({ columns: [t.proyectoId, t.seccion] }) }));
