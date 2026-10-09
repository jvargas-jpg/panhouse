import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ESTADOS_PROYECTO } from '../db/schema/index.js';
import { verificarAccesoAProyecto } from '../helpers/proyectos.js';
import { CONTEXTOS_RRPP, historialProyectoRrpp, listarProyectosRrpp, resumenProyectoRrpp } from '../helpers/rrppProyectos.js';
import { iniciarIntakeRrpp } from '../helpers/intakeRrpp.js';
import { obtenerDashboardRrpp } from '../helpers/rrppDashboard.js';
import { parseOrReply } from '../helpers/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { catalogosIngresoRrpp, guardarIngresoRrpp, ingresoRrppSchema, obtenerIngresoRrpp, obtenerIngresosRrpp } from '../helpers/rrppIngresos.js';

export async function rrppRoutes(app: FastifyInstance) {
  app.get('/proyectos', { preHandler: [requireAuth, requireRole('rrpp')] }, async (request, reply) => {
    const filtros = parseOrReply(z.object({ q: z.string().trim().max(150).optional(), servicio: z.string().uuid().optional(), estado: z.enum(ESTADOS_PROYECTO).optional(), rrpp: z.enum(Object.keys(CONTEXTOS_RRPP) as [keyof typeof CONTEXTOS_RRPP, ...(keyof typeof CONTEXTOS_RRPP)[]]).optional(), orden: z.enum(['recientes', 'antiguos', 'autor']).default('recientes'), pagina: z.coerce.number().int().min(1).max(100000).default(1) }).strict(), request.query, reply);
    if (!filtros) return;
    return reply.send(await listarProyectosRrpp({ ...filtros, pagina: filtros.pagina ?? 1 }));
  });
  app.get('/proyectos/:id/resumen', { preHandler: [requireAuth, requireRole('rrpp')] }, async (request, reply) => {
    const params = parseOrReply(z.object({ id: z.string().uuid() }), request.params, reply);
    if (!params || !request.user) return;
    const acceso = await verificarAccesoAProyecto(params.id, request.user);
    if (!acceso.ok) return reply.code(acceso.status).send({ error: acceso.error });
    return reply.send(await resumenProyectoRrpp(params.id));
  });
  app.get('/proyectos/:id/historial', { preHandler: [requireAuth, requireRole('rrpp')] }, async (request, reply) => {
    const params = parseOrReply(z.object({ id: z.string().uuid() }), request.params, reply);
    const query = parseOrReply(z.object({ pagina: z.coerce.number().int().min(1).max(100000).default(1) }).strict(), request.query, reply);
    if (!params || !query || !request.user) return;
    const acceso = await verificarAccesoAProyecto(params.id, request.user);
    if (!acceso.ok) return reply.code(acceso.status).send({ error: acceso.error });
    return reply.send(await historialProyectoRrpp(params.id, query.pagina));
  });
  app.get('/ingresos', { preHandler: [requireAuth, requireRole('rrpp')] }, async (_request, reply) => reply.send({ ingresos: await obtenerIngresosRrpp(), catalogos: catalogosIngresoRrpp }));
  app.get('/ingresos/:id', { preHandler: [requireAuth, requireRole('rrpp')] }, async (request, reply) => {
    const params = parseOrReply(z.object({ id: z.string().uuid() }), request.params, reply);
    if (!params) return;
    const ingreso = await obtenerIngresoRrpp(params.id);
    return ingreso ? reply.send(ingreso) : reply.code(404).send({ error: 'Ingreso no encontrado' });
  });
  app.patch('/ingresos/:id', { preHandler: [requireAuth, requireRole('rrpp')] }, async (request, reply) => {
    const params = parseOrReply(z.object({ id: z.string().uuid() }), request.params, reply);
    if (!params || !request.user) return;
    const body = parseOrReply(ingresoRrppSchema, request.body, reply);
    if (!body) return;
    const resultado = await guardarIngresoRrpp(params.id, body, request.user.id);
    if (!resultado.ok) return reply.code(resultado.status).send({ error: resultado.error });
    return reply.send(await obtenerIngresoRrpp(params.id));
  });
  app.get(
    '/dashboard',
    { preHandler: [requireAuth, requireRole('rrpp')] },
    async (_request, reply) => reply.send(await obtenerDashboardRrpp()),
  );
  app.post(
    '/ingresos/:id/iniciar',
    { preHandler: [requireAuth, requireRole('rrpp')] },
    async (request, reply) => {
      const params = parseOrReply(
        z.object({ id: z.string().uuid() }),
        request.params,
        reply,
      );
      if (!params || !request.user) return;
      const resultado = await iniciarIntakeRrpp(params.id, request.user.id);
      if (!resultado.ok)
        return reply.code(resultado.status).send({ error: resultado.error });
      return reply.send({ ok: true });
    },
  );
}
