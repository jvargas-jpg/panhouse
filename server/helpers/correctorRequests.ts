import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { informacionSolicitudArea, notificaciones, proyectos, solicitudesArea, users } from '../db/schema/index.js';
import { registrarEvento } from './auditLog.js';
import { obtenerEspecialistaActual } from './carga.js';
import { correctorError, correctorWorkContext, lockCorrectorWork } from './correctorAccess.js';
import { etiquetaAlcance } from './correctorWork.js';
import { CORRECTOR_REQUEST_TYPES } from '../../shared/correctorRequests.js';
import type { CorrectorRequestDetail, CorrectorRequestList, CorrectorRequestSummary, CorrectorRequestType } from '../../shared/correctorRequests.js';

// Solicitudes que el PROPIO Corrector envía sobre una corrección ya
// asignada (master prompt Mis solicitudes §2-12): reutiliza
// solicitudes_area (mismo patrón que editorOwnRequests.ts), nunca un
// segundo sistema de tickets. Los tres tipos del Corrector van SIEMPRE
// al Especialista coordinador -- a diferencia de Editor (que reparte
// entre Jefe de Edición y Especialista), acá no hay ambigüedad de
// destino que resolver por tipo.
const EVENTS: Record<string, string> = {
  CORRECTOR_REQUEST_CREADA: 'Solicitud enviada', CORRECTOR_REQUEST_CANCELADA: 'Solicitud cancelada',
  CORRECTOR_REQUEST_EN_REVISION: 'Solicitud en revisión', CORRECTOR_REQUEST_DEVUELTA: 'Solicitud devuelta',
  CORRECTOR_REQUEST_REENVIADA: 'Información enviada', CORRECTOR_REQUEST_RESUELTA: 'Solicitud resuelta',
};

function status(estado: string): CorrectorRequestSummary['status'] {
  return estado === 'requiere_informacion' ? 'devuelta' : estado as CorrectorRequestSummary['status'];
}

export async function crearRequestCorrector(actorId: string, workItemId: string, type: CorrectorRequestType, motivo: string) {
  const trimmed = motivo.trim();
  if (trimmed.length < 5 || trimmed.length > 1000) throw correctorError('Escribe un motivo de entre 5 y 1000 caracteres', 400);
  if (!CORRECTOR_REQUEST_TYPES.includes(type)) throw correctorError('Tipo de solicitud no permitido', 400);
  return db.transaction(async tx => {
    const { item, correccion, project } = await lockCorrectorWork(tx, workItemId, actorId);
    if (['completado', 'cancelado'].includes(item.estado)) throw correctorError('Esta corrección ya no admite solicitudes');
    const [existing] = await tx.select({ id: solicitudesArea.id }).from(solicitudesArea)
      .where(and(eq(solicitudesArea.workItemId, workItemId), eq(solicitudesArea.requestedById, actorId), eq(solicitudesArea.tipo, type), inArray(solicitudesArea.estado, ['pendiente', 'en_revision', 'requiere_informacion'])));
    if (existing) throw correctorError('Ya enviaste una solicitud de este tipo para esta corrección, sin resolver todavía', 409);
    const targetUserId = await obtenerEspecialistaActual(correccion.proyectoId, project.especialistaId, tx);
    if (!targetUserId) throw correctorError('El proyecto no tiene un Especialista asignado');
    const [row] = await tx.insert(solicitudesArea).values({ proyectoId: correccion.proyectoId, workItemId, tipo: type, businessKey: randomUUID(), requestedById: actorId, targetUserId, descripcion: trimmed }).returning();
    await registrarEvento(tx, { actorId, accion: 'CORRECTOR_REQUEST_CREADA', entityType: 'solicitud', entityId: row!.id, proyectoId: correccion.proyectoId, detalles: { type, workItemId } });
    await tx.insert(notificaciones).values({ proyectoId: correccion.proyectoId, targetPath: '/proyectos/' + correccion.proyectoId, rolDestino: 'especialista', usuarioDestinoId: targetUserId, mensaje: `El Corrector envió una solicitud: ${trimmed}` });
    return row!;
  });
}

