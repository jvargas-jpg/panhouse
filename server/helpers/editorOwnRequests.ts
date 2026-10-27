import { editorError, lockEditorWork } from './editorAccess.js';
import { EDITOR_REQUEST_TYPES } from '../../shared/editorOwn.js';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { notificaciones, proyectos, solicitudesArea, workItems, informacionSolicitudArea, users, projectAssignments } from '../db/schema/index.js';
import { registrarEvento } from './auditLog.js';
import { obtenerEspecialistaActual } from './carga.js';
import { EDITORIAL_EVENTS } from './editorialChief.js';
import type { EditorRequestDetail, EditorRequestList, EditorRequestSummary, EditorRequestType } from '../../shared/editorOwn.js';

// Solicitudes que el PROPIO Editor envía sobre un work item ya asignado --
// nunca el tipo 'editor' existente (ese significa "el Especialista pide que
// se asigne un Editor"). Reusa solicitudes_area (misma tabla, misma
// convención de lifecycle pendiente→en_revision→requiere_informacion→
// resuelta|rechazada|cancelada) con tipos nuevos e inequívocos.
const TARGET_LABEL: Record<EditorRequestType, string> = {
  editor_apoyo: 'Jefe de Edición',
  editor_reasignacion: 'Jefe de Edición',
  editor_aclaracion: 'Especialista',
};

function status(estado: string): EditorRequestSummary['status'] {
  return estado === 'requiere_informacion' ? 'devuelta' : estado as EditorRequestSummary['status'];
}

export async function crearRequestEditor(actorId: string, workItemId: string, type: EditorRequestType, motivo: string) {
  const trimmed = motivo.trim();
  if (trimmed.length < 5 || trimmed.length > 1000) throw Object.assign(new Error('Escribe un motivo de entre 5 y 1000 caracteres'), { statusCode: 400 });
  return db.transaction(async tx => {
    if (!EDITOR_REQUEST_TYPES.includes(type)) throw editorError('Tipo de solicitud no permitido',400);
    const {item,project} = await lockEditorWork(tx,workItemId,actorId);
    if (item.estado === 'cancelado' || item.estado === 'completado') throw editorError('Esta intervención ya no admite solicitudes operativas');
    const [existing] = await tx.select({ id: solicitudesArea.id }).from(solicitudesArea)
      .where(and(eq(solicitudesArea.workItemId, workItemId), eq(solicitudesArea.requestedById, actorId), eq(solicitudesArea.tipo, type), inArray(solicitudesArea.estado, ['pendiente', 'en_revision', 'requiere_informacion'])));
    if (existing) throw Object.assign(new Error('Ya enviaste una solicitud de este tipo para esta intervención, sin resolver todavía'), { statusCode: 409 });
    const targetUserId = type === 'editor_aclaracion' ? await obtenerEspecialistaActual(item.proyectoId, project.especialistaId, tx) : null;
    if (type === 'editor_aclaracion' && !targetUserId) throw editorError('El proyecto no tiene un Especialista asignado');
    const [row] = await tx.insert(solicitudesArea).values({ proyectoId: item.proyectoId, workItemId, tipo: type, businessKey: randomUUID(), requestedById: actorId, targetUserId, descripcion: trimmed }).returning();
    await registrarEvento(tx, { actorId, accion: 'EDITOR_REQUEST_CREADA', entityType: 'solicitud', entityId: row!.id, proyectoId: item.proyectoId, detalles: { type, workItemId } });
    if (targetUserId) await tx.insert(notificaciones).values({ proyectoId: item.proyectoId, targetPath:'/?vista=solicitudes',rolDestino: 'especialista', usuarioDestinoId: targetUserId, mensaje: `El Editor envió una solicitud de aclaración: ${trimmed}` });
    else await tx.insert(notificaciones).values({ proyectoId: item.proyectoId, targetPath:'/?vista=solicitudes-edicion&selectedRequest='+row!.id,rolDestino: 'jefe_edicion', mensaje: `El Editor envió una solicitud (${TARGET_LABEL[type]==='Jefe de Edición'?(type==='editor_apoyo'?'apoyo':'reasignación'):type}): ${trimmed}` });
    return row!;
  });
}

