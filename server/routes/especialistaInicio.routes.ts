import type { FastifyInstance } from 'fastify';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { actividadInicioEspecialista, obtenerInicioEspecialista } from '../helpers/especialistaInicio.js';
export async function especialistaInicioRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireRole('especialista')];
  // Identity comes exclusively from the authenticated session. No user/project selector.
  app.get('/inicio', {preHandler}, req => obtenerInicioEspecialista(req.user!.id));
  app.get('/inicio/actividad', {preHandler}, req => actividadInicioEspecialista(req.user!.id));
}
