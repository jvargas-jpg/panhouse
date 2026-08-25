import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { listarCargaEspecialistas, obtenerCargaEspecialista } from '../helpers/carga.js';
import { parseOrReply } from '../helpers/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const idParamSchema = z.object({ id: z.string().uuid() });

export async function especialistasRoutes(app: FastifyInstance) {
  // Solo jefe_area: quien asigna proyectos necesita ver a todos de un
  // vistazo antes de repartir trabajo nuevo.
  app.get('/carga', { preHandler: [requireAuth, requireRole('jefe_area')] }, async (_request, reply) => {
    const especialistas = await listarCargaEspecialistas();
    return reply.send({ especialistas });
  });

  // jefe_area puede consultar la carga de cualquiera; un especialista
  // solo la propia.
  app.get('/:id/carga', { preHandler: [requireAuth, requireRole('jefe_area', 'especialista')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;

    if (!request.user) {
      return reply.code(401).send({ error: 'No autenticado' });
    }

    if (request.user.rol === 'especialista' && request.user.id !== params.id) {
      return reply.code(403).send({ error: 'Un especialista solo puede consultar su propia carga' });
    }

    const carga = await obtenerCargaEspecialista(params.id);
    return reply.send({ especialistaId: params.id, carga });
  });
}
