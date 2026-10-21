import {listCreativeProjects,getCreativeProjectDetail,getCreativeProjectConcept} from '../helpers/creativePortfolio.js';
import {listCreativeWork} from '../helpers/creativeInbox.js';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { direccionesCreativas, fichaDisenoPropuestas, proyectos } from '../db/schema/index.js';
import {
  agregarConceptoPortada,
  aprobarConceptoRrpp,
  asignarLiderCreativo,
  cerrarDireccionCreativa,
  listarMisDireccionesCreativas,
  listarPropuestasDeDireccionCreativa,
  listarPropuestasPendientesRrpp,
  registrarBrief,
  registrarBriefAutor,
  registrarConceptoAutor,
  registrarRecursosCreativos,
  registrarReunionCreativa,
  verificarAccesoADireccionCreativa,
} from '../helpers/direccionCreativa.js';
import { parseOrReply } from '../helpers/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import {CreativeError,getCreativeActivity,getCreativeDashboard,getCreativeWorkDetail} from '../helpers/creativeLeader.js';
import {deliverCreativeConcepts,reviseCreativeConcept} from '../helpers/creativeLeaderCommands.js';
import {obtenerEspecialistaActual} from '../helpers/carga.js';

const idParamSchema = z.object({ id: z.string().uuid() });
const propuestaParamSchema = z.object({ propuestaId: z.string().uuid() });

const asignarSchema = z.object({ liderCreativoId: z.string().uuid() });
const webUrl=z.string().trim().url().max(2000).refine(v=>{const u=new URL(v);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;},'Utiliza un enlace web.');

const reunionSchema = z.object({
  fecha: z.string().nullable().optional(),
  realizada: z.boolean().optional(),
  enlaceGrabacion: z.string().nullable().optional(),
});

const briefSchema = z.object({
  briefEnlace: webUrl.nullable().optional(),
  fechaBriefEnviadoEspecialista: z.string().nullable().optional(),
}).strict();

const briefAutorSchema = z.object({
  fechaBriefEnviadoAutor: z.string().nullable().optional(),
  fechaBriefAprobadoAutor: z.string().nullable().optional(),
  feedback:z.string().trim().min(1).max(5000).optional(),
}).strict().refine(v=>!v.feedback||!v.fechaBriefAprobadoAutor,'Registra feedback o aprobación, por separado.');

const conceptoSchema = z.object({
  descripcion: z.string().nullable().optional(),
  enlace: z.string().nullable().optional(),
});

const rrppSchema = z.object({
  aprobar: z.boolean(),
  observaciones: z.string().nullable().optional(),
});

const conceptoAutorSchema = z.object({
  fechaEnviadaAutor: z.string().nullable().optional(),
  fechaAprobadaAutor: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  feedback:z.string().trim().min(1).max(5000).optional(),
}).strict().refine(v=>!v.feedback||!v.fechaAprobadaAutor,'Registra feedback o aprobación, por separado.');

const recursosSchema = z.object({
  recursoImagenUrl: webUrl.nullable().optional(),
  recursoConceptoPdfUrl: webUrl.nullable().optional(),
}).strict();

const cierreSchema = z.object({
  resultadoFinal: z.enum(['aprobado', 'rechazado']),
  observaciones: z.string().nullable().optional(),
});

// Ownership de una propuesta puntual (Especialista dueño del proyecto
// al que pertenece, vía direccion_creativa — mismo criterio de
// verificarAccesoADireccionCreativa pero resuelto desde el lado de la
// propuesta, que es el recurso real de estas dos rutas).
async function verificarAccesoAPropuesta(
  propuestaId: string,
  usuario: { id: string; rol: string },
): Promise<{ ok: true } | { ok: false; status: 403 | 404; error: string }> {
  const [fila] = await db
    .select({ especialistaId: proyectos.especialistaId,projectId:proyectos.id })
    .from(fichaDisenoPropuestas)
    .innerJoin(direccionesCreativas, eq(fichaDisenoPropuestas.direccionCreativaId, direccionesCreativas.id))
    .innerJoin(proyectos, eq(direccionesCreativas.proyectoId, proyectos.id))
    .where(eq(fichaDisenoPropuestas.id, propuestaId))
    .limit(1);

  if (!fila) return { ok: false, status: 404, error: 'Concepto de portada no encontrado' };
  if (usuario.rol === 'jefe_area') return { ok: true };
  if (usuario.rol === 'especialista' && await obtenerEspecialistaActual(fila.projectId,fila.especialistaId) === usuario.id) return { ok: true };
  return { ok: false, status: 403, error: 'No autorizado para este concepto de portada' };
}

