import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { obtenerCarteraEspecialista } from '../helpers/especialistaCartera.js';
import { TABS_CARTERA } from '../../shared/especialistaCartera.js';
import type { FiltrosCartera } from '../../shared/especialistaCartera.js';

export const carteraQuery = z.object({
  tab: z.enum(TABS_CARTERA).default('todos'),
  search: z.string().trim().max(200).optional(), q: z.string().trim().max(200).optional(),
  servicio: z.string().uuid().optional(), subtipo: z.enum(['Tripa','Capítulo']).optional(),
  estado: z.enum(['en_proceso','retrasado','stand_by','pausado','culminado']).optional(),
  proceso: z.string().max(80).optional(), riesgo: z.enum(['si','no']).optional(),
  orden: z.enum(['prioridad','fecha','recientes','autor']).default('prioridad'),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().refine(n => [10,20,50].includes(n)).default(20),
});
export async function especialistaCarteraRoutes(app: FastifyInstance) {
  app.get('/cartera', { preHandler: [requireAuth, requireRole('especialista')] }, async (req, reply) => {
    const parsed = carteraQuery.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'Filtros de cartera inválidos' });
    const { q, search, ...filtros } = parsed.data;
    return obtenerCarteraEspecialista(req.user!.id, { ...filtros, search: search ?? q ?? '', pageSize: filtros.pageSize as FiltrosCartera['pageSize'] });
  });
}
