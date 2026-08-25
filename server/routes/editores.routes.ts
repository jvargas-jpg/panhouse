import type { FastifyInstance } from 'fastify';
import { listarCargaEditores } from '../helpers/carga.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

// Mismo patrón exacto que especialistas.routes.ts (GET /carga): solo
// jefe_edicion, quien asigna proyectos a editores necesita ver a todos
// de un vistazo antes de repartir trabajo nuevo.
export async function editoresRoutes(app: FastifyInstance) {
  app.get('/carga', { preHandler: [requireAuth, requireRole('jefe_edicion')] }, async (_request, reply) => {
    const editores = await listarCargaEditores();
    return reply.send({ editores });
  });
}