interface Row {
  authors:string; cover:string|null; requested_by:string; resolved_by_id:string|null; assignment_id:string|null; work_accessible:boolean; can_respond:boolean; updated_at:Date|string; last_event:string|null;
  id: string; tipo: string; proyecto_id: string; codigo: string; title: string; work_item_id: string; intervention_label: string;
  descripcion: string | null; estado: string; requested_at: string | Date; resolved_at: string | Date | null; outcome: string | null; version: number; return_reason:string|null; resolved_by:string|null; previous_editor:string|null;next_editor:string|null;reassigned_at:Date|string|null;
}
const SOURCE = `SELECT r.id,r.tipo,r.proyecto_id,p.codigo,coalesce(nullif(trim(p.titulo_definitivo),''),nullif(trim(p.titulo),''),'Proyecto editorial') title,
 r.work_item_id,coalesce(step.nombre,CASE WHEN w.business_key='default' THEN 'Inicio de edición' WHEN w.business_key LIKE 'capitulo:%' THEN 'Capítulo '||c.numero ELSE replace(w.business_key,'_',' ') END) intervention_label,
 r.descripcion,r.estado,r.requested_at,r.resolved_at,r.outcome,r.version,r.motivo return_reason,decider.nombre resolved_by,r.resolved_by_id,sender.nombre requested_by,sender.nombre previous_editor,reassignment.name next_editor,reassignment.at reassigned_at,reassignment.id assignment_id,
 coalesce((SELECT string_agg(a.nombre,', ' ORDER BY a.nombre) FROM proyectos_autores pa JOIN autores a ON a.id=pa.autor_id WHERE pa.proyecto_id=p.id),author.nombre) authors,
 CASE WHEN p.portada_decision_autor='aprobada' THEN p.propuesta_portada_url END cover,
 coalesce(ownership.editor_id=r.requested_by_id,false) work_accessible,
 coalesce(ownership.editor_id=r.requested_by_id AND p.estado NOT IN ('culminado','retirado') AND w.estado NOT IN ('completado','cancelado'),false) can_respond,
 greatest(r.requested_at,coalesce(r.resolved_at,r.requested_at),coalesce(last_event.created_at,r.requested_at)) updated_at,last_event.accion last_event
 FROM solicitudes_area r JOIN proyectos p ON p.id=r.proyecto_id JOIN work_items w ON w.id=r.work_item_id
 JOIN autores author ON author.id=p.autor_id
 LEFT JOIN usuarios sender ON sender.id=r.requested_by_id LEFT JOIN LATERAL (SELECT x.id,u.nombre name,x.asignado_en at FROM project_assignments x JOIN usuarios u ON u.id=x.usuario_id WHERE r.tipo='editor_reasignacion' AND r.estado='resuelta' AND x.proyecto_id=r.proyecto_id AND x.tipo='editor' AND x.work_item_id IS NULL AND x.usuario_id<>r.requested_by_id AND x.asignado_en>=r.requested_at AND x.asignado_en<=r.resolved_at ORDER BY (EXISTS(SELECT 1 FROM audit_logs result WHERE result.entity_id=r.id AND result.entity_type='solicitud' AND result.detalles->>'assignmentId'=x.id::text)) DESC,x.asignado_en DESC,x.id DESC LIMIT 1) reassignment ON true
 LEFT JOIN LATERAL (SELECT CASE WHEN EXISTS(SELECT 1 FROM project_assignments a WHERE a.proyecto_id=p.id AND a.tipo='editor' AND a.work_item_id IS NULL) THEN (SELECT a.usuario_id FROM project_assignments a WHERE a.proyecto_id=p.id AND a.tipo='editor' AND a.work_item_id IS NULL AND a.finalizado_en IS NULL LIMIT 1) ELSE p.editor_id END editor_id) ownership ON true
 LEFT JOIN LATERAL (SELECT a.accion,a.created_at FROM audit_logs a WHERE a.entity_id=r.id AND a.entity_type='solicitud' ORDER BY a.created_at DESC,a.id DESC LIMIT 1) last_event ON true
 LEFT JOIN usuarios decider ON decider.id=r.resolved_by_id LEFT JOIN pasos step ON step.id=w.paso_id LEFT JOIN capitulos c ON w.business_key='capitulo:'||c.id::text
 WHERE r.tipo IN ('editor_apoyo','editor_reasignacion','editor_aclaracion') AND r.requested_by_id=$1::uuid`;
