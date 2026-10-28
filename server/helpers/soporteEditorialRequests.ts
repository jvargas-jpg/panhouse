import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { informacionSolicitudArea, notificaciones, proyectos, solicitudesArea, users } from '../db/schema/index.js';
import { registrarEvento, type AccionAuditoria } from './auditLog.js';
import { obtenerEspecialistaActual } from './carga.js';
import { ErrorDiseno } from './diseno.js';
import type { Tx } from './tx.js';
import { QUALITY_REQUEST_TYPES, QUALITY_REQUEST_LABELS, type CreateQualityRequest, type QualityRequestContext, type QualityRequestDetail, type QualityRequestEligibility, type QualityRequestFilters, type QualityRequestList, type QualityRequestRow, type QualityRequestStatus, type QualityRequestType } from '../../shared/soporteEditorialRequests.js';

type Actor = { id: string; rol: string };
const TYPES = "('calidad_material','calidad_aclaracion','calidad_tecnico')";
const OPEN = ['pendiente', 'en_revision', 'requiere_informacion'] as const;
const EVENTS: Record<string, string> = {
  CALIDAD_REQUEST_CREADA: 'Solicitud enviada', CALIDAD_REQUEST_EN_REVISION: 'Revisión iniciada', CALIDAD_REQUEST_DEVUELTA: 'Información solicitada',
  CALIDAD_REQUEST_REENVIADA: 'Información completada', CALIDAD_REQUEST_RESUELTA: 'Solicitud resuelta', CALIDAD_REQUEST_CANCELADA: 'Solicitud cancelada',
};
function requireValue(value: unknown, message: string, status = 409): asserts value { if (!value) throw new ErrorDiseno(status, message); }
const iso = (v: string | Date) => new Date(v).toISOString();

// Ronda, versión y proyecto se resuelven por relaciones, nunca por
// nombres de archivo o IDs de proyecto suministrados por el cliente.
const CONTEXT = `SELECT q.id quality_phase_id,q.numero_fase phase,q.ronda round,q.pdf_version version_label,q.work_item_id,
  p.id project_id,p.codigo project_code,p.estado project_state,
  coalesce(nullif(trim(p.titulo_definitivo),''),nullif(trim(p.titulo),''),'Proyecto editorial') project_title,
  coalesce(au.names,author.nombre) authors,CASE WHEN p.portada_decision_autor='aprobada' THEN p.propuesta_portada_url END cover_url,
  owner.id specialist_id,specialist.nombre specialist,designer.nombre designer,
  (p.estado<>'retirado' AND w.estado<>'cancelado') work_accessible,
  (q.revisado_en IS NULL AND w.estado IN ('pendiente','en_progreso','bloqueado') AND p.estado NOT IN ('culminado','retirado','pausado')
    AND v.calidad_fase_id=q.id AND owner.id IS NOT NULL AND specialist.activo AND specialist.rol='especialista'
    AND NOT EXISTS(SELECT 1 FROM diseno_versiones newer WHERE newer.diseno_id=v.diseno_id AND newer.numero>v.numero AND newer.calidad_fase_id IS NOT NULL)) eligible
  FROM ficha_calidad_fases q JOIN work_items w ON w.id=q.work_item_id AND w.tipo='calidad'
  JOIN fichas_trazabilidad f ON f.id=q.ficha_id AND f.proyecto_id=w.proyecto_id
  JOIN diseno_versiones v ON v.id=q.diseno_version_id JOIN disenos d ON d.id=v.diseno_id AND d.proyecto_id=f.proyecto_id
  JOIN proyectos p ON p.id=f.proyecto_id JOIN autores author ON author.id=p.autor_id
  LEFT JOIN (SELECT x.proyecto_id,string_agg(a.nombre,', ' ORDER BY a.nombre) names FROM proyectos_autores x JOIN autores a ON a.id=x.autor_id GROUP BY x.proyecto_id) au ON au.proyecto_id=p.id
  LEFT JOIN LATERAL (SELECT coalesce((SELECT a.usuario_id FROM project_assignments a WHERE a.proyecto_id=p.id AND a.tipo='especialista' AND a.work_item_id IS NULL AND a.finalizado_en IS NULL),
    CASE WHEN NOT EXISTS(SELECT 1 FROM project_assignments a WHERE a.proyecto_id=p.id AND a.tipo='especialista' AND a.work_item_id IS NULL) THEN p.especialista_id END) id) owner ON true
  LEFT JOIN usuarios specialist ON specialist.id=owner.id LEFT JOIN usuarios designer ON designer.id=p.disenador_id`;
