import { pool } from '../db/client.js';
import { editorialInterventions, EDITORIAL_EVENTS, EDITORIAL_RESPONSIBLE } from './editorialChief.js';
import { diaCaracas } from './atencionEspecialista.js';
import { workspaceSummaries } from '../modules/project-workspaces/queries.js';
import { db } from '../db/client.js';
import { projectDriveFolders } from '../db/schema/index.js';
import { eq, and, inArray } from 'drizzle-orm';
import type { EditorialIntervention, EditorialProjectDetail, EditorialProjectFilters, EditorialProjectList, EditorialProjectState, EditorialProjectSummary } from '../../shared/editorialChief.js';

// Qué intervención "manda" al sintetizar el estado de Edición de un proyecto: bloqueo/ajuste del
// Editor primero, luego trabajo en curso, luego lo no iniciado; las esperas de terceros van al final
// porque no son responsabilidad activa de Edición (ver EDITORIAL_RESPONSIBLE en editorialChief.ts).
const STATE_PRIORITY: EditorialIntervention['state'][] = ['Bloqueadas', 'Requiere ajustes', 'En edición', 'Pendiente', 'Esperando autor', 'Esperando Especialista', 'En pausa'];
const NEXT_STEP: Partial<Record<EditorialProjectState, (label: string) => string>> = {
  'Por iniciar': l => `El Editor debe iniciar: ${l}.`,
  'En edición': l => `En curso con el Editor: ${l}.`,
  'Requiere ajustes': l => `Pendiente por el Editor: ${l}.`,
  'Esperando autor': l => `Esperando respuesta del autor: ${l}.`,
  'Esperando Especialista': l => `Pendiente de gestión del Especialista: ${l}.`,
  'En pausa': () => 'El proyecto está en pausa; no hay próximo paso activo de Edición.',
};
// Claves reales de la plantilla de workspace de Edición (server/modules/project-workspaces/templates.ts),
// compartidas con Seguimiento — nunca una ruta hardcodeada ni inventada por pantalla.
export const EDITORIAL_DRIVE_LINKS: { key: string; label: string }[] = [
  { key: 'EDITING_OUTPUT', label: 'Capítulos editados' },
  { key: 'FULL_MANUSCRIPT', label: 'Tripa completa' },
  { key: 'EDITORIAL_KIT', label: 'Kit editorial' },
  { key: 'EDITING_FEEDBACK', label: 'Feedback del autor' },
];
const DRIVE_LINKS = [{key:'EDITING',label:'Carpeta de Edición'},...EDITORIAL_DRIVE_LINKS];

// Exportado para Indicadores (proyectos en riesgo) -- misma síntesis que
// Proyectos de edición, nunca una segunda prioridad de estados.
export function projectState(items: EditorialIntervention[]): EditorialProjectState {
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
    currentIntervention:active.find(i=>i.actionable)?.label??active[0]?.label??null, activeInterventions:active.filter(i=>i.actionable).length,
    projectId, code: first.code, title: first.title, authors: first.authors, coverUrl: first.coverUrl,
    service: first.service, serviceId: first.serviceId ?? '', serviceCode: first.serviceCode ?? '', subtype: first.subtype ?? null,
    editorialState: state, risk: active.some(i => i.atRisk), overdue: active.some(i => i.overdue), blocker: active.find(i => i.block)?.block ?? null,
    responsibleNow: state === 'Por iniciar' ? 'editor' : EDITORIAL_RESPONSIBLE[state as EditorialIntervention['state']] ?? null,
    interventionSummary, interventionCount: items.length,
    progress: null,
    editor: multipleEditors ? null : editorFrom?.editor ?? null, editorId: multipleEditors ? null : editorFrom?.editorId ?? null, multipleEditors, editorCount: editors.size,
    specialist: null, specialistId: null,
    nextDelivery: deliveries[0] ? { label: deliveries[0].label, date: deliveries[0].dueDate! } : null,
    lastActivity,
  };
}

