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
import { obtenerPortafolioJefatura, obtenerQuickViewJefatura, obtenerActividadProyectoJefatura } from '../helpers/jefaturaProyectos.js';
import {
  compararAsignacionJefatura,
  obtenerAsignacionesJefatura,
} from '../helpers/jefaturaAsignaciones.js';

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
  app.get('/proyectos', { preHandler }, async (req, reply) => {
    const f = parseOrReply(z.object({
      tab: z.enum(['todos', 'porAsignar', 'enProduccion', 'enRiesgo', 'express', 'completados']).default('todos'),
      q: z.string().trim().max(160).default(''),
      servicioId: z.string().uuid().optional(),
      especialistaId: z.union([z.string().uuid(), z.literal('sinAsignar')]).optional(),
      estado: z.enum(['porAsignar', 'enProduccion', 'enRiesgo', 'pausado', 'standBy', 'completado', 'asignado']).optional(),
      orden: z.enum(['urgentes', 'recientes', 'fecha', 'autor']).default('urgentes'),
      page: z.coerce.number().int().min(1).max(100000).default(1),
      pageSize: z.coerce.number().int().min(1).max(20).default(10),
    }).strict(), req.query, reply);
    if (!f) return;
    return obtenerPortafolioJefatura({ ...f, tab: f.tab ?? 'todos', q: f.q ?? '', orden: f.orden ?? 'urgentes', page: f.page ?? 1, pageSize: f.pageSize ?? 10 });
  });
  app.get('/proyectos/:id/resumen', { preHandler }, async (req, reply) => {
    const p = parseOrReply(idSchema, req.params, reply);
    if (!p) return;
    return await obtenerQuickViewJefatura(p.id) ?? reply.code(404).send({ error: 'Proyecto no disponible en el ámbito de Jefatura' });
  });
  app.get('/proyectos/:id/actividad', { preHandler }, async (req, reply) => {
    const p = parseOrReply(idSchema, req.params, reply);
    if (!p) return;
    const actividad = await obtenerActividadProyectoJefatura(p.id);
    return actividad ? { actividad } : reply.code(404).send({ error: 'Proyecto no disponible en el ámbito de Jefatura' });
  });
  app.get('/asignaciones', { preHandler }, async (req, reply) => {
    const f = parseOrReply(
      z
        .object({
          tab: z
            .enum(['porAsignar', 'asignados', 'express', 'enRiesgo'])
            .default('porAsignar'),
          q: z.string().trim().max(160).default(''),
          servicioId: z.string().uuid().optional(),
          especialistaId: z.string().uuid().optional(),
          orden: z
            .enum(['urgentes', 'recientes', 'mayorImpacto', 'menorImpacto'])
            .default('urgentes'),
          page: z.coerce.number().int().min(1).max(100000).default(1),
          pageSize: z.coerce.number().int().min(1).max(25).default(20),
        })
        .strict(),
      req.query,
      reply,
    );
    if (!f) return;
    return obtenerAsignacionesJefatura({
      ...f,
      tab: f.tab ?? 'porAsignar',
      q: f.q ?? '',
      orden: f.orden ?? 'urgentes',
      page: f.page ?? 1,
      pageSize: f.pageSize ?? 20,
    });
  });
  app.get('/proyectos/:id/candidatos', { preHandler }, async (req, reply) => {
    const p = parseOrReply(idSchema, req.params, reply);
    if (!p) return;
    const comparacion = await compararAsignacionJefatura(p.id);
    return (
      comparacion ??
      reply.code(404).send({
        error: 'Proyecto no disponible en el ámbito activo de Jefatura',
      })
    );
  });
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
        z
          .object({
            especialistaId: z.string().uuid(),
            especialistaActualEsperado: z.string().uuid().nullable().optional(),
          })
          .strict(),
        req.body,
        reply,
      );
      if (!b) return;
      await asignarEspecialista(p.id, b.especialistaId, req.user!.id, {
        exigirHandoff: true,
        ...(b.especialistaActualEsperado !== undefined
          ? { especialistaActualEsperado: b.especialistaActualEsperado }
          : {}),
      });
      return { ok: true };
    },
  );
}
