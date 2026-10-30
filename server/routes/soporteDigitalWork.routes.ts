import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { parseOrReply } from '../helpers/validate.js';
import { listarMiTrabajoDigital, obtenerDetalleTrabajoDigital } from '../helpers/soporteDigitalWork.js';
import { listDigitalDriveFiles } from '../helpers/soporteDigitalDrive.js';
import { DIGITAL_ACTIONS, DIGITAL_DEADLINE_FILTERS, DIGITAL_WORK_SORTS, DIGITAL_WORK_STATES, DIGITAL_WORK_TABS } from '../../shared/soporteDigitalWork.js';
import { registrarAccionDigital } from '../helpers/soporteDigitalActions.js';

const workItemParamSchema = z.object({ workItemId: z.string().uuid() });
const miTrabajoFiltersSchema = z.object({
  tab: z.enum(DIGITAL_WORK_TABS).default('all'), search: z.string().max(150).default(''),
  project: z.string().uuid().optional(),
  state: z.enum(DIGITAL_WORK_STATES).optional(), stage: z.enum(['preparation', 'testing', 'loaded', 'completed']).optional(),
  deadline: z.enum(DIGITAL_DEADLINE_FILTERS).optional(), blocked: z.enum(['yes', 'no']).optional(), sort: z.enum(DIGITAL_WORK_SORTS).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1), pageSize: z.coerce.number().int().refine(n => [10, 25, 50].includes(n)).default(10),
}).strict();
const actionSchema = z.object({ kind: z.enum(DIGITAL_ACTIONS), expectedRevision: z.string().regex(/^[a-f0-9]{64}$/), requestId: z.string().uuid(),
  date: z.string().date().optional(), dateKindle: z.string().date().optional(),
  datos: z.record(z.union([z.string().max(5000), z.null()])).refine(d => Object.keys(d).length > 0 && Object.keys(d).length <= 16).optional(),
}).strict().superRefine((v, ctx) => {
  if (!['iniciarTarea', 'actualizarDatos'].includes(v.kind) && (v.kind === 'registrarCarga' ? !v.date && !v.dateKindle : !v.date)) ctx.addIssue({ code: 'custom', message: 'Indica la fecha del hito realizado' });
  if (v.kind !== 'registrarCarga' && v.dateKindle) ctx.addIssue({ code: 'custom', message: 'La fecha Kindle solo corresponde al registro de carga' });
  if ((v.kind === 'actualizarDatos') !== !!v.datos) ctx.addIssue({ code: 'custom', message: 'Indica los datos que deseas actualizar' });
  if (['iniciarTarea', 'actualizarDatos'].includes(v.kind) && v.date) ctx.addIssue({ code: 'custom', message: 'Esta acción no recibe una fecha de hito' });
});

export async function soporteDigitalWorkRoutes(app: FastifyInstance) {
  const digital = { preHandler: [requireAuth, requireRole('soporte_digital')] };
  // Bandeja compartida (como Inicio): sin assignment individual, cualquier
  // soporte_digital ve y opera cualquier tarea digital abierta.
  app.get('/mi-trabajo', digital, async (request, reply) => {
    const f = parseOrReply(miTrabajoFiltersSchema, request.query, reply); if (!f) return;
    return listarMiTrabajoDigital({ ...f, tab: f.tab ?? 'all', search: f.search ?? '', page: f.page ?? 1, pageSize: f.pageSize ?? 10 });
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
  app.post('/mi-trabajo/:workItemId/acciones', digital, async (request, reply) => {
    const p = parseOrReply(workItemParamSchema, request.params, reply);
    const body = parseOrReply(actionSchema, request.body, reply);
    if (!p || !body) return;
    return registrarAccionDigital(p.workItemId, body, request.user!);
  });
}
