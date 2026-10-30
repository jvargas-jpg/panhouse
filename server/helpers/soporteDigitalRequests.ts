import { createHash } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { editorialBlockers, informacionSolicitudArea, notificaciones, proyectos, solicitudArchivos, solicitudesArea, users, workItems } from '../db/schema/index.js';
import { obtenerEspecialistaActual } from './carga.js';
import { registrarEvento, type AccionAuditoria } from './auditLog.js';
import { DIGITAL_WORK_ROWS_SQL, deriveWork, type DigitalWorkItemRow } from './soporteDigitalHome.js';
import { diaCaracas } from './atencionEspecialista.js';
import type { Tx } from './tx.js';
import { DIGITAL_REQUEST_TYPES, DIGITAL_REQUEST_LABELS, type CreateDigitalRequest, type DigitalRequestContext, type DigitalRequestDetail, type DigitalRequestEligibility, type DigitalRequestFilters, type DigitalRequestList, type DigitalRequestRow, type DigitalRequestStatus, type DigitalRequestType } from '../../shared/soporteDigitalRequests.js';

type Actor = { id: string; rol: string };
const TYPES = "('digital_material','digital_aclaracion','digital_tecnico')";
const OPEN = ['pendiente', 'en_revision', 'requiere_informacion'] as const;
const EVENTS: Record<string, string> = {
  DIGITAL_REQUEST_CREADA: 'Solicitud enviada', DIGITAL_REQUEST_EN_REVISION: 'Revisión iniciada', DIGITAL_REQUEST_DEVUELTA: 'Información solicitada',
  DIGITAL_REQUEST_REENVIADA: 'Información completada', DIGITAL_REQUEST_RESUELTA: 'Solicitud resuelta', DIGITAL_REQUEST_CANCELADA: 'Solicitud cancelada',
  DIGITAL_REQUEST_ARCHIVO: 'Evidencia añadida', DIGITAL_REQUEST_BLOQUEO_RESUELTO: 'Bloqueo de la tarea resuelto',
};
export function digitalRequestAssert(value: unknown, message: string, statusCode = 409): asserts value {
  if (!value) throw Object.assign(new Error(message), { statusCode });
}
const iso = (v: Date | string) => new Date(v).toISOString();

// Las tareas son compartidas por rol; las solicitudes son privadas por
// requested_by_id. El contexto histórico permanece si se cancela la tarea.
const CONTEXT = `WITH active AS (${DIGITAL_WORK_ROWS_SQL}) SELECT w.id,w.id work_item_id,w.proyecto_id,w.estado,w.business_key,w.gate_bloqueante,w.created_at,
 p.codigo,p.estado project_state,coalesce(nullif(trim(p.titulo_definitivo),''),nullif(trim(p.titulo),''),'Proyecto editorial') title,
 coalesce(au.names,a.nombre) authors,CASE WHEN p.portada_decision_autor='aprobada' THEN p.propuesta_portada_url END cover,
 ps.nombre task_name,w.fecha_fin_pautada::text deadline,f.soporte_digital_fecha_activacion::text activation,f.soporte_digital_fecha_envio_formulario::text form_sent,f.digital_estatus digital_status,
 coalesce(active.package_available,false) package_available,coalesce(active.tested,false) tested,coalesce(active.loaded,false) loaded,
 owner.id specialist_id,specialist.nombre specialist,
 (p.estado<>'retirado' AND w.estado<>'cancelado') work_accessible,
 (p.estado NOT IN ('pausado','culminado','retirado') AND w.estado<>'cancelado' AND coalesce(lower(trim(f.digital_estatus)),'')<>'completado'
  AND (w.estado<>'completado' OR (w.business_key='activacion_amazon' AND f.soporte_digital_fecha_activacion IS NOT NULL))
  AND specialist.activo AND specialist.rol='especialista') eligible
 FROM work_items w JOIN proyectos p ON p.id=w.proyecto_id JOIN autores a ON a.id=p.autor_id
 LEFT JOIN active ON active.id=w.id LEFT JOIN pasos ps ON ps.id=w.paso_id LEFT JOIN fichas_trazabilidad f ON f.proyecto_id=p.id
 LEFT JOIN (SELECT x.proyecto_id,string_agg(a.nombre,', ' ORDER BY a.nombre) names FROM proyectos_autores x JOIN autores a ON a.id=x.autor_id GROUP BY x.proyecto_id) au ON au.proyecto_id=p.id
 LEFT JOIN LATERAL(SELECT CASE WHEN EXISTS(SELECT 1 FROM project_assignments x WHERE x.proyecto_id=p.id AND x.tipo='especialista' AND x.work_item_id IS NULL)
  THEN (SELECT x.usuario_id FROM project_assignments x WHERE x.proyecto_id=p.id AND x.tipo='especialista' AND x.work_item_id IS NULL AND x.finalizado_en IS NULL LIMIT 1) ELSE p.especialista_id END id) owner ON true
 LEFT JOIN usuarios specialist ON specialist.id=owner.id WHERE w.tipo='soporte_digital'`;
