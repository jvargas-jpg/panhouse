import { date, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { proyectos } from './proyectos.js';

// Módulo financiero de Comercial ("Registrar Pago" en el sidebar): un
// registro por abono recibido, no un estado agregado por proyecto —
// un mismo proyecto puede tener varios pagos (cuotas, abonos
// parciales). Deliberadamente separado de proyectos.pagoCuota1..6
// (booleanos sin ruta propia que los actualice, ver comentario en
// proyectos.ts): esos son un checklist de seis cuotas fijas, esto es un
// historial de transacciones reales con monto, método y comprobante.
export const pagos = pgTable('pagos', {
  id: uuid('id').primaryKey().defaultRandom(),
  proyectoId: uuid('proyecto_id')
    .notNull()
    .references(() => proyectos.id, { onDelete: 'cascade' }),
  monto: numeric('monto', { precision: 12, scale: 2 }).notNull(),
  moneda: text('moneda').notNull().default('USD'),
  fechaPago: date('fecha_pago').notNull(),
  metodoPago: text('metodo_pago').notNull(),
  referencia: text('referencia'),
  // URL, no archivo: el resto del sistema nunca sube binarios (mismo
  // patrón que fichaDisenoPropuestas.enlace / fichaCalidadFases.pdfUrl)
  // — no existe infraestructura de almacenamiento de archivos, así que
  // el comprobante es un enlace externo, no un upload real.
  comprobanteUrl: text('comprobante_url'),
  // Controlado por el servidor, no por quien registra el pago: nace
  // 'Pendiente de verificación' y solo cambia vía PATCH /:id/verificar
  // (cobranzas/jefe_area/dirección, ver pagos.routes.ts).
  estatus: text('estatus').notNull().default('Pendiente de verificación'),
  // Solo tiene sentido cuando estatus = 'Rechazado' — por qué cobranzas
  // no pudo confirmar el pago (comprobante ilegible, monto no coincide,
  // etc.), visible para quien lo registró.
  motivoRechazo: text('motivo_rechazo'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
