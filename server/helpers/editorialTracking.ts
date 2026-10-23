import { pool, db } from '../db/client.js';
import { and, eq } from 'drizzle-orm';
import { capitulos } from '../db/schema/index.js';
import { editorialInterventions, EDITORIAL_EVENTS, EDITORIAL_RESPONSIBLE } from './editorialChief.js';
import { editorialTypeName } from './editorialAssignments.js';
import { editorialDriveLinks, specialistsFor } from './editorialProjects.js';
import { diaCaracas } from './atencionEspecialista.js';
import type { CurrentResponsible, EditorialIntervention, EditorialTrackingDetail, EditorialTrackingFilters, EditorialTrackingList, EditorialTrackingRow } from '../../shared/editorialChief.js';

// Seguimiento es por intervención, nunca por proyecto (ver docs/arquitectura/29-jefe-edicion.md
// § Seguimiento): el mismo proyecto puede — y debe poder — aparecer varias veces.

function diasLabel(i: EditorialIntervention, today: string): string {
  if (i.state === 'Completadas') return 'Completada';
  if (i.waitingOn === 'project_pause') return 'Pausado';
  if (i.waitingOn) return 'SLA en pausa';
  if (!i.dueDate) return 'Sin fecha pautada';
  const diff = Math.round((Date.parse(i.dueDate) - Date.parse(today)) / 86400000);
  if (diff === 0) return 'Vence hoy';
  if (diff > 0) return `${diff} día${diff === 1 ? '' : 's'}`;
  return `Vencida hace ${Math.abs(diff)} día${Math.abs(diff) === 1 ? '' : 's'}`;
}
function toRow(i: EditorialIntervention, today: string): EditorialTrackingRow {
  return { ...i, currentResponsible: (EDITORIAL_RESPONSIBLE[i.state] ?? null) as CurrentResponsible, daysLabel: diasLabel(i, today) };
}
function inTab(i: EditorialIntervention, tab: EditorialTrackingFilters['tab']) {
  if (tab === 'priority') return i.overdue || i.atRisk || i.state === 'Bloqueadas';
  if (tab === 'overdue') return i.overdue;
  if (tab === 'risk') return i.atRisk;
  if (tab === 'blocked') return i.state === 'Bloqueadas';
  if (tab === 'editing') return i.actionable;
  if (tab === 'waiting') return !!i.waitingOn;
  return true;
}
const severity = (i: EditorialIntervention) => i.overdue ? 0 : i.state === 'Bloqueadas' ? 1 : i.atRisk ? 2 : 3;

export async function listarSeguimientoEdicion(filters: EditorialTrackingFilters, now = new Date()): Promise<EditorialTrackingList> {
  const today = diaCaracas(now);
  // Las solicitudes sin Editor son de Asignaciones y carga, nunca de Seguimiento (§3/§38/§117 del encargo).
  const all = (await editorialInterventions(today)).filter(i => !i.needsAssignment);
  const services = new Map<string, string>(), editors = new Map<string, string>(), types = new Map<string, string>();
  for (const i of all) {
    if (i.serviceId) services.set(i.serviceId, i.service.split(' · ')[0]!);
    if (i.editorId && i.editor) editors.set(i.editorId, i.editor);
    if (i.interventionType) types.set(i.interventionType, editorialTypeName(i.interventionType));
  }
  const choices = (map: Map<string, string>) => [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id));
  const options = { services: choices(services), editors: choices(editors), interventionTypes: choices(types), states: [...new Set(all.map(i => i.state))].sort() };
  const search = filters.search.trim().toLocaleLowerCase('es');
  const matching = all.filter(i => (!search || `${i.title} ${i.authors} ${i.code} ${i.label} ${i.editor ?? ''}`.toLocaleLowerCase('es').includes(search)) &&
    (!filters.service || i.serviceId === filters.service) && (!filters.status || i.state === filters.status) &&
    (!filters.editor || i.editorId === filters.editor) && (!filters.interventionType || i.interventionType === filters.interventionType) &&
    (!filters.responsible || (EDITORIAL_RESPONSIBLE[i.state] ?? null) === filters.responsible) &&
    (!filters.from || !i.dueDate || i.dueDate >= filters.from) && (!filters.to || !i.dueDate || i.dueDate <= filters.to));
  // Counts del conjunto filtrado completo (search/filtros), independientes del tab y de la página.
  const counts = {
    overdue: matching.filter(i => i.overdue).length,
    risk: matching.filter(i => i.atRisk).length,
    blocked: matching.filter(i => i.state === 'Bloqueadas').length,
    waitingThirdParty: matching.filter(i => !!i.waitingOn).length,
    priority: matching.filter(i => i.overdue || i.atRisk || i.state === 'Bloqueadas').length,
    all: matching.length,
  };
  const sorters: Record<EditorialTrackingFilters['sort'], (a: EditorialIntervention, b: EditorialIntervention) => number> = {
    due: (a, b) => severity(a) - severity(b) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'),
    status: (a, b) => a.state.localeCompare(b.state, 'es'),
    editor: (a, b) => (a.editor ?? '').localeCompare(b.editor ?? '', 'es'),
    project: (a, b) => a.title.localeCompare(b.title, 'es'),
  };
  const rows = matching.filter(i => inTab(i, filters.tab)).sort((a, b) => sorters[filters.sort](a, b) || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(rows.length / filters.pageSize)), page = Math.min(filters.page, pages);
  return { items: rows.slice((page - 1) * filters.pageSize, page * filters.pageSize).map(i => toRow(i, today)), total: rows.length, pages, page, counts, options };
}