interface ContextRow extends DigitalWorkItemRow, Record<string, unknown> { work_item_id: string; specialist_id: string | null; specialist: string | null; eligible: boolean; work_accessible: boolean }
interface RequestRow extends ContextRow {
  request_id: string; tipo: DigitalRequestType; asunto: string; descripcion: string; request_state: DigitalRequestStatus; version: number;
  requested_at: string | Date; updated_at: string | Date; last_event: string | null; requested_by_id: string;
  outcome: string | null; resolved_at: string | Date | null; resolved_by: string | null;
  blocker_id: string | null; blocker_active: boolean; blocker_reason: string | null; blocker_resolved_at: string | Date | null;
  snapshot: { stage?: DigitalRequestContext['stage']; taskLabel?: string } | null;
}
function context(r: ContextRow): DigitalRequestContext {
  const current = deriveWork(r, diaCaracas(new Date()));
  return { workItemId: r.work_item_id, projectId: r.proyecto_id, projectTitle: r.title, projectCode: r.codigo, authors: r.authors, coverUrl: r.cover,
    stage: current.stage, taskLabel: current.taskLabel, specialist: r.specialist, canBlock: !r.gate_bloqueante && r.estado !== 'bloqueado' };
}
function row(r: RequestRow): DigitalRequestRow {
  return { ...context(r), stage: r.snapshot?.stage ?? context(r).stage, taskLabel: r.snapshot?.taskLabel ?? context(r).taskLabel,
    id: r.request_id, type: r.tipo, subject: r.asunto, summary: r.descripcion.slice(0, 240), status: r.request_state, version: r.version,
    createdAt: iso(r.requested_at), updatedAt: iso(r.updated_at), lastEvent: EVENTS[r.last_event ?? ''] ?? 'Solicitud enviada',
    requiresAction: r.request_state === 'requiere_informacion', blocksWorkItem: !!r.blocker_active,
    canCancel: OPEN.includes(r.request_state as typeof OPEN[number]) && !r.blocker_active, workAccessible: r.work_accessible };
}
const SOURCE = `SELECT c.*,r.id request_id,r.tipo,r.asunto,r.descripcion,r.estado request_state,r.version,r.requested_by_id,r.requested_at,r.outcome,r.resolved_at,
 u.nombre resolved_by,r.blocker_id,(b.id IS NOT NULL AND b.resolved_at IS NULL) blocker_active,b.reason blocker_reason,b.resolved_at blocker_resolved_at,
 first.detalles->'context' snapshot,greatest(r.requested_at,coalesce(last.created_at,r.requested_at)) updated_at,last.accion last_event
 FROM solicitudes_area r JOIN context c ON c.work_item_id=r.work_item_id AND c.proyecto_id=r.proyecto_id
 LEFT JOIN editorial_blockers b ON b.id=r.blocker_id AND b.work_item_id=r.work_item_id LEFT JOIN usuarios u ON u.id=r.resolved_by_id
 LEFT JOIN LATERAL(SELECT detalles FROM audit_logs WHERE entity_type='solicitud' AND entity_id=r.id AND accion='DIGITAL_REQUEST_CREADA' ORDER BY created_at,id LIMIT 1) first ON true
 LEFT JOIN LATERAL(SELECT accion,created_at FROM audit_logs WHERE entity_type='solicitud' AND entity_id=r.id ORDER BY created_at DESC,id DESC LIMIT 1) last ON true
 WHERE r.tipo IN ${TYPES}`;