interface ContextRow extends Record<string, unknown> {
  project_id: string; project_code: string; project_title: string; authors: string; cover_url: string | null;
  work_item_id: string; quality_phase_id: string; phase: number; round: number; version_label: string | null;
  specialist_id: string | null; specialist: string | null; designer: string | null; eligible: boolean; work_accessible: boolean;
}
interface Row extends ContextRow {
  id: string; tipo: QualityRequestType; asunto: string; descripcion: string; estado: QualityRequestStatus; version: number;
  requested_at: Date | string; updated_at: Date | string; last_event: string | null;
  resolved_at: Date | string | null; resolved_by: string | null; outcome: string | null;
}
function context(r: ContextRow): QualityRequestContext {
  return { projectId: r.project_id, projectCode: r.project_code, projectTitle: r.project_title, authors: r.authors, coverUrl: r.cover_url,
    workItemId: r.work_item_id, qualityPhaseId: r.quality_phase_id, phase: r.phase, round: r.round, versionLabel: r.version_label };
}
function row(r: Row): QualityRequestRow {
  return { ...context(r), id: r.id, type: r.tipo, subject: r.asunto, status: r.estado, version: r.version, requestedAt: iso(r.requested_at), updatedAt: iso(r.updated_at),
    lastEvent: EVENTS[r.last_event ?? ''] ?? 'Solicitud enviada', requiresAction: r.estado === 'requiere_informacion', canCancel: OPEN.includes(r.estado as typeof OPEN[number]), workAccessible: r.work_accessible };
}
const SOURCE = `SELECT c.*,r.id,r.tipo,r.asunto,r.descripcion,r.estado,r.version,r.requested_by_id,r.requested_at,r.resolved_at,r.outcome,
  decider.nombre resolved_by,greatest(r.requested_at,coalesce(r.resolved_at,r.requested_at),coalesce(last.created_at,r.requested_at)) updated_at,last.accion last_event
  FROM solicitudes_area r JOIN context c ON c.work_item_id=r.work_item_id AND c.project_id=r.proyecto_id
  LEFT JOIN usuarios decider ON decider.id=r.resolved_by_id
  LEFT JOIN LATERAL(SELECT a.accion,a.created_at FROM audit_logs a WHERE a.entity_id=r.id AND a.entity_type='solicitud' ORDER BY a.created_at DESC,a.id DESC LIMIT 1) last ON true
  WHERE r.tipo IN ${TYPES}`;

export async function eligibleQualityRequests(search: string, page: number, pageSize: number, workItemId?: string): Promise<QualityRequestEligibility> {
  const { rows } = await pool.query<{ result: { items: ContextRow[]; total: number; page: number; pages: number } }>(
    `WITH context AS (${CONTEXT}), eligible AS (SELECT * FROM context WHERE eligible AND ($1='' OR strpos(lower(concat_ws(' ',project_title,project_code,authors,version_label,'F'||phase||'.'||round,'ronda '||round)),lower($1))>0)
      AND ($4::uuid IS NULL OR work_item_id=$4)), meta AS (SELECT count(*)::int total,greatest(1,ceil(count(*)::numeric/$3))::int pages FROM eligible),
      paged AS(SELECT * FROM eligible ORDER BY project_title,phase,round,work_item_id LIMIT $3 OFFSET ((SELECT least($2,pages)-1 FROM meta)*$3))
      SELECT json_build_object('items',coalesce((SELECT json_agg(paged) FROM paged),'[]'),'total',total,'pages',pages,'page',least($2,pages)) result FROM meta`, [search.trim(), page, pageSize, workItemId ?? null]);
  const data = rows[0]!.result;
  return { ...data, items: data.items.map(r => ({ ...context(r), specialist: r.specialist! })) };
}