const iso = (v: string | Date) => new Date(v).toISOString();
function summary(r: Row): EditorRequestSummary {
  return { id: r.id, type: r.tipo as EditorRequestType, projectId: r.proyecto_id, code: r.codigo, title: r.title, workItemId: r.work_item_id, interventionLabel: r.intervention_label,
    authors:r.authors,coverUrl:r.cover,requestedBy:r.requested_by,updatedAt:iso(r.updated_at),lastEventLabel:r.last_event?(EDITORIAL_EVENTS[r.last_event]??'Solicitud actualizada'):'Solicitud enviada',workAccessible:r.work_accessible,canRespond:r.can_respond,
    resultReferences:{projectId:r.proyecto_id,workItemId:r.work_item_id,assignmentId:r.assignment_id,resolvedById:r.resolved_by_id},
    motivo: r.descripcion ?? '', status: status(r.estado), target: TARGET_LABEL[r.tipo as EditorRequestType], requestedAt: iso(r.requested_at), resolvedAt: r.resolved_at ? iso(r.resolved_at) : null, outcome: r.outcome, version: r.version, reassignment:r.tipo==='editor_reasignacion'&&r.previous_editor&&r.next_editor&&r.reassigned_at?{previousEditor:r.previous_editor,nextEditor:r.next_editor,assignedAt:iso(r.reassigned_at)}:null,returnReason:r.return_reason, resolvedBy:r.resolved_by };
}

export async function listarRequestsEditor(actorId: string, tab: 'all' | 'pending' | 'resolved' | 'returned' | 'cancelled' | 'rejected', page: number, pageSize: number, filters: {search?:string;type?:string;project?:string;from?:string;to?:string;target?:string;sort?:string} = {}): Promise<EditorRequestList> {
  const { rows } = await pool.query<Row>(`${SOURCE} ORDER BY r.requested_at DESC, r.id`, [actorId]);
  const all = rows.map(summary);
  const labels:Record<string,string>={editor_apoyo:'apoyo solicitar apoyo',editor_reasignacion:'reasignación solicitar reasignación',editor_aclaracion:'aclaración solicitar aclaración'};
  const items = all.filter(r=>(!filters.search || (r.title+' '+r.code+' '+r.authors+' '+r.motivo+' '+r.interventionLabel+' '+labels[r.type]).toLocaleLowerCase('es').includes(filters.search.toLocaleLowerCase('es'))) && (!filters.type || r.type===filters.type) && (!filters.project || r.projectId===filters.project) && (!filters.target || r.target===(filters.target==='chief'?'Jefe de Edición':'Especialista')) && (!filters.from || r.requestedAt>=filters.from+'T04:00:00.000Z') && (!filters.to || r.requestedAt<new Date(new Date(filters.to+'T04:00:00.000Z').getTime()+86400000).toISOString()));
  const rank:Record<string,number>={devuelta:0,pendiente:1,en_revision:1,resuelta:2,rechazada:2,cancelada:3};
  items.sort((a,b)=>(filters.sort==='newest'?0:filters.sort==='activity'?b.updatedAt!.localeCompare(a.updatedAt!):rank[a.status]!-rank[b.status]!)||b.requestedAt.localeCompare(a.requestedAt)||a.id.localeCompare(b.id));
  const bucket = tab === 'all' ? items : items.filter(i => tab === 'pending' ? (i.status === 'pendiente' || i.status === 'en_revision') : i.status === tab.replace('returned', 'devuelta').replace('resolved', 'resuelta').replace('cancelled', 'cancelada').replace('rejected','rechazada'));
  const pages = Math.max(1, Math.ceil(bucket.length / pageSize)), safePage = Math.min(page, pages);
  return {
    items: bucket.slice((safePage - 1) * pageSize, safePage * pageSize), total: bucket.length, pages, page: safePage,
    counts: { pending: items.filter(i => i.status === 'pendiente' || i.status === 'en_revision').length, resolved: items.filter(i => i.status === 'resuelta').length, returned: items.filter(i => i.status === 'devuelta').length, cancelled: items.filter(i => i.status === 'cancelada').length, rejected:items.filter(i=>i.status==='rechazada').length,all: items.length },
    options:{projects:[...new Map(all.map(i=>[i.projectId,{id:i.projectId,name:i.title}])).values()].sort((a,b)=>a.name.localeCompare(b.name,'es'))},
  };
}

