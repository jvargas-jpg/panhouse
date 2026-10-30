import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { pagos, proyectos } from '../db/schema/index.js';
import { listarPagos } from '../helpers/pagosProyecto.js';
import { financialDetail, registrarPago, transitionPayment, updateFinancialContract, updateSolvency, validatePaymentReceipt } from '../helpers/pagosOperaciones.js';
import { getProjectFinancialStatus, listFinancialProjects } from '../helpers/estadoFinanciero.js';
import { verificarAccesoFichaViva } from '../helpers/fichaViva.js';
import { diaCaracas } from '../helpers/atencionEspecialista.js';
import { parseOrReply } from '../helpers/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { montoDineroSchema as amount, monedaDineroSchema as currency } from '../helpers/validacionDinero.js';
import { METODOS_PAGO, ROLES_CONFIRMACION_PAGOS, ROLES_LECTURA_PAGOS, ROLES_REGISTRO_PAGOS } from '../../shared/pagos.js';

const reason = z.string().trim().min(1).max(1000);
const day = z.string().date();
const idSchema = z.object({ id: z.string().uuid() });
const paging = z.coerce.number().int().min(1).max(100000).default(1);
const crearPagoSchema = z.object({
  proyectoId: z.string().uuid(), monto: amount, moneda: currency.optional(),
  fechaPago: day.refine(s => s <= diaCaracas(new Date()), 'La fecha del pago no puede ser futura'),
  metodoPago: z.enum(METODOS_PAGO), referencia: z.string().trim().max(160).nullable().optional(),
  comprobanteUrl: z.string().url().max(1500).nullable().optional(), notas: z.string().trim().max(2000).nullable().optional(),
  idempotencyKey: z.string().uuid().optional(), motivoAdministrativo: reason.optional(),
});
const listSchema = z.object({ search: z.string().trim().max(160).optional(), service: z.string().uuid().optional(),
  paymentStatus: z.enum(['Sin monto contractual','Sin pagos','Parcial','Pagado','Sobrepago','Revisar moneda']).optional(),
  dateFrom: day.optional(), dateTo: day.optional(), tab: z.enum(['todos','saldo','pendientes','solventes','bloqueados']).default('todos'),
  page: paging, pageSize: z.coerce.number().int().min(1).max(50).default(8), sort: z.enum(['attention','recent']).default('attention'),
  includeInactive: z.enum(['true','false']).default('false'),
}).refine(v => !v.dateFrom || !v.dateTo || v.dateFrom <= v.dateTo, 'El rango de fechas es inválido');
const verifySchema = z.object({ estatus: z.enum(['Verificado','Rechazado']), motivoRechazo: reason.nullable().optional(), motivoAdministrativo: reason.optional() })
  .refine(v => v.estatus !== 'Rechazado' || !!v.motivoRechazo, 'El rechazo requiere un motivo');