export async function listQualityRequests(actorId: string, f: QualityRequestFilters): Promise<QualityRequestList> {
  const args: unknown[] = [actorId], filters: string[] = [];
  const bind = (v: unknown) => { args.push(v); return '$' + args.length; };
  if (f.search.trim()) filters.push(`strpos(lower(concat_ws(' ',project_title,project_code,authors,asunto,tipo,CASE tipo WHEN 'calidad_material' THEN 'Material incorrecto o faltante' WHEN 'calidad_aclaracion' THEN 'Aclaración operativa' ELSE 'Problema de acceso o archivo' END,version_label,'F'||phase||'.'||round,'ronda '||round)),lower(${bind(f.search.trim())}))>0`);
  if (f.type) filters.push(`tipo=${bind(f.type)}`);
  if (f.status) filters.push(`estado=${bind(f.status)}`);
  if (f.project) filters.push(`project_id=${bind(f.project)}::uuid`);
  if (f.from) filters.push(`(requested_at AT TIME ZONE 'America/Caracas')::date>=${bind(f.from)}::date`);
  if (f.to) filters.push(`(requested_at AT TIME ZONE 'America/Caracas')::date<=${bind(f.to)}::date`);
  const bucket = f.tab === 'pending' ? "estado IN ('pendiente','en_revision')" : f.tab === 'returned' ? "estado='requiere_informacion'" : f.tab === 'resolved' ? "estado IN ('resuelta','rechazada')" : f.tab === 'cancelled' ? "estado='cancelada'" : 'true';
  const size = bind(f.pageSize), page = bind(f.page);
  const { rows } = await pool.query<{ result: { items: Row[]; total: number; pages: number; page: number; counts: QualityRequestList['counts']; projects: QualityRequestList['projects'] } }>(
    `WITH context AS (${CONTEXT}), requests AS (${SOURCE} AND r.requested_by_id=$1::uuid), filtered AS (SELECT * FROM requests WHERE ${filters.join(' AND ') || 'true'}),
      selected AS(SELECT * FROM filtered WHERE ${bucket}), meta AS(SELECT count(*)::int total,greatest(1,ceil(count(*)::numeric/${size}))::int pages FROM selected),
      paged AS(SELECT id,tipo,asunto,estado,version,requested_at,updated_at,last_event,project_id,project_code,project_title,authors,cover_url,work_item_id,quality_phase_id,phase,round,version_label,work_accessible
        FROM selected ORDER BY CASE WHEN estado='requiere_informacion' THEN 0 WHEN estado IN ('pendiente','en_revision') THEN 1 WHEN estado='cancelada' THEN 3 ELSE 2 END,updated_at DESC,id
        LIMIT ${size} OFFSET ((SELECT least(${page},pages)-1 FROM meta)*${size}))
      SELECT json_build_object('items',coalesce((SELECT json_agg(paged) FROM paged),'[]'),'total',m.total,'pages',m.pages,'page',least(${page},m.pages),
        'counts',(SELECT json_build_object('all',count(*),'pending',count(*) FILTER(WHERE estado IN ('pendiente','en_revision')),'returned',count(*) FILTER(WHERE estado='requiere_informacion'),
          'resolved',count(*) FILTER(WHERE estado IN ('resuelta','rechazada')),'cancelled',count(*) FILTER(WHERE estado='cancelada')) FROM filtered),
        'projects',coalesce((SELECT json_agg(x ORDER BY name,id) FROM (SELECT DISTINCT project_id id,project_title name FROM requests) x),'[]')) result FROM meta m`, args);
  const data = rows[0]!.result;
  return { ...data, items: data.items.map(row) };
}

