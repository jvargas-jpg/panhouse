import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { generarTokenAccesoPagos } from '../helpers/pagos.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

export async function portalRoutes(app: FastifyInstance) {
  app.get('/pagos/enlace', { preHandler: [requireAuth, requireRole('autor')] }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'No autenticado' });
    }

    const token = generarTokenAccesoPagos({ email: request.user.email });
    const url = `${env.PAYMENT_PORTAL_URL}?token=${token}`;

    return reply.send({ url });
  });
}
