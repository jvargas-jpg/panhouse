import {and,eq,isNull} from 'drizzle-orm';
import {db} from '../db/client.js';
import {direccionesCreativas,fichaDisenoPropuestas,fichasTrazabilidad,notificaciones,projectAssignments,proyectos,workItems} from '../db/schema/index.js';
import type {Tx} from './tx.js';
import {CreativeError} from './creativeLeader.js';
import {registrarEvento} from './auditLog.js';
import {evaluarGateBriefAprobadoParaConceptos} from './gates.js';
import {obtenerEspecialistaActual} from './carga.js';

export async function lockCreativeForLeader(tx:Tx,id:string,userId:string,allowCompleted=false){
  const [initial]=await tx.select().from(direccionesCreativas).where(eq(direccionesCreativas.id,id));
  if(!initial)throw new CreativeError(404,'Trabajo creativo no encontrado.');
  const [p]=await tx.select().from(proyectos).where(eq(proyectos.id,initial.proyectoId)).for('update');
  const [dc]=await tx.select().from(direccionesCreativas).where(eq(direccionesCreativas.id,id));
  const [assignment]=await tx.select().from(projectAssignments).where(and(eq(projectAssignments.workItemId,initial.workItemId),eq(projectAssignments.tipo,'lider_creativo'),isNull(projectAssignments.finalizadoEn)));
  if(assignment?.usuarioId!==userId)throw new CreativeError(403,'Este trabajo pertenece a otro Líder Creativo.');
  const [wi]=await tx.select().from(workItems).where(eq(workItems.id,initial.workItemId));
  if(!dc||!p||['culminado','retirado'].includes(p.estado)||dc.tipo!=='concepto_portada'||!wi||wi.estado==='cancelado'||!allowCompleted&&(!!dc.fechaCierre||wi.estado==='completado'))throw new CreativeError(409,'Esta intervención ya no admite entregas creativas.');
  return dc;
}
export async function deliverCreativeConcepts(id:string,concepts:{descripcion:string;enlace:string}[],userId:string){
  if(concepts.length<2||concepts.length>3)throw new CreativeError(400,'Entrega de 2 a 3 conceptos de portada.');
  return db.transaction(async tx=>{
    const dc=await lockCreativeForLeader(tx,id,userId);
    const gate=evaluarGateBriefAprobadoParaConceptos(dc);if(!gate.desbloqueado)throw new CreativeError(400,gate.motivo!);
    const existing=await tx.select().from(fichaDisenoPropuestas).where(eq(fichaDisenoPropuestas.direccionCreativaId,id)).orderBy(fichaDisenoPropuestas.createdAt,fichaDisenoPropuestas.id);
    // Old versions published one proposal without a draft state. Let an
    // undecided legacy proposal join the required batch, preserving its ID.
    const legacyUndecided=existing.length<2&&existing.every(c=>!c.fechaAprobadaRrpp&&!c.fechaEnviadaAutor&&!c.fechaAprobadaAutor&&!c.feedbackAutor&&!c.feedbackRrpp&&c.estado!=='Devuelta por RRPP'&&c.estado!=='Feedback del autor');
    if(existing.some(c=>c.estado!=='Borrador')&&!legacyUndecided){
      if(existing.length===concepts.length&&existing.every(c=>concepts.some(input=>c.enlace===input.enlace&&c.descripcion===input.descripcion)))return {ids:concepts.map(input=>existing.find(c=>c.enlace===input.enlace&&c.descripcion===input.descripcion)!.id)};
      throw new CreativeError(409,'Los conceptos ya se entregaron. Usa la revisión del concepto que requiere ajustes.');
    }
    const [ficha]=await tx.select().from(fichasTrazabilidad).where(eq(fichasTrazabilidad.proyectoId,dc.proyectoId));
    if(!ficha)throw new CreativeError(409,'Falta el expediente editorial del proyecto.');
    if(existing.length>concepts.length)throw new CreativeError(409,'Conserva todos los conceptos guardados.');
    const ids=[];
    for(let index=0;index<concepts.length;index++){
      const current=existing[index];
      if(current){await tx.update(fichaDisenoPropuestas).set({...concepts[index]!,estado:'Pendiente RRPP'}).where(eq(fichaDisenoPropuestas.id,current.id));ids.push(current.id);}
      else{const [c]=await tx.insert(fichaDisenoPropuestas).values({fichaId:ficha.id,direccionCreativaId:id,...concepts[index]!,estado:'Pendiente RRPP'}).returning();ids.push(c!.id);}
    }
    await registrarEvento(tx,{actorId:userId,accion:'CONCEPTOS_ENTREGADOS',entityType:'work_item',entityId:dc.workItemId,proyectoId:dc.proyectoId,detalles:{count:ids.length,conceptIds:ids}});
    await tx.insert(notificaciones).values({proyectoId:dc.proyectoId,rolDestino:'rrpp',mensaje:'Hay conceptos de portada esperando tu aprobación.'});
    return {ids};
  });
}
export async function reviseCreativeConcept(id:string,conceptId:string,input:{descripcion:string;enlace:string},userId:string){
  return db.transaction(async tx=>{
    const dc=await lockCreativeForLeader(tx,id,userId);
    const [concept]=await tx.select().from(fichaDisenoPropuestas).where(and(eq(fichaDisenoPropuestas.id,conceptId),eq(fichaDisenoPropuestas.direccionCreativaId,id)));
    if(!concept)throw new CreativeError(404,'El concepto no pertenece a esta intervención.');
    if(concept.fechaAprobadaAutor)throw new CreativeError(409,'El concepto aprobado no puede reemplazarse.');
    const rrpp=concept.estado==='Devuelta por RRPP',author=concept.estado==='Feedback del autor'||!!concept.feedbackAutor;
    if(!rrpp&&!author){
      if(concept.enlace===input.enlace&&concept.descripcion===input.descripcion)return {ok:true};
      throw new CreativeError(409,'Este concepto está esperando revisión de otra persona.');
    }
    await tx.update(fichaDisenoPropuestas).set({...input,feedbackRrpp:null,feedbackAutor:null,revisedAt:new Date(),
      fechaAprobadaRrpp:rrpp?null:concept.fechaAprobadaRrpp,fechaEnviadaAutor:null,estado:rrpp?'Pendiente RRPP':'Ajustada para autor'}).where(eq(fichaDisenoPropuestas.id,concept.id));
    await registrarEvento(tx,{actorId:userId,accion:'CONCEPTO_AJUSTADO',entityType:'work_item',entityId:dc.workItemId,proyectoId:dc.proyectoId,
      detalles:{propuestaId:conceptId,source:rrpp?'RRPP':'AUTOR',previousUrl:concept.enlace,feedback:concept.feedbackAutor??concept.feedbackRrpp??concept.descripcion}});
    const [p]=await tx.select().from(proyectos).where(eq(proyectos.id,dc.proyectoId));
    const specialist=rrpp?null:await obtenerEspecialistaActual(dc.proyectoId,p?.especialistaId??null,tx);
    await tx.insert(notificaciones).values({proyectoId:dc.proyectoId,rolDestino:rrpp?'rrpp':'especialista',usuarioDestinoId:specialist,
      mensaje:rrpp?'El Líder Creativo ajustó un concepto para tu revisión.':'El concepto ajustado está disponible para enviar al autor.'});
    return {ok:true};
  });
}
