import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { DIGITAL_REQUEST_STATUSES, DIGITAL_REQUEST_TABS, DIGITAL_REQUEST_TYPES } from '../../shared/soporteDigitalRequests.js';
import { answerDigitalRequest, attachDigitalRequest, cancelDigitalRequest, createDigitalRequest, decideDigitalRequest, detailDigitalRequest, eligibleDigitalRequests, listDigitalRequests, readDigitalRequestFile } from '../helpers/soporteDigitalRequests.js';
const id = z.object({ id: z.string().uuid() }).strict();
const paging = { page: z.coerce.number().int().min(1).max(10000).default(1), pageSize: z.coerce.number().int().refine(n => [10, 25, 50].includes(n)).default(25) };
const filters = z.object({ ...paging, tab: z.enum(DIGITAL_REQUEST_TABS).default('all'), search: z.string().trim().max(200).default(''),
  type: z.enum(DIGITAL_REQUEST_TYPES).optional(), status: z.enum(DIGITAL_REQUEST_STATUSES).optional(), project: z.string().uuid().optional(), from: z.string().date().optional(), to: z.string().date().optional(),
}).strict().refine(f => !f.from || !f.to || f.from <= f.to, 'Revisa el rango de fechas');
const version = z.number().int().positive(), text = z.string().trim().min(5).max(2000);
function read<T extends z.ZodTypeAny>(schema: T, input: unknown, reply: FastifyReply): z.output<T> | null {
  const result = schema.safeParse(input);
  if (!result.success) { reply.code(400).send({ error: 'Datos inválidos', detalles: result.error.flatten() }); return null; }
  return result.data;
}
export async function soporteDigitalRequestsRoutes(app: FastifyInstance) {
  const outgoing = { preHandler: [requireAuth, requireRole('soporte_digital')] }, incoming = { preHandler: [requireAuth, requireRole('especialista')] };
  app.get('/mis-solicitudes', outgoing, async (req, reply) => { const f = read(filters, req.query, reply); if (!f) return; return listDigitalRequests(req.user!.id, f); });
  app.get('/mis-solicitudes/contextos', outgoing, async (req, reply) => {
    const f = read(z.object({ ...paging, search: z.string().trim().max(200).default(''), workItemId: z.string().uuid().optional() }).strict(), req.query, reply);
    if (!f) return; return eligibleDigitalRequests(f.search, f.page, f.pageSize, f.workItemId);
  });
  app.post('/mis-solicitudes', outgoing, async (req, reply) => {
    const b = read(z.object({ workItemId: z.string().uuid(), type: z.enum(DIGITAL_REQUEST_TYPES), subject: z.string().trim().min(5).max(160), description: z.string().trim().min(10).max(4000),
      blocksWorkItem: z.boolean().default(false), idempotencyKey: z.string().uuid() }).strict(), req.body, reply);
    if (!b) return; return createDigitalRequest(req.user!, b);
  });
  app.get('/mis-solicitudes/:id', outgoing, async (req, reply) => {
    const p = read(id, req.params, reply); if (!p) return;
    const d = await detailDigitalRequest(p.id, req.user!.id); if (!d) return reply.code(404).send({ error: 'Solicitud no encontrada' }); return d;
  });
  app.post('/mis-solicitudes/:id/completar', outgoing, async (req, reply) => {
    const p = read(id, req.params, reply), b = read(z.object({ expectedVersion: version, questionId: z.string().uuid(), text }).strict(), req.body, reply);
    if (!p || !b) return; return answerDigitalRequest(req.user!, p.id, b.expectedVersion, b.questionId, b.text);
  });
  app.post('/mis-solicitudes/:id/cancelar', outgoing, async (req, reply) => {
    const p = read(id, req.params, reply), b = read(z.object({ expectedVersion: version, reason: z.string().trim().max(2000).optional() }).strict(), req.body, reply);
    if (!p || !b) return; return cancelDigitalRequest(req.user!, p.id, b.expectedVersion, b.reason);
  });
  app.post('/mis-solicitudes/:id/archivos', { ...outgoing, bodyLimit: 7_100_000 }, async (req, reply) => {
    const p = read(id, req.params, reply), b = read(z.object({ expectedVersion: version, uploadKey: z.string().uuid(), name: z.string().max(180), contentBase64: z.string().max(6990510) }).strict(), req.body, reply);
    if (!p || !b) return; return attachDigitalRequest(req.user!, p.id, b);
  });
  app.get('/solicitudes/:id/archivos/:fileId', { preHandler: [requireAuth, requireRole('soporte_digital', 'especialista')] }, async (req, reply) => {
    const p = read(z.object({ id: z.string().uuid(), fileId: z.string().uuid() }).strict(), req.params, reply); if (!p) return;
    const f = await readDigitalRequestFile(req.user!, p.id, p.fileId);
    return reply.header('Content-Type', f.mimeType).header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`)
      .header('X-Content-Type-Options', 'nosniff').header('Content-Security-Policy', "sandbox; default-src 'none'").header('Cache-Control', 'private, no-store').send(f.content);
  });
  // Servicio del destinatario sobre la MISMA solicitud; no se añade una
  // bandeja recibida a la pantalla saliente ni UI de otros roles.
  app.get('/solicitudes-recibidas', incoming, async (req, reply) => { const f = read(filters, req.query, reply); if (!f) return; return listDigitalRequests(req.user!.id, f, true); });
  app.get('/solicitudes-recibidas/:id', incoming, async (req, reply) => {
    const p = read(id, req.params, reply); if (!p) return;
    const d = await detailDigitalRequest(p.id, req.user!.id, true); if (!d) return reply.code(404).send({ error: 'Solicitud no encontrada' }); return d;
  });
  app.post('/solicitudes-recibidas/:id/decidir', incoming, async (req, reply) => {
    const p = read(id, req.params, reply), b = read(z.object({ expectedVersion: version, action: z.enum(['review', 'return', 'resolve', 'unblock']), text,
      resultWorkItemId: z.string().uuid().optional(), resultAttachmentId: z.string().uuid().optional(), resolveBlocker: z.boolean().optional() }).strict(), req.body, reply);
    if (!p || !b) return; return decideDigitalRequest(req.user!, p.id, b.expectedVersion, b.action, b.text, { resultWorkItemId: b.resultWorkItemId, resultAttachmentId: b.resultAttachmentId, resolveBlocker: b.resolveBlocker });
  });
}
