import type { FastifyInstance } from 'fastify';
import { listarCargaDisenadores } from '../helpers/carga.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

// Mismo patrón exacto que especialistas.routes.ts / editores.routes.ts
// (GET /carga), pero a diferencia de esos dos —que los usa la jefatura
// que reparte el trabajo— acá quien asigna es el propio especialista
// dueño del proyecto (ver PATCH /proyectos/:id/disenador).
export async function disenadoresRoutes(app: FastifyInstance) {
  app.get('/carga', { preHandler: [requireAuth, requireRole('especialista')] }, async (_request, reply) => {
    const disenadores = await listarCargaDisenadores();
    return reply.send({ disenadores });
  });
}
