import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { proyectos } from './proyectos.js';
import { users } from './users.js';
import { workItems } from './workItems.js';

// Metadata only -- mismo patrón que creative_deliveries.ts (Dirección
// Creativa): nunca se guarda el archivo, solo la referencia. driveUrl es
// la entrada canónica que pega el Editor (abre la carpeta de salida vía
// el folderKey correspondiente, sube ahí con su propia cuenta de Drive,
// pega el enlace acá); driveFileId es mejor-esfuerzo -- GoogleDriveAdapter
// corre bajo scope drive.file (ver server/modules/integrations/google-drive/
// oauth.ts), que NO garantiza visibilidad de archivos añadidos por el
// Editor directamente en Drive, así que nunca se bloquea una entrega real
// solo porque el backend no pudo resolver el id.
//
// Varias filas por work item a propósito: cada "Registrar entrega" es un
// evento nuevo (primera entrega, reentrega tras feedback...), nunca un
// UPDATE que borra la entrega anterior -- es el historial real de qué se
// entregó y cuándo.
export const editorialDeliveries = pgTable('editorial_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),
  workItemId: uuid('work_item_id').notNull().references(() => workItems.id, { onDelete: 'cascade' }),
  driveUrl: text('drive_url').notNull(),
  driveFileId: text('drive_file_id'),
  observaciones: text('observaciones'),
  submittedBy: uuid('submitted_by').notNull().references(() => users.id),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
});
