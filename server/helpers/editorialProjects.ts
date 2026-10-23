import { pool } from '../db/client.js';
import { editorialInterventions, EDITORIAL_EVENTS } from './editorialChief.js';
import { diaCaracas } from './atencionEspecialista.js';
import { workspaceSummaries } from '../modules/project-workspaces/queries.js';
import { db } from '../db/client.js';
import { projectDriveFolders } from '../db/schema/index.js';
import { eq, and, inArray } from 'drizzle-orm';
import type { EditorialIntervention, EditorialProjectDetail, EditorialProjectFilters, EditorialProjectList, EditorialProjectState, EditorialProjectSummary } from '../../shared/editorialChief.js';

// Qué intervención "manda" al sintetizar el estado de Edición de un proyecto: bloqueo/ajuste del
// Editor primero, luego trabajo en curso, luego lo no iniciado; las esperas de terceros van al final
// porque no son responsabilidad activa de Edición (ver EDITORIAL_WAITING_RESPONSIBLE más abajo).
const STATE_PRIORITY: EditorialIntervention['state'][] = ['Bloqueadas', 'Requiere ajustes', 'En edición', 'Pendiente', 'Esperando autor', 'Esperando Especialista', 'En pausa'];
const RESPONSIBLE: Partial<Record<EditorialIntervention['state'], EditorialProjectSummary['responsibleNow']>> = {
  'Bloqueadas': 'editor', 'Requiere ajustes': 'editor', 'En edición': 'editor', 'Pendiente': 'editor',
  'Esperando autor': 'autor', 'Esperando Especialista': 'especialista',
};
const NEXT_STEP: Partial<Record<EditorialProjectState, (label: string) => string>> = {
  'Por iniciar': l => `El Editor debe iniciar: ${l}.`,
  'En edición': l => `En curso con el Editor: ${l}.`,
  'Requiere ajustes': l => `Pendiente por el Editor: ${l}.`,
  'Esperando autor': l => `Esperando respuesta del autor: ${l}.`,
  'Esperando Especialista': l => `Pendiente de gestión del Especialista: ${l}.`,
  'En pausa': () => 'El proyecto está en pausa; no hay próximo paso activo de Edición.',
};
const DRIVE_LINKS: { key: string; label: string }[] = [
  { key: 'EDITING_OUTPUT', label: 'Capítulos editados' },
  { key: 'FULL_MANUSCRIPT', label: 'Tripa completa' },
  { key: 'EDITORIAL_KIT', label: 'Kit editorial' },
  { key: 'EDITING_FEEDBACK', label: 'Feedback del autor' },
];

function projectState(items: EditorialIntervention[]): EditorialProjectState {
  const active = items.filter(i => i.state !== 'Completadas');
  if (!active.length) return items.length ? 'Completadas' : 'Pendiente';
  for (const s of STATE_PRIORITY) { if (active.some(i => i.state === s)) return s === 'Pendiente' ? 'Por iniciar' : s; }
  return active[0]!.state;
}

