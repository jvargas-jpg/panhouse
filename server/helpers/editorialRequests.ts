import { pool } from '../db/client.js';
import { editorialInterventions, EDITORIAL_EVENTS } from './editorialChief.js';
import { specialistsFor } from './editorialProjects.js';
import { diaCaracas } from './atencionEspecialista.js';
import { ESTADOS_ACTIVOS } from './carga.js';
import type { EditorialRequestDetail, EditorialRequestFilters, EditorialRequestList, EditorialRequestSummary } from '../../shared/editorialChief.js';

// Único tipo de solicitud real en este dominio hoy: ASSIGN_EDITOR (ver docs/arquitectura/29-jefe-edicion.md
// § Solicitudes — se auditaron REASSIGN_EDITOR-como-solicitud, "apoyo por carga" y "escalación" y ninguno
// tiene respaldo en el código/esquema actual; no se fabrican). Una solicitud = un evento EDITOR_SOLICITADO,
// que por el guardián de idempotencia en solicitarEditor() solo puede existir una vez por work item contenedor.

async function pendingFromInterventions(now: Date): Promise<EditorialRequestSummary[]> {
  const items = await editorialInterventions(diaCaracas(now));
  return items.filter(i => i.needsAssignment).map(i => ({
    id: i.id, projectId: i.projectId, code: i.code, title: i.title, authors: i.authors, coverUrl: i.coverUrl,
    service: i.service, serviceId: i.serviceId ?? '',
    requester: i.requestedBy ?? null, requesterId: i.requestedById ?? null, requesterRole: i.requestedByRole ?? null,
    status: 'pendiente' as const, requestedAt: i.requestedAt!,
    resolvedAt: null, resolvedBy: null, resultEditorId: null, resultEditor: null, resultWorkItemId: null,
  }));
}

async function resolvedRequests(): Promise<EditorialRequestSummary[]> {
  const { rows } = await pool.query<{
    work_item_id: string; proyecto_id: string; requested_at: Date; requester_id: string | null;
    resolved_at: Date; resolved_by: string | null; editor_id: string | null;
    codigo: string; title: string; authors: string; service: string; service_id: string;
    requester: string | null; requester_role: string | null; editor: string | null; resolver: string | null;
  }>(`WITH pedidos AS (
    SELECT a.entity_id work_item_id, a.proyecto_id, a.created_at requested_at, a.actor_id requester_id
    FROM audit_logs a WHERE a.accion='EDITOR_SOLICITADO'
  ), resoluciones AS (
    SELECT a.proyecto_id, a.created_at resolved_at, a.actor_id resolved_by, nullif(a.detalles->>'nuevo','')::uuid editor_id
    FROM audit_logs a WHERE a.accion='EDITOR_ASIGNADO'
  ), resolved AS (
    SELECT DISTINCT ON (ped.work_item_id) ped.*, res.resolved_at, res.resolved_by, res.editor_id
    FROM pedidos ped JOIN resoluciones res ON res.proyecto_id=ped.proyecto_id AND res.resolved_at>=ped.requested_at
    ORDER BY ped.work_item_id, res.resolved_at
  )
  SELECT r.work_item_id, r.proyecto_id, r.requested_at, r.requester_id, r.resolved_at, r.resolved_by, r.editor_id,
    p.codigo, coalesce(nullif(trim(p.titulo_definitivo),''),nullif(trim(p.titulo),''),'Proyecto editorial') title,
    coalesce(au.names,a.nombre) authors, s.nombre service, s.id service_id,
    req.nombre requester, req.rol::text requester_role, ed.nombre editor, rb.nombre resolver
  FROM resolved r
  JOIN proyectos p ON p.id=r.proyecto_id JOIN autores a ON a.id=p.autor_id JOIN servicios s ON s.id=p.servicio_id
  LEFT JOIN (SELECT pa.proyecto_id, string_agg(au.nombre,', ' ORDER BY au.nombre) names FROM proyectos_autores pa JOIN autores au ON au.id=pa.autor_id GROUP BY pa.proyecto_id) au ON au.proyecto_id=p.id
  LEFT JOIN usuarios req ON req.id=r.requester_id
  LEFT JOIN usuarios ed ON ed.id=r.editor_id
  LEFT JOIN usuarios rb ON rb.id=r.resolved_by
  WHERE p.estado::text = ANY($1::text[])
  ORDER BY r.resolved_at DESC`, [ESTADOS_ACTIVOS]);
  return rows.map(r => ({
    id: r.work_item_id, projectId: r.proyecto_id, code: r.codigo, title: r.title, authors: r.authors, coverUrl: null,
    service: r.service, serviceId: r.service_id,
    requester: r.requester, requesterId: r.requester_id, requesterRole: r.requester_role,
    status: 'resuelta' as const, requestedAt: r.requested_at.toISOString(),
    resolvedAt: r.resolved_at.toISOString(), resolvedBy: r.resolver,
    resultEditorId: r.editor_id, resultEditor: r.editor, resultWorkItemId: r.work_item_id,
  }));
}