interface Row {
  authors: string; cover: string | null; requested_by: string; resolved_by_id: string | null; work_accessible: boolean; can_respond: boolean; updated_at: Date | string; last_event: string | null;
  id: string; tipo: string; proyecto_id: string; codigo: string; title: string; work_item_id: string; intervention_label: string;
  descripcion: string | null; estado: string; requested_at: string | Date; resolved_at: string | Date | null; outcome: string | null; version: number; return_reason: string | null; resolved_by: string | null;
}
const SOURCE = `SELECT r.id,r.tipo,r.proyecto_id,p.codigo,coalesce(nullif(trim(p.titulo_definitivo),''),nullif(trim(p.titulo),''),'Proyecto editorial') title,
 r.work_item_id,co.alcance intervention_label,
 r.descripcion,r.estado,r.requested_at,r.resolved_at,r.outcome,r.version,r.motivo return_reason,decider.nombre resolved_by,r.resolved_by_id,sender.nombre requested_by,
 coalesce((SELECT string_agg(a.nombre,', ' ORDER BY a.nombre) FROM proyectos_autores pa JOIN autores a ON a.id=pa.autor_id WHERE pa.proyecto_id=p.id),author.nombre) authors,
 CASE WHEN p.portada_decision_autor='aprobada' THEN p.propuesta_portada_url END cover,
 coalesce(co.corrector_id=r.requested_by_id,false) work_accessible,
 coalesce(co.corrector_id=r.requested_by_id AND p.estado NOT IN ('culminado','retirado') AND w.estado NOT IN ('completado','cancelado'),false) can_respond,
 greatest(r.requested_at,coalesce(r.resolved_at,r.requested_at),coalesce(last_event.created_at,r.requested_at)) updated_at,last_event.accion last_event
 FROM solicitudes_area r JOIN proyectos p ON p.id=r.proyecto_id JOIN work_items w ON w.id=r.work_item_id JOIN correcciones co ON co.work_item_id=r.work_item_id
 JOIN autores author ON author.id=p.autor_id
 LEFT JOIN usuarios sender ON sender.id=r.requested_by_id
 LEFT JOIN LATERAL (SELECT a.accion,a.created_at FROM audit_logs a WHERE a.entity_id=r.id AND a.entity_type='solicitud' ORDER BY a.created_at DESC,a.id DESC LIMIT 1) last_event ON true
 LEFT JOIN usuarios decider ON decider.id=r.resolved_by_id
 WHERE r.tipo IN ('corrector_material','corrector_aclaracion','corrector_tecnico') AND r.requested_by_id=$1::uuid`;
const iso = (v: string | Date) => new Date(v).toISOString();
function summary(r: Row): CorrectorRequestSummary {
  return {
    id: r.id, type: r.tipo as CorrectorRequestType, projectId: r.proyecto_id, code: r.codigo, title: r.title, authors: r.authors, coverUrl: r.cover,
    workItemId: r.work_item_id, interventionLabel: etiquetaAlcance(r.intervention_label),
    motivo: r.descripcion ?? '', status: status(r.estado), target: 'Especialista', requestedAt: iso(r.requested_at), updatedAt: iso(r.updated_at),
    lastEventLabel: r.last_event ? (EVENTS[r.last_event] ?? 'Solicitud actualizada') : 'Solicitud enviada',
    resolvedAt: r.resolved_at ? iso(r.resolved_at) : null, outcome: r.outcome, returnReason: r.return_reason, resolvedBy: r.resolved_by,
    requestedBy: r.requested_by, workAccessible: r.work_accessible, canRespond: r.can_respond, version: r.version,
  };
}

export async function listarRequestsCorrector(actorId: string, tab: 'all' | 'pending' | 'resolved' | 'returned' | 'cancelled' | 'rejected', page: number, pageSize: number, filters: { search?: string; type?: string; project?: string; from?: string; to?: string } = {}): Promise<CorrectorRequestList> {
  const { rows } = await pool.query<Row>(`${SOURCE} ORDER BY r.requested_at DESC, r.id`, [actorId]);
  const all = rows.map(summary);
  const items = all.filter(r =>
    (!filters.search || (r.title + ' ' + r.code + ' ' + r.authors + ' ' + r.motivo + ' ' + r.interventionLabel).toLocaleLowerCase('es').includes(filters.search.toLocaleLowerCase('es'))) &&
    (!filters.type || r.type === filters.type) && (!filters.project || r.projectId === filters.project) &&
    (!filters.from || r.requestedAt >= filters.from + 'T04:00:00.000Z') && (!filters.to || r.requestedAt < new Date(new Date(filters.to + 'T04:00:00.000Z').getTime() + 86400000).toISOString()));
  const rank: Record<string, number> = { devuelta: 0, pendiente: 1, en_revision: 1, resuelta: 2, rechazada: 2, cancelada: 3 };
  items.sort((a, b) => rank[a.status]! - rank[b.status]! || b.requestedAt.localeCompare(a.requestedAt) || a.id.localeCompare(b.id));
  const bucket = tab === 'all' ? items : items.filter(i => tab === 'pending' ? (i.status === 'pendiente' || i.status === 'en_revision') : i.status === tab.replace('returned', 'devuelta').replace('resolved', 'resuelta').replace('cancelled', 'cancelada').replace('rejected', 'rechazada'));
  const pages = Math.max(1, Math.ceil(bucket.length / pageSize)), safePage = Math.min(page, pages);
  return {
    items: bucket.slice((safePage - 1) * pageSize, safePage * pageSize), total: bucket.length, pages, page: safePage,
    counts: { pending: items.filter(i => i.status === 'pendiente' || i.status === 'en_revision').length, resolved: items.filter(i => i.status === 'resuelta').length, returned: items.filter(i => i.status === 'devuelta').length, cancelled: items.filter(i => i.status === 'cancelada').length, rejected: items.filter(i => i.status === 'rechazada').length, all: items.length },
    options: { projects: [...new Map(all.map(i => [i.projectId, { id: i.projectId, name: i.title }])).values()].sort((a, b) => a.name.localeCompare(b.name, 'es')) },
  };
}

