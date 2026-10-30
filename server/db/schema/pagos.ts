import { date, index, numeric, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { proyectos } from './proyectos.js';
import { users } from './users.js';

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
    .references(() => proyectos.id, { onDelete: 'restrict' }),
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
  // Comercial registra pagos recibidos como Verificado con actor y fecha.
  // El default conservador sigue disponible para registros históricos o
  // futuras integraciones; los pendientes se revisan desde Comercial.
  estatus: text('estatus').notNull().default('Pendiente de verificación'),
  // Solo tiene sentido cuando estatus = 'Rechazado' — por qué Comercial
  // no pudo confirmar el pago (comprobante ilegible, monto no coincide,
  // etc.), visible para quien lo registró.
  motivoRechazo: text('motivo_rechazo'),
  notas: text('notas'),
  origen: text('origen').notNull().default('INTERNAL_TEMPORARY'),
  externalPaymentId: text('external_payment_id'),
  idempotencyKey: uuid('idempotency_key'),
  requestFingerprint: text('request_fingerprint'),
  registradoPorId: uuid('registrado_por_id').references(() => users.id, { onDelete: 'set null' }),
  confirmadoPorId: uuid('confirmado_por_id').references(() => users.id, { onDelete: 'set null' }),
  confirmadoEn: timestamp('confirmado_en', { withTimezone: true }),
  anuladoPorId: uuid('anulado_por_id').references(() => users.id, { onDelete: 'set null' }),
  anuladoEn: timestamp('anulado_en', { withTimezone: true }),
  motivoAnulacion: text('motivo_anulacion'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, t => ({
  proyectoEstadoFecha: index('pagos_proyecto_estado_fecha_idx').on(t.proyectoId, t.estatus, t.fechaPago),
  idempotencia: unique('pagos_actor_idempotencia_unique').on(t.registradoPorId, t.idempotencyKey),
  externo: unique('pagos_origen_externo_unique').on(t.origen, t.externalPaymentId),
}));
