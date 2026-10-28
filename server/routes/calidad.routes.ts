import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CRITERIOS_CALIDAD, coordinarCalidad, escalarColeccionInconsistente, iniciarCalidad, listarCalidad, resolverCalidad } from '../helpers/calidad.js';
import { ErrorDiseno } from '../helpers/diseno.js';
import { getValidatorDashboard } from '../helpers/soporteEditorialHome.js';
import { listarMiTrabajoValidador, obtenerDetalleTrabajoValidador } from '../helpers/soporteEditorialWork.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { parseOrReply } from '../helpers/validate.js';
import { soporteEditorialRequestsRoutes } from './soporteEditorialRequests.routes.js';
const id = z.object({ id: z.string().uuid() });
const miTrabajoFiltros = z.object({
  tab: z.enum(['active', 'waiting', 'completed', 'all']).default('active'), search: z.string().max(150).default(''),
  status: z.enum(['new_round', 'in_review', 'waiting_design', 'completed']).optional(),
  type: z.string().max(120).optional(), project: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1), pageSize: z.coerce.number().int().refine(n => [10, 25, 50].includes(n)).default(10),
}).strict();
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
  await soporteEditorialRequestsRoutes(app);
  app.get('/bandeja', { preHandler: [requireAuth, requireRole('soporte_editorial')] }, async req => ({ rondas: await listarCalidad(req.user!) }));
  app.get('/inicio', { preHandler: [requireAuth, requireRole('soporte_editorial')] }, async () => getValidatorDashboard());
  // Mi trabajo del Validador (master prompt dedicado): UNA FILA = UNA
  // RONDA (ficha_calidad_fases.id), bandeja compartida por rol -- no
  // filtra por usuario, mismo alcance real que /bandeja (ver listarCalidad).
  app.get('/mi-trabajo', { preHandler: [requireAuth, requireRole('soporte_editorial')] }, async (req, reply) => {
    const f = miTrabajoFiltros.safeParse(req.query);
    if (!f.success) return reply.code(400).send({ error: 'Datos inválidos', detalles: f.error.flatten() });
    return listarMiTrabajoValidador(f.data);
  });
  app.get('/mi-trabajo/:id', { preHandler: [requireAuth, requireRole('soporte_editorial')] }, async (req, reply) => {
    const p = parseOrReply(id, req.params, reply); if (!p) return;
    const detail = await obtenerDetalleTrabajoValidador(p.id);
    if (!detail) return reply.code(404).send({ error: 'Ronda no encontrada' });
    return detail;
  });
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
  // Jefatura · Decisiones (docs/arquitectura/17-jefatura-decisiones.md) —
  // escalación por colección inconsistente. NO cambia el checklist ni
  // resuelve la ronda; solo expone el caso a Jefatura.
  app.post('/:id/escalar-coleccion', { preHandler: [requireAuth, requireRole('soporte_editorial')] }, async (req, reply) => {
    const p = parseOrReply(id, req.params, reply);
    const b = parseOrReply(z.object({ motivo: z.string().trim().min(10).max(1000) }).strict(), req.body, reply);
    if (!p || !b) return;
    return escalarColeccionInconsistente(p.id, b.motivo, req.user!);
  });
}