function summarize(projectId: string, items: EditorialIntervention[], lastActivity: EditorialProjectSummary['lastActivity']): EditorialProjectSummary {
  const first = items[0]!, state = projectState(items);
  const active = items.filter(i => i.state !== 'Completadas');
  const editors = new Set(items.map(i => i.editorId).filter((id): id is string => !!id));
  const multipleEditors = editors.size > 1;
  const editorFrom = active.find(i => i.editorId) ?? items[items.length - 1];
  const chapters = items.filter(i => i.chapter != null);
  const interventionSummary = chapters.length
    ? `${chapters.length} capítulo${chapters.length === 1 ? '' : 's'} registrado${chapters.length === 1 ? '' : 's'} · ${chapters.filter(c => c.state === 'Completadas').length} completado${chapters.filter(c => c.state === 'Completadas').length === 1 ? '' : 's'}`
    : first.label;
  const deliveries = active.filter(i => i.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  return {
    projectId, code: first.code, title: first.title, authors: first.authors, coverUrl: first.coverUrl,
    service: first.service, serviceId: first.serviceId ?? '', serviceCode: first.serviceCode ?? '', subtype: first.subtype ?? null,
    editorialState: state, risk: active.some(i => i.atRisk), overdue: active.some(i => i.overdue), blocker: active.find(i => i.block)?.block ?? null,
    responsibleNow: state === 'Por iniciar' ? 'editor' : RESPONSIBLE[state as EditorialIntervention['state']] ?? null,
    interventionSummary, interventionCount: items.length,
    progress: null,
    editor: multipleEditors ? null : editorFrom?.editor ?? null, editorId: multipleEditors ? null : editorFrom?.editorId ?? null, multipleEditors, editorCount: editors.size,
    specialist: null, specialistId: null,
    nextDelivery: deliveries[0] ? { label: deliveries[0].label, date: deliveries[0].dueDate! } : null,
    lastActivity,
  };
}

async function specialistsFor(projectIds: string[]): Promise<Map<string, { id: string; nombre: string }>> {
  if (!projectIds.length) return new Map();
  const { rows } = await pool.query<{ project_id: string; id: string; nombre: string }>(
    `SELECT p.id project_id, u.id, u.nombre FROM proyectos p
     LEFT JOIN LATERAL (
       SELECT coalesce(
         (SELECT pa.usuario_id FROM project_assignments pa WHERE pa.proyecto_id=p.id AND pa.tipo='especialista' AND pa.work_item_id IS NULL AND pa.finalizado_en IS NULL),
         CASE WHEN NOT EXISTS(SELECT 1 FROM project_assignments ph WHERE ph.proyecto_id=p.id AND ph.tipo='especialista' AND ph.work_item_id IS NULL) THEN p.especialista_id END
       ) id
     ) s ON true
     LEFT JOIN usuarios u ON u.id=s.id
     WHERE p.id=ANY($1::uuid[])`, [projectIds]);
  return new Map(rows.filter(r => r.id).map(r => [r.project_id, { id: r.id, nombre: r.nombre }]));
}

async function lastActivityFor(projectIds: string[]): Promise<Map<string, EditorialProjectSummary['lastActivity']>> {
  if (!projectIds.length) return new Map();
  const { rows } = await pool.query<{ proyecto_id: string; accion: string; created_at: Date }>(
    `SELECT DISTINCT ON (proyecto_id) proyecto_id, accion, created_at FROM audit_logs
     WHERE proyecto_id=ANY($1::uuid[]) AND accion=ANY($2::text[]) ORDER BY proyecto_id, created_at DESC, id DESC`,
    [projectIds, Object.keys(EDITORIAL_EVENTS)]);
  return new Map(rows.map(r => [r.proyecto_id, { label: EDITORIAL_EVENTS[r.accion]!, at: r.created_at.toISOString() }]));
}

async function projectSummaries(now: Date): Promise<EditorialProjectSummary[]> {
  const items = await editorialInterventions(diaCaracas(now));
  const byProject = new Map<string, EditorialIntervention[]>();
  for (const i of items) { const list = byProject.get(i.projectId) ?? []; list.push(i); byProject.set(i.projectId, list); }
  const ids = [...byProject.keys()];
  const [specialists, activity] = await Promise.all([specialistsFor(ids), lastActivityFor(ids)]);
  return ids.map(id => {
    const summary = summarize(id, byProject.get(id)!, activity.get(id) ?? null);
    const specialist = specialists.get(id);
    return { ...summary, specialist: specialist?.nombre ?? null, specialistId: specialist?.id ?? null };
  });
}

export async function listarProyectosEdicion(filters: EditorialProjectFilters, now = new Date()): Promise<EditorialProjectList> {
  const all = await projectSummaries(now);
  const services = new Map<string, string>(), editors = new Map<string, string>();
  for (const p of all) { if (p.serviceId) services.set(p.serviceId, p.service.split(' · ')[0]!); if (p.editorId && p.editor) editors.set(p.editorId, p.editor); }
  const choices = (map: Map<string, string>) => [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id));
  const options = { services: choices(services), editors: choices(editors), states: [...new Set(all.map(p => p.editorialState))].sort() };
  const search = filters.search.trim().toLocaleLowerCase('es');
  const matching = all.filter(p => (!search || `${p.title} ${p.authors} ${p.editor ?? ''}`.toLocaleLowerCase('es').includes(search)) &&
    (!filters.service || p.serviceId === filters.service) && (!filters.state || p.editorialState === filters.state) && (!filters.editor || p.editorId === filters.editor));
  // Cada contador es "proyectos con al menos un X", nunca intervenciones (ver §14-17 del spec).
  const counts = {
    inEditing: matching.length,
    upcomingDeliveries: matching.filter(p => p.nextDelivery).length,
    overdue: matching.filter(p => p.overdue).length,
    waitingAuthor: matching.filter(p => p.editorialState === 'Esperando autor').length,
  };
  const sorters: Record<EditorialProjectFilters['sort'], (a: EditorialProjectSummary, b: EditorialProjectSummary) => number> = {
    activity: (a, b) => (b.lastActivity?.at ?? '').localeCompare(a.lastActivity?.at ?? ''),
    delivery: (a, b) => (a.nextDelivery?.date ?? '9999').localeCompare(b.nextDelivery?.date ?? '9999'),
    title: (a, b) => a.title.localeCompare(b.title, 'es'),
    state: (a, b) => a.editorialState.localeCompare(b.editorialState, 'es'),
    editor: (a, b) => (a.editor ?? '').localeCompare(b.editor ?? '', 'es'),
  };
  const rows = [...matching].sort((a, b) => sorters[filters.sort](a, b) || a.projectId.localeCompare(b.projectId));
  const pages = Math.max(1, Math.ceil(rows.length / filters.pageSize)), page = Math.min(filters.page, pages);
  return { items: rows.slice((page - 1) * filters.pageSize, page * filters.pageSize), total: rows.length, pages, page, counts, options };
}

