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
import { getCorrectorDashboard } from '../helpers/correctorHome.js';
import { listarMiTrabajoCorrector, obtenerDetalleTrabajoCorrector, registrarEntregaCorrectorConArchivos, reportarBloqueoCorreccion } from '../helpers/correctorWork.js';
import { listCorreccionDriveFiles } from '../helpers/correccionDrive.js';

const idParamSchema = z.object({ id: z.string().uuid() });

// `revisionPreviaConfirmada` YA NO se acepta acá (Jefatura · Decisiones,
// docs/arquitectura/17-jefatura-decisiones.md) -- ese booleano ahora
// solo lo escribe resolverDecision() al aprobar la revisión previa.
const asignarCorrectorSchema = z.object({
  correctorId: z.string().uuid().nullable().optional(),
  correctorNombre: z.string().min(1).nullable().optional(),
  freelance: z.boolean(),
  contratoConfirmado: z.boolean(),
}).strict();

const fechaSchema = z.object({ fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), motivo: z.string().trim().min(10).max(500).optional() }).strict();

const entregaSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  motivo: z.string().trim().min(10).max(500).optional(),
  entregadoEn: z.string().datetime({ offset: true }).refine((s) => new Date(s).getTime() <= Date.now(), 'La entrega no puede estar en el futuro').optional(),
  controlCambiosUrl: z.string().nullable().optional(),
  informeTecnicoUrl: z.string().nullable().optional(),
}).strict();

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

  return { ok: false, status: 403, error: 'No autorizado para esta corrección' };
}

const workItemParamSchema = z.object({ workItemId: z.string().uuid() });
const miTrabajoFiltersSchema = z.object({
  tab: z.enum(['active', 'completed', 'all']).default('active'), search: z.string().max(150).default(''),
  status: z.enum(['asignada', 'en_correccion', 'bloqueada', 'completada']).optional(),
  scope: z.string().max(80).optional(), project: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1), pageSize: z.coerce.number().int().refine(n => [10, 25, 50].includes(n)).default(10),
}).strict();