export async function obtenerRequestCorrectorDetalle(id: string, actorId: string): Promise<CorrectorRequestDetail | null> {
  const { rows } = await pool.query<Row>(`${SOURCE} AND r.id=$2::uuid`, [actorId, id]);
  const r = rows[0]; if (!r) return null;
  const { rows: observations } = await pool.query<{ id: string; question: string; answer: string | null; at: Date; askedBy: string; answeredBy: string | null; answeredAt: Date | null }>(
    `SELECT i.id,i.pregunta question,i.respuesta answer,i.asked_at at,a.nombre "askedBy",b.nombre "answeredBy",i.answered_at "answeredAt" FROM informacion_solicitud_area i JOIN usuarios a ON a.id=i.asked_by_id LEFT JOIN usuarios b ON b.id=i.answered_by_id WHERE i.solicitud_id=$1 ORDER BY i.asked_at,i.id`, [id]);
  const { rows: history } = await pool.query<{ id: string; accion: string; actor: string; created_at: Date; detalles: { motivo?: string } | null }>(
    `SELECT a.id,a.accion,coalesce(u.nombre,'Sistema') actor,a.created_at,a.detalles FROM audit_logs a LEFT JOIN usuarios u ON u.id=a.actor_id WHERE a.entity_id=$1 AND a.entity_type='solicitud' ORDER BY a.created_at,a.id`, [id]);
  return {
    summary: summary(r), description: r.descripcion,
    observations: observations.map(o => ({ ...o, at: o.at.toISOString(), answeredAt: o.answeredAt?.toISOString() ?? null })),
    history: history.map(h => ({ id: h.id, label: (EVENTS[h.accion] ?? 'Solicitud actualizada') + (h.detalles?.motivo ? ' · ' + h.detalles.motivo : ''), actor: h.actor, at: h.created_at.toISOString() })),
  };
}

export async function cancelarRequestCorrector(id: string, actorId: string, expectedVersion: number) {
  return db.transaction(async tx => {
    const [r] = await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id, id)).for('update');
    if (!r || r.requestedById !== actorId || !CORRECTOR_REQUEST_TYPES.includes(r.tipo as CorrectorRequestType)) throw correctorError('Solicitud no encontrada', 404);
    if (r.estado !== 'pendiente' && r.estado !== 'en_revision') throw correctorError('Solo se puede cancelar una solicitud sin resolver', 409);
    if (r.version !== expectedVersion) throw correctorError('La solicitud cambió. Actualiza antes de cancelar.', 409);
    await tx.update(solicitudesArea).set({ estado: 'cancelada', resolvedAt: new Date(), resolvedById: actorId, version: r.version + 1 }).where(eq(solicitudesArea.id, id));
    await registrarEvento(tx, { actorId, accion: 'CORRECTOR_REQUEST_CANCELADA', entityType: 'solicitud', entityId: id, proyectoId: r.proyectoId });
    return { ok: true };
  });
}

