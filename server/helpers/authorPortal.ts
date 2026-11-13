import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { approvalArtifacts, approvalRequests, authorDocuments, authorMailOutbox, auditLogs, capitulos, direccionesCreativas, disenos, disenoVersiones, editorialDeliveries, fichaCalidadFases, fichaDisenoPropuestas, fichasTrazabilidad, notificaciones, pausas, projectAssignments, proyectos, proyectosAutores, servicios, solicitudesArea, users, workItems } from '../db/schema/index.js';
import type { AuthenticatedUser } from './session.js';
import type { Tx } from './tx.js';
import { especialistaActualSql, obtenerEspecialistaActual } from './carga.js';
import { diaCaracas } from './atencionEspecialista.js';
import { requestAuthorFinalReview } from './authorFinalReview.js';
import { queueExternalDesignNotice } from './designExternalMail.js';
import { sincronizarCapituloEditorial } from './editorialInterventions.js';
import { calcularFechaPautadaFeedbackCapitulo, calcularFechaPautadaFeedbackTripa } from './edicionSla.js';
import { habilitarPlanificacionRrpp } from './rrppLanzamientoGate.js';

export const APPROVAL_TYPES = ['estructura','capitulo','tripa_completa','kit_editorial','brief_creativo','concepto_portada','muestra_diagramacion','cubierta_extendida','version_validada','aprobacion_final','otro_entregable'] as const;
export type ApprovalType = typeof APPROVAL_TYPES[number];
export class AuthorPortalError extends Error { constructor(public status:number,message:string){super(message);} }
export function ensure(value:unknown,message:string,status=409):asserts value {if(!value)throw new AuthorPortalError(status,message);}
export const authorScope=(authorId:string)=>or(eq(proyectos.autorId,authorId),sql`EXISTS (SELECT 1 FROM proyectos_autores pa WHERE pa.proyecto_id=${proyectos.id} AND pa.autor_id=${authorId})`);
export async function portalProject(projectId:string,actor:AuthenticatedUser,client:Tx|typeof db=db,lock=false){
  const query=client.select().from(proyectos).where(eq(proyectos.id,projectId));
  const [p]=await (lock?query.for('update'):query);
  ensure(p,'Proyecto no encontrado',404);
  if(actor.rol==='autor'){
    ensure(actor.autorId,'La cuenta no está vinculada a un autor',403);
    const [owned]=await client.select({id:proyectos.id}).from(proyectos).where(and(eq(proyectos.id,projectId),authorScope(actor.autorId)));
    ensure(owned,'Proyecto no encontrado',404);
  }else{
    ensure(['especialista','jefe_area'].includes(actor.rol),'Acceso no autorizado',403);
    if(actor.rol==='especialista')ensure(await obtenerEspecialistaActual(p.id,p.especialistaId,client)===actor.id,'Proyecto no encontrado',404);
  }
  return p;
}
export async function portalAudit(tx:Tx,actorId:string|null,projectId:string|null,action:string,entityId:string,details?:unknown){
  await tx.insert(auditLogs).values({actorId,proyectoId:projectId,accion:action,entityType:'author_portal',entityId,detalles:details});
}
export async function authorNotice(tx:Tx,authorId:string,projectId:string,message:string,path:string,key:string){
  const [u]=await tx.select({id:users.id}).from(users).where(and(eq(users.autorId,authorId),eq(users.rol,'autor')));
  if(!u)return;
  const [notice]=await tx.insert(notificaciones).values({proyectoId:projectId,rolDestino:'autor',usuarioDestinoId:u.id,mensaje:message,targetPath:path}).returning({id:notificaciones.id});
  await tx.insert(authorMailOutbox).values({key,userId:u.id,projectId,subject:'PanHouse · '+message,message,path}).onConflictDoNothing();
  await portalAudit(tx,null,projectId,'AUTOR_NOTIFICACION_CREADA',notice!.id);
}
async function specialistNotice(tx:Tx,p:typeof proyectos.$inferSelect,message:string){
  const id=await obtenerEspecialistaActual(p.id,p.especialistaId,tx);
  if(id)await tx.insert(notificaciones).values({proyectoId:p.id,rolDestino:'especialista',usuarioDestinoId:id,mensaje:message,targetPath:`/proyectos/${p.id}/operacion`});
}
export const PORTAL_STAGES=['Ingreso','Producción de contenido','Corrección','Diseño','Validación editorial','Preparación final','Publicación'];
export async function authorProjects(actor:AuthenticatedUser){
  ensure(actor.rol==='autor'&&actor.autorId,'Acceso no autorizado',403);
  const rows=await db.select({id:proyectos.id,title:proyectos.titulo,service:servicios.nombre,serviceCode:servicios.codigo,
    startDate:proyectos.fechaRealInicio,plannedStart:proyectos.fechaProgramadaInicio,estimatedDate:proyectos.fechaFinProyectada,
    state:proyectos.estado,specialist:users.nombre,activePause:sql<boolean>`EXISTS (SELECT 1 FROM pausas pa WHERE pa.proyecto_id=${proyectos.id} AND pa.fecha_fin IS NULL AND pa.fecha_inicio<=now())`,edicion:fichasTrazabilidad.edicionEstatus,correccion:fichasTrazabilidad.correccionEstatus,diseno:fichasTrazabilidad.disenoEstatus,calidad:fichasTrazabilidad.calidadEstatus,
    workStage:sql<string|null>`(SELECT CASE WHEN wi.tipo='calidad' AND EXISTS(SELECT 1 FROM ficha_calidad_fases q WHERE q.work_item_id=wi.id AND q.numero_fase>=3) THEN 'preparacion_final' ELSE wi.tipo END FROM work_items wi WHERE wi.proyecto_id=${proyectos.id} AND wi.tipo IN ('edicion','correccion','diseno','calidad','lanzamiento','impresion','distribucion') AND wi.estado IN ('en_progreso','bloqueado','pendiente') ORDER BY CASE wi.tipo WHEN 'edicion' THEN 1 WHEN 'correccion' THEN 2 WHEN 'diseno' THEN 3 WHEN 'calidad' THEN 4 ELSE 5 END, wi.created_at LIMIT 1)`})
    .from(proyectos).innerJoin(servicios,eq(proyectos.servicioId,servicios.id)).leftJoin(users,eq(users.id,especialistaActualSql)).leftJoin(fichasTrazabilidad,eq(fichasTrazabilidad.proyectoId,proyectos.id)).where(authorScope(actor.autorId)).orderBy(desc(proyectos.createdAt));
  return rows.map(({edicion,correccion,diseno,calidad,workStage,state,activePause,...p})=>{
    const stage=state==='culminado'?6:workStage?({edicion:1,correccion:2,diseno:3,calidad:4,preparacion_final:5,lanzamiento:6,impresion:5,distribucion:6}[workStage]??0):calidad?4:diseno?3:correccion?2:edicion?1:0;
    return {...p,estimatedDate:state==='pausado'||activePause?null:p.estimatedDate,stage,stageLabel:PORTAL_STAGES[stage],status:state==='pausado'||activePause?'En pausa':state==='stand_by'?'En espera':state==='retirado'?'Cerrado':state==='culminado'?'Publicado':'En curso',nextMilestone:PORTAL_STAGES[Math.min(stage+1,6)]};
  });
}
export async function portalDocuments(actor:AuthenticatedUser,projectId?:string){
  ensure(actor.autorId&&actor.rol==='autor','Acceso no autorizado',403);
  if(projectId)await portalProject(projectId,actor);
  return db.select({id:authorDocuments.id,projectId:authorDocuments.projectId,title:authorDocuments.title,version:authorDocuments.version,category:authorDocuments.category,sharedAt:authorDocuments.sharedAt,approved:sql<boolean>`EXISTS(SELECT 1 FROM approval_artifacts aa JOIN approval_requests ar ON ar.id=aa.approval_id WHERE aa.document_id=${authorDocuments.id} AND ar.status='approved')`})
    .from(authorDocuments).innerJoin(proyectos,eq(proyectos.id,authorDocuments.projectId)).where(and(eq(authorDocuments.authorId,actor.autorId),authorScope(actor.autorId),isNull(authorDocuments.revokedAt),projectId?eq(authorDocuments.projectId,projectId):undefined)).orderBy(desc(authorDocuments.sharedAt));
}
export async function portalApprovals(actor:AuthenticatedUser,projectId?:string){
  if(projectId)await portalProject(projectId,actor);
  else ensure(actor.rol==='autor'&&actor.autorId,'Acceso no autorizado',403);
  const rows=await db.select({id:approvalRequests.id,projectId:approvalRequests.projectId,projectTitle:proyectos.titulo,type:approvalRequests.type,title:approvalRequests.title,instructions:approvalRequests.instructions,requestedAt:approvalRequests.requestedAt,dueAt:approvalRequests.dueAt,status:approvalRequests.status,feedback:approvalRequests.feedback,decidedAt:approvalRequests.decidedAt,previousId:approvalRequests.previousId,sentBy:users.nombre,external:sql<boolean>`${approvalRequests.externalEvidence} IS NOT NULL`})
    .from(approvalRequests).innerJoin(proyectos,eq(proyectos.id,approvalRequests.projectId)).innerJoin(users,eq(users.id,approvalRequests.requestedBy))
    .where(and(projectId?eq(approvalRequests.projectId,projectId):undefined,actor.rol==='autor'?and(eq(approvalRequests.authorId,actor.autorId!),authorScope(actor.autorId!)):undefined)).orderBy(desc(approvalRequests.requestedAt));
  return Promise.all(rows.map(async r=>({...r,overdueDays:r.status==='pending'&&r.dueAt?Math.max(0,Math.ceil((Date.now()-r.dueAt.getTime())/86400000)):0,
    documents:await db.select({id:authorDocuments.id,title:authorDocuments.title,version:authorDocuments.version,available:sql<boolean>`${authorDocuments.revokedAt} IS NULL`}).from(approvalArtifacts).innerJoin(authorDocuments,eq(authorDocuments.id,approvalArtifacts.documentId)).where(eq(approvalArtifacts.approvalId,r.id))})));
}

