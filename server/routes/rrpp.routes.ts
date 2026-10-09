import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { iniciarIntakeRrpp } from '../helpers/intakeRrpp.js';
import { obtenerDashboardRrpp } from '../helpers/rrppDashboard.js';
import { parseOrReply } from '../helpers/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { catalogosIngresoRrpp, guardarIngresoRrpp, ingresoRrppSchema, obtenerIngresoRrpp, obtenerIngresosRrpp } from '../helpers/rrppIngresos.js';

export async function rrppRoutes(app: FastifyInstance) {
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