export async function correccionesRoutes(app: FastifyInstance) {
  const corrector = { preHandler: [requireAuth, requireRole('corrector')] };
  app.get('/inicio', corrector, async (request, reply) => {
    if (!parseOrReply(z.object({}).strict(), request.query, reply)) return;
    return getCorrectorDashboard(request.user!.id);
  });
  // "Mi trabajo" del Corrector (master prompt dedicado, Mi trabajo): UNA
  // FILA = UNA INTERVENCIÓN DE CORRECCIÓN, scoped por assignment vigente
  // (listarMiTrabajoCorrector reutiliza listarMisCorrecciones, ya
  // acotado por cuenta -- ver server/helpers/correctorWork.ts).
  app.get('/mi-trabajo', corrector, async (request, reply) => {
    const f = parseOrReply(miTrabajoFiltersSchema, request.query, reply); if (!f) return;
    return listarMiTrabajoCorrector(request.user!.id, { ...f, tab: f.tab ?? 'active', search: f.search ?? '', page: f.page ?? 1, pageSize: f.pageSize ?? 10 });
  });
  app.get('/mi-trabajo/:workItemId', corrector, async (request, reply) => {
    const p = parseOrReply(workItemParamSchema, request.params, reply); if (!p) return;
    const detail = await obtenerDetalleTrabajoCorrector(p.workItemId, request.user!.id);
    if (!detail) return reply.code(404).send({ error: 'Corrección no disponible para tu cuenta' });
    return detail;
  });
  app.get('/mi-trabajo/:workItemId/archivos', corrector, async (request, reply) => {
    const p = parseOrReply(workItemParamSchema, request.params, reply), f = parseOrReply(z.object({ folderKey: z.string().max(80), pageToken: z.string().max(2000).optional() }), request.query, reply);
    if (!p || !f) return;
    return listCorreccionDriveFiles(p.workItemId, request.user!.id, f.folderKey, f.pageToken);
  });
  app.patch('/mi-trabajo/:workItemId/entrega', corrector, async (request, reply) => {
    const p = parseOrReply(workItemParamSchema, request.params, reply);
    const body = parseOrReply(z.object({ tripaUrl: z.string().trim().url().max(2000), reportUrl: z.string().trim().url().max(2000), observaciones: z.string().trim().max(1000).optional() }).strict(), request.body, reply);
    if (!p || !body) return;
    const delivery = await registrarEntregaCorrectorConArchivos(p.workItemId, request.user!.id, { tripaUrl: body.tripaUrl, reportUrl: body.reportUrl, observaciones: body.observaciones });
    return { ok: true, deliveryId: delivery.id };
  });
  app.post('/mi-trabajo/:workItemId/bloqueo', corrector, async (request, reply) => {
    const p = parseOrReply(workItemParamSchema, request.params, reply), body = parseOrReply(z.object({ reason: z.string().trim().min(5).max(1000) }).strict(), request.body, reply);
    if (!p || !body) return;
    const blocker = await reportarBloqueoCorreccion(p.workItemId, body.reason, request.user!.id);
    return { ok: true, blockerId: blocker.id };
  });
  // "Mis Correcciones" (master prompt §19) — solo correctores con
  // cuenta de sistema llegan acá (ver rol 'corrector' en ROLES).
  app.get('/mias', { preHandler: [requireAuth, requireRole('corrector')] }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'No autenticado' });
    const query = parseOrReply(z.object({workItem:z.string().uuid().optional()}).strict(), request.query, reply);
    if (!query) return;
    const trabajos = await listarMisCorrecciones(request.user.id);
    const selected = query.workItem ? trabajos.filter(t=>t.workItemId===query.workItem) : trabajos;
    if (query.workItem && !selected.length) return reply.code(404).send({error:'Corrección no disponible para tu cuenta'});
    return reply.send({ trabajos:selected });
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
    { preHandler: [requireAuth, requireRole('corrector', 'especialista')] },
    async (request, reply) => {
      const params = parseOrReply(idParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(fechaSchema, request.body, reply);
      if (!body) return;
      if (!request.user) return reply.code(401).send({ error: 'No autenticado' });

      const acceso = await verificarAccesoAEjecucion(params.id, request.user);
      if (!acceso.ok) return reply.code(acceso.status).send({ error: acceso.error });

      const diaActual = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      if (body.fecha && body.fecha !== diaActual && !body.motivo) return reply.code(400).send({error:'El registro manual de una fecha histórica requiere motivo'});
      if (body.fecha && (isNaN(Date.parse(body.fecha)) || new Date(body.fecha).toISOString().slice(0,10) !== body.fecha || body.fecha > diaActual)) return reply.code(400).send({error:'Inicio inválido o futuro'});

      await marcarInicioCorreccion(params.id, body.fecha, request.user.id, body.motivo);
      return reply.send({ ok: true });
    },
  );

  app.patch(
    '/:id/entrega',
    { preHandler: [requireAuth, requireRole('corrector', 'especialista')] },
    async (request, reply) => {
      const params = parseOrReply(idParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(entregaSchema, request.body, reply);
      if (!body) return;
      if (!request.user) return reply.code(401).send({ error: 'No autenticado' });

      const acceso = await verificarAccesoAEjecucion(params.id, request.user);
      if (!acceso.ok) return reply.code(acceso.status).send({ error: acceso.error });

      const diaActual = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      if ((body.entregadoEn || body.fecha && body.fecha !== diaActual) && !body.motivo) return reply.code(400).send({error:'El registro manual de tiempos requiere motivo'});
      if (body.fecha && (isNaN(Date.parse(body.fecha)) || new Date(body.fecha).toISOString().slice(0,10)!==body.fecha || body.fecha>diaActual)) return reply.code(400).send({error:'Entrega inválida o futura'});
      if (body.fecha && body.entregadoEn && new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(body.entregadoEn))!==body.fecha) return reply.code(400).send({error:'La fecha y el instante de entrega no coinciden'});
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
