import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { QUALITY_REQUEST_STATUSES, QUALITY_REQUEST_TYPES } from '../../shared/soporteEditorialRequests.js';
import { answerQualityRequest, cancelQualityRequest, createQualityRequest, decideQualityRequest, detailQualityRequest, eligibleQualityRequests, incomingQualityRequests, listQualityRequests } from '../helpers/soporteEditorialRequests.js';

const id = z.object({ id: z.string().uuid() }).strict();
const paging = { page: z.coerce.number().int().min(1).max(10000).default(1), pageSize: z.coerce.number().int().refine(n => [10, 25, 50].includes(n)).default(25) };
const filters = z.object({ ...paging, tab: z.enum(['all', 'pending', 'returned', 'resolved', 'cancelled']).default('all'), search: z.string().trim().max(200).default(''),
  status: z.enum(QUALITY_REQUEST_STATUSES).optional(), type: z.enum(QUALITY_REQUEST_TYPES).optional(), project: z.string().uuid().optional(), from: z.string().date().optional(), to: z.string().date().optional(),
}).strict().refine(f => !f.from || !f.to || f.from <= f.to, 'Revisa el rango de fechas');
const version = z.number().int().positive();
const text = z.string().trim().min(5).max(2000);
function read<T extends z.ZodTypeAny>(schema: T, value: unknown, reply: FastifyReply): z.output<T> | null {
  const r = schema.safeParse(value);
  if (!r.success) { reply.code(400).send({ error: 'Datos inválidos', detalles: r.error.flatten() }); return null; }
  return r.data;
}
export async function soporteEditorialRequestsRoutes(app: FastifyInstance) {
  const validator = { preHandler: [requireAuth, requireRole('soporte_editorial')] };
  const specialist = { preHandler: [requireAuth, requireRole('especialista')] };
  app.get('/mis-solicitudes', validator, async (req, reply) => {
    const f = read(filters, req.query, reply); if (!f) return;
    return listQualityRequests(req.user!.id, f);
  });
  app.get('/mis-solicitudes/contextos', validator, async (req, reply) => {
    const f = read(z.object({ ...paging, search: z.string().trim().max(200).default(''), workItemId: z.string().uuid().optional() }).strict(), req.query, reply); if (!f) return;
    return eligibleQualityRequests(f.search, f.page, f.pageSize, f.workItemId);
  });
  app.post('/mis-solicitudes', validator, async (req, reply) => {
    const b = read(z.object({ workItemId: z.string().uuid(), type: z.enum(QUALITY_REQUEST_TYPES), subject: z.string().trim().min(5).max(160), description: z.string().trim().min(10).max(4000), idempotencyKey: z.string().uuid() }).strict(), req.body, reply);
    if (!b) return;
    return createQualityRequest(req.user!, b);
  });
  app.get('/mis-solicitudes/:id', validator, async (req, reply) => {
    const p = read(id, req.params, reply); if (!p) return;
    const detail = await detailQualityRequest(p.id, req.user!.id);
    if (!detail) return reply.code(404).send({ error: 'Solicitud no encontrada' });
    return detail;
  });
  app.post('/mis-solicitudes/:id/responder', validator, async (req, reply) => {
    const p = read(id, req.params, reply), b = read(z.object({ expectedVersion: version, questionId: z.string().uuid(), text }).strict(), req.body, reply);
    if (!p || !b) return;
    return answerQualityRequest(req.user!, p.id, b.expectedVersion, b.questionId, b.text);
  });
  app.post('/mis-solicitudes/:id/cancelar', validator, async (req, reply) => {
    const p = read(id, req.params, reply), b = read(z.object({ expectedVersion: version, reason: z.string().trim().max(2000).optional() }).strict(), req.body, reply);
    if (!p || !b) return;
    return cancelQualityRequest(req.user!, p.id, b.expectedVersion, b.reason);
  });
  // El receptor usa la misma entidad y comandos; no es una segunda
  // bandeja ni un permiso del Validador para resolver solicitudes.
  app.get('/solicitudes-recibidas', specialist, async (req, reply) => {
    const f = read(z.object(paging).strict(), req.query, reply); if (!f) return;
    return incomingQualityRequests(req.user!.id, f.page, f.pageSize);
  });
  app.get('/solicitudes-recibidas/:id', specialist, async (req, reply) => {
    const p = read(id, req.params, reply); if (!p) return;
    const detail = await detailQualityRequest(p.id, req.user!.id, true);
    if (!detail) return reply.code(404).send({ error: 'Solicitud no encontrada' });
    return detail;
  });
  app.post('/solicitudes-recibidas/:id/decidir', specialist, async (req, reply) => {
    const p = read(id, req.params, reply), b = read(z.object({ expectedVersion: version, action: z.enum(['review', 'return', 'resolve']), text, resultQualityPhaseId: z.string().uuid().optional() }).strict(), req.body, reply);
    if (!p || !b) return;
    return decideQualityRequest(req.user!, p.id, b.expectedVersion, b.action, b.text, b.resultQualityPhaseId);
  });
}
