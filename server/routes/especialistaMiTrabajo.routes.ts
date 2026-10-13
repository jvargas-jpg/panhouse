import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { obtenerColaTrabajoEspecialista } from '../helpers/especialistaMiTrabajo.js';
import { TABS_MI_TRABAJO } from '../../shared/especialistaMiTrabajo.js';

const query = z.object({
  // Default 'pendientes', no 'hoy': "hoy" es un subconjunto acotado a
  // fecha (vence hoy/vencida); la mayoría de acciones de coordinación
  // real (Solicitar Editor, Solicitar reunión creativa...) no tienen
  // fecha pautada y caen en 'pendiente' -- aterrizar en "hoy" por
  // default las esconde detrás de un "todo al día" falso. Ver QA del
  // 2026-10-12: cuenta demo con 22 pendientes reales y 0 en "hoy".
  tab: z.enum(TABS_MI_TRABAJO).default('pendientes'),
  proceso: z.string().max(80).optional(),
  proyectoId: z.string().uuid().optional(),
  dependencia: z.string().max(80).optional(),
  orden: z.enum(['prioridad','fecha']).default('prioridad'),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().refine(n => [10, 20, 50].includes(n)).default(20),
});

export async function especialistaMiTrabajoRoutes(app: FastifyInstance) {
  // Identidad exclusivamente de la sesión -- no selector de usuario/proyecto.
  app.get('/mi-trabajo', { preHandler: [requireAuth, requireRole('especialista')] }, async (req, reply) => {
    const parsed = query.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'Filtros de trabajo inválidos' });
    const { search, pageSize, ...resto } = parsed.data;
    return obtenerColaTrabajoEspecialista(req.user!.id, { ...resto, search: search ?? '', pageSize: pageSize as 10 | 20 | 50 });
  });
}