export async function obtenerRequestEditorDetalle(id: string, actorId: string): Promise<EditorRequestDetail | null> {
  const { rows } = await pool.query<Row>(`${SOURCE} AND r.id=$2::uuid`, [actorId, id]);
  const r = rows[0]; if (!r) return null;
  const {rows:observations} = await pool.query<{id:string;question:string;answer:string|null;at:Date;askedBy:string;answeredBy:string|null;answeredAt:Date|null}>(`SELECT i.id,i.pregunta question,i.respuesta answer,i.asked_at at,a.nombre "askedBy",b.nombre "answeredBy",i.answered_at "answeredAt" FROM informacion_solicitud_area i JOIN usuarios a ON a.id=i.asked_by_id LEFT JOIN usuarios b ON b.id=i.answered_by_id WHERE i.solicitud_id=$1 ORDER BY i.asked_at,i.id`,[id]);
  const { rows: history } = await pool.query<{ id: string; accion: string; actor: string; created_at: Date; detalles: { motivo?: string } | null }>(
    `SELECT a.id,a.accion,coalesce(u.nombre,'Sistema') actor,a.created_at,a.detalles FROM audit_logs a LEFT JOIN usuarios u ON u.id=a.actor_id
     WHERE a.entity_id=$1 AND a.entity_type='solicitud' ORDER BY a.created_at,a.id`, [id]);
  return { summary: summary(r), description: r.descripcion, observations:observations.map(o=>({...o,at:o.at.toISOString(),answeredAt:o.answeredAt?.toISOString()??null})), history: history.map(h => ({ id: h.id, label: (EDITORIAL_EVENTS[h.accion] ?? 'Solicitud actualizada') + (h.detalles?.motivo ? ' · ' + h.detalles.motivo : ''), actor: h.actor, at: h.created_at.toISOString() })) };
}

export async function cancelarRequestEditor(id: string, actorId: string, expectedVersion: number) {
  return db.transaction(async tx => {
    const [r] = await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id, id)).for('update');
    if (!r || r.requestedById !== actorId || !['editor_apoyo', 'editor_reasignacion', 'editor_aclaracion'].includes(r.tipo)) throw Object.assign(new Error('Solicitud no encontrada'), { statusCode: 404 });
    if (r.estado !== 'pendiente' && r.estado !== 'en_revision') throw Object.assign(new Error('Solo se puede cancelar una solicitud sin resolver'), { statusCode: 409 });
    if (r.version !== expectedVersion) throw Object.assign(new Error('La solicitud cambió. Actualiza antes de cancelar.'), { statusCode: 409 });
    await tx.update(solicitudesArea).set({ estado: 'cancelada', resolvedAt: new Date(), resolvedById: actorId, version: r.version + 1 }).where(eq(solicitudesArea.id, id));
    await registrarEvento(tx, { actorId, accion: 'EDITOR_REQUEST_CANCELADA', entityType: 'solicitud', entityId: id, proyectoId: r.proyectoId });
    return { ok: true };
  });
}


export async function decidirRequestEditor(id:string,actor:{id:string;rol:string},expectedVersion:number,action:'review'|'return'|'resolve',text:string) {
  if (text.trim().length<5 || text.trim().length>1000) throw editorError('Escribe una respuesta de entre 5 y 1000 caracteres',400);
  return db.transaction(async tx=>{
    const [origin]=await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id,id));
    if(!origin || !EDITOR_REQUEST_TYPES.includes(origin.tipo as EditorRequestType)) throw editorError('Solicitud no encontrada',404);
    const [project]=await tx.select().from(proyectos).where(eq(proyectos.id,origin.proyectoId)).for('update');
    const [r]=await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id,id)).for('update');
    const [recipient]=await tx.select().from(users).where(and(eq(users.id,actor.id),eq(users.activo,true)));
    const specialist=await obtenerEspecialistaActual(origin.proyectoId,project?.especialistaId??null,tx);
    if(!recipient || recipient.rol!==actor.rol || (r!.tipo==='editor_aclaracion' ? actor.rol!=='especialista'||specialist!==actor.id : actor.rol!=='jefe_edicion')) throw editorError('No eres el destinatario de esta solicitud',403);
    if(!project || !r || r.version!==expectedVersion || !['pendiente','en_revision'].includes(r.estado)) throw editorError('La solicitud cambió. Actualiza el detalle antes de decidir.');
    let assignmentId:string|null=null;
    if(action==='resolve' && r.tipo==='editor_reasignacion') {
      const [assignment]=await tx.select().from(projectAssignments).where(and(eq(projectAssignments.proyectoId,r.proyectoId),eq(projectAssignments.tipo,'editor'),isNull(projectAssignments.workItemId),isNull(projectAssignments.finalizadoEn)));
      if(!assignment || assignment.usuarioId===r.requestedById || assignment.asignadoEn<r.requestedAt)throw editorError('Realiza primero la reasignación desde Asignaciones y carga');
      assignmentId=assignment.id;
    }
    const state=action==='resolve'?'resuelta':action==='return'?'requiere_informacion':'en_revision';
    await tx.update(solicitudesArea).set({estado:state,version:r.version+1,motivo:action==='return'?text.trim():r.motivo,
      ...(action==='resolve'?{outcome:text.trim(),resolvedAt:new Date(),resolvedById:actor.id}:{})}).where(eq(solicitudesArea.id,id));
    if(action==='return')await tx.insert(informacionSolicitudArea).values({solicitudId:id,pregunta:text.trim(),askedById:actor.id});
    await registrarEvento(tx,{actorId:actor.id,accion:action==='resolve'?'EDITOR_REQUEST_RESUELTA':action==='return'?'EDITOR_REQUEST_DEVUELTA':'EDITOR_REQUEST_EN_REVISION',entityType:'solicitud',entityId:id,proyectoId:r.proyectoId,detalles:{motivo:text.trim(),...(assignmentId?{assignmentId}: {})}});
    if(r.requestedById)await tx.insert(notificaciones).values({proyectoId:r.proyectoId,targetPath:'/?vista=mis-solicitudes&request='+id,rolDestino:'editor',usuarioDestinoId:r.requestedById,mensaje:`Tu solicitud está ${state==='resuelta'?'resuelta':state==='requiere_informacion'?'devuelta para completar':'en revisión'}: ${text.trim()}`});
    return {ok:true};
  });
}