export async function detailQualityRequest(id: string, actorId: string, incoming = false): Promise<QualityRequestDetail | null> {
  const { rows } = await pool.query<Row>(`WITH context AS (${CONTEXT}) ${SOURCE} AND r.id=$1::uuid AND ${incoming ? 'c.specialist_id' : 'r.requested_by_id'}=$2::uuid`, [id, actorId]);
  const r = rows[0]; if (!r) return null;
  const [questions, history] = await Promise.all([
    pool.query<{ id: string; text: string; actor: string; at: Date; answer: string | null; answeredBy: string | null; answeredAt: Date | null }>(
      `SELECT i.id,i.pregunta text,a.nombre actor,i.asked_at at,i.respuesta answer,b.nombre "answeredBy",i.answered_at "answeredAt" FROM informacion_solicitud_area i
        JOIN usuarios a ON a.id=i.asked_by_id LEFT JOIN usuarios b ON b.id=i.answered_by_id WHERE i.solicitud_id=$1 ORDER BY i.asked_at,i.id`, [id]),
    pool.query<{ id: string; accion: string; actor: string; created_at: Date; detalles: { text?: string; resultQualityPhaseId?: string } | null }>(
      `SELECT a.id,a.accion,coalesce(u.nombre,'Sistema') actor,a.created_at,a.detalles FROM audit_logs a LEFT JOIN usuarios u ON u.id=a.actor_id
        WHERE a.entity_type='solicitud' AND a.entity_id=$1 ORDER BY a.created_at,a.id`, [id]),
  ]);
  const resultId = [...history.rows].reverse().find(h => h.accion === 'CALIDAD_REQUEST_RESUELTA')?.detalles?.resultQualityPhaseId;
  const ref = resultId ? (await pool.query<ContextRow>(`WITH context AS (${CONTEXT}) SELECT * FROM context WHERE quality_phase_id=$1 AND project_id=$2`, [resultId, r.project_id])).rows[0] : null;
  return { summary: row(r), description: r.descripcion, destination: 'Especialista coordinador', specialist: r.specialist, designer: r.designer,
    questions: questions.rows.map(q => ({ ...q, at: iso(q.at), answeredAt: q.answeredAt ? iso(q.answeredAt) : null })),
    history: history.rows.map(h => ({ id: h.id, label: EVENTS[h.accion] ?? 'Solicitud actualizada', actor: h.actor, at: iso(h.created_at), text: h.detalles?.text ?? null })),
    result: r.estado === 'resuelta' || r.estado === 'rechazada' ? { text: r.outcome ?? '', actor: r.resolved_by, at: iso(r.resolved_at!), references: ref ? context(ref) : null } : null,
    cancellation: r.estado === 'cancelada' ? { actor: r.resolved_by, at: iso(r.resolved_at!), reason: r.outcome } : null };
}

async function actorRole(tx: Tx, actor: Actor, role: string) {
  const [person] = await tx.select().from(users).where(and(eq(users.id, actor.id), eq(users.activo, true)));
  requireValue(actor.rol === role && person?.rol === role, 'Rol no autorizado', 403);
}
async function notify(tx: Tx, projectId: string, target: string, role: 'especialista' | 'soporte_editorial', id: string, message: string) {
  await tx.insert(notificaciones).values({ proyectoId: projectId, usuarioDestinoId: target, rolDestino: role,
    targetPath: role === 'especialista' ? '/?vista=solicitudes&qualityRequest=' + id : '/?vista=mis-solicitudes&request=' + id, mensaje: message });
}
async function event(tx: Tx, id: string, projectId: string, actorId: string, action: AccionAuditoria, details?: Record<string, unknown>) {
  await registrarEvento(tx, { actorId, accion: action, entityType: 'solicitud', entityId: id, proyectoId: projectId, detalles: details });
}

export async function createQualityRequest(actor: Actor, input: CreateQualityRequest) {
  requireValue(QUALITY_REQUEST_TYPES.includes(input.type), 'Tipo no permitido', 400);
  const subject = input.subject.trim(), description = input.description.trim();
  requireValue(subject.length >= 5 && subject.length <= 160 && description.length >= 10 && description.length <= 4000, 'Revisa el tema y la descripción', 400);
  try { return await db.transaction(async tx => {
    await actorRole(tx, actor, 'soporte_editorial');
    const origin = (await tx.execute<ContextRow>(sql`WITH context AS (${sql.raw(CONTEXT)}) SELECT * FROM context WHERE work_item_id=${input.workItemId}::uuid`)).rows[0];
    requireValue(origin, 'Validación no disponible', 404);
    // Tomar el mismo bloqueo de proyecto que los comandos de Diseño/Calidad.
    await tx.select().from(proyectos).where(eq(proyectos.id, origin.project_id)).for('update');
    const [retry] = await tx.select().from(solicitudesArea).where(and(eq(solicitudesArea.requestedById, actor.id), eq(solicitudesArea.businessKey, input.idempotencyKey), inArray(solicitudesArea.tipo, [...QUALITY_REQUEST_TYPES])));
    if (retry) {
      requireValue(retry.workItemId === input.workItemId && retry.tipo === input.type && retry.asunto === subject && retry.descripcion === description, 'La clave de envío ya corresponde a otra solicitud');
      return { ok: true, id: retry.id, reused: true };
    }
    const current = (await tx.execute<ContextRow>(sql`WITH context AS (${sql.raw(CONTEXT)}) SELECT * FROM context WHERE work_item_id=${input.workItemId}::uuid`)).rows[0];
    requireValue(current?.eligible, 'Esta ronda no admite nuevas solicitudes o no tiene Especialista coordinador');
    const [duplicate] = await tx.select().from(solicitudesArea).where(and(eq(solicitudesArea.requestedById, actor.id), eq(solicitudesArea.workItemId, input.workItemId), eq(solicitudesArea.tipo, input.type), inArray(solicitudesArea.estado, [...OPEN])));
    requireValue(!duplicate, 'Ya tienes una solicitud de este tipo pendiente para esta ronda');
    const [created] = await tx.insert(solicitudesArea).values({ proyectoId: current.project_id, workItemId: current.work_item_id, tipo: input.type,
      businessKey: input.idempotencyKey, requestedById: actor.id, targetUserId: current.specialist_id!, asunto: subject, descripcion: description }).returning();
    await event(tx, created!.id, current.project_id, actor.id, 'CALIDAD_REQUEST_CREADA', { qualityPhaseId: current.quality_phase_id, workItemId: current.work_item_id, phase: current.phase, round: current.round, versionLabel: current.version_label });
    await notify(tx, current.project_id, current.specialist_id!, 'especialista', created!.id, `Soporte Editorial reportó ${QUALITY_REQUEST_LABELS[input.type].toLowerCase()}: ${subject}`);
    return { ok: true, id: created!.id, reused: false };
  }); } catch (error) {
    if ((error as { code?: string }).code === '23505') throw new ErrorDiseno(409, 'El envío ya fue registrado. Actualiza tus solicitudes.');
    throw error;
  }
}

