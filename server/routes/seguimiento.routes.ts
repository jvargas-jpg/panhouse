import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { obtenerSeguimientoGeneral } from '../helpers/seguimientoGeneral.js';
import { obtenerDashboardJefatura } from '../helpers/jefatura.js';
import {
  actividadIntervencion,
  ErrorSeguimiento,
  guardarSupervision,
  listarIntervenciones,
  obtenerIntervencion,
} from '../helpers/seguimientoIntervenciones.js';
import {
  obtenerQuickViewJefatura,
  obtenerActividadProyectoJefatura,
} from '../helpers/jefaturaProyectos.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { parseOrReply } from '../helpers/validate.js';
import {
  MATERIALES_SEGUIMIENTO,
  PROCESOS_SEGUIMIENTO,
  RESULTADOS_SEGUIMIENTO,
} from '../../shared/seguimientoOperativo.js';

const enumKeys = <T extends Record<string, unknown>>(r: T) =>
  Object.keys(r) as [keyof T & string, ...(keyof T & string)[]];
const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
  );
const persona = z.union([z.string().uuid(), z.literal('sin_asignar')]);
const pagina = {
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce
    .number()
    .refine((v) => [10, 20, 50].includes(v))
    .default(10),
};
const generalSchema = z
  .object({
    q: z.string().trim().max(160).default(''),
    proceso: z.string().max(60).optional(),
    especialistaId: persona.optional(),
    proyectoId: z.string().uuid().optional(),
    estado: z
      .enum(['en_proceso', 'retrasado', 'pausado', 'stand_by'])
      .optional(),
    riesgo: z.enum(['riesgo', 'bloqueados', 'proximos', 'express']).optional(),
    orden: z.enum(['urgentes', 'vencimiento', 'recientes']).default('urgentes'),
    ...pagina,
  })
  .strict();
const intervencionesSchema = z
  .object({
    q: z.string().trim().max(160).default(''),
    grupo: z
      .enum(['todas', 'pendientes', 'en_progreso', 'vencidas', 'entregadas'])
      .default('todas'),
    proceso: z.enum(enumKeys(PROCESOS_SEGUIMIENTO)).optional(),
    material: z.enum(enumKeys(MATERIALES_SEGUIMIENTO)).optional(),
    analistaId: persona.optional(),
    especialistaId: persona.optional(),
    proyectoId: z.string().uuid().optional(),
    freelance: z.enum(['si', 'no']).optional(),
    origen: z.enum(['correccion', 'calidad', 'legacy']).optional(),
    resultado: z
      .enum([...enumKeys(RESULTADOS_SEGUIMIENTO), 'sin_evaluar'])
      .optional(),
    from: fecha.optional(),
    to: fecha.optional(),
    orden: z.enum(['urgentes', 'vencimiento', 'recientes']).default('urgentes'),
    ...pagina,
  })
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: 'El periodo Desde no puede superar Hasta',
  });
const idSchema = z.object({
  origen: z.enum(['correccion', 'calidad', 'legacy']),
  id: z.string().uuid(),
});
const cambiosSchema = z
  .object({
    observaciones: z.string().trim().max(5000).nullable().optional(),
    resultadoSeguimiento: z
      .enum(enumKeys(RESULTADOS_SEGUIMIENTO))
      .nullable()
      .optional(),
    observacionesF1: z.string().trim().max(5000).nullable().optional(),
    cantidadComentarios: z
      .number()
      .int()
      .min(0)
      .max(100000)
      .nullable()
      .optional(),
    paginas: z.number().int().min(0).max(100000).nullable().optional(),
    pago80: z.boolean().optional(),
    pago20: z.boolean().optional(),
    expectedUpdatedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export async function seguimientoRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireRole('jefe_area')];
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ErrorSeguimiento)
      return reply.code(error.status).send({ error: error.message });
    return reply.send(error);
  });
  app.get('/general', { preHandler }, async (req, reply) => {
    const f = parseOrReply(generalSchema, req.query, reply);
    if (!f) return;
    return obtenerSeguimientoGeneral({
      ...f,
      q: f.q ?? '',
      orden: f.orden ?? 'urgentes',
      page: f.page ?? 1,
      pageSize: f.pageSize ?? 10,
    });
  });
  app.get('/general/:id', { preHandler }, async (req, reply) => {
    const p = parseOrReply(
      z.object({ id: z.string().uuid() }),
      req.params,
      reply,
    );
    if (!p) return;
    const snapshot = await obtenerDashboardJefatura();
    const d = await obtenerQuickViewJefatura(p.id, snapshot);
    return d
      ? {
          ...d,
          solicitudes: snapshot.requests.filter((r) => r.proyectoId === p.id),
        }
      : reply
          .code(404)
          .send({ error: 'Proyecto no disponible en Seguimiento activo' });
  });
  app.get('/general/:id/actividad', { preHandler }, async (req, reply) => {
    const p = parseOrReply(
      z.object({ id: z.string().uuid() }),
      req.params,
      reply,
    );
    if (!p) return;
    const snapshot = await obtenerDashboardJefatura();
    const a = await obtenerActividadProyectoJefatura(p.id, snapshot);
    return a
      ? { actividad: a }
      : reply.code(404).send({ error: 'Proyecto no disponible' });
  });
  app.get('/intervenciones', { preHandler }, async (req, reply) => {
    const f = parseOrReply(intervencionesSchema, req.query, reply);
    if (!f) return;
    return listarIntervenciones({
      ...f,
      q: f.q ?? '',
      grupo: f.grupo ?? 'todas',
      orden: f.orden ?? 'urgentes',
      page: f.page ?? 1,
      pageSize: f.pageSize ?? 10,
    });
  });
  app.get('/intervenciones/:origen/:id', { preHandler }, async (req, reply) => {
    const p = parseOrReply(idSchema, req.params, reply);
    if (!p) return;
    const d = await obtenerIntervencion(p.origen, p.id);
    return (
      d ??
      reply
        .code(404)
        .send({ error: 'Intervención no disponible en el ámbito de Jefatura' })
    );
  });
  app.get(
    '/intervenciones/:origen/:id/actividad',
    { preHandler },
    async (req, reply) => {
      const p = parseOrReply(idSchema, req.params, reply);
      if (!p) return;
      const a = await actividadIntervencion(p.origen, p.id);
      return a
        ? { actividad: a }
        : reply.code(404).send({ error: 'Intervención no disponible' });
    },
  );
  app.patch(
    '/intervenciones/:origen/:id',
    { preHandler },
    async (req, reply) => {
      const p = parseOrReply(idSchema, req.params, reply),
        b = parseOrReply(cambiosSchema, req.body, reply);
      if (!p || !b) return;
      return guardarSupervision(
        p.origen,
        p.id,
        { ...b, expectedUpdatedAt: b.expectedUpdatedAt ?? null },
        req.user!.id,
      );
    },
  );
  app.get('/', { preHandler }, async () =>
    listarIntervenciones({
      q: '',
      grupo: 'todas',
      orden: 'urgentes',
      page: 1,
      pageSize: 10,
    }),
  );
  app.post('/', { preHandler }, async (_req, reply) =>
    reply.code(410).send({
      error:
        'Solicita la intervención desde su workflow; aparece automáticamente en Seguimiento',
    }),
  );
  app.patch('/:id', { preHandler }, async (_req, reply) =>
    reply.code(410).send({
      error:
        'Usa la supervisión de la intervención identificada por su origen; los datos operativos pertenecen al workflow',
    }),
  );
}
