import type { FastifyInstance } from 'fastify';
import { obtenerMetricasComerciales } from '../helpers/metricas.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

// comercial y dirección: mismos dos roles que ya ven la pestaña
// "Clientes" del CRM en AutoresPage.tsx (el botón "Métricas" del
// sidebar vive en esa misma pantalla, visible para ambos).
export async function metricasRoutes(app: FastifyInstance) {
  app.get('/comercial', { preHandler: [requireAuth, requireRole('comercial', 'direccion')] }, async (_request, reply) => {
    const metricas = await obtenerMetricasComerciales();
    return reply.send(metricas);
  });
}
