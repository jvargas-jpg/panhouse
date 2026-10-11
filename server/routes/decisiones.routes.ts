import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  actividadDecision,
  iniciarRevision,
  listarDecisiones,
  obtenerDecision,
  resolverDecision,
  responderInformacion,
  resumenDecisiones,
  solicitarInformacion,
} from '../helpers/decisiones.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { parseOrReply } from '../helpers/validate.js';

const idParam = z.object({ id: z.string().uuid() });
const listQuery = z
  .object({
    q: z.string().max(200).optional(),
    status: z
      .enum([
        'todas',
        'abiertas',
        'pendiente',
        'en_revision',
        'informacion_solicitada',
        'resuelta',
      ])
      .optional(),
    tipo: z
      .enum(['revision_previa_correccion', 'coleccion_inconsistente'])
      .optional(),
    origen: z.enum(['correccion', 'calidad']).optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(50).default(20),
  })
  .strict()
  .refine((q) => !q.from || !q.to || q.from <= q.to, 'El periodo no es válido');
const accionConVersion = z
  .object({ expectedVersion: z.number().int().positive().optional() })
  .strict();
const solicitarInfoBody = z
  .object({
    mensaje: z.string().trim().min(5).max(2000),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
const responderInfoBody = z
  .object({
    mensaje: z.string().trim().min(1).max(2000),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
const resolverBody = z
  .object({
    resolution: z.enum(['approved', 'rejected', 'cancelled']),
    mensaje: z.string().trim().max(2000).optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();

function respuesta(
  reply: any,
  resultado: { ok: true } | { ok: false; status: number; error: string },
) {
  if (resultado.ok) return reply.send({ ok: true });
  return reply.code(resultado.status).send({ error: resultado.error });
}

// Jefatura · Decisiones (docs/arquitectura/17-jefatura-decisiones.md) —
// bandeja/expediente de HUMAN GATES. NO hay POST de creación libre acá
// a propósito (prompt §19/81): las decisiones nacen DENTRO de workflows
// autorizados (solicitarCorreccion, escalarColeccionInconsistente),
// nunca desde este router.
export async function decisionesRoutes(app: FastifyInstance) {
  const soloJefatura = [requireAuth, requireRole('jefe_area')];

  app.get('/resumen', { preHandler: soloJefatura }, async () =>
    resumenDecisiones(),
  );

  app.get('/', { preHandler: soloJefatura }, async (req, reply) => {
    const q = parseOrReply(listQuery, req.query, reply);
    if (!q) return;
    return listarDecisiones({
      ...q,
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 20,
    });
  });

  app.get('/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const p = parseOrReply(idParam, req.params, reply);
    if (!p) return;
    const detalle = await obtenerDecision(p.id, req.user!);
    if (!detalle)
      return reply.code(404).send({ error: 'Decisión no encontrada' });
    return detalle;
  });

  app.get(
    '/:id/actividad',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const p = parseOrReply(idParam, req.params, reply);
      if (!p) return;
      if (!(await obtenerDecision(p.id, req.user!)))
        return reply.code(404).send({ error: 'Decisión no encontrada' });
      return { actividad: await actividadDecision(p.id) };
    },
  );

  app.post(
    '/:id/revision',
    { preHandler: soloJefatura },
    async (req, reply) => {
      const p = parseOrReply(idParam, req.params, reply);
      const b = parseOrReply(accionConVersion, req.body, reply);
      if (!p || !b) return;
      respuesta(
        reply,
        await iniciarRevision(p.id, req.user!, b.expectedVersion),
      );
    },
  );

  app.post(
    '/:id/solicitar-info',
    { preHandler: soloJefatura },
    async (req, reply) => {
      const p = parseOrReply(idParam, req.params, reply);
      const b = parseOrReply(solicitarInfoBody, req.body, reply);
      if (!p || !b) return;
      respuesta(
        reply,
        await solicitarInformacion(
          p.id,
          req.user!,
          b.mensaje,
          b.expectedVersion,
        ),
      );
    },
  );

  // Responder información es del SOLICITANTE, no de Jefatura (prompt
  // §52/76/78) -- cualquier rol autenticado puede intentarlo, el helper
  // valida que sea el solicitante real (IDOR por requestedByUserId).
  app.post(
    '/:id/responder-info',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const p = parseOrReply(idParam, req.params, reply);
      const b = parseOrReply(responderInfoBody, req.body, reply);
      if (!p || !b) return;
      respuesta(
        reply,
        await responderInformacion(
          p.id,
          req.user!,
          b.mensaje,
          b.expectedVersion,
        ),
      );
    },
  );

  app.post(
    '/:id/resolver',
    { preHandler: soloJefatura },
    async (req, reply) => {
      const p = parseOrReply(idParam, req.params, reply);
      const b = parseOrReply(resolverBody, req.body, reply);
      if (!p || !b) return;
      respuesta(
        reply,
        await resolverDecision(
          p.id,
          req.user!,
          b.resolution,
          b.mensaje,
          b.expectedVersion,
        ),
      );
    },
  );
}
