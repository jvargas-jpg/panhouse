import { check, customType, index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { solicitudesArea } from './operacionEspecialista.js';
import { users } from './users.js';
const binary = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });
// Evidencia pequeña del sistema canónico de solicitudes, independiente de
// los entregables de Drive. Sin URLs públicas ni identificadores de archivos ajenos.
export const solicitudArchivos = pgTable('solicitud_archivos', {
  id: uuid('id').primaryKey().defaultRandom(),
  solicitudId: uuid('solicitud_id').notNull().references(() => solicitudesArea.id, { onDelete: 'cascade' }),
  uploadedById: uuid('uploaded_by_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  name: text('name').notNull(), mimeType: text('mime_type').notNull(), size: integer('size').notNull(),
  content: binary('content').notNull(), sha256: text('sha256').notNull(), uploadKey: uuid('upload_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ request: index('solicitud_archivos_request_idx').on(t.solicitudId, t.createdAt),
  upload: unique('solicitud_archivos_upload_unique').on(t.solicitudId, t.uploadKey),
  size: check('solicitud_archivos_size_check', sql`${t.size}>0 AND ${t.size}<=5242880 AND octet_length(${t.content})=${t.size}`),
}));
