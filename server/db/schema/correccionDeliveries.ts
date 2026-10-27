import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { proyectos } from './proyectos.js';
import { users } from './users.js';
import { workItems } from './workItems.js';

// Historial real de entregas de Corrección — a diferencia de
// correcciones.controlCambiosUrl/informeTecnicoUrl (un único par de
// campos, sobreescrito en cada entrega), esta tabla conserva cada
// versión entregada (master prompt Mi trabajo §45/§64 "no fecha sola",
// "versiones"). correcciones.*Url sigue reflejando la ÚLTIMA entrega
// (compatibilidad con Seguimiento/Ficha viva, que ya leen esas
// columnas), pero el detalle de "qué entregué y cuándo" lee de acá.
// Mismo criterio que editorial_deliveries, con dos archivos obligatorios
// en vez de uno porque el proceso real de Corrección siempre produce
// ambos (tripa con control de cambios + informe técnico).
export const correccionDeliveries = pgTable('correccion_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),
  workItemId: uuid('work_item_id').notNull().references(() => workItems.id, { onDelete: 'cascade' }),
  tripaDriveUrl: text('tripa_drive_url').notNull(),
  tripaDriveFileId: text('tripa_drive_file_id'),
  reportDriveUrl: text('report_drive_url').notNull(),
  reportDriveFileId: text('report_drive_file_id'),
  observaciones: text('observaciones'),
  submittedBy: uuid('submitted_by').notNull().references(() => users.id),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
});
