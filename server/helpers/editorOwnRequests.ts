import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { notificaciones, proyectos, solicitudesArea, workItems } from '../db/schema/index.js';
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
  return estado === 'cancelada' ? 'cancelada' : estado === 'resuelta' || estado === 'rechazada' ? 'resuelta' : estado === 'requiere_informacion' ? 'devuelta' : estado === 'en_revision' ? 'en_revision' : 'pendiente';
}

export async function crearRequestEditor(actorId: string, workItemId: string, type: EditorRequestType, motivo: string) {
  const trimmed = motivo.trim();
  if (trimmed.length < 5 || trimmed.length > 1000) throw Object.assign(new Error('Escribe un motivo de entre 5 y 1000 caracteres'), { statusCode: 400 });
  return db.transaction(async tx => {
    const [item] = await tx.select({ id: workItems.id, proyectoId: workItems.proyectoId }).from(workItems).where(eq(workItems.id, workItemId)).for('update');
    if (!item) throw Object.assign(new Error('Intervención no encontrada'), { statusCode: 404 });
    const [proyecto] = await tx.select({ editorId: proyectos.editorId }).from(proyectos).where(eq(proyectos.id, item.proyectoId));
    if (proyecto?.editorId !== actorId) throw Object.assign(new Error('Esta intervención no está asignada a este Editor'), { statusCode: 403 });
    const [existing] = await tx.select({ id: solicitudesArea.id }).from(solicitudesArea)
      .where(and(eq(solicitudesArea.workItemId, workItemId), eq(solicitudesArea.tipo, type), inArray(solicitudesArea.estado, ['pendiente', 'en_revision', 'requiere_informacion'])));
    if (existing) throw Object.assign(new Error('Ya enviaste una solicitud de este tipo para esta intervención, sin resolver todavía'), { statusCode: 409 });
    const targetUserId = type === 'editor_aclaracion' ? await obtenerEspecialistaActual(item.proyectoId, null, tx) : null;
    const [row] = await tx.insert(solicitudesArea).values({ proyectoId: item.proyectoId, workItemId, tipo: type, businessKey: randomUUID(), requestedById: actorId, targetUserId, descripcion: trimmed }).returning();
    await registrarEvento(tx, { actorId, accion: 'EDITOR_REQUEST_CREADA', entityType: 'solicitud', entityId: row!.id, proyectoId: item.proyectoId, detalles: { type, workItemId } });
    if (targetUserId) await tx.insert(notificaciones).values({ proyectoId: item.proyectoId, rolDestino: 'especialista', usuarioDestinoId: targetUserId, mensaje: `El Editor envió una solicitud de aclaración: ${trimmed}` });
    else await tx.insert(notificaciones).values({ proyectoId: item.proyectoId, rolDestino: 'jefe_edicion', mensaje: `El Editor envió una solicitud (${TARGET_LABEL[type]==='Jefe de Edición'?(type==='editor_apoyo'?'apoyo':'reasignación'):type}): ${trimmed}` });
    return row!;
  });
}

interface Row {
  id: string; tipo: string; proyecto_id: string; codigo: string; title: string; work_item_id: string; intervention_label: string;
  descripcion: string | null; estado: string; requested_at: string | Date; resolved_at: string | Date | null; outcome: string | null; version: number;
}
const SOURCE = `SELECT r.id,r.tipo,r.proyecto_id,p.codigo,coalesce(nullif(trim(p.titulo_definitivo),''),nullif(trim(p.titulo),''),'Proyecto editorial') title,
 r.work_item_id,coalesce(step.nombre,CASE WHEN w.business_key='default' THEN 'Inicio de edición' WHEN w.business_key LIKE 'capitulo:%' THEN 'Capítulo '||c.numero ELSE replace(w.business_key,'_',' ') END) intervention_label,
 r.descripcion,r.estado,r.requested_at,r.resolved_at,r.outcome,r.version
 FROM solicitudes_area r JOIN proyectos p ON p.id=r.proyecto_id JOIN work_items w ON w.id=r.work_item_id
 LEFT JOIN pasos step ON step.id=w.paso_id LEFT JOIN capitulos c ON w.business_key='capitulo:'||c.id::text
 WHERE r.tipo IN ('editor_apoyo','editor_reasignacion','editor_aclaracion') AND r.requested_by_id=$1::uuid`;
const iso = (v: string | Date) => new Date(v).toISOString();
function summary(r: Row): EditorRequestSummary {
  return { id: r.id, type: r.tipo as EditorRequestType, projectId: r.proyecto_id, code: r.codigo, title: r.title, workItemId: r.work_item_id, interventionLabel: r.intervention_label,
    motivo: r.descripcion ?? '', status: status(r.estado), target: TARGET_LABEL[r.tipo as EditorRequestType], requestedAt: iso(r.requested_at), resolvedAt: r.resolved_at ? iso(r.resolved_at) : null, outcome: r.outcome, version: r.version };
}

export async function listarRequestsEditor(actorId: string, tab: 'all' | 'pending' | 'resolved' | 'returned' | 'cancelled', page: number, pageSize: number): Promise<EditorRequestList> {
  const { rows } = await pool.query<Row>(`${SOURCE} ORDER BY r.requested_at DESC, r.id`, [actorId]);
  const items = rows.map(summary);
  const bucket = tab === 'all' ? items : items.filter(i => tab === 'pending' ? (i.status === 'pendiente' || i.status === 'en_revision') : i.status === tab.replace('returned', 'devuelta').replace('resolved', 'resuelta').replace('cancelled', 'cancelada'));
  const pages = Math.max(1, Math.ceil(bucket.length / pageSize)), safePage = Math.min(page, pages);
  return {
    items: bucket.slice((safePage - 1) * pageSize, safePage * pageSize), total: bucket.length, pages, page: safePage,
    counts: { pending: items.filter(i => i.status === 'pendiente' || i.status === 'en_revision').length, resolved: items.filter(i => i.status === 'resuelta').length, returned: items.filter(i => i.status === 'devuelta').length, cancelled: items.filter(i => i.status === 'cancelada').length, all: items.length },
  };
}

export async function obtenerRequestEditorDetalle(id: string, actorId: string): Promise<EditorRequestDetail | null> {
  const { rows } = await pool.query<Row>(`${SOURCE.replace('WHERE r.tipo', 'WHERE r.id=$2::uuid AND r.tipo')}`, [actorId, id]);
  const r = rows[0]; if (!r) return null;
  const { rows: history } = await pool.query<{ id: string; accion: string; actor: string; created_at: Date; detalles: { motivo?: string } | null }>(
    `SELECT a.id,a.accion,coalesce(u.nombre,'Sistema') actor,a.created_at,a.detalles FROM audit_logs a LEFT JOIN usuarios u ON u.id=a.actor_id
     WHERE a.entity_id=$1 ORDER BY a.created_at,a.id LIMIT 20`, [id]);
  return { summary: summary(r), description: r.descripcion, history: history.map(h => ({ id: h.id, label: (EDITORIAL_EVENTS[h.accion] ?? h.accion) + (h.detalles?.motivo ? ' · ' + h.detalles.motivo : ''), actor: h.actor, at: h.created_at.toISOString() })) };
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
