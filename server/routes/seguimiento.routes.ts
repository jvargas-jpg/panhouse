import type { FastifyInstance } from 'fastify';
import { listarSeguimiento } from '../helpers/seguimiento.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

// Módulo "Control de Tiempos" — exclusivo de jefe_area (ver
// SeguimientoPage.tsx). Sin Zod schema: este GET no recibe params ni
// body que validar, mismo criterio que GET /catalogos y GET /usuarios.
// Restricción del pedido original: solo lectura por ahora, la creación
// de registros queda pendiente de una ronda futura.
export async function seguimientoRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [requireAuth, requireRole('jefe_area')] }, async (_request, reply) => {
    const registros = await listarSeguimiento();
    return reply.send({ registros });
  });
}
