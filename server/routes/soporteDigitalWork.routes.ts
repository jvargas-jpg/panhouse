import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { parseOrReply } from '../helpers/validate.js';
import { listarMiTrabajoDigital, obtenerDetalleTrabajoDigital } from '../helpers/soporteDigitalWork.js';
import { listDigitalDriveFiles } from '../helpers/soporteDigitalDrive.js';
import { DIGITAL_WORK_TABS } from '../../shared/soporteDigitalWork.js';

const workItemParamSchema = z.object({ workItemId: z.string().uuid() });
const miTrabajoFiltersSchema = z.object({
  tab: z.enum(DIGITAL_WORK_TABS).default('all'), search: z.string().max(150).default(''),
  project: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1), pageSize: z.coerce.number().int().refine(n => [10, 25, 50].includes(n)).default(10),
}).strict();

export async function soporteDigitalWorkRoutes(app: FastifyInstance) {
  const digital = { preHandler: [requireAuth, requireRole('soporte_digital')] };
  // Bandeja compartida (como Inicio): sin assignment individual, cualquier
  // soporte_digital ve y opera cualquier tarea digital abierta.
  app.get('/mi-trabajo', digital, async (request, reply) => {
    const f = parseOrReply(miTrabajoFiltersSchema, request.query, reply); if (!f) return;
    return listarMiTrabajoDigital({ tab: f.tab ?? 'all', search: f.search ?? '', project: f.project, page: f.page ?? 1, pageSize: f.pageSize ?? 10 });
  });
  app.get('/mi-trabajo/:workItemId', digital, async (request, reply) => {
    const p = parseOrReply(workItemParamSchema, request.params, reply); if (!p) return;
    const detail = await obtenerDetalleTrabajoDigital(p.workItemId);
    if (!detail) return reply.code(404).send({ error: 'Tarea digital no encontrada' });
    return detail;
  });
  app.get('/mi-trabajo/:workItemId/archivos', digital, async (request, reply) => {
    const p = parseOrReply(workItemParamSchema, request.params, reply);
    const q = parseOrReply(z.object({ pageToken: z.string().max(2000).optional() }).strict(), request.query, reply);
    if (!p || !q) return;
    try {
      return await listDigitalDriveFiles(p.workItemId, q.pageToken);
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });
}