export async function specialistsFor(projectIds: string[]): Promise<Map<string, { id: string; nombre: string }>> {
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

async function projectSummaries(now: Date, editorId?: string, history=false): Promise<EditorialProjectSummary[]> {
  const items = await editorialInterventions(diaCaracas(now),undefined,history?undefined:editorId,undefined,!!editorId,history?editorId:undefined);
  const byProject = new Map<string, EditorialIntervention[]>();
  for (const i of items) { const list = byProject.get(i.projectId) ?? []; list.push(i); byProject.set(i.projectId, list); }
  const ids = [...byProject.keys()];
  const [specialists, activity] = await Promise.all([specialistsFor(ids), lastActivityFor(ids)]);
  const workspaces=editorId?await workspaceSummaries(ids):new Map();
  const folders=editorId&&ids.length?await pool.query<{project_id:string;url:string}>(`SELECT w.project_id,f.drive_url url FROM project_drive_workspaces w JOIN project_drive_folders f ON f.workspace_id=w.id WHERE w.project_id=ANY($1::uuid[]) AND f.key='EDITING' AND f.status='READY'`,[ids]):null;
  const closed=editorId&&ids.length?await pool.query<{id:string}>("SELECT id FROM proyectos WHERE id=ANY($1::uuid[]) AND estado IN ('culminado','retirado')",[ids]):null;
  return ids.map(id => {
    const summary = summarize(id, byProject.get(id)!, activity.get(id) ?? null);
    const specialist = specialists.get(id);
    const historical=!!editorId&&(summary.editorId!==editorId||!!closed?.rows.some(p=>p.id===id));
    const ws=workspaces.get(id);
    return { ...summary, participation:historical?'history' as const:'active' as const,
      ...(historical?{interventionSummary:'Participación finalizada',currentIntervention:null,activeInterventions:0,nextDelivery:null}:{}),
      editingDriveUrl:!historical&&ws?.status==='READY'&&!ws.contextChanged?folders?.rows.find(f=>f.project_id===id)?.url??null:null,
      specialist: specialist?.nombre ?? null, specialistId: specialist?.id ?? null };
  });
}

export async function listarProyectosEdicion(filters: EditorialProjectFilters, now = new Date()): Promise<EditorialProjectList> {
  const all = await projectSummaries(now,filters.editor,filters.participation==='history');
  const services = new Map<string, string>(), editors = new Map<string, string>();
  for (const p of all) { if (p.serviceId) services.set(p.serviceId, p.service.split(' · ')[0]!); if (p.editorId && p.editor) editors.set(p.editorId, p.editor); }
  const choices = (map: Map<string, string>) => [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id));
  const specialists = new Map(all.filter(p=>p.specialistId&&p.specialist).map(p=>[p.specialistId!,p.specialist!]));
  const options = { specialists:choices(specialists),services: choices(services), editors: choices(editors), states: [...new Set(all.map(p => p.editorialState))].sort() };
  const search = filters.search.trim().toLocaleLowerCase('es');
  const matching = all.filter(p => (!search || `${p.title} ${p.authors} ${p.editor ?? ''}`.toLocaleLowerCase('es').includes(search)) &&
    (!filters.specialist || p.specialistId===filters.specialist) && (!filters.service || p.serviceId === filters.service) && (!filters.state || p.editorialState === filters.state) && (!filters.editor || (filters.participation==='history'?p.participation==='history':p.editorId === filters.editor&&p.participation==='active')));
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
  const editorOverview=filters.editor?{interventionCount:matching.reduce((n,p)=>n+p.interventionCount,0),loads:matching.filter(p=>p.activeInterventions).slice(0,6).map(p=>({projectId:p.projectId,title:p.title,active:p.activeInterventions!})),upcoming:matching.filter(p=>p.nextDelivery).sort((a,b)=>a.nextDelivery!.date.localeCompare(b.nextDelivery!.date)).slice(0,5).map(p=>({id:p.projectId,title:p.title,label:p.nextDelivery!.label,dueDate:p.nextDelivery!.date}))}:undefined;
  return { items: rows.slice((page - 1) * filters.pageSize, page * filters.pageSize), total: rows.length, pages, page, counts, options, editorOverview };
}