async function lockRequest(tx: Tx, id: string, ownerId?: string) {
  const [origin] = await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id, id));
  requireValue(origin && QUALITY_REQUEST_TYPES.includes(origin.tipo as QualityRequestType) && (!ownerId || origin.requestedById === ownerId), 'Solicitud no encontrada', 404);
  const [project] = await tx.select().from(proyectos).where(eq(proyectos.id, origin.proyectoId)).for('update');
  const [request] = await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id, id)).for('update');
  requireValue(project && request, 'Solicitud no encontrada', 404);
  return { request, project };
}

export async function cancelQualityRequest(actor: Actor, id: string, expectedVersion: number, reason?: string) {
  requireValue(!reason || reason.length <= 2000, 'Motivo demasiado largo', 400);
  return db.transaction(async tx => {
    await actorRole(tx, actor, 'soporte_editorial');
    const { request: r, project } = await lockRequest(tx, id, actor.id);
    requireValue(r.version === expectedVersion && OPEN.includes(r.estado as typeof OPEN[number]), 'La solicitud cambió o ya está cerrada. Actualiza el detalle.');
    await tx.update(solicitudesArea).set({ estado: 'cancelada', resolvedAt: new Date(), resolvedById: actor.id, outcome: reason?.trim() || null, version: r.version + 1 }).where(eq(solicitudesArea.id, id));
    await event(tx, id, r.proyectoId, actor.id, 'CALIDAD_REQUEST_CANCELADA', { text: reason?.trim() || null });
    const specialist = await obtenerEspecialistaActual(project.id, project.especialistaId, tx);
    if (specialist) await notify(tx, project.id, specialist, 'especialista', id, 'Soporte Editorial canceló su solicitud: ' + r.asunto);
    return { ok: true };
  });
}

export async function answerQualityRequest(actor: Actor, id: string, expectedVersion: number, questionId: string, text: string) {
  requireValue(text.trim().length >= 5 && text.trim().length <= 2000, 'Escribe una respuesta de entre 5 y 2000 caracteres', 400);
  return db.transaction(async tx => {
    await actorRole(tx, actor, 'soporte_editorial');
    const { request: r, project } = await lockRequest(tx, id, actor.id);
    requireValue(r.version === expectedVersion && r.estado === 'requiere_informacion', 'La solicitud cambió. Actualiza antes de completar la información.');
    const [question] = await tx.select().from(informacionSolicitudArea).where(and(eq(informacionSolicitudArea.solicitudId, id), eq(informacionSolicitudArea.id, questionId))).for('update');
    requireValue(question && !question.answeredAt, 'La pregunta ya fue respondida o no pertenece a esta solicitud');
    const target = await obtenerEspecialistaActual(project.id, project.especialistaId, tx);
    requireValue(target, 'El proyecto necesita un Especialista coordinador para recibir la respuesta');
    await tx.update(informacionSolicitudArea).set({ respuesta: text.trim(), answeredById: actor.id, answeredAt: new Date() }).where(eq(informacionSolicitudArea.id, question.id));
    await tx.update(solicitudesArea).set({ estado: 'pendiente', targetUserId: target, version: r.version + 1 }).where(eq(solicitudesArea.id, id));
    await event(tx, id, project.id, actor.id, 'CALIDAD_REQUEST_REENVIADA', { text: text.trim(), questionId });
    await notify(tx, project.id, target, 'especialista', id, 'Soporte Editorial completó la información: ' + r.asunto);
    return { ok: true };
  });
}

