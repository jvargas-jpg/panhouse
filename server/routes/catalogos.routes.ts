import type { FastifyInstance } from 'fastify';
import { listarCatalogosProyecto } from '../helpers/catalogos.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

// Catálogos para el formulario de creación de proyecto. comercial
// también crea proyectos ahora, desde su propio CRM (ver
// autores/CrearProyectoModalForm.tsx) — mismo catálogo que jefe_area.
export async function catalogosRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [requireAuth, requireRole('jefe_area', 'comercial')] }, async (_request, reply) => {
    const catalogos = await listarCatalogosProyecto();
    return reply.send(catalogos);
  });
}