export async function editorialDriveLinks(projectId: string): Promise<{ rootUrl: string | null; links: { key: string; label: string; url: string }[] }> {
  const workspace = await workspaceSummaries([projectId]);
  const ws = workspace.get(projectId);
  const driveReady = ws?.status === 'READY' && !ws.contextChanged;
  const folders = driveReady && ws?.id
    ? await db.select({ key: projectDriveFolders.key, url: projectDriveFolders.driveUrl }).from(projectDriveFolders)
        .where(and(eq(projectDriveFolders.workspaceId, ws.id), inArray(projectDriveFolders.key, DRIVE_LINKS.map(d => d.key)), eq(projectDriveFolders.status, 'READY')))
    : [];
  const links = DRIVE_LINKS.flatMap(d => { const f = folders.find(x => x.key === d.key); return f?.url ? [{ key: d.key, label: d.label, url: f.url }] : []; });
  return { rootUrl: driveReady ? ws!.rootFolderUrl : null, links };
}

export async function obtenerProyectoEdicionDetalle(projectId: string, now = new Date(), editorId?: string): Promise<EditorialProjectDetail | null> {
  let items = await editorialInterventions(diaCaracas(now), projectId,undefined,undefined,!!editorId,editorId);
  const historical=!!editorId&&items[0]?.editorId!==editorId;
  if(historical){
    const own=await pool.query<{work_item_id:string}>("SELECT DISTINCT work_item_id FROM editorial_deliveries WHERE project_id=$1 AND submitted_by=$2",[projectId,editorId]);
    items=items.filter(i=>own.rows.some(r=>r.work_item_id===i.id));
  }
  if (historical) {
    const prior=(await projectSummaries(now,editorId,true)).find(p=>p.projectId===projectId);
    if(!prior)return null;
    const events=await pool.query<{id:string;name:string;at:Date}>(`SELECT a.id,u.nombre name,a.asignado_en at FROM project_assignments a JOIN usuarios u ON u.id=a.asignado_por_id WHERE a.proyecto_id=$1 AND a.tipo='editor' AND a.usuario_id=$2 ORDER BY a.asignado_en DESC`,[projectId,editorId]);
    return {summary:prior,nextStep:'Tu participación en este proyecto finalizó.',interventions:[],interventionsTotal:0,drive:{rootUrl:null,links:[]},history:events.rows.map(h=>({id:h.id,label:'Asignación del Editor',actor:h.name,at:h.at.toISOString()}))};
  }
  if (!items.length) return null;
  const [specialists, activity, drive, history] = await Promise.all([
    specialistsFor([projectId]), lastActivityFor([projectId]), historical?Promise.resolve({rootUrl:null,links:[]}):editorialDriveLinks(projectId),
    pool.query<{ id: string; accion: string; actor: string; created_at: Date }>(
      `SELECT a.id, a.accion, coalesce(u.nombre,'Sistema') actor, a.created_at FROM audit_logs a LEFT JOIN usuarios u ON u.id=a.actor_id
       WHERE a.proyecto_id=$1 AND a.accion=ANY($2::text[]) AND ($3::uuid IS NULL OR a.actor_id=$3 OR a.entity_id IN (SELECT id FROM project_assignments WHERE proyecto_id=$1 AND usuario_id=$3)) ORDER BY a.created_at DESC, a.id DESC LIMIT 10`, [projectId, Object.keys(EDITORIAL_EVENTS),editorId??null]),
  ]);
  const summaryBase = summarize(projectId, items, activity.get(projectId) ?? null);
  const specialist = specialists.get(projectId);
  const summary = { ...summaryBase, specialist: specialist?.nombre ?? null, specialistId: specialist?.id ?? null };
  const sorted = [...items].sort((a, b) => (Number(b.actionable) - Number(a.actionable)) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.id.localeCompare(b.id));
  const active = items.find(i => i.actionable) ?? items.find(i => i.state !== 'Completadas');
  const nextStep = summary.editorialState === 'Completadas' ? 'Proceso de Edición finalizado.'
    : summary.blocker ? `Bloqueo: ${summary.blocker}` : active ? (NEXT_STEP[summary.editorialState]?.(active.label) ?? `${active.cta}: ${active.label}.`) : 'Sin próximo paso identificado.';
  return {
    summary, nextStep,
    interventions: sorted.slice(0, 10).map(i => ({ id: i.id, label: i.label, state: i.state, editor: i.editor, editorId: i.editorId, dueDate: i.dueDate, overdue: i.overdue, deliveredAt: i.deliveredAt, waitingOn: i.waitingOn ?? null, cta: i.cta })),
    interventionsTotal: items.length,
    drive,
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