// Resolve a real domain origin and its current work item. Clients cannot choose
// which employee receives feedback, or inject arbitrary next workflow states.
async function resolveOrigin(tx:Tx,p:typeof proyectos.$inferSelect,type:ApprovalType,id:string){
  if(['brief_creativo','concepto_portada'].includes(type)){
    const proposal=type==='concepto_portada'?(await tx.select().from(fichaDisenoPropuestas).where(eq(fichaDisenoPropuestas.id,id)))[0]:null;
    const [c]=await tx.select().from(direccionesCreativas).where(eq(direccionesCreativas.id,proposal?.direccionCreativaId??id));
    ensure(c&&c.proyectoId===p.id&&!c.fechaCierre,'Intervención creativa no disponible');
    ensure(type==='brief_creativo'?c.briefEnlace&&c.fechaBriefEnviadoEspecialista&&!c.fechaBriefAprobadoAutor:proposal?.fechaAprobadaRrpp&&!proposal.fechaAprobadaAutor,'El entregable no está liberado para el Autor');
    return {workItemId:c.workItemId,url:type==='brief_creativo'?c.briefEnlace:proposal?.enlace};
  }
  if(['muestra_diagramacion','cubierta_extendida','version_validada','aprobacion_final'].includes(type)){
    const [v]=await tx.select().from(disenoVersiones).where(eq(disenoVersiones.id,id));
    const [d]=v?await tx.select().from(disenos).where(eq(disenos.id,v.disenoId)):[];
    ensure(v&&d&&d.proyectoId===p.id&&!v.feedbackEn&&!v.aprobadaAutorEn,'Versión no disponible');
    const [latest]=await tx.select({id:disenoVersiones.id}).from(disenoVersiones).where(eq(disenoVersiones.disenoId,d.id)).orderBy(desc(disenoVersiones.numero)).limit(1);
    ensure(latest?.id===v.id,'Existe una versión posterior');
    if(type==='muestra_diagramacion')ensure(d.tipo==='muestra_diagramacion','Tipo de diseño incorrecto');
    else if(type==='cubierta_extendida'){
      const [creative]=v.revisionCreativaId?await tx.select().from(direccionesCreativas).where(eq(direccionesCreativas.id,v.revisionCreativaId)):[];
      ensure(d.tipo==='cubierta_extendida'&&v.aprobadaInternaEn&&creative?.resultadoFinal==='aprobado','La cubierta requiere revisión interna y creativa');
    }else{
      const [q]=await tx.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.id,v.calidadFaseId!));
      ensure(d.tipo==='diagramacion'&&q?.aprobado&&q.revisadoEn&&q.numeroFase<=2,'Se requiere validación de Calidad');
    }
    return {workItemId:d.workItemId,url:v.enlace};
  }
  if(type==='capitulo'){
    const [c]=await tx.select().from(capitulos).where(eq(capitulos.id,id));
    ensure(c?.proyectoId===p.id&&c.fechaEntregaEditor,'El capítulo aún no se ha entregado');
    const [wi]=await tx.select().from(workItems).where(and(eq(workItems.proyectoId,p.id),eq(workItems.businessKey,`capitulo:${id}`)));
    // Older chapter work items use their numeric business key; fall back to the
    // canonical editorial work item only when no chapter instance exists.
    const [ed]=wi?[]:await tx.select().from(workItems).where(and(eq(workItems.proyectoId,p.id),eq(workItems.tipo,'edicion'))).limit(1);
    ensure(wi??ed,'No existe trabajo editorial');
    const [delivery]=await tx.select().from(editorialDeliveries).where(eq(editorialDeliveries.workItemId,(wi??ed)!.id)).orderBy(desc(editorialDeliveries.submittedAt)).limit(1);
    return {workItemId:(wi??ed)!.id,url:delivery?.driveUrl??null};
  }
  const [wi]=await tx.select().from(workItems).where(and(eq(workItems.id,id),eq(workItems.proyectoId,p.id)));
  ensure(wi&&wi.tipo==='edicion'&&!['cancelado','completado'].includes(wi.estado),'Trabajo editorial no disponible');
  return {workItemId:wi.id,url:null};
}
export interface CreateApproval {authorId:string;type:ApprovalType;originId:string;title:string;instructions:string;documentIds:string[];dueAt?:string;previousId?:string}
export async function createApproval(projectId:string,input:CreateApproval,actor:AuthenticatedUser){
  ensure(['especialista','jefe_area'].includes(actor.rol),'Acceso no autorizado',403);
  return db.transaction(async tx=>{
    const p=await portalProject(projectId,actor,tx,true);
    ensure(!['culminado','retirado','pausado'].includes(p.estado),'Proyecto no disponible');
    const [owner]=await tx.select({id:proyectos.id}).from(proyectos).where(and(eq(proyectos.id,p.id),authorScope(input.authorId)));
    ensure(owner,'El destinatario no pertenece al proyecto',400);
    const [account]=await tx.select({id:users.id}).from(users).where(and(eq(users.autorId,input.authorId),eq(users.rol,'autor')));
    ensure(account,'Invita al Autor antes de solicitar una decisión',400);
    const [service]=await tx.select().from(servicios).where(eq(servicios.id,p.servicioId));
    if(input.type==='capitulo')ensure(['EF','EEC','EET'].includes(service?.codigo??''),'Este servicio no tiene aprobación de capítulos',400);
    if(input.type==='estructura')ensure(service?.codigo==='EF','La estructura corresponde a Escritura Fantasma',400);
    const origin=await resolveOrigin(tx,p,input.type,input.originId);
    const [originWork]=await tx.select().from(workItems).where(eq(workItems.id,origin.workItemId));
    ensure(originWork&&(!originWork.gateBloqueante||originWork.gateBloqueante==='ESPERANDO_AUTOR'),'Resuelve el bloqueo interno antes de solicitar al Autor');
    const [existing]=await tx.select({id:approvalRequests.id}).from(approvalRequests).where(and(eq(approvalRequests.projectId,p.id),eq(approvalRequests.originId,input.originId),eq(approvalRequests.status,'pending')));
    ensure(!existing,'Ya existe una solicitud pendiente para este entregable');
    const documents=await tx.select().from(authorDocuments).where(inArray(authorDocuments.id,input.documentIds));
    ensure(input.documentIds.length>0&&documents.length===new Set(input.documentIds).size&&documents.every(d=>d.projectId===p.id&&d.authorId===input.authorId&&!d.revokedAt),'Documentos no autorizados',400);
    if(origin.url){const match=/\/(?:d|file\/d)\/([^/?#]+)/.exec(origin.url)?.[1]??new URL(origin.url).searchParams.get('id');ensure(documents.some(d=>d.driveFileId===match),'El documento no corresponde al entregable canónico',400);}
    if(input.previousId){
      const [prev]=await tx.select().from(approvalRequests).where(eq(approvalRequests.id,input.previousId));ensure(prev&&prev.projectId===p.id&&prev.authorId===input.authorId&&prev.type===input.type&&['changes_requested','cancelled'].includes(prev.status),'Versión anterior inválida',400);
      if(['muestra_diagramacion','cubierta_extendida','version_validada','aprobacion_final'].includes(input.type)){
        const versions=await tx.select().from(disenoVersiones).where(inArray(disenoVersiones.id,[prev.originId,input.originId]));ensure(versions.length===2&&versions[0]!.disenoId===versions[1]!.disenoId,'Las versiones pertenecen a entregables distintos',400);
      }else if(input.type==='concepto_portada'){
        const proposals=await tx.select().from(fichaDisenoPropuestas).where(inArray(fichaDisenoPropuestas.id,[prev.originId,input.originId]));ensure(proposals.every(v=>v.direccionCreativaId===proposals[0]?.direccionCreativaId),'Los conceptos pertenecen a intervenciones distintas',400);
      }else ensure(prev.originId===input.originId,'La aprobación anterior pertenece a otro entregable',400);
      const old=await tx.select({file:authorDocuments.driveFileId,revision:authorDocuments.revisionId}).from(approvalArtifacts).innerJoin(authorDocuments,eq(authorDocuments.id,approvalArtifacts.documentId)).where(eq(approvalArtifacts.approvalId,prev.id));
      ensure(documents.some(d=>!old.some(o=>o.file===d.driveFileId&&o.revision===d.revisionId)),'Comparte una revisión nueva para solicitar otra decisión',400);
    }
    const today=diaCaracas(new Date());
    const defaultDue=input.type==='capitulo'?calcularFechaPautadaFeedbackCapitulo(today):input.type==='tripa_completa'?calcularFechaPautadaFeedbackTripa(today):null;
    const dueAt=input.dueAt?new Date(input.dueAt):defaultDue?new Date(defaultDue+'T23:59:59-04:00'):null;
    if(input.type==='brief_creativo')await tx.update(direccionesCreativas).set({fechaBriefEnviadoAutor:today}).where(eq(direccionesCreativas.id,input.originId));
    else if(input.type==='concepto_portada')await tx.update(fichaDisenoPropuestas).set({fechaEnviadaAutor:today,estado:'Enviada al autor'}).where(eq(fichaDisenoPropuestas.id,input.originId));
    else if(['muestra_diagramacion','cubierta_extendida','version_validada','aprobacion_final'].includes(input.type))await tx.update(disenoVersiones).set({enviadaAutorEn:new Date(),feedbackAutorDueAt:dueAt}).where(eq(disenoVersiones.id,input.originId));
    else if(input.type==='capitulo')await tx.update(capitulos).set({fechaEnvioAutor:today,fechaPautadaFeedback:dueAt?diaCaracas(dueAt):null}).where(eq(capitulos.id,input.originId));
    const id=randomUUID();const [wait]=await tx.insert(workItems).values({proyectoId:p.id,tipo:'aprobacion_autor',businessKey:id,estado:'bloqueado',gateBloqueante:'ESPERANDO_AUTOR',observaciones:input.title}).returning();
    const [request]=await tx.insert(approvalRequests).values({id,projectId:p.id,authorId:input.authorId,type:input.type,title:input.title,instructions:input.instructions,originId:input.originId,originWorkItemId:origin.workItemId,waitWorkItemId:wait!.id,requestedBy:actor.id,dueAt,previousId:input.previousId}).returning();
    await tx.insert(approvalArtifacts).values(documents.map(d=>({approvalId:id,documentId:d.id})));
    await tx.update(workItems).set({estado:'bloqueado',gateBloqueante:'ESPERANDO_AUTOR'}).where(and(eq(workItems.id,origin.workItemId),or(isNull(workItems.gateBloqueante),eq(workItems.gateBloqueante,'ESPERANDO_AUTOR'))));
    const deadline=dueAt?` Respuesta recomendada: ${dueAt.toLocaleDateString('es-VE',{timeZone:'America/Caracas'})}.`:'';
    await authorNotice(tx,input.authorId,p.id,`${input.previousId?'Nueva versión disponible':'Nueva aprobación pendiente'}: ${input.title}.${deadline}`,`/autor/aprobaciones/${id}`,`approval:${id}`);
    await portalAudit(tx,actor.id,p.id,'APROBACION_AUTOR_CREADA',id,{type:input.type,documents:documents.map(d=>({id:d.id,revision:d.revisionId}))});
    return request!;
  });
}

async function applyDomainDecision(tx:Tx,r:typeof approvalRequests.$inferSelect,p:typeof proyectos.$inferSelect,approved:boolean,feedback:string|null,now:Date){
  const today=diaCaracas(now);
  if(r.type==='brief_creativo')await tx.update(direccionesCreativas).set(approved?{fechaBriefAprobadoAutor:today,briefFeedback:null}:{briefFeedback:feedback,briefFeedbackAt:now}).where(eq(direccionesCreativas.id,r.originId));
  else if(r.type==='concepto_portada')await tx.update(fichaDisenoPropuestas).set(approved?{fechaAprobadaAutor:today,estado:'Aprobada por autor'}:{feedbackAutor:feedback,estado:'Feedback del autor'}).where(eq(fichaDisenoPropuestas.id,r.originId));
  else if(['muestra_diagramacion','cubierta_extendida','version_validada','aprobacion_final'].includes(r.type)){
    const [v]=await tx.update(disenoVersiones).set(approved?{aprobadaAutorEn:now}:{feedback,feedbackEn:now}).where(eq(disenoVersiones.id,r.originId)).returning();
    ensure(v,'Versión no encontrada');
    if(approved&&['muestra_diagramacion','cubierta_extendida'].includes(r.type))await tx.update(disenos).set({cerradoEn:now}).where(eq(disenos.id,v.disenoId));
    if(approved&&['version_validada','aprobacion_final'].includes(r.type)){
      const [quality]=await tx.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.id,v.calidadFaseId!));
      ensure(quality?.aprobado,'La versión requiere validación editorial');
      await requestAuthorFinalReview(tx,quality,v,p.id);
    }
    if(!approved){
      const [design]=await tx.update(disenos).set({cerradoEn:null}).where(eq(disenos.id,v.disenoId)).returning();
      if(design)await queueExternalDesignNotice(tx,design,v,p.tituloDefinitivo??p.codigo,`Observaciones del Autor: ${feedback??''}`);
    }
  }else if(r.type==='capitulo'){
    await tx.update(capitulos).set({fechaRespuestaReal:approved?null:today}).where(eq(capitulos.id,r.originId));
    if(!approved)await sincronizarCapituloEditorial(tx,r.originId,'autor',false,true);
  }
  else if(r.type==='tripa_completa'&&approved){
    await tx.update(proyectos).set({fechaFeedbackTripa:today}).where(eq(proyectos.id,p.id));
    await habilitarPlanificacionRrpp(tx,p.id,r.recordedBy??r.requestedBy);
  }
  const targets=r.type==='brief_creativo'||r.type==='concepto_portada'?['lider_creativo']:['muestra_diagramacion','cubierta_extendida','version_validada','aprobacion_final'].includes(r.type)?['disenador']:['editor'];
  const assignments=await tx.select({userId:projectAssignments.usuarioId,role:projectAssignments.tipo}).from(projectAssignments).where(and(eq(projectAssignments.proyectoId,p.id),isNull(projectAssignments.finalizadoEn),or(eq(projectAssignments.workItemId,r.originWorkItemId),isNull(projectAssignments.workItemId))));
  if(!approved||targets[0]==='lider_creativo')for(const a of assignments.filter(a=>targets.includes(a.role)))await tx.insert(notificaciones).values({proyectoId:p.id,rolDestino:a.role,usuarioDestinoId:a.userId,mensaje:approved?'El Autor aprobó el entregable. Continúa con el siguiente paso.':'Hay observaciones del Autor para aplicar. Coordina con el Especialista.',targetPath:`/proyectos/${p.id}`});
  if(!approved&&targets[0]==='disenador'&&p.disenadorId&&!assignments.some(a=>a.userId===p.disenadorId))await tx.insert(notificaciones).values({proyectoId:p.id,rolDestino:'disenador',usuarioDestinoId:p.disenadorId,mensaje:'Hay observaciones del Autor. Coordina los ajustes con el Especialista.'});
  if(!approved&&targets[0]==='editor'&&p.editorId&&!assignments.some(a=>a.role==='editor')){
    const [history]=await tx.select({id:projectAssignments.id}).from(projectAssignments).where(and(eq(projectAssignments.proyectoId,p.id),eq(projectAssignments.tipo,'editor'))).limit(1);
    if(!history)await tx.insert(notificaciones).values({proyectoId:p.id,rolDestino:'editor',usuarioDestinoId:p.editorId,mensaje:'Hay observaciones del Autor para aplicar. Coordina con el Especialista.'});
  }
}
export async function decideApproval(id:string,input:{decision:'approved'|'changes_requested';feedback?:string;external?:{channel:string;receivedAt:string;evidence:string;reason:string}},actor:AuthenticatedUser){
  ensure(input.decision==='approved'||input.decision==='changes_requested','Decisión inválida',400);
  ensure(input.decision!=='changes_requested'||input.feedback?.trim(),'Explica los cambios solicitados',400);
  return db.transaction(async tx=>{
    const [initial]=await tx.select().from(approvalRequests).where(eq(approvalRequests.id,id));ensure(initial,'Aprobación no encontrada',404);
    const p=await portalProject(initial.projectId,actor,tx,true);
    const [r]=await tx.select().from(approvalRequests).where(eq(approvalRequests.id,id));ensure(r,'Aprobación no encontrada',404);
    if(actor.rol==='autor')ensure(r.authorId===actor.autorId&&!input.external,'Aprobación no encontrada',404);
    else ensure(input.external&&['especialista','jefe_area'].includes(actor.rol),'La decisión externa requiere evidencia',400);
    ensure(r.status==='pending','Esta decisión ya está registrada');
    const [revoked]=await tx.select({id:authorDocuments.id}).from(approvalArtifacts).innerJoin(authorDocuments,eq(authorDocuments.id,approvalArtifacts.documentId)).where(and(eq(approvalArtifacts.approvalId,id),sql`${authorDocuments.revokedAt} IS NOT NULL`));
    ensure(!revoked,'Un documento fue retirado. Contacta a tu Especialista.');
    await resolveOriginForDecision(tx,r,p);
    const now=new Date(),effectiveAt=input.external?new Date(input.external.receivedAt):now,approved=input.decision==='approved',feedback=input.feedback?.trim()||null;
    await tx.update(approvalRequests).set({status:input.decision,feedback,decidedAt:effectiveAt,recordedBy:actor.id,externalEvidence:input.external??null}).where(eq(approvalRequests.id,id));
    await applyDomainDecision(tx,{...r,recordedBy:actor.id},p,approved,feedback,effectiveAt);
    await tx.update(workItems).set({estado:'completado',gateBloqueante:null,fechaFinReal:diaCaracas(now)}).where(eq(workItems.id,r.waitWorkItemId));
    const [pending]=await tx.select({id:approvalRequests.id}).from(approvalRequests).where(and(eq(approvalRequests.originWorkItemId,r.originWorkItemId),eq(approvalRequests.status,'pending')));
    if(!pending)await tx.update(workItems).set({estado:approved&&['capitulo','tripa_completa','muestra_diagramacion','cubierta_extendida'].includes(r.type)?'completado':'en_progreso',gateBloqueante:null,...(!approved?{fechaFinReal:null}:{} )}).where(and(eq(workItems.id,r.originWorkItemId),eq(workItems.gateBloqueante,'ESPERANDO_AUTOR')));
    await specialistNotice(tx,p,approved?`El Autor aprobó: ${r.title}.`:`El Autor solicitó cambios: ${r.title}.`);
    await authorNotice(tx,r.authorId,p.id,approved?'Tu aprobación fue registrada.':'Tu feedback fue recibido.',`/autor/aprobaciones/${id}`,`decision:${id}`);
    await portalAudit(tx,actor.id,p.id,input.external?'DECISION_AUTOR_EXTERNA_REGISTRADA':approved?'APROBACION_AUTOR_EMITIDA':'AUTOR_CAMBIOS_SOLICITADOS',id,{decision:input.decision,feedback,external:input.external??null,waitingSeconds:Math.max(0,(effectiveAt.getTime()-r.requestedAt.getTime())/1000),lateSeconds:r.dueAt?Math.max(0,(effectiveAt.getTime()-r.dueAt.getTime())/1000):0,recordingDelaySeconds:Math.max(0,(now.getTime()-effectiveAt.getTime())/1000)});
    return {ok:true};
  });
}
export async function cancelApprovalInTransaction(tx:Tx,r:typeof approvalRequests.$inferSelect,reason:string,actor:AuthenticatedUser){
  ensure(['especialista','jefe_area'].includes(actor.rol),'Acceso no autorizado',403);ensure(r.status==='pending','La solicitud ya está resuelta');ensure(reason.trim().length>=5,'Explica por qué retiras la solicitud',400);
  await tx.update(approvalRequests).set({status:'cancelled',feedback:reason,decidedAt:new Date(),recordedBy:actor.id}).where(eq(approvalRequests.id,r.id));
  await tx.update(workItems).set({estado:'cancelado',gateBloqueante:null}).where(eq(workItems.id,r.waitWorkItemId));
  const [other]=await tx.select({id:approvalRequests.id}).from(approvalRequests).where(and(eq(approvalRequests.originWorkItemId,r.originWorkItemId),eq(approvalRequests.status,'pending')));
  if(!other)await tx.update(workItems).set({estado:'en_progreso',gateBloqueante:null}).where(and(eq(workItems.id,r.originWorkItemId),eq(workItems.gateBloqueante,'ESPERANDO_AUTOR')));
  await authorNotice(tx,r.authorId,r.projectId,`Tu equipo retiró la solicitud: ${r.title}.`,`/autor/aprobaciones/${r.id}`,`cancelled:${r.id}`);
  await portalAudit(tx,actor.id,r.projectId,'APROBACION_AUTOR_RETIRADA',r.id,{reason});
}
export async function cancelApproval(id:string,reason:string,actor:AuthenticatedUser){
  return db.transaction(async tx=>{const [initial]=await tx.select().from(approvalRequests).where(eq(approvalRequests.id,id));ensure(initial,'Solicitud no encontrada',404);await portalProject(initial.projectId,actor,tx,true);const [r]=await tx.select().from(approvalRequests).where(eq(approvalRequests.id,id));await cancelApprovalInTransaction(tx,r!,reason,actor);return {ok:true};});
}
async function resolveOriginForDecision(tx:Tx,r:typeof approvalRequests.$inferSelect,p:typeof proyectos.$inferSelect){
  // Revalidate current versions / gates at commit time; cannot approve an
  // obsolete design or a creative deliverable withdrawn since publication.
  if(['brief_creativo','concepto_portada','muestra_diagramacion','cubierta_extendida','version_validada','aprobacion_final'].includes(r.type))await resolveOrigin(tx,p,r.type as ApprovalType,r.originId);
}
export async function authorPauseRequest(projectId:string,input:{reason:string;start:string;returnDate?:string;comment?:string;requestKey:string},actor:AuthenticatedUser){
  ensure(actor.rol==='autor'&&actor.autorId,'Acceso no autorizado',403);
  ensure(!input.returnDate||new Date(input.returnDate)>new Date(input.start),'El regreso debe ser posterior al inicio',400);
  return db.transaction(async tx=>{
    const p=await portalProject(projectId,actor,tx,true);
    const [retry]=await tx.select().from(solicitudesArea).where(and(eq(solicitudesArea.proyectoId,p.id),eq(solicitudesArea.tipo,'autor_pausa'),eq(solicitudesArea.businessKey,input.requestKey)));
    if(retry){ensure(retry.requestedById===actor.id,'Solicitud no encontrada',404);return {id:retry.id};}
    const [active]=await tx.select().from(solicitudesArea).where(and(eq(solicitudesArea.proyectoId,p.id),eq(solicitudesArea.tipo,'autor_pausa'),eq(solicitudesArea.estado,'pendiente')));ensure(!active,'Ya existe una solicitud de pausa pendiente');
    ensure(!['culminado','retirado','pausado'].includes(p.estado),'El proyecto no admite una pausa');
    const [r]=await tx.insert(solicitudesArea).values({proyectoId:p.id,tipo:'autor_pausa',businessKey:input.requestKey,requestedById:actor.id,targetUserId:await obtenerEspecialistaActual(p.id,p.especialistaId,tx),asunto:input.reason,descripcion:input.comment,desiredStart:new Date(input.start),expectedReturn:input.returnDate?new Date(input.returnDate):null}).returning();
    await specialistNotice(tx,p,'El Autor solicitó una pausa del proyecto.');
    if(!await obtenerEspecialistaActual(p.id,p.especialistaId,tx))await tx.insert(notificaciones).values({proyectoId:p.id,rolDestino:'jefe_area',mensaje:'Solicitud de pausa del Autor pendiente de revisión.',targetPath:`/proyectos/${p.id}/operacion`});
    await authorNotice(tx,actor.autorId!,p.id,'Recibimos tu solicitud de pausa.',`/autor/solicitudes`,`pause-request:${r!.id}`);
    await portalAudit(tx,actor.id,p.id,'AUTOR_PAUSA_SOLICITADA',r!.id);return {id:r!.id};
  });
}
export async function portalRequests(actor:AuthenticatedUser,projectId?:string){
  if(projectId)await portalProject(projectId,actor);else ensure(actor.rol==='autor','Acceso no autorizado',403);
  return db.select({id:solicitudesArea.id,projectId:solicitudesArea.proyectoId,reason:solicitudesArea.asunto,comment:solicitudesArea.descripcion,status:solicitudesArea.estado,requestedAt:solicitudesArea.requestedAt,start:solicitudesArea.desiredStart,returnDate:solicitudesArea.expectedReturn,response:solicitudesArea.motivo,resolvedAt:solicitudesArea.resolvedAt,pausedAt:pausas.fechaInicio,resumedAt:pausas.fechaFin})
    .from(solicitudesArea).innerJoin(proyectos,eq(proyectos.id,solicitudesArea.proyectoId)).leftJoin(pausas,eq(pausas.id,solicitudesArea.pausaId)).where(and(eq(solicitudesArea.tipo,'autor_pausa'),projectId?eq(solicitudesArea.proyectoId,projectId):undefined,actor.rol==='autor'?and(eq(solicitudesArea.requestedById,actor.id),authorScope(actor.autorId!)):undefined)).orderBy(desc(solicitudesArea.requestedAt));
}
export async function resolvePauseRequest(id:string,input:{approve:boolean;reason:string;effectiveStart?:string;formal?:boolean;paymentConfirmed?:boolean;returnLimit?:string},actor:AuthenticatedUser){
  ensure(['especialista','jefe_area'].includes(actor.rol),'Acceso no autorizado',403);
  return db.transaction(async tx=>{
    const [r]=await tx.select().from(solicitudesArea).where(and(eq(solicitudesArea.id,id),eq(solicitudesArea.tipo,'autor_pausa')));ensure(r,'Solicitud no encontrada',404);
    const p=await portalProject(r.proyectoId,actor,tx,true);
    const [fresh]=await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id,id));ensure(fresh?.estado==='pendiente','La solicitud ya fue resuelta');
    let pauseId:string|undefined;
    if(input.approve){
      ensure(!input.formal||actor.rol==='jefe_area'&&input.paymentConfirmed,'Pausa formal requiere Jefatura y pago confirmado',403);
      ensure(!['culminado','retirado','pausado'].includes(p.estado),'El proyecto no admite pausa');
      const now=new Date();ensure(!input.effectiveStart||new Date(input.effectiveStart)<=now,'La pausa efectiva no puede comenzar en el futuro',400);
      const [pause]=await tx.insert(pausas).values({proyectoId:p.id,causa:'autor',responsableId:actor.id,fechaInicio:input.effectiveStart?new Date(input.effectiveStart):now,esPausadoFormal:!!input.formal,pagoConfirmado:!!input.paymentConfirmed,origenConfirmacionPago:input.paymentConfirmed?'manual':null,confirmadoPagoPorId:input.paymentConfirmed?actor.id:null,confirmadoPagoEn:input.paymentConfirmed?now:null,fechaLimiteRetoma:input.returnLimit}).returning();pauseId=pause!.id;
      await tx.update(proyectos).set({estado:input.formal?'pausado':'retrasado'}).where(eq(proyectos.id,p.id));
    }
    await tx.update(solicitudesArea).set({estado:input.approve?'resuelta':'rechazada',resolvedAt:new Date(),resolvedById:actor.id,motivo:input.reason,outcome:input.approve?'pausa_aprobada':'pausa_rechazada',pausaId:pauseId}).where(eq(solicitudesArea.id,id));
    const [requester]=await tx.select({authorId:users.autorId}).from(users).where(eq(users.id,r.requestedById!));
    if(requester?.authorId)await authorNotice(tx,requester.authorId,p.id,input.approve?'Tu solicitud de pausa fue aprobada.':'Tu solicitud de pausa fue rechazada.','/autor/solicitudes',`pause-result:${id}`);
    await portalAudit(tx,actor.id,p.id,input.approve?'AUTOR_PAUSA_APROBADA':'AUTOR_PAUSA_RECHAZADA',id,{reason:input.reason,pauseId});return {ok:true};
  });
}
