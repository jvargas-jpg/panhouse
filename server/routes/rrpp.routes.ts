import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { iniciarIntakeRrpp } from '../helpers/intakeRrpp.js';
import { obtenerDashboardRrpp } from '../helpers/rrppDashboard.js';
import { parseOrReply } from '../helpers/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

export async function rrppRoutes(app: FastifyInstance) {
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