export async function responderRequestEditor(id:string,actorId:string,expectedVersion:number,text:string) {
  if(text.trim().length<5 || text.trim().length>1000)throw editorError('Escribe una respuesta de entre 5 y 1000 caracteres',400);
  return db.transaction(async tx=>{
    const [origin]=await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id,id));
    if(!origin || origin.requestedById!==actorId || !EDITOR_REQUEST_TYPES.includes(origin.tipo as EditorRequestType))throw editorError('Solicitud no encontrada',404);
    const {item}=await lockEditorWork(tx,origin.workItemId!,actorId);
    if(['completado','cancelado'].includes(item.estado))throw editorError('Esta intervención ya no admite solicitudes operativas');
    const [r]=await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id,id)).for('update');
    if(!r || r.requestedById!==actorId || !EDITOR_REQUEST_TYPES.includes(r.tipo as EditorRequestType))throw editorError('Solicitud no encontrada',404);
    if(r.version!==expectedVersion || r.estado!=='requiere_informacion')throw editorError('La solicitud cambió. Actualiza antes de responder.');
    const questions=await tx.select().from(informacionSolicitudArea).where(and(eq(informacionSolicitudArea.solicitudId,id))).orderBy(desc(informacionSolicitudArea.askedAt));
    const question=questions.find(q=>!q.answeredAt);
    if(!question)throw editorError('No hay información pendiente de respuesta');
    await tx.update(informacionSolicitudArea).set({respuesta:text.trim(),answeredById:actorId,answeredAt:new Date()}).where(eq(informacionSolicitudArea.id,question.id));
    await tx.update(solicitudesArea).set({estado:'pendiente',version:r.version+1}).where(eq(solicitudesArea.id,id));
    await registrarEvento(tx,{actorId,accion:'EDITOR_REQUEST_REENVIADA',entityType:'solicitud',entityId:id,proyectoId:r.proyectoId,detalles:{motivo:text.trim()}});
    const [project]=await tx.select().from(proyectos).where(eq(proyectos.id,r.proyectoId));
    const target=r.tipo==='editor_aclaracion'?await obtenerEspecialistaActual(r.proyectoId,project?.especialistaId??null,tx):null;
    await tx.insert(notificaciones).values({proyectoId:r.proyectoId,targetPath:target?'/?vista=solicitudes':'/?vista=solicitudes-edicion&selectedRequest='+id,rolDestino:target?'especialista':'jefe_edicion',usuarioDestinoId:target,mensaje:'El Editor completó la información de su solicitud.'});
    return {ok:true};
  });
}

export async function listarAclaracionesRecibidas(actorId:string) {
  const incoming=SOURCE.replace('AND r.requested_by_id=$1::uuid',`AND r.tipo='editor_aclaracion' AND r.estado IN ('pendiente','en_revision','requiere_informacion') AND coalesce((SELECT x.usuario_id FROM project_assignments x WHERE x.proyecto_id=p.id AND x.tipo='especialista' AND x.work_item_id IS NULL AND x.finalizado_en IS NULL LIMIT 1),CASE WHEN NOT EXISTS(SELECT 1 FROM project_assignments x WHERE x.proyecto_id=p.id AND x.tipo='especialista' AND x.work_item_id IS NULL) THEN p.especialista_id END)=$1::uuid`);
  const {rows}=await pool.query<Row>(incoming+' ORDER BY r.requested_at LIMIT 50',[actorId]);
  return {items:rows.map(summary)};
}
