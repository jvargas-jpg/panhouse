import type { FastifyInstance } from 'fastify';
import { listarCatalogosProyecto } from '../helpers/catalogos.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

// Catálogos para el formulario de creación de proyecto. Solo jefe_area
// los necesita hoy (único rol que crea proyectos); se amplía si otro
// rol lo necesita más adelante.
export async function catalogosRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [requireAuth, requireRole('jefe_area')] }, async (_request, reply) => {
    const catalogos = await listarCatalogosProyecto();
    return reply.send(catalogos);
  });
}