export async function obtenerProyectoEdicionDetalle(projectId: string, now = new Date()): Promise<EditorialProjectDetail | null> {
  const items = await editorialInterventions(diaCaracas(now), projectId);
  if (!items.length) return null;
  const [specialists, activity, workspace, history] = await Promise.all([
    specialistsFor([projectId]), lastActivityFor([projectId]), workspaceSummaries([projectId]),
    pool.query<{ id: string; accion: string; actor: string; created_at: Date }>(
      `SELECT a.id, a.accion, coalesce(u.nombre,'Sistema') actor, a.created_at FROM audit_logs a LEFT JOIN usuarios u ON u.id=a.actor_id
       WHERE a.proyecto_id=$1 AND a.accion=ANY($2::text[]) ORDER BY a.created_at DESC, a.id DESC LIMIT 10`, [projectId, Object.keys(EDITORIAL_EVENTS)]),
  ]);
  const summaryBase = summarize(projectId, items, activity.get(projectId) ?? null);
  const specialist = specialists.get(projectId);
  const summary = { ...summaryBase, specialist: specialist?.nombre ?? null, specialistId: specialist?.id ?? null };
  const ws = workspace.get(projectId);
  const driveReady = ws?.status === 'READY' && !ws.contextChanged;
  const folders = driveReady && ws?.id
    ? await db.select({ key: projectDriveFolders.key, url: projectDriveFolders.driveUrl }).from(projectDriveFolders)
        .where(and(eq(projectDriveFolders.workspaceId, ws.id), inArray(projectDriveFolders.key, DRIVE_LINKS.map(d => d.key)), eq(projectDriveFolders.status, 'READY')))
    : [];
  const links = DRIVE_LINKS.flatMap(d => { const f = folders.find(x => x.key === d.key); return f?.url ? [{ key: d.key, label: d.label, url: f.url }] : []; });
  const sorted = [...items].sort((a, b) => (Number(b.actionable) - Number(a.actionable)) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.id.localeCompare(b.id));
  const active = items.find(i => i.actionable) ?? items.find(i => i.state !== 'Completadas');
  const nextStep = summary.editorialState === 'Completadas' ? 'Proceso de Edición finalizado.'
    : summary.blocker ? `Bloqueo: ${summary.blocker}` : active ? (NEXT_STEP[summary.editorialState]?.(active.label) ?? `${active.cta}: ${active.label}.`) : 'Sin próximo paso identificado.';
  return {
    summary, nextStep,
    interventions: sorted.slice(0, 10).map(i => ({ id: i.id, label: i.label, state: i.state, editor: i.editor, editorId: i.editorId, dueDate: i.dueDate, overdue: i.overdue, deliveredAt: i.deliveredAt, waitingOn: i.waitingOn ?? null, cta: i.cta })),
    interventionsTotal: items.length,
    drive: { rootUrl: driveReady ? ws!.rootFolderUrl : null, links },
    history: history.rows.map(r => ({ id: r.id, label: EDITORIAL_EVENTS[r.accion]!, actor: r.actor, at: r.created_at.toISOString() })),
  };
}

const celdaCsv = (value: string | number | null) => { const text = String(value ?? ''); return `"${(/^[\s]*[=+\-@]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"`; };
export async function csvProyectosEdicion(now = new Date()): Promise<string> {
  const all = await projectSummaries(now);
  const rows: (string | number | null)[][] = [
    ['Proyecto', 'Autor', 'Servicio', 'Editor actual', 'Estado de edición', 'Intervención actual', 'Próxima entrega', 'Última actividad'],
    ...all.sort((a, b) => a.title.localeCompare(b.title, 'es')).map(p => [p.title, p.authors, p.service, p.multipleEditors ? `${p.editorCount} Editores` : p.editor ?? 'Por asignar', p.editorialState, p.interventionSummary, p.nextDelivery?.date ?? '', p.lastActivity?.at ?? '']),
  ];
  return '﻿' + rows.map(row => row.map(celdaCsv).join(',')).join('\r\n') + '\r\n';
}