export async function obtenerSeguimientoDetalle(workItemId: string, now = new Date()): Promise<EditorialTrackingDetail | null> {
  const today = diaCaracas(now);
  const [item] = await editorialInterventions(today, undefined, undefined, workItemId);
  if (!item || item.needsAssignment) return null;
  const [projectItems, specialists, drive, capitulo] = await Promise.all([
    editorialInterventions(today, item.projectId), specialistsFor([item.projectId]), editorialDriveLinks(item.projectId),
    item.chapter != null ? db.select().from(capitulos).where(and(eq(capitulos.proyectoId, item.projectId), eq(capitulos.numero, item.chapter))) : Promise.resolve([]),
  ]);
  const entityIds = [item.id, item.workItemId, capitulo[0]?.id].filter((id): id is string => !!id);
  const history = await pool.query<{ id: string; accion: string; actor: string; created_at: Date }>(
    `SELECT a.id, a.accion, coalesce(u.nombre,'Sistema') actor, a.created_at FROM audit_logs a LEFT JOIN usuarios u ON u.id=a.actor_id
     WHERE a.proyecto_id=$1 AND a.accion=ANY($2::text[]) AND a.entity_id=ANY($3::uuid[]) ORDER BY a.created_at DESC, a.id DESC LIMIT 10`,
    [item.projectId, Object.keys(EDITORIAL_EVENTS), entityIds]);
  const specialist = specialists.get(item.projectId);
  const siblingsAll = projectItems.filter(i => i.id !== item.id && !i.needsAssignment);
  const summary = toRow(item, today);
  const riskReason = item.atRisk ? 'Vence hoy y sigue bajo responsabilidad de Edición.' : null;
  const blockerReason = item.block ?? null;
  const nextStep = item.state === 'Completadas' ? 'Intervención completada.'
    : item.block ? `Bloqueo: ${item.block}`
    : item.state === 'Esperando autor' ? 'Esperando respuesta del autor.'
    : item.state === 'Esperando Especialista' ? 'El Especialista debe continuar la gestión.'
    : item.state === 'En pausa' ? 'El proyecto está en pausa; no hay próximo paso activo de Edición.'
    : item.state === 'Requiere ajustes' ? `El Editor debe aplicar el feedback recibido: ${item.label}.`
    : `El Editor debe entregar: ${item.label}.`;
  const files = (capitulo[0]?.enlaces as string[] | null ?? []).filter(u => typeof u === 'string' && /^https:\/\//.test(u)).map(url => ({ label: 'Documento enviado al autor', url }));
  return {
    summary, project: { id: item.projectId, code: item.code, title: item.title, authors: item.authors, service: item.service, coverUrl: item.coverUrl },
    specialist: specialist?.nombre ?? null, specialistId: specialist?.id ?? null,
    nextStep, riskReason, blockerReason,
    siblings: siblingsAll.slice(0, 6).map(i => ({ id: i.id, label: i.label, state: i.state, dueDate: i.dueDate, overdue: i.overdue })), siblingsTotal: siblingsAll.length,
    drive: { ...drive, files },
    history: history.rows.map(r => ({ id: r.id, label: EDITORIAL_EVENTS[r.accion]!, actor: r.actor, at: r.created_at.toISOString() })),
  };
}

const celdaCsv = (value: string | number | null) => { const text = String(value ?? ''); return `"${(/^[\s]*[=+\-@]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"`; };
export async function csvSeguimientoEdicion(filters: Omit<EditorialTrackingFilters, 'page' | 'pageSize'>, now = new Date()): Promise<string> {
  const data = await listarSeguimientoEdicion({ ...filters, page: 1, pageSize: 10000 }, now);
  const rows: (string | number | null)[][] = [
    ['Proyecto', 'Autor', 'Intervención', 'Servicio', 'Editor', 'Responsable actual', 'Estado', 'Fecha límite', 'Desvío'],
    ...data.items.map(i => [i.title, i.authors, i.label, i.service, i.editor ?? 'Por asignar',
      i.currentResponsible === 'editor' ? 'Editor' : i.currentResponsible === 'autor' ? 'Autor' : i.currentResponsible === 'especialista' ? 'Especialista' : 'Sin responsable activo',
      i.state, i.dueDate ?? '', i.daysLabel]),
  ];
  return '﻿' + rows.map(row => row.map(celdaCsv).join(',')).join('\r\n') + '\r\n';
}
