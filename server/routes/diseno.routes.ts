import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ErrorDiseno, asignarDiseno, coordinarVersion, entregarDiseno, listarDisenos, revisarCubierta, solicitarDiseno } from '../helpers/diseno.js';
import { TIPOS_DISENO } from '../helpers/disenoSla.js';
import { parseOrReply } from '../helpers/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
const id = z.object({ id: z.string().uuid() });
const version = id.extend({ versionId: z.string().uuid() });
const url = z.string().url().refine(s => ['https:', 'http:'].includes(new URL(s).protocol), 'Use un enlace web');
const instante = z.string().datetime({ offset: true });
const solicitud = z.object({ tipo: z.enum(TIPOS_DISENO), solicitudKey: z.string().uuid(), fuenteUrl: url,
  capitulosMuestra: z.number().int().min(3).optional(), correccionId: z.string().uuid().optional(), aprobacionEdicionUrl: url.optional(), preparacionConfirmada: z.boolean(), dueAt: instante.optional() }).strict();
const asignacion = z.object({ disenadorId: z.string().uuid(), dueAt: instante.optional() }).strict();
const entrega = z.object({ enlace: url, entregaKey: z.string().uuid() }).strict();
const coordinacion = z.object({ accion: z.enum(['enviar_autor', 'feedback', 'aprobar_autor', 'handoff_calidad']), feedback: z.string().min(1).max(10000).optional(), cantidadComentarios: z.number().int().nonnegative().optional(), feedbackAutorDueAt: instante.optional() }).strict();
const revision = z.object({ aprobar: z.boolean(), feedback: z.string().min(1).max(10000).optional() }).strict();
export async function disenoRoutes(app: FastifyInstance) {
  app.setErrorHandler((err, _request, reply) => {
    if (err instanceof ErrorDiseno) return reply.code(err.status).send({ error: err.message });
    app.log.error(err); return reply.code(500).send({ error: 'No se pudo completar la acción de Diseño' });
  });
  app.get('/mios', { preHandler: [requireAuth, requireRole('disenador')] }, async (req) => ({ trabajos: await listarDisenos(req.user!) }));
  app.get('/revisiones', { preHandler: [requireAuth, requireRole('lider_creativo', 'jefe_edicion')] }, async req => ({ trabajos: await listarDisenos(req.user!, undefined, true) }));
  app.get('/proyecto/:id', { preHandler: [requireAuth, requireRole('especialista', 'disenador', 'jefe_area', 'soporte_editorial')] }, async (req, reply) => {
    const p = parseOrReply(id, req.params, reply); if (!p) return;
    return { trabajos: await listarDisenos(req.user!, p.id) };
  });
  app.post('/proyecto/:id', { preHandler: [requireAuth, requireRole('especialista')] }, async (req, reply) => {
    const p = parseOrReply(id, req.params, reply); const b = parseOrReply(solicitud, req.body, reply); if (!p || !b) return;
    const result = await solicitarDiseno(p.id, b, req.user!); return reply.code(result.nueva ? 201 : 200).send(result);
  });
  app.patch('/:id/asignar', { preHandler: [requireAuth, requireRole('especialista')] }, async (req, reply) => {
    const p = parseOrReply(id, req.params, reply); const b = parseOrReply(asignacion, req.body, reply); if (!p || !b) return;
    return asignarDiseno(p.id, b, req.user!);
  });
  app.post('/:id/versiones', { preHandler: [requireAuth, requireRole('disenador')] }, async (req, reply) => {
    const p = parseOrReply(id, req.params, reply); const b = parseOrReply(entrega, req.body, reply); if (!p || !b) return;
    const result = await entregarDiseno(p.id, b, req.user!); return reply.code(result.nueva ? 201 : 200).send(result);
  });
  app.patch('/:id/versiones/:versionId', { preHandler: [requireAuth, requireRole('especialista')] }, async (req, reply) => {
    const p = parseOrReply(version, req.params, reply); const b = parseOrReply(coordinacion, req.body, reply); if (!p || !b) return;
    return coordinarVersion(p.id, p.versionId, b, req.user!);
  });
  for (const interna of [false, true]) app.patch(`/:id/versiones/:versionId/${interna ? 'revision-interna' : 'revision-creativa'}`, {
    preHandler: [requireAuth, requireRole(interna ? 'jefe_edicion' : 'lider_creativo')],
  }, async (req, reply) => {
    const p = parseOrReply(version, req.params, reply); const b = parseOrReply(revision, req.body, reply); if (!p || !b) return;
    return revisarCubierta(p.id, p.versionId, b, req.user!, interna);
  });
}
