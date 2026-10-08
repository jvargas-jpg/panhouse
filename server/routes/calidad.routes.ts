import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CRITERIOS_CALIDAD, coordinarCalidad, iniciarCalidad, listarCalidad, resolverCalidad } from '../helpers/calidad.js';
import { ErrorDiseno } from '../helpers/diseno.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { parseOrReply } from '../helpers/validate.js';
const id = z.object({ id: z.string().uuid() });
const enlace = z.string().url().refine(s => ['https:', 'http:'].includes(new URL(s).protocol), 'Use un enlace web');
const numero = z.number().int().nonnegative();
const instante = z.string().datetime({ offset: true });
const resultado = z.object({ aprobar: z.boolean(), cantidadComentarios: numero, cantidadPaginas: z.number().int().positive().optional(), comentariosUrl: enlace.optional(),
  cambiosPendientesPorAplicar: numero.optional(), cambiosNuevosSugeridos: numero.optional(), observaciones: z.string().max(10000).optional(),
  checklist: z.record(z.enum(CRITERIOS_CALIDAD), z.object({ cumple: z.boolean().nullable(), observaciones: z.string().max(2000).optional() }).strict()).optional(),
}).strict();
const coordinacion = z.object({ accion: z.enum(['enviar_autor', 'feedback_autor', 'aprobar_autor', 'revision_final']), feedback: z.string().max(10000).optional(),
  comentariosUrl: enlace.optional(), cantidadComentarios: numero.optional(), feedbackAutorDueAt: instante.optional(), numerosLegalesUrl: enlace.optional(),
}).strict();
export async function calidadRoutes(app: FastifyInstance) {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ErrorDiseno) return reply.code(err.status).send({ error: err.message });
    app.log.error(err); return reply.code(500).send({ error: 'No se pudo completar la acción de Calidad' });
  });
  app.get('/bandeja', { preHandler: [requireAuth, requireRole('soporte_editorial')] }, async req => ({ rondas: await listarCalidad(req.user!) }));
  app.get('/proyecto/:id', { preHandler: [requireAuth, requireRole('especialista', 'disenador', 'jefe_area', 'soporte_editorial')] }, async (req, reply) => {
    const p = parseOrReply(id, req.params, reply); if (!p) return; return { rondas: await listarCalidad(req.user!, p.id) };
  });
  app.patch('/:id/inicio', { preHandler: [requireAuth, requireRole('soporte_editorial')] }, async (req, reply) => {
    const p = parseOrReply(id, req.params, reply); const b = parseOrReply(z.object({ dueAt: instante.optional() }).strict(), req.body, reply);
    if (!p || !b) return; return iniciarCalidad(p.id, b.dueAt, req.user!);
  });
  app.patch('/:id/resultado', { preHandler: [requireAuth, requireRole('soporte_editorial')] }, async (req, reply) => {
    const p = parseOrReply(id, req.params, reply); const b = parseOrReply(resultado, req.body, reply); if (!p || !b) return; return resolverCalidad(p.id, b, req.user!);
  });
  app.patch('/:id/coordinacion', { preHandler: [requireAuth, requireRole('especialista')] }, async (req, reply) => {
    const p = parseOrReply(id, req.params, reply); const b = parseOrReply(coordinacion, req.body, reply); if (!p || !b) return; return coordinarCalidad(p.id, b, req.user!);
  });
}
