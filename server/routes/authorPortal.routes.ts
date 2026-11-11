import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { approvalRequests, authorDocuments, autores, capitulos, direccionesCreativas, disenos, disenoVersiones, fichaDisenoPropuestas, notificaciones, proyectosAutores, workItems } from '../db/schema/index.js';
import { env } from '../config/env.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { APPROVAL_TYPES, AuthorPortalError, authorPauseRequest, authorProjects, createApproval, decideApproval, ensure, portalApprovals, portalAudit, portalDocuments, portalProject, portalRequests, resolvePauseRequest } from '../helpers/authorPortal.js';
import { authorDocument, revokeAuthorDocument, shareAuthorDocument } from '../helpers/authorDocuments.js';
import { consumeAuthorToken, inviteAuthor, requestAuthorReset } from '../helpers/authorAccounts.js';
import { withCorporateDrive } from '../modules/integrations/google-drive/corporate.js';
import { manualAuthorReminder } from '../helpers/authorMail.js';
import { cancelApproval } from '../helpers/authorPortal.js';
const id=z.string().uuid(),text=z.string().trim().min(1).max(5000);
const decision=z.object({decision:z.enum(['approved','changes_requested']),feedback:z.string().trim().max(20000).optional()}).strict();
const external=decision.extend({external:z.object({channel:z.enum(['correo','whatsapp','otro']),receivedAt:z.string().datetime({offset:true}),evidence:text,reason:z.string().trim().min(10).max(5000)}).strict()}).strict();
const creation=z.object({authorId:id,type:z.enum(APPROVAL_TYPES),originId:id,title:z.string().trim().min(3).max(200),instructions:text,documentIds:z.array(id).min(1).max(20),dueAt:z.string().datetime({offset:true}).optional(),previousId:id.optional()}).strict();
export async function authorPortalRoutes(app:FastifyInstance){
  app.addHook('onSend',async(_req,reply,payload)=>{reply.header('Cache-Control','no-store');return payload;});
  app.addHook('preHandler',async(req,reply)=>{if(!['GET','HEAD'].includes(req.method)&&req.headers.origin&&req.headers.origin!==new URL(env.APP_FRONTEND_URL).origin)return reply.code(403).send({error:'Origen no autorizado'});});
  app.setErrorHandler((error,_req,reply)=>{
    if(error instanceof AuthorPortalError)return reply.code(error.status).send({error:error.message});
    if(error instanceof z.ZodError)return reply.code(400).send({error:'Revisa los datos del formulario',details:error.flatten()});
    if((error as {code?:string}).code==='23505')return reply.code(409).send({error:'La operación ya fue registrada'});
    return reply.code(503).send({error:'No se pudo completar la operación. Inténtalo de nuevo.'});
  });
  // Public credential operations never register or claim a project. Rate limit
  // per process plus hashed, expiring, single-use tokens; responses hide email existence.
  const attempts=new Map<string,{n:number;until:number}>();
  const limited=async(req:import('fastify').FastifyRequest,reply:import('fastify').FastifyReply)=>{const now=Date.now();for(const [k,v]of attempts)if(v.until<now)attempts.delete(k);const a=attempts.get(req.ip)??{n:0,until:now+15*60000};a.n++;attempts.set(req.ip,a);if(a.n>10)return reply.code(429).send({error:'Espera unos minutos antes de intentarlo de nuevo'});};
  app.post('/credentials/reset',{preHandler:limited},async req=>{const b=z.object({email:z.string().email().max(254)}).strict().parse(req.body);return requestAuthorReset(b.email);});
  app.post('/credentials/activate',{preHandler:limited},async req=>{const b=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),password:z.string().min(12).max(200)}).strict().parse(req.body);return consumeAuthorToken(b.token,b.password);});
  const author=[requireAuth,requireRole('autor')],staff=[requireAuth,requireRole('especialista','jefe_area')];
  app.get('/projects',{preHandler:author},async req=>({projects:await authorProjects(req.user!)}));
  app.get('/projects/:id',{preHandler:author},async req=>{
    const projectId=id.parse((req.params as {id:string}).id);await portalProject(projectId,req.user!);
    const [approvals,documents,requests,projects]=await Promise.all([portalApprovals(req.user!,projectId),portalDocuments(req.user!,projectId),portalRequests(req.user!,projectId),authorProjects(req.user!)]);
    return {project:projects.find(p=>p.id===projectId),approvals,documents,requests};
  });
  app.get('/approvals',{preHandler:author},async req=>({approvals:await portalApprovals(req.user!)}));
  app.get('/approvals/:id',{preHandler:author},async req=>{const requestId=id.parse((req.params as {id:string}).id);const approvals=await portalApprovals(req.user!);const approval=approvals.find(a=>a.id===requestId);ensure(approval,'Aprobación no encontrada',404);return {approval,history:approvals.filter(a=>a.projectId===approval.projectId&&a.type===approval.type&&a.id!==approval.id&&a.id===approval.previousId)};});
  app.post('/approvals/:id/decision',{preHandler:author},async req=>decideApproval(id.parse((req.params as {id:string}).id),decision.parse(req.body),req.user!));
  app.get('/documents',{preHandler:author},async req=>({documents:await portalDocuments(req.user!)}));
  app.get('/documents/:id/content',{preHandler:author},async(req,reply)=>{
    const d=await authorDocument(id.parse((req.params as {id:string}).id),req.user!);
    const content=await withCorporateDrive(async({storage})=>{ensure(storage.readAuthorRevision,'La revisión no está disponible');return storage.readAuthorRevision(d.driveFileId,d.revisionId);});
    // Recheck after remote IO so a revoked release cannot slip through.
    await authorDocument(d.id,req.user!);
    await db.transaction(tx=>portalAudit(tx,req.user!.id,d.projectId,'AUTOR_DOCUMENTO_CONSULTADO',d.id,{revisionId:d.revisionId}));
    reply.header('X-Content-Type-Options','nosniff').header('Content-Security-Policy',"sandbox; default-src 'none'").header('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(d.title+(d.mimeType==='application/pdf'?'.pdf':''))}`);
    return reply.type(d.mimeType).send(content);
  });
  app.get('/requests',{preHandler:author},async req=>({requests:await portalRequests(req.user!)}));
  app.post('/projects/:id/pause-requests',{preHandler:author},async(req,reply)=>{const b=z.object({reason:z.string().trim().min(5).max(200),start:z.string().datetime({offset:true}),returnDate:z.string().datetime({offset:true}).optional(),comment:z.string().trim().max(5000).optional(),requestKey:id}).strict().parse(req.body);return reply.code(201).send(await authorPauseRequest(id.parse((req.params as {id:string}).id),b,req.user!));});
  app.get('/notifications',{preHandler:author},async req=>({notifications:await db.select({id:notificaciones.id,message:notificaciones.mensaje,path:notificaciones.targetPath,read:notificaciones.leido,createdAt:notificaciones.createdAt}).from(notificaciones).where(and(eq(notificaciones.usuarioDestinoId,req.user!.id),eq(notificaciones.rolDestino,'autor'))).orderBy(sql`${notificaciones.createdAt} DESC`).limit(200)}));
  app.post('/notifications/:id/read',{preHandler:author},async req=>{const [r]=await db.update(notificaciones).set({leido:true}).where(and(eq(notificaciones.id,id.parse((req.params as {id:string}).id)),eq(notificaciones.usuarioDestinoId,req.user!.id),eq(notificaciones.rolDestino,'autor'))).returning({id:notificaciones.id});ensure(r,'Notificación no encontrada',404);return {ok:true};});

  app.get('/internal/projects/:id',{preHandler:staff},async req=>{
    const projectId=id.parse((req.params as {id:string}).id),p=await portalProject(projectId,req.user!);
    const authors=await db.select({id:autores.id,name:autores.nombre,emails:autores.email}).from(proyectosAutores).innerJoin(autores,eq(autores.id,proyectosAutores.autorId)).where(eq(proyectosAutores.proyectoId,projectId));
    if(!authors.some(a=>a.id===p.autorId)){const [a]=await db.select({id:autores.id,name:autores.nombre,emails:autores.email}).from(autores).where(eq(autores.id,p.autorId));if(a)authors.push(a);}
    const documents=await db.select({id:authorDocuments.id,title:authorDocuments.title,version:authorDocuments.version,authorId:authorDocuments.authorId,revokedAt:authorDocuments.revokedAt}).from(authorDocuments).where(eq(authorDocuments.projectId,projectId));
    const origins:{id:string;type:string;label:string}[]=[];
    for(const c of await db.select().from(capitulos).where(eq(capitulos.proyectoId,projectId)))if(c.fechaEntregaEditor)origins.push({id:c.id,type:'capitulo',label:`Capítulo ${c.numero}`});
    for(const c of await db.select().from(direccionesCreativas).where(and(eq(direccionesCreativas.proyectoId,projectId),isNull(direccionesCreativas.fechaCierre)))){
      if(c.briefEnlace&&c.fechaBriefEnviadoEspecialista&&!c.fechaBriefAprobadoAutor)origins.push({id:c.id,type:'brief_creativo',label:'Brief Creativo'});
      for(const proposal of await db.select().from(fichaDisenoPropuestas).where(eq(fichaDisenoPropuestas.direccionCreativaId,c.id)))if(proposal.fechaAprobadaRrpp&&!proposal.fechaAprobadaAutor)origins.push({id:proposal.id,type:'concepto_portada',label:`Concepto de portada`});
    }
    for(const {v,d}of await db.select({v:disenoVersiones,d:disenos}).from(disenoVersiones).innerJoin(disenos,eq(disenos.id,disenoVersiones.disenoId)).where(eq(disenos.proyectoId,projectId)))if(!v.aprobadaAutorEn&&!v.feedbackEn)origins.push({id:v.id,type:d.tipo==='diagramacion'?'version_validada':d.tipo,label:`${d.tipo.replaceAll('_',' ')} V${v.numero}`});
    for(const w of await db.select().from(workItems).where(and(eq(workItems.proyectoId,projectId),eq(workItems.tipo,'edicion'))))if(w.businessKey==='default')for(const type of ['estructura','tripa_completa','kit_editorial'])origins.push({id:w.id,type,label:type.replaceAll('_',' ')});
    const approvals=await portalApprovals(req.user!,projectId);
    const responses=approvals.filter(a=>['approved','changes_requested'].includes(a.status)&&a.decidedAt).map(a=>Math.max(0,(new Date(a.decidedAt!).getTime()-new Date(a.requestedAt).getTime())/3600000));
    return {authors,documents,origins,approvals,requests:await portalRequests(req.user!,projectId),responseMetrics:{pending:approvals.filter(a=>a.status==='pending').length,overdue:approvals.filter(a=>a.status==='pending'&&a.overdueDays>0).length,averageCalendarHours:responses.length?Math.round(responses.reduce((a,b)=>a+b,0)/responses.length*10)/10:null}};
  });
  app.post('/internal/projects/:id/invite',{preHandler:staff},async req=>inviteAuthor(id.parse((req.params as {id:string}).id),z.object({authorId:id,email:z.string().email().max(254)}).strict().parse(req.body),req.user!));
  app.post('/internal/projects/:id/documents',{preHandler:staff},async(req,reply)=>reply.code(201).send(await shareAuthorDocument(id.parse((req.params as {id:string}).id),z.object({authorId:id,driveFileId:z.string().regex(/^[\w-]{5,200}$/),title:z.string().trim().min(3).max(200),version:z.string().trim().min(1).max(50),category:z.enum(['compartido','entregable_final'])}).strict().parse(req.body),req.user!)));
  app.post('/internal/documents/:id/revoke',{preHandler:staff},async req=>revokeAuthorDocument(id.parse((req.params as {id:string}).id),req.user!));
  app.post('/internal/projects/:id/approvals',{preHandler:staff},async(req,reply)=>reply.code(201).send({id:(await createApproval(id.parse((req.params as {id:string}).id),creation.parse(req.body),req.user!)).id}));
  app.post('/internal/approvals/:id/external-decision',{preHandler:staff},async req=>{const b=external.parse(req.body);ensure(new Date(b.external.receivedAt)<=new Date(),'La fecha no puede estar en el futuro',400);return decideApproval(id.parse((req.params as {id:string}).id),b,req.user!);});
  app.post('/internal/approvals/:id/remind',{preHandler:staff},async req=>manualAuthorReminder(id.parse((req.params as {id:string}).id),req.user!));
  app.post('/internal/approvals/:id/cancel',{preHandler:staff},async req=>cancelApproval(id.parse((req.params as {id:string}).id),z.object({reason:z.string().trim().min(5).max(5000)}).strict().parse(req.body).reason,req.user!));
  app.post('/internal/requests/:id/resolve',{preHandler:staff},async req=>resolvePauseRequest(id.parse((req.params as {id:string}).id),z.object({approve:z.boolean(),reason:z.string().trim().min(5).max(5000),effectiveStart:z.string().datetime({offset:true}).optional(),formal:z.boolean().optional(),paymentConfirmed:z.boolean().optional(),returnLimit:z.string().date().optional()}).strict().parse(req.body),req.user!));
}
