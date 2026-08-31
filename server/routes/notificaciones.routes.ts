import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { listarNotificacionesPorRol, marcarNotificacionLeida } from '../helpers/notificaciones.js';
import { parseOrReply } from '../helpers/validate.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const notificacionIdParamSchema = z.object({ id: z.string().uuid() });

// Sin requireRole: cualquier rol autenticado puede tener notificaciones
// propias (rolDestino es texto libre, no está atado a los pocos roles
// que hoy disparan algo) — el filtro real es rolDestino === el propio
// rol de la sesión, no una lista de roles permitidos en la ruta.
export async function notificacionesRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'No autenticado' });
    }
    const notificaciones = await listarNotificacionesPorRol(request.user.rol);
    return reply.send({ notificaciones });
  });

  app.patch('/:id/leer', { preHandler: [requireAuth] }, async (request, reply) => {
    const params = parseOrReply(notificacionIdParamSchema, request.params, reply);
    if (!params) return;

    if (!request.user) {
      return reply.code(401).send({ error: 'No autenticado' });
    }
    const notificacion = await marcarNotificacionLeida(params.id, request.user.rol);
    if (!notificacion) {
      return reply.code(404).send({ error: 'Notificación no encontrada' });
    }
    return reply.send({ notificacion });
  });
}