export async function eligibleDigitalRequests(search: string, page: number, pageSize: number, workItemId?: string): Promise<DigitalRequestEligibility> {
  const result = await pool.query<{ data: { items: ContextRow[]; total: number; page: number; pages: number } }>(`WITH context AS (${CONTEXT}), eligible AS (
    SELECT * FROM context WHERE eligible AND ($1='' OR strpos(lower(concat_ws(' ',title,codigo,authors,task_name)),lower($1))>0) AND ($4::uuid IS NULL OR work_item_id=$4)),
    meta AS(SELECT count(*)::int total,greatest(1,ceil(count(*)::numeric/$3))::int pages FROM eligible),
    paged AS(SELECT * FROM eligible ORDER BY title,work_item_id LIMIT $3 OFFSET ((SELECT least($2,pages)-1 FROM meta)*$3))
    SELECT json_build_object('items',coalesce((SELECT json_agg(paged) FROM paged),'[]'),'total',total,'page',least($2,pages),'pages',pages) data FROM meta`, [search, page, pageSize, workItemId ?? null]);
  return { ...result.rows[0]!.data, items: result.rows[0]!.data.items.map(context) };
}
export async function listDigitalRequests(actorId: string, f: DigitalRequestFilters, incoming = false): Promise<DigitalRequestList> {
  const args: unknown[] = [actorId], conditions: string[] = [];
  const bind = (v: unknown) => { args.push(v); return '$' + args.length; };
  if (f.search) conditions.push(`strpos(lower(concat_ws(' ',title,codigo,authors,asunto,descripcion,coalesce(snapshot->>'taskLabel',task_name),CASE tipo WHEN 'digital_material' THEN 'Material incorrecto o faltante' WHEN 'digital_aclaracion' THEN 'Aclaración operativa' ELSE 'Problema técnico o de acceso' END)),lower(${bind(f.search)}))>0`);
  if (f.type) conditions.push(`tipo=${bind(f.type)}`);
  if (f.status) conditions.push(`request_state=${bind(f.status)}`);
  if (f.project) conditions.push(`proyecto_id=${bind(f.project)}::uuid`);
  if (f.from) conditions.push(`(requested_at AT TIME ZONE 'America/Caracas')::date>=${bind(f.from)}::date`);
  if (f.to) conditions.push(`(requested_at AT TIME ZONE 'America/Caracas')::date<=${bind(f.to)}::date`);
  const bucket = f.tab === 'pending' ? "request_state IN ('pendiente','en_revision')" : f.tab === 'returned' ? "request_state='requiere_informacion'" : f.tab === 'resolved' ? "request_state='resuelta'" : f.tab === 'cancelled' ? "request_state='cancelada'" : 'true';
  const size = bind(f.pageSize), page = bind(f.page);
  const result = await pool.query<{ data: Omit<DigitalRequestList, 'items'> & { items: RequestRow[] } }>(`WITH context AS (${CONTEXT}), requests AS (${SOURCE} AND ${incoming ? 'c.specialist_id' : 'r.requested_by_id'}=$1::uuid),
    filtered AS(SELECT * FROM requests WHERE ${conditions.join(' AND ') || 'true'}), selected AS(SELECT * FROM filtered WHERE ${bucket}),
    meta AS(SELECT count(*)::int total,greatest(1,ceil(count(*)::numeric/${size}))::int pages FROM selected),
    paged AS(SELECT * FROM selected ORDER BY CASE WHEN request_state='requiere_informacion' THEN 0 WHEN blocker_active AND request_state IN ('pendiente','en_revision') THEN 1
      WHEN request_state IN ('pendiente','en_revision') THEN 2 WHEN request_state='cancelada' THEN 4 ELSE 3 END,updated_at DESC,request_id
      LIMIT ${size} OFFSET ((SELECT least(${page},pages)-1 FROM meta)*${size}))
    SELECT json_build_object('items',coalesce((SELECT json_agg(paged) FROM paged),'[]'),'total',total,'page',least(${page},pages),'pages',pages,
      'counts',(SELECT json_build_object('all',count(*),'pending',count(*) FILTER(WHERE request_state IN ('pendiente','en_revision')),'returned',count(*) FILTER(WHERE request_state='requiere_informacion'),
      'resolved',count(*) FILTER(WHERE request_state='resuelta'),'cancelled',count(*) FILTER(WHERE request_state='cancelada')) FROM filtered),
      'projects',coalesce((SELECT json_agg(x ORDER BY name,id) FROM (SELECT DISTINCT proyecto_id id,title name FROM requests) x),'[]')) data FROM meta`, args);
  return { ...result.rows[0]!.data, items: result.rows[0]!.data.items.map(row) };
}
export async function detailDigitalRequest(id: string, actorId: string, incoming = false): Promise<DigitalRequestDetail | null> {
  const { rows: [r] } = await pool.query<RequestRow>(`WITH context AS (${CONTEXT}) ${SOURCE} AND r.id=$1::uuid AND ${incoming ? 'c.specialist_id' : 'r.requested_by_id'}=$2::uuid`, [id, actorId]);
  if (!r) return null;
  const [questions, history, files] = await Promise.all([
    pool.query<{ id: string; text: string; actor: string; at: Date; answer: string | null; answeredAt: Date | null; answeredBy: string | null }>(`SELECT i.id,i.pregunta text,u.nombre actor,i.asked_at at,i.respuesta answer,i.answered_at "answeredAt",a.nombre "answeredBy"
      FROM informacion_solicitud_area i JOIN usuarios u ON u.id=i.asked_by_id LEFT JOIN usuarios a ON a.id=i.answered_by_id WHERE solicitud_id=$1 ORDER BY asked_at,i.id`, [id]),
    pool.query<{ id: string; accion: string; actor: string; at: Date; detalles: { text?: string; resultWorkItemId?: string; resultAttachmentId?: string; resolveBlocker?: boolean } | null }>(`SELECT a.id,a.accion,coalesce(u.nombre,'Sistema') actor,a.created_at at,a.detalles FROM audit_logs a LEFT JOIN usuarios u ON u.id=a.actor_id WHERE entity_type='solicitud' AND entity_id=$1 ORDER BY a.created_at,a.id`, [id]),
    pool.query<{ id: string; name: string; mime_type: string; size: number; created_at: Date; actor: string }>(`SELECT f.id,f.name,f.mime_type,f.size,f.created_at,u.nombre actor FROM solicitud_archivos f JOIN usuarios u ON u.id=f.uploaded_by_id WHERE solicitud_id=$1 ORDER BY f.created_at,f.id`, [id]),
  ]);
  const result = history.rows.find(h => h.accion === 'DIGITAL_REQUEST_RESUELTA')?.detalles;
  return { summary: row(r), description: r.descripcion, destination: 'Especialista coordinador',
    blocker: r.blocker_id ? { id: r.blocker_id, active: r.blocker_active, reason: r.blocker_reason ?? 'Bloqueo de la tarea', resolvedAt: r.blocker_resolved_at ? iso(r.blocker_resolved_at) : null } : null,
    questions: questions.rows.map(q => ({ ...q, at: iso(q.at), answeredAt: q.answeredAt ? iso(q.answeredAt) : null })),
    history: history.rows.map(h => ({ id: h.id, label: EVENTS[h.accion] ?? 'Solicitud actualizada', actor: h.actor, at: iso(h.at), text: h.detalles?.text ?? null })),
    attachments: files.rows.map(f => ({ id: f.id, name: f.name, mimeType: f.mime_type, size: f.size, at: iso(f.created_at), uploadedBy: f.actor, url: `/api/soporte-digital/solicitudes/${id}/archivos/${f.id}` })),
    canAttach: !incoming && r.work_accessible && ['pendiente', 'requiere_informacion'].includes(r.request_state),
    result: r.resolved_at && ['resuelta', 'rechazada', 'cancelada'].includes(r.request_state) ? { text: r.outcome ?? '', actor: r.resolved_by, at: iso(r.resolved_at), workItemId: result?.resultWorkItemId ?? null, attachmentId: result?.resultAttachmentId ?? null, blockerResolved: !!r.blocker_id && !r.blocker_active } : null,
  };
}
async function role(tx: Tx, actor: Actor, expected: string) {
  const [person] = await tx.select().from(users).where(eq(users.id, actor.id));
  digitalRequestAssert(person?.activo && person.rol === expected && actor.rol === expected, 'Rol no autorizado', 403);
}
async function event(tx: Tx, id: string, projectId: string, actorId: string, accion: AccionAuditoria, detalles?: Record<string, unknown>) {
  await registrarEvento(tx, { actorId, accion, entityType: 'solicitud', entityId: id, proyectoId: projectId, detalles });
}
async function notify(tx: Tx, projectId: string, id: string, actorId: string, role: 'soporte_digital' | 'especialista', message: string) {
  await tx.insert(notificaciones).values({ proyectoId: projectId, usuarioDestinoId: actorId, rolDestino: role,
    targetPath: role === 'soporte_digital' ? '/?vista=mis-solicitudes&request=' + id : '/proyectos/' + projectId, mensaje: message });
}
async function lockWork(tx: Tx, workItemId: string) {
  const [origin] = await tx.select().from(workItems).where(eq(workItems.id, workItemId));
  digitalRequestAssert(origin?.tipo === 'soporte_digital', 'Tarea digital no encontrada', 404);
  const [project] = await tx.select().from(proyectos).where(eq(proyectos.id, origin.proyectoId)).for('update');
  const [work] = await tx.select().from(workItems).where(eq(workItems.id, workItemId)).for('update');
  digitalRequestAssert(project && work && work.proyectoId === project.id, 'Tarea digital no encontrada', 404);
  return { project, work };
}
async function lockRequest(tx: Tx, id: string, requesterId?: string) {
  const [origin] = await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id, id));
  digitalRequestAssert(origin && DIGITAL_REQUEST_TYPES.includes(origin.tipo as DigitalRequestType) && (!requesterId || origin.requestedById === requesterId), 'Solicitud no encontrada', 404);
  const c = await lockWork(tx, origin.workItemId!);
  const [request] = await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id, id)).for('update');
  digitalRequestAssert(request, 'Solicitud no encontrada', 404);
  return { ...c, request };
}
export async function createDigitalRequest(actor: Actor, input: CreateDigitalRequest) {
  digitalRequestAssert(DIGITAL_REQUEST_TYPES.includes(input.type), 'Tipo no permitido', 400);
  const subject = input.subject.trim(), description = input.description.trim();
  digitalRequestAssert(subject.length >= 5 && subject.length <= 160 && description.length >= 10 && description.length <= 4000, 'Revisa el tema y la descripción', 400);
  try { return await db.transaction(async tx => {
    await role(tx, actor, 'soporte_digital');
    const { project, work } = await lockWork(tx, input.workItemId);
    const [retry] = await tx.select().from(solicitudesArea).where(and(eq(solicitudesArea.requestedById, actor.id), eq(solicitudesArea.businessKey, input.idempotencyKey), inArray(solicitudesArea.tipo, [...DIGITAL_REQUEST_TYPES])));
    if (retry) {
      digitalRequestAssert(retry.workItemId === input.workItemId && retry.tipo === input.type && retry.asunto === subject && retry.descripcion === description && !!retry.blockerId === input.blocksWorkItem, 'La clave de envío ya se utilizó con otros datos');
      return { id: retry.id, reused: true };
    }
    const c = (await tx.execute<ContextRow>(sql`WITH context AS (${sql.raw(CONTEXT)}) SELECT * FROM context WHERE work_item_id=${input.workItemId}::uuid`)).rows[0];
    digitalRequestAssert(c?.eligible && c.specialist_id !== actor.id, 'La tarea ya no admite solicitudes o no tiene Especialista coordinador');
    const [duplicate] = await tx.select().from(solicitudesArea).where(and(eq(solicitudesArea.requestedById, actor.id), eq(solicitudesArea.workItemId, input.workItemId), eq(solicitudesArea.tipo, input.type), inArray(solicitudesArea.estado, [...OPEN])));
    digitalRequestAssert(!duplicate, 'Ya tienes una solicitud de este tipo pendiente para esta tarea');
    let blockerId: string | null = null;
    if (input.blocksWorkItem) {
      digitalRequestAssert(!work.gateBloqueante && work.estado !== 'bloqueado', 'La tarea ya tiene un bloqueo; envía la solicitud sin duplicarlo');
      const [blocker] = await tx.insert(editorialBlockers).values({ workItemId: work.id, reason: subject, createdBy: actor.id }).returning(); blockerId = blocker!.id;
      await tx.update(workItems).set({ estado: 'bloqueado', gateBloqueante: subject }).where(eq(workItems.id, work.id));
    }
    const [created] = await tx.insert(solicitudesArea).values({ proyectoId: project.id, workItemId: work.id, requestedById: actor.id, targetUserId: c.specialist_id,
      tipo: input.type, asunto: subject, descripcion: description, businessKey: input.idempotencyKey, blockerId }).returning();
    await event(tx, created!.id, project.id, actor.id, 'DIGITAL_REQUEST_CREADA', { context: context(c), previousWorkState: work.estado, blockerId });
    await notify(tx, project.id, created!.id, c.specialist_id!, 'especialista', 'Soporte Digital solicita intervención: ' + subject);
    return { id: created!.id, reused: false };
  }); } catch (error) {
    if ((error as { code?: string }).code === '23505') throw Object.assign(new Error('El envío ya fue registrado. Actualiza tus solicitudes.'), { statusCode: 409 });
    throw error;
  }
}
export async function answerDigitalRequest(actor: Actor, id: string, expectedVersion: number, questionId: string, text: string) {
  text = text.trim(); digitalRequestAssert(text.length >= 5 && text.length <= 2000, 'Escribe información de entre 5 y 2000 caracteres', 400);
  return db.transaction(async tx => {
    await role(tx, actor, 'soporte_digital'); const { request: r, project } = await lockRequest(tx, id, actor.id);
    digitalRequestAssert(r.version === expectedVersion && r.estado === 'requiere_informacion', 'La solicitud cambió. Actualiza antes de completar la información.');
    const [question] = await tx.select().from(informacionSolicitudArea).where(and(eq(informacionSolicitudArea.id, questionId), eq(informacionSolicitudArea.solicitudId, id))).for('update');
    digitalRequestAssert(question && !question.answeredAt, 'La pregunta no pertenece a esta solicitud o ya fue respondida');
    const target = await obtenerEspecialistaActual(project.id, project.especialistaId, tx);
    const [recipient] = target ? await tx.select().from(users).where(eq(users.id, target)) : [];
    digitalRequestAssert(recipient?.activo && recipient.rol === 'especialista', 'El proyecto necesita un Especialista coordinador activo');
    await tx.update(informacionSolicitudArea).set({ respuesta: text, answeredById: actor.id, answeredAt: new Date() }).where(eq(informacionSolicitudArea.id, questionId));
    await tx.update(solicitudesArea).set({ estado: 'pendiente', targetUserId: target, version: r.version + 1 }).where(eq(solicitudesArea.id, id));
    await event(tx, id, project.id, actor.id, 'DIGITAL_REQUEST_REENVIADA', { text, questionId });
    await notify(tx, project.id, id, target!, 'especialista', 'Soporte Digital completó la información: ' + r.asunto);
    return { ok: true };
  });
}
export async function cancelDigitalRequest(actor: Actor, id: string, expectedVersion: number, reason?: string) {
  reason = reason?.trim(); digitalRequestAssert(!reason || reason.length <= 2000, 'Motivo demasiado largo', 400);
  return db.transaction(async tx => {
    await role(tx, actor, 'soporte_digital'); const { request: r, project } = await lockRequest(tx, id, actor.id);
    digitalRequestAssert(r.version === expectedVersion && OPEN.includes(r.estado as typeof OPEN[number]), 'La solicitud cambió o ya está cerrada');
    const [blocker] = r.blockerId ? await tx.select().from(editorialBlockers).where(eq(editorialBlockers.id, r.blockerId)) : [];
    digitalRequestAssert(!blocker || blocker.resolvedAt, 'El Especialista debe revisar el bloqueo activo antes de cancelar esta solicitud');
    await tx.update(solicitudesArea).set({ estado: 'cancelada', version: r.version + 1, resolvedById: actor.id, resolvedAt: new Date(), outcome: reason || null }).where(eq(solicitudesArea.id, id));
    await event(tx, id, project.id, actor.id, 'DIGITAL_REQUEST_CANCELADA', { text: reason || null });
    const target = await obtenerEspecialistaActual(project.id, project.especialistaId, tx);
    if (target) await notify(tx, project.id, id, target, 'especialista', 'Soporte Digital canceló una solicitud: ' + r.asunto);
    return { ok: true };
  });
}
export async function decideDigitalRequest(actor: Actor, id: string, expectedVersion: number, action: 'review' | 'return' | 'resolve' | 'unblock', text: string,
  result: { resultWorkItemId?: string; resultAttachmentId?: string; resolveBlocker?: boolean } = {}) {
  text = text.trim(); digitalRequestAssert(['review', 'return', 'resolve', 'unblock'].includes(action) && text.length >= 5 && text.length <= 2000, 'Revisa la acción y su explicación', 400);
  return db.transaction(async tx => {
    await role(tx, actor, 'especialista'); const { request: r, project, work } = await lockRequest(tx, id);
    digitalRequestAssert(actor.id !== r.requestedById && await obtenerEspecialistaActual(project.id, project.especialistaId, tx) === actor.id, 'No eres el Especialista coordinador de esta solicitud', 403);
    digitalRequestAssert(r.version === expectedVersion && (action === 'unblock' ? r.estado === 'resuelta' : ['pendiente', 'en_revision'].includes(r.estado)), 'La solicitud cambió. Actualiza antes de decidir.');
    digitalRequestAssert(action !== 'review' || r.estado === 'pendiente', 'La revisión ya fue iniciada');
    digitalRequestAssert(action === 'resolve' || !result.resultWorkItemId && !result.resultAttachmentId && !result.resolveBlocker, 'Solo una resolución admite referencias o revisión del bloqueo', 400);
    if (result.resultWorkItemId) {
      const [ref] = await tx.select().from(workItems).where(eq(workItems.id, result.resultWorkItemId));
      digitalRequestAssert(ref?.proyectoId === project.id && ref.tipo === 'soporte_digital' && ref.estado !== 'cancelado', 'La tarea resultante no pertenece al contexto digital del proyecto', 404);
    }
    if (result.resultAttachmentId) {
      const [ref] = await tx.select({ id: solicitudArchivos.id }).from(solicitudArchivos).where(and(eq(solicitudArchivos.id, result.resultAttachmentId), eq(solicitudArchivos.solicitudId, id)));
      digitalRequestAssert(ref, 'La evidencia no pertenece a esta solicitud', 404);
    }
    if (result.resolveBlocker || action === 'unblock') {
      const [blocker] = r.blockerId ? await tx.select().from(editorialBlockers).where(eq(editorialBlockers.id, r.blockerId)).for('update') : [];
      digitalRequestAssert(blocker && !blocker.resolvedAt && blocker.workItemId === work.id && work.estado === 'bloqueado' && work.gateBloqueante === blocker.reason, 'El bloqueo cambió o no pertenece a esta solicitud');
      digitalRequestAssert(!['pausado', 'culminado', 'retirado'].includes(project.estado), 'No se puede reactivar una tarea de un proyecto pausado o cerrado');
      const created = (await tx.execute<{ detalles: { previousWorkState?: string } }>(sql`SELECT detalles FROM audit_logs WHERE entity_type='solicitud' AND entity_id=${id}::uuid AND accion='DIGITAL_REQUEST_CREADA' LIMIT 1`)).rows[0];
      const prior = created?.detalles.previousWorkState;
      digitalRequestAssert(prior && ['pendiente', 'en_progreso', 'completado'].includes(prior), 'No se conoce el estado anterior de la tarea');
      await tx.update(editorialBlockers).set({ resolvedAt: new Date(), resolvedBy: actor.id, resolution: text }).where(eq(editorialBlockers.id, blocker.id));
      await tx.update(workItems).set({ estado: prior as 'pendiente' | 'en_progreso' | 'completado', gateBloqueante: null }).where(eq(workItems.id, work.id));
      await event(tx, id, project.id, actor.id, 'DIGITAL_REQUEST_BLOQUEO_RESUELTO', { text, blockerId: blocker.id });
    }
    if (action === 'unblock') {
      await tx.update(solicitudesArea).set({ version: r.version + 1 }).where(eq(solicitudesArea.id, id));
      await notify(tx, project.id, id, r.requestedById!, 'soporte_digital', 'El Especialista resolvió el bloqueo de tu tarea: ' + r.asunto);
      return { ok: true };
    }
    const estado = action === 'resolve' ? 'resuelta' : action === 'return' ? 'requiere_informacion' : 'en_revision';
    await tx.update(solicitudesArea).set({ estado, targetUserId: actor.id, version: r.version + 1, ...(action === 'resolve' ? { resolvedById: actor.id, resolvedAt: new Date(), outcome: text } : {}) }).where(eq(solicitudesArea.id, id));
    if (action === 'return') await tx.insert(informacionSolicitudArea).values({ solicitudId: id, pregunta: text, askedById: actor.id });
    await event(tx, id, project.id, actor.id, action === 'resolve' ? 'DIGITAL_REQUEST_RESUELTA' : action === 'return' ? 'DIGITAL_REQUEST_DEVUELTA' : 'DIGITAL_REQUEST_EN_REVISION', { text, ...result });
    await notify(tx, project.id, id, r.requestedById!, 'soporte_digital', action === 'resolve' ? 'Tu solicitud fue resuelta: ' + r.asunto : action === 'return' ? 'Tu solicitud requiere información: ' + r.asunto : 'Tu solicitud está en revisión: ' + r.asunto);
    return { ok: true };
  });
}