async function allRequests(now: Date): Promise<EditorialRequestSummary[]> {
  const [pending, resolved] = await Promise.all([pendingFromInterventions(now), resolvedRequests()]);
  return [...pending, ...resolved];
}

export async function listarSolicitudesEdicion(filters: EditorialRequestFilters, now = new Date()): Promise<EditorialRequestList> {
  const all = await allRequests(now);
  const services = new Map<string, string>(), requesters = new Map<string, string>();
  for (const r of all) { if (r.serviceId) services.set(r.serviceId, r.service.split(' · ')[0]!); if (r.requesterId && r.requester) requesters.set(r.requesterId, r.requester); }
  const choices = (map: Map<string, string>) => [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id));
  const options = { services: choices(services), requesters: choices(requesters) };
  const search = filters.search.trim().toLocaleLowerCase('es');
  const matching = all.filter(r => (!search || `${r.title} ${r.authors} ${r.code} ${r.requester ?? ''}`.toLocaleLowerCase('es').includes(search)) &&
    (!filters.service || r.serviceId === filters.service) && (!filters.requester || r.requesterId === filters.requester) &&
    (!filters.from || r.requestedAt.slice(0, 10) >= filters.from) && (!filters.to || r.requestedAt.slice(0, 10) <= filters.to));
  const counts = { pending: matching.filter(r => r.status === 'pendiente').length, resolved: matching.filter(r => r.status === 'resuelta').length, all: matching.length };
  const sorters: Record<EditorialRequestFilters['sort'], (a: EditorialRequestSummary, b: EditorialRequestSummary) => number> = {
    oldest: (a, b) => a.requestedAt.localeCompare(b.requestedAt),
    newest: (a, b) => b.requestedAt.localeCompare(a.requestedAt),
    project: (a, b) => a.title.localeCompare(b.title, 'es'),
  };
  const rows = matching.filter(r => filters.tab === 'all' || (filters.tab === 'pending' ? r.status === 'pendiente' : r.status === 'resuelta'))
    .sort((a, b) => sorters[filters.sort](a, b) || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(rows.length / filters.pageSize)), page = Math.min(filters.page, pages);
  return { items: rows.slice((page - 1) * filters.pageSize, page * filters.pageSize), total: rows.length, pages, page, counts, options };
}

export async function obtenerSolicitudEdicionDetalle(id: string, now = new Date()): Promise<EditorialRequestDetail | null> {
  const all = await allRequests(now);
  const summary = all.find(r => r.id === id);
  if (!summary) return null;
  const [item] = await editorialInterventions(diaCaracas(now), undefined, undefined, id);
  const [specialists, history] = await Promise.all([
    specialistsFor([summary.projectId]),
    pool.query<{ id: string; accion: string; actor: string; created_at: Date }>(
      `SELECT a.id, a.accion, coalesce(u.nombre,'Sistema') actor, a.created_at FROM audit_logs a LEFT JOIN usuarios u ON u.id=a.actor_id
       WHERE a.proyecto_id=$1 AND a.accion=ANY($2::text[]) AND a.entity_id=$3 ORDER BY a.created_at DESC, a.id DESC LIMIT 10`,
      [summary.projectId, ['EDITOR_SOLICITADO', 'EDITOR_ASIGNADO', 'EDITOR_REASIGNADO'], id]),
  ]);
  const specialist = specialists.get(summary.projectId);
  return {
    summary,
    context: item ? {
      editorialState: item.state, currentEditor: item.editor, specialist: specialist?.nombre ?? null,
      deadline: item.dueDate, waitingOn: item.waitingOn ?? null, blocker: item.block,
    } : null,
    history: history.rows.map(r => ({ id: r.id, label: EDITORIAL_EVENTS[r.accion]!, actor: r.actor, at: r.created_at.toISOString() })),
  };
}