export async function pagosRoutes(app: FastifyInstance) {
  const read = [requireAuth, requireRole(...ROLES_LECTURA_PAGOS)];
  const write = [requireAuth, requireRole(...ROLES_REGISTRO_PAGOS)];
  const confirm = [requireAuth, requireRole(...ROLES_CONFIRMACION_PAGOS)];
  app.post('/', { preHandler: write }, async (req, reply) => {
    const body = parseOrReply(crearPagoSchema, req.body, reply); if (!body) return;
    return reply.code(201).send({ pago: await registrarPago(body, req.user!) });
  });
  // Historial legacy, ahora acotado; el explorador usa /proyectos.
  app.get('/', { preHandler: read }, async (req, reply) => {
    const q = parseOrReply(z.object({ proyectoId: z.string().uuid().optional(), page: paging }), req.query, reply); if (!q) return;
    if (q.proyectoId && !await getProjectFinancialStatus(q.proyectoId)) return reply.code(404).send({ error: 'Proyecto no encontrado' });
    return { pagos: await listarPagos(q.proyectoId, q.page) };
  });
  app.get('/proyectos', { preHandler: read }, async (req, reply) => {
    const result = listSchema.safeParse(req.query);
    if (!result.success) return reply.code(400).send({ error: 'Datos inválidos', detalles: result.error.flatten() });
    const q = result.data;
    return listFinancialProjects({ ...q, includeInactive: q.includeInactive === 'true' });
  });
  app.get('/proyectos/:id', { preHandler: read }, async (req, reply) => {
    const p = parseOrReply(idSchema, req.params, reply); if (!p) return;
    const q = parseOrReply(z.object({ historyPage: paging }), req.query, reply); if (!q) return;
    const detail = await financialDetail(p.id, q.historyPage);
    if (!detail) return reply.code(404).send({ error: 'Proyecto no encontrado' });
    return detail;
  });
  app.patch('/:id/verificar', { preHandler: confirm }, async (req, reply) => {
    const p = parseOrReply(idSchema, req.params, reply); if (!p) return;
    const b = parseOrReply(verifySchema, req.body, reply); if (!b) return;
    const pago = await transitionPayment(p.id, b.estatus, b.motivoRechazo ?? undefined, req.user!, b.motivoAdministrativo);
    return pago ? { pago } : reply.code(404).send({ error: 'Pago no encontrado' });
  });
  app.post('/:id/anular', { preHandler: confirm }, async (req, reply) => {
    const p = parseOrReply(idSchema, req.params, reply); if (!p) return;
    const b = parseOrReply(z.object({ motivo: reason, motivoAdministrativo: reason.optional() }), req.body, reply); if (!b) return;
    const pago = await transitionPayment(p.id, 'Anulado', b.motivo, req.user!, b.motivoAdministrativo);
    return pago ? { pago } : reply.code(404).send({ error: 'Pago no encontrado' });
  });
  app.patch('/proyectos/:id/solvencia', { preHandler: confirm }, async (req, reply) => {
    const p = parseOrReply(idSchema, req.params, reply); if (!p) return;
    const b = parseOrReply(z.object({ estado: z.enum(['Pendiente','Solvente','No solvente']), gateRequired: z.boolean(), motivo: reason, expectedUpdatedAt: z.string().datetime() }), req.body, reply); if (!b) return;
    return updateSolvency(p.id, b, req.user!);
  });
  app.patch('/proyectos/:id/contrato', { preHandler: [requireAuth, requireRole('comercial','direccion','admin')] }, async (req, reply) => {
    const p = parseOrReply(idSchema, req.params, reply); if (!p) return;
    const b = parseOrReply(z.object({ monto: amount, moneda: currency, motivo: reason, expectedUpdatedAt: z.string().datetime() }), req.body, reply); if (!b) return;
    return updateFinancialContract(p.id, b, req.user!);
  });
  app.get('/:id/comprobante', { preHandler: read }, async (req, reply) => {
    const p = parseOrReply(idSchema, req.params, reply); if (!p) return;
    const [pago] = await db.select().from(pagos).where(eq(pagos.id, p.id));
    if (!pago?.comprobanteUrl) return reply.code(404).send({ error: 'Comprobante no encontrado' });
    const url = await validatePaymentReceipt(pago.proyectoId, pago.comprobanteUrl);
    return reply.header('Cache-Control','no-store').redirect(url);
  });
  app.get('/proyectos/:id/estado', { preHandler: [requireAuth] }, async (req, reply) => {
    const p = parseOrReply(idSchema, req.params, reply); if (!p) return;
    // Los lectores financieros tienen alcance de grupo; otros roles conservan el
    // scope de su intervención. Nunca se devuelve el historial o sus montos.
    if (!(ROLES_LECTURA_PAGOS as readonly string[]).includes(req.user!.rol)) await verificarAccesoFichaViva(p.id, req.user!);
    const status = await getProjectFinancialStatus(p.id);
    if (!status) return reply.code(404).send({ error: 'Proyecto no encontrado' });
    return { solvencyStatus: status.solvencyStatus, financialGateStatus: status.financialGateStatus, gateSatisfied: status.gateSatisfied };
  });
}