export async function responderRequestCorrector(id: string, actorId: string, expectedVersion: number, text: string) {
  if (text.trim().length < 5 || text.trim().length > 1000) throw correctorError('Escribe una respuesta de entre 5 y 1000 caracteres', 400);
  return db.transaction(async tx => {
    const [origin] = await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id, id));
    if (!origin || origin.requestedById !== actorId || !CORRECTOR_REQUEST_TYPES.includes(origin.tipo as CorrectorRequestType)) throw correctorError('Solicitud no encontrada', 404);
    await correctorWorkContext(origin.workItemId!, actorId);
    const [r] = await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id, id)).for('update');
    if (!r || r.version !== expectedVersion || r.estado !== 'requiere_informacion') throw correctorError('La solicitud cambió. Actualiza antes de responder.', 409);
    const questions = await tx.select().from(informacionSolicitudArea).where(eq(informacionSolicitudArea.solicitudId, id)).orderBy(desc(informacionSolicitudArea.askedAt));
    const question = questions.find(q => !q.answeredAt);
    if (!question) throw correctorError('No hay información pendiente de respuesta');
    await tx.update(informacionSolicitudArea).set({ respuesta: text.trim(), answeredById: actorId, answeredAt: new Date() }).where(eq(informacionSolicitudArea.id, question.id));
    await tx.update(solicitudesArea).set({ estado: 'pendiente', version: r.version + 1 }).where(eq(solicitudesArea.id, id));
    await registrarEvento(tx, { actorId, accion: 'CORRECTOR_REQUEST_REENVIADA', entityType: 'solicitud', entityId: id, proyectoId: r.proyectoId, detalles: { motivo: text.trim() } });
    const [project] = await tx.select().from(proyectos).where(eq(proyectos.id, r.proyectoId));
    const target = await obtenerEspecialistaActual(r.proyectoId, project?.especialistaId ?? null, tx);
    if (target) await tx.insert(notificaciones).values({ proyectoId: r.proyectoId, targetPath: '/proyectos/' + r.proyectoId, rolDestino: 'especialista', usuarioDestinoId: target, mensaje: 'El Corrector completó la información de su solicitud.' });
    return { ok: true };
  });
}

// Decisión del Especialista (master prompt §40-48). Sin UI dedicada
// todavía (fuera de alcance de esta pantalla -- ver reporte final), pero
// el comando existe completo y probado para que Especialista pueda
// decidir vía API ya mismo, y una pantalla futura solo necesite llamarlo.
export async function decidirRequestCorrector(id: string, actor: { id: string; rol: string }, expectedVersion: number, action: 'review' | 'return' | 'resolve', text: string) {
  if (text.trim().length < 5 || text.trim().length > 1000) throw correctorError('Escribe una respuesta de entre 5 y 1000 caracteres', 400);
  return db.transaction(async tx => {
    const [origin] = await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id, id));
    if (!origin || !CORRECTOR_REQUEST_TYPES.includes(origin.tipo as CorrectorRequestType)) throw correctorError('Solicitud no encontrada', 404);
    const [project] = await tx.select().from(proyectos).where(eq(proyectos.id, origin.proyectoId)).for('update');
    const [r] = await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id, id)).for('update');
    const [recipient] = await tx.select().from(users).where(and(eq(users.id, actor.id), eq(users.activo, true)));
    const specialist = await obtenerEspecialistaActual(origin.proyectoId, project?.especialistaId ?? null, tx);
    if (!recipient || recipient.rol !== 'especialista' || actor.rol !== 'especialista' || specialist !== actor.id) throw correctorError('No eres el destinatario de esta solicitud', 403);
    if (!project || !r || r.version !== expectedVersion || !['pendiente', 'en_revision'].includes(r.estado)) throw correctorError('La solicitud cambió. Actualiza el detalle antes de decidir.');
    const state = action === 'resolve' ? 'resuelta' : action === 'return' ? 'requiere_informacion' : 'en_revision';
    await tx.update(solicitudesArea).set({
      estado: state, version: r.version + 1, motivo: action === 'return' ? text.trim() : r.motivo,
      ...(action === 'resolve' ? { outcome: text.trim(), resolvedAt: new Date(), resolvedById: actor.id } : {}),
    }).where(eq(solicitudesArea.id, id));
    if (action === 'return') await tx.insert(informacionSolicitudArea).values({ solicitudId: id, pregunta: text.trim(), askedById: actor.id });
    await registrarEvento(tx, { actorId: actor.id, accion: action === 'resolve' ? 'CORRECTOR_REQUEST_RESUELTA' : action === 'return' ? 'CORRECTOR_REQUEST_DEVUELTA' : 'CORRECTOR_REQUEST_EN_REVISION', entityType: 'solicitud', entityId: id, proyectoId: r.proyectoId, detalles: { motivo: text.trim() } });
    if (r.requestedById) await tx.insert(notificaciones).values({ proyectoId: r.proyectoId, targetPath: '/?vista=mis-solicitudes&request=' + id, rolDestino: 'corrector', usuarioDestinoId: r.requestedById, mensaje: `Tu solicitud está ${state === 'resuelta' ? 'resuelta' : state === 'requiere_informacion' ? 'devuelta para completar' : 'en revisión'}: ${text.trim()}` });
    return { ok: true };
  });
}