export async function direccionCreativaRoutes(app: FastifyInstance) {
  app.setErrorHandler((error,_req,reply)=>{
    if(error instanceof CreativeError)return reply.code(error.status).send({error:error.message});
    if(error instanceof z.ZodError)return reply.code(400).send({error:'Revisa los datos de la entrega creativa.'});
    const known=error as {statusCode?:number;message?:string};
    if(known.statusCode&&known.statusCode<500)return reply.code(known.statusCode).send({error:known.message});
    app.log.error(error);return reply.code(500).send({error:'No se pudo completar la operación creativa.'});
  });
  const leader=[requireAuth,requireRole('lider_creativo')];
  app.get('/inicio',{preHandler:leader},async req=>getCreativeDashboard(req.user!.id,new Date(),z.object({orden:z.enum(['accion','fecha']).optional()}).parse(req.query).orden));
  app.get('/mi-trabajo',{preHandler:leader},async req=>{
    const filters=z.object({tipo:z.enum(['BRIEF','CONCEPT','RESOURCES','COVER_REVIEW']).optional(),
      estado:z.enum(['Pendiente','En curso','Requiere ajustes','Esperando RRPP','Esperando autor','Esperando Diseño','Esperando Especialista','Completada','Bloqueada']).optional(),
      servicio:z.string().uuid().optional(),fecha:z.enum(['hoy','semana','proximos','vencidos','sin-fecha']).optional(),search:z.string().trim().max(200).optional(),
      alcance:z.enum(['activas','todas','completadas']).optional(),orden:z.enum(['accion','fecha']).optional(),
      pagina:z.coerce.number().int().min(1).max(100000).optional(),pageSize:z.coerce.number().refine(n=>[10,25,50].includes(n)).optional()}).strict().parse(req.query);
    return listCreativeWork(req.user!.id,filters);
  });
  const portfolioProject=z.object({projectId:z.string().uuid()});
  const portfolioContext=z.object({process:z.string().uuid().optional()}).strict();
  app.get('/proyectos',{preHandler:leader},async req=>{
    const filters=z.object({search:z.string().trim().max(200).optional(),service:z.string().uuid().optional(),
      creativeState:z.enum(['MEETING','BRIEF','CONCEPTS','RESOURCES','COVER','COMPLETED','BLOCKED']).optional(),specialist:z.string().uuid().optional(),
      scope:z.enum(['active','all','completed']).optional(),sort:z.enum(['attention','activity','title']).optional(),
      page:z.coerce.number().int().min(1).max(100000).optional(),pageSize:z.coerce.number().refine(n=>[10,25,50].includes(n)).optional()}).strict().parse(req.query);
    return listCreativeProjects(req.user!.id,filters);
  });
  app.get('/proyectos/:projectId',{preHandler:leader},async req=>getCreativeProjectDetail(portfolioProject.parse(req.params).projectId,req.user!.id,portfolioContext.parse(req.query).process));
  app.get('/proyectos/:projectId/conceptos/:conceptId',{preHandler:leader},async req=>{
    const params=portfolioProject.extend({conceptId:z.string().uuid()}).parse(req.params);
    return getCreativeProjectConcept(params.projectId,params.conceptId,req.user!.id,portfolioContext.parse(req.query).process);
  });
  app.get('/inicio/actividad',{preHandler:leader},async req=>({items:await getCreativeActivity(req.user!.id)}));
  app.get('/:id/operacion',{preHandler:leader},async req=>getCreativeWorkDetail(idParamSchema.parse(req.params).id,req.user!.id));
  const conceptInput=z.object({descripcion:z.string().trim().min(1).max(3000),enlace:webUrl}).strict();
  app.post('/:id/conceptos/entregar',{preHandler:leader},async req=>{
    const p=idParamSchema.parse(req.params),b=z.object({conceptos:z.array(conceptInput).min(2).max(3).refine(items=>new Set(items.map(i=>JSON.stringify(i))).size===items.length,'Cada concepto debe ser distinto.')}).strict().parse(req.body);
    return deliverCreativeConcepts(p.id,b.conceptos,req.user!.id);
  });
  app.patch('/:id/conceptos/:conceptId',{preHandler:leader},async req=>{
    const p=idParamSchema.extend({conceptId:z.string().uuid()}).parse(req.params);
    return reviseCreativeConcept(p.id,p.conceptId,conceptInput.parse(req.body),req.user!.id);
  });
  app.addHook('preHandler', async (request, reply) => {
    if (request.method === 'GET') return;
    await requireAuth(request, reply);
    if (reply.sent) return;
    const params = request.params as { id?: string };
    if (!params.id || !z.string().uuid().safeParse(params.id).success) return;
    const [dc] = await db.select().from(direccionesCreativas).where(eq(direccionesCreativas.id, params.id));
    if (dc?.tipo === 'revision_cubierta' && !request.url.endsWith('/asignar')) {
      return reply.code(403).send({ error: 'Las revisiones de cubierta se resuelven mediante Diseño, por versión y responsable' });
    }
  });
  // "¿Qué necesita mi atención hoy?" (master prompt 5C §24).
  app.get('/mias', { preHandler: [requireAuth, requireRole('lider_creativo')] }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'No autenticado' });
    const trabajos = await listarMisDireccionesCreativas(request.user.id);
    return reply.send({ trabajos });
  });

  // "PENDIENTE DE APROBACIÓN CREATIVA" (master prompt 5C §12/§27) —
  // bandeja propia de RRPP, separada de su intake inicial.
  app.get('/pendientes-rrpp', { preHandler: [requireAuth, requireRole('rrpp')] }, async (_request, reply) => {
    const propuestas = await listarPropuestasPendientesRrpp();
    return reply.send({ propuestas });
  });

  // Asignación (master prompt 5C §6): jefe_area asigna a cualquiera, un
  // lider_creativo solo puede auto-asignarse (reclamar la solicitud),
  // nunca asignar a otro.
  app.patch(
    '/:id/asignar',
    { preHandler: [requireAuth, requireRole('jefe_area', 'lider_creativo')] },
    async (request, reply) => {
      const params = parseOrReply(idParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(asignarSchema, request.body, reply);
      if (!body) return;
      if (!request.user) return reply.code(401).send({ error: 'No autenticado' });

      if (request.user.rol === 'lider_creativo' && body.liderCreativoId !== request.user.id) {
        return reply.code(403).send({ error: 'Un líder creativo solo puede auto-asignarse, no asignar a otro' });
      }

      const resultado = await asignarLiderCreativo(params.id, body.liderCreativoId, request.user.id);
      if (!resultado.ok) return reply.code(resultado.status).send({ error: resultado.error });
      return reply.send({ ok: true });
    },
  );

  app.get('/:id/propuestas', { preHandler: [requireAuth, requireRole('jefe_area', 'especialista', 'lider_creativo')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;
    if (!request.user) return reply.code(401).send({ error: 'No autenticado' });

    const acceso = await verificarAccesoADireccionCreativa(params.id, request.user);
    if (!acceso.ok) return reply.code(acceso.status).send({ error: acceso.error });

    const propuestas = await listarPropuestasDeDireccionCreativa(params.id);
    return reply.send({ propuestas });
  });

  app.patch(
    '/:id/reunion',
    { preHandler: [requireAuth, requireRole('lider_creativo')] },
    async (request, reply) => {
      const params = parseOrReply(idParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(reunionSchema, request.body, reply);
      if (!body) return;
      if (!request.user) return reply.code(401).send({ error: 'No autenticado' });

      const acceso = await verificarAccesoADireccionCreativa(params.id, request.user);
      if (!acceso.ok) return reply.code(acceso.status).send({ error: acceso.error });

      await registrarReunionCreativa(params.id, body, request.user.id);
      return reply.send({ ok: true });
    },
  );

  app.patch('/:id/brief', { preHandler: [requireAuth, requireRole('lider_creativo')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOrReply(briefSchema, request.body, reply);
    if (!body) return;
    if (!request.user) return reply.code(401).send({ error: 'No autenticado' });

    const acceso = await verificarAccesoADireccionCreativa(params.id, request.user);
    if (!acceso.ok) return reply.code(acceso.status).send({ error: acceso.error });

    await registrarBrief(params.id, body, request.user.id);
    return reply.send({ ok: true });
  });

  // Autor sin Portal (5C §13): el Especialista registra envío/aprobación
  // del brief en su nombre.
  app.patch('/:id/brief-autor', { preHandler: [requireAuth, requireRole('especialista')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOrReply(briefAutorSchema, request.body, reply);
    if (!body) return;
    if (!request.user) return reply.code(401).send({ error: 'No autenticado' });

    const acceso = await verificarAccesoADireccionCreativa(params.id, request.user);
    if (!acceso.ok) return reply.code(acceso.status).send({ error: acceso.error });

    await registrarBriefAutor(params.id, body, request.user.id);
    return reply.send({ ok: true });
  });

  // GATE-08 adentro (brief aprobado requerido).
  app.post('/:id/propuestas', { preHandler: [requireAuth, requireRole('lider_creativo')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOrReply(conceptoSchema, request.body, reply);
    if (!body) return;
    if (!request.user) return reply.code(401).send({ error: 'No autenticado' });

    const acceso = await verificarAccesoADireccionCreativa(params.id, request.user);
    if (!acceso.ok) return reply.code(acceso.status).send({ error: acceso.error });

    const resultado = await agregarConceptoPortada(params.id, body, request.user.id);
    if (!resultado.ok) return reply.code(resultado.status).send({ error: resultado.error });
    return reply.code(201).send({ id: resultado.id });
  });

  // Flujo confirmado: Líder Creativo -> conceptos -> RRPP -> Autor.
  // Exclusivo de RRPP — nunca el líder creativo ni el especialista.
  app.patch('/propuestas/:propuestaId/rrpp', { preHandler: [requireAuth, requireRole('rrpp')] }, async (request, reply) => {
    const params = parseOrReply(propuestaParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOrReply(rrppSchema, request.body, reply);
    if (!body) return;
    if (!request.user) return reply.code(401).send({ error: 'No autenticado' });

    const resultado = await aprobarConceptoRrpp(params.propuestaId, body, request.user.id);
    if (!resultado.ok) return reply.code(resultado.status).send({ error: resultado.error });
    return reply.send({ ok: true });
  });

  // GATE-05 adentro (RRPP debe haber aprobado antes de enviar al autor)
  // — reusado, no reimplementado. Autor sin Portal: Especialista
  // registra en su nombre.
  app.patch('/propuestas/:propuestaId/autor', { preHandler: [requireAuth, requireRole('especialista')] }, async (request, reply) => {
    const params = parseOrReply(propuestaParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOrReply(conceptoAutorSchema, request.body, reply);
    if (!body) return;
    if (!request.user) return reply.code(401).send({ error: 'No autenticado' });

    const acceso = await verificarAccesoAPropuesta(params.propuestaId, request.user);
    if (!acceso.ok) return reply.code(acceso.status).send({ error: acceso.error });

    const resultado = await registrarConceptoAutor(params.propuestaId, body, request.user.id);
    if (!resultado.ok) return reply.code(resultado.status).send({ error: resultado.error });
    return reply.send({ ok: true });
  });

  app.patch('/:id/recursos', { preHandler: [requireAuth, requireRole('lider_creativo')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOrReply(recursosSchema, request.body, reply);
    if (!body) return;
    if (!request.user) return reply.code(401).send({ error: 'No autenticado' });

    const acceso = await verificarAccesoADireccionCreativa(params.id, request.user);
    if (!acceso.ok) return reply.code(acceso.status).send({ error: acceso.error });

    const resultado = await registrarRecursosCreativos(params.id, body, request.user.id);
    if (!resultado.ok) return reply.code(resultado.status).send({ error: resultado.error });
    return reply.send({ ok: true });
  });

  app.patch('/:id/cerrar', { preHandler: [requireAuth, requireRole('especialista')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOrReply(cierreSchema, request.body, reply);
    if (!body) return;
    if (!request.user) return reply.code(401).send({ error: 'No autenticado' });

    const acceso = await verificarAccesoADireccionCreativa(params.id, request.user);
    if (!acceso.ok) return reply.code(acceso.status).send({ error: acceso.error });

    await cerrarDireccionCreativa(params.id, body, request.user.id);
    return reply.send({ ok: true });
  });
}