export async function attachDigitalRequest(actor: Actor, id: string, input: { expectedVersion: number; uploadKey: string; name: string; contentBase64: string }) {
  digitalRequestAssert(/^[^\\/\x00-\x1f\x7f]{1,180}$/.test(input.name) && /\.(pdf|png|jpe?g)$/i.test(input.name), 'Selecciona una imagen PNG/JPEG o un PDF', 400);
  digitalRequestAssert(input.contentBase64.length <= 6990510 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.contentBase64), 'Archivo inválido o demasiado grande', 400);
  const content = Buffer.from(input.contentBase64, 'base64'), sha256 = createHash('sha256').update(content).digest('hex');
  digitalRequestAssert(content.length > 0 && content.length <= 5 * 1024 * 1024, 'La evidencia debe pesar entre 1 byte y 5 MB', 400);
  const ext = input.name.split('.').pop()!.toLowerCase();
  const mimeType = ext === 'pdf' && content.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf'
    : ext === 'png' && content.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
    : ['jpg', 'jpeg'].includes(ext) && content[0] === 255 && content[1] === 216 && content[2] === 255 ? 'image/jpeg' : null;
  digitalRequestAssert(mimeType, 'El contenido no coincide con el tipo de archivo', 400);
  return db.transaction(async tx => {
    await role(tx, actor, 'soporte_digital'); const { request: r, project, work } = await lockRequest(tx, id, actor.id);
    const [retry] = await tx.select({ id: solicitudArchivos.id, sha256: solicitudArchivos.sha256, name: solicitudArchivos.name }).from(solicitudArchivos).where(and(eq(solicitudArchivos.solicitudId, id), eq(solicitudArchivos.uploadKey, input.uploadKey)));
    if (retry) { digitalRequestAssert(retry.sha256 === sha256 && retry.name === input.name, 'La clave de carga ya corresponde a otra evidencia'); return { id: retry.id, reused: true }; }
    digitalRequestAssert(r.version === input.expectedVersion && ['pendiente', 'requiere_informacion'].includes(r.estado), 'La solicitud cambió o no admite evidencia. Actualiza el detalle.');
    digitalRequestAssert(project.estado !== 'retirado' && work.estado !== 'cancelado', 'La tarea ya no admite evidencia');
    const [created] = await tx.insert(solicitudArchivos).values({ solicitudId: id, uploadedById: actor.id, name: input.name, mimeType, content, size: content.length, sha256, uploadKey: input.uploadKey }).returning({ id: solicitudArchivos.id });
    await tx.update(solicitudesArea).set({ version: r.version + 1 }).where(eq(solicitudesArea.id, id));
    await event(tx, id, project.id, actor.id, 'DIGITAL_REQUEST_ARCHIVO', { text: input.name, attachmentId: created!.id });
    return { id: created!.id, reused: false };
  });
}
export async function readDigitalRequestFile(actor: Actor, id: string, fileId: string) {
  const allowed = await pool.query(`WITH context AS (${CONTEXT}) SELECT r.id FROM solicitudes_area r JOIN context c ON c.work_item_id=r.work_item_id AND c.proyecto_id=r.proyecto_id
    WHERE r.tipo IN ${TYPES} AND r.id=$1::uuid AND ${actor.rol === 'especialista' ? 'c.specialist_id' : 'r.requested_by_id'}=$2::uuid`, [id, actor.id]);
  digitalRequestAssert(allowed.rowCount, 'Solicitud no encontrada', 404);
  const [file] = await db.select().from(solicitudArchivos).where(and(eq(solicitudArchivos.solicitudId, id), eq(solicitudArchivos.id, fileId)));
  digitalRequestAssert(file, 'Evidencia no encontrada', 404);
  return file;
}
