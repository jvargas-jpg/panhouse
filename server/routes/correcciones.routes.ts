import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { correcciones, proyectos } from '../db/schema/index.js';
import {
  asignarCorrector,
  cerrarCorreccion,
  listarMisCorrecciones,
  listarSeguimientoCorreccion,
  marcarInicioCorreccion,
  registrarEntregaCorreccion,
  verificarAccesoACorreccion,
} from '../helpers/correcciones.js';
import { parseOrReply } from '../helpers/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const idParamSchema = z.object({ id: z.string().uuid() });

const asignarCorrectorSchema = z.object({
  correctorId: z.string().uuid().nullable().optional(),
  correctorNombre: z.string().min(1).nullable().optional(),
  freelance: z.boolean(),
  contratoConfirmado: z.boolean(),
  revisionPreviaConfirmada: z.boolean().optional(),
});

const fechaSchema = z.object({ fecha: z.string().min(1) });

const entregaSchema = z.object({
  fecha: z.string().min(1),
  controlCambiosUrl: z.string().nullable().optional(),
  informeTecnicoUrl: z.string().nullable().optional(),
});

const cierreSchema = z.object({
  resultado: z.enum(['buena', 'regular', 'deficiente']),
  observaciones: z.string().nullable().optional(),
});

// Fase 5 (5B Corrección) — inicio/entrega los puede registrar: el
// propio corrector asignado (si tiene cuenta, ver verificarAccesoACorreccion)
// O el especialista dueño del proyecto, pero SOLO cuando el corrector es
// freelance (sin cuenta de sistema, no puede loguearse a hacerlo él
// mismo) — mismo principio de separación por rol que capítulos.ts
// (fechaEntregaEditor es del editor, fechaEnvioAutor es del
// especialista), aplicado acá vía el campo `freelance` en vez de una
// columna fija.
async function verificarAccesoAEjecucion(
  correccionId: string,
  usuario: { id: string; rol: string },
): Promise<{ ok: true } | { ok: false; status: 403 | 404; error: string }> {
  const [fila] = await db
    .select({ correctorId: correcciones.correctorId, freelance: correcciones.freelance, especialistaId: proyectos.especialistaId })
    .from(correcciones)
    .innerJoin(proyectos, eq(correcciones.proyectoId, proyectos.id))
    .where(eq(correcciones.id, correccionId))
    .limit(1);

  if (!fila) return { ok: false, status: 404, error: 'Corrección no encontrada' };

  if (usuario.rol === 'corrector' && fila.correctorId === usuario.id) return { ok: true };
  if (usuario.rol === 'especialista' && fila.especialistaId === usuario.id && fila.freelance) return { ok: true };
  if (usuario.rol === 'jefe_area') return { ok: true };

  return { ok: false, status: 403, error: 'No autorizado para esta corrección' };
}

export async function correccionesRoutes(app: FastifyInstance) {
  // "Mis Correcciones" (master prompt §19) — solo correctores con
  // cuenta de sistema llegan acá (ver rol 'corrector' en ROLES).
  app.get('/mias', { preHandler: [requireAuth, requireRole('corrector')] }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'No autenticado' });
    const trabajos = await listarMisCorrecciones(request.user.id);
    return reply.send({ trabajos });
  });

  // "Seguimiento de Corrección" (master prompt §18/§21) — jefatura.
  app.get('/seguimiento', { preHandler: [requireAuth, requireRole('jefe_area')] }, async (_request, reply) => {
    const correcciones = await listarSeguimientoCorreccion();
    return reply.send({ correcciones });
  });

  // Asignación formal (Manual §3.1) — y reasignación (master prompt
  // §27): mismo endpoint, asignarCorrector detecta cuál es.
  app.patch('/:id/asignar', { preHandler: [requireAuth, requireRole('especialista')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOrReply(asignarCorrectorSchema, request.body, reply);
    if (!body) return;
    if (!request.user) return reply.code(401).send({ error: 'No autenticado' });

    const acceso = await verificarAccesoACorreccion(params.id, request.user);
    if (!acceso.ok) return reply.code(acceso.status).send({ error: acceso.error });

    const resultado = await asignarCorrector(params.id, body, request.user.id);
    if (!resultado.ok) return reply.code(resultado.status).send({ error: resultado.error });
    return reply.send({ ok: true });
  });

  app.patch(
    '/:id/inicio',
    { preHandler: [requireAuth, requireRole('corrector', 'especialista', 'jefe_area')] },
    async (request, reply) => {
      const params = parseOrReply(idParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(fechaSchema, request.body, reply);
      if (!body) return;
      if (!request.user) return reply.code(401).send({ error: 'No autenticado' });

      const acceso = await verificarAccesoAEjecucion(params.id, request.user);
      if (!acceso.ok) return reply.code(acceso.status).send({ error: acceso.error });

      await marcarInicioCorreccion(params.id, body.fecha, request.user.id);
      return reply.send({ ok: true });
    },
  );

  app.patch(
    '/:id/entrega',
    { preHandler: [requireAuth, requireRole('corrector', 'especialista', 'jefe_area')] },
    async (request, reply) => {
      const params = parseOrReply(idParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(entregaSchema, request.body, reply);
      if (!body) return;
      if (!request.user) return reply.code(401).send({ error: 'No autenticado' });

      const acceso = await verificarAccesoAEjecucion(params.id, request.user);
      if (!acceso.ok) return reply.code(acceso.status).send({ error: acceso.error });

      await registrarEntregaCorreccion(params.id, body, request.user.id);
      return reply.send({ ok: true });
    },
  );

  // Cierre (master prompt §4 paso 9) — exclusivo del Especialista, nunca
  // del corrector (ver comentario de `resultado` en server/db/schema/correcciones.ts).
  app.patch('/:id/cierre', { preHandler: [requireAuth, requireRole('especialista')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOrReply(cierreSchema, request.body, reply);
    if (!body) return;
    if (!request.user) return reply.code(401).send({ error: 'No autenticado' });

    const acceso = await verificarAccesoACorreccion(params.id, request.user);
    if (!acceso.ok) return reply.code(acceso.status).send({ error: acceso.error });

    await cerrarCorreccion(params.id, body, request.user.id);
    return reply.send({ ok: true });
  });
}
