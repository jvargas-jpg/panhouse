import { date, integer, jsonb, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { proyectos } from './proyectos.js';

// Un capítulo es una sola fila en todo el sistema, no una por cada
// consumidor. Hoy solo llena el grupo "cara al autor" la sección
// Edición de la ficha de trazabilidad; el grupo "cara al editor" queda
// listo para cuando exista el seguimiento operativo de edición. Qué
// rol puede leer/escribir cada grupo se resuelve con permisos más
// adelante, no separando la tabla.
export const capitulos = pgTable(
  'capitulos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    proyectoId: uuid('proyecto_id')
      .notNull()
      .references(() => proyectos.id, { onDelete: 'cascade' }),
    numero: integer('numero').notNull(),

    // Cara al autor — sección Edición de la ficha (lo que se construye ahora).
    fechaEnvioAutor: date('fecha_envio_autor'),
    fechaPautadaFeedback: date('fecha_pautada_feedback'),
    fechaRespuestaReal: date('fecha_respuesta_real'),
    enlaces: jsonb('enlaces'), // lista de URLs a los documentos de esa vuelta

    // Cara al editor — columnas listas, sin llenar todavía.
    fechaInicioEditor: date('fecha_inicio_editor'),
    paginas: integer('paginas'),
    fechaEntregaEditor: date('fecha_entrega_editor'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    proyectoNumeroUnico: unique('capitulos_proyecto_numero_unique').on(table.proyectoId, table.numero),
  }),
);