export async function decideQualityRequest(actor: Actor, id: string, expectedVersion: number, action: 'review' | 'return' | 'resolve', text: string, resultQualityPhaseId?: string) {
  requireValue(['review', 'return', 'resolve'].includes(action) && text.trim().length >= 5 && text.trim().length <= 2000, 'Indica la acción y su explicación', 400);
  requireValue(!resultQualityPhaseId || action === 'resolve', 'Solo la resolución admite una referencia de resultado', 400);
  return db.transaction(async tx => {
    await actorRole(tx, actor, 'especialista');
    const { request: r, project } = await lockRequest(tx, id);
    requireValue(r.requestedById !== actor.id && await obtenerEspecialistaActual(project.id, project.especialistaId, tx) === actor.id, 'No eres el Especialista responsable de esta solicitud', 403);
    requireValue(r.version === expectedVersion && ['pendiente', 'en_revision'].includes(r.estado), 'La solicitud cambió. Actualiza el detalle antes de decidir.');
    requireValue(action !== 'review' || r.estado === 'pendiente', 'La revisión ya fue iniciada');
    if (resultQualityPhaseId) {
      const ref = (await tx.execute<ContextRow>(sql`WITH context AS (${sql.raw(CONTEXT)}) SELECT * FROM context WHERE quality_phase_id=${resultQualityPhaseId}::uuid AND project_id=${project.id}::uuid`)).rows[0];
      requireValue(ref, 'La referencia de resultado no pertenece al proyecto', 404);
    }
    const estado = action === 'resolve' ? 'resuelta' : action === 'return' ? 'requiere_informacion' : 'en_revision';
    await tx.update(solicitudesArea).set({ estado, targetUserId: actor.id, version: r.version + 1, ...(action === 'resolve' ? { outcome: text.trim(), resolvedAt: new Date(), resolvedById: actor.id } : {}) }).where(eq(solicitudesArea.id, id));
    if (action === 'return') await tx.insert(informacionSolicitudArea).values({ solicitudId: id, pregunta: text.trim(), askedById: actor.id });
    await event(tx, id, project.id, actor.id, action === 'resolve' ? 'CALIDAD_REQUEST_RESUELTA' : action === 'return' ? 'CALIDAD_REQUEST_DEVUELTA' : 'CALIDAD_REQUEST_EN_REVISION', { text: text.trim(), ...(resultQualityPhaseId ? { resultQualityPhaseId } : {}) });
    await notify(tx, project.id, r.requestedById!, 'soporte_editorial', id, `Tu solicitud ${action === 'resolve' ? 'fue resuelta' : action === 'return' ? 'requiere información' : 'está en revisión'}: ${r.asunto}`);
    return { ok: true };
  });
}

export async function incomingQualityRequests(actorId: string, page: number, pageSize: number) {
  const { rows } = await pool.query<{ result: { items: Row[]; total: number; pages: number; page: number } }>(
    `WITH context AS (${CONTEXT}), requests AS (${SOURCE} AND c.specialist_id=$1::uuid AND r.estado IN ('pendiente','en_revision','requiere_informacion')),
      meta AS(SELECT count(*)::int total,greatest(1,ceil(count(*)::numeric/$3))::int pages FROM requests),
      paged AS(SELECT * FROM requests ORDER BY requested_at,id LIMIT $3 OFFSET ((SELECT least($2,pages)-1 FROM meta)*$3))
      SELECT json_build_object('items',coalesce((SELECT json_agg(paged) FROM paged),'[]'),'total',total,'pages',pages,'page',least($2,pages)) result FROM meta`, [actorId, page, pageSize]);
  return { ...rows[0]!.result, items: rows[0]!.result.items.map(row) };
}
