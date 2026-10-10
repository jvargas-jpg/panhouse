import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  decidirExpressJefatura,
  obtenerActividadJefatura,
  obtenerDashboardJefatura,
} from '../helpers/jefatura.js';
import { asignarEspecialista } from '../helpers/proyectos.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { parseOrReply } from '../helpers/validate.js';

const idSchema = z.object({ id: z.string().uuid() });
const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
  );
const expressSchema = z
  .object({
    decision: z.enum(['confirmado', 'normal']),
    fechaEstandar: fecha,
    fechaDeseada: fecha,
    motivo: z.string().trim().max(500).optional(),
  })
  .strict();
export async function jefaturaRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireRole('jefe_area')];
  app.get('/dashboard', { preHandler }, async () => obtenerDashboardJefatura());
  app.get('/actividad', { preHandler }, async () => ({
    actividad: await obtenerActividadJefatura(),
  }));
  app.patch('/proyectos/:id/express', { preHandler }, async (req, reply) => {
    const p = parseOrReply(idSchema, req.params, reply);
    if (!p) return;
    const b = parseOrReply(expressSchema, req.body, reply);
    if (!b) return;
    const result = await decidirExpressJefatura(p.id, req.user!.id, b);
    return result.ok
      ? result
      : reply.code(result.status).send({ error: result.error });
  });
  app.patch(
    '/proyectos/:id/especialista',
    { preHandler },
    async (req, reply) => {
      const p = parseOrReply(idSchema, req.params, reply);
      if (!p) return;
      const b = parseOrReply(
        z.object({ especialistaId: z.string().uuid() }).strict(),
        req.body,
        reply,
      );
      if (!b) return;
      await asignarEspecialista(p.id, b.especialistaId, req.user!.id, {
        exigirHandoff: true,
      });
      return { ok: true };
    },
  );
}
