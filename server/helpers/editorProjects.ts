import { pool } from '../db/client.js';
import { editorialInterventions, EDITORIAL_EVENTS } from './editorialChief.js';
import { projectState, specialistsFor } from './editorialProjects.js';
import { diaCaracas } from './atencionEspecialista.js';
import { workspaceSummaries } from '../modules/project-workspaces/queries.js';
import type { EditorialIntervention } from '../../shared/editorialChief.js';
import type { EditorProjectDetail, EditorProjectFilters, EditorProjectList, EditorProjectRow, EditorProjectWork } from '../../shared/editorProjects.js';

type Project = { id: string; codigo: string; title: string; authors: string; service: string; service_id: string; service_code: string; cover: string | null; current_editor: string | null; editor: string | null; assigned_at: Date | null; ended_at: Date | null; closed: boolean };
type Event = { id: string; proyecto_id: string; entity_id: string; accion: string; actor: string; created_at: Date; chapter: number | null };

// Canonical project assignments win; the legacy project pointer is only a fallback
// when no project-level assignment exists. One database row per project, including
// assigned projects with no current work items. No Google calls or writes.
async function projectsFor(editorId: string, projectId?: string): Promise<Project[]> {
  const { rows } = await pool.query<Project>(`WITH current_assignments AS (
    SELECT DISTINCT ON (proyecto_id) proyecto_id,usuario_id,finalizado_en FROM project_assignments
    WHERE tipo='editor' AND work_item_id IS NULL ORDER BY proyecto_id,(finalizado_en IS NULL) DESC,asignado_en DESC,id DESC
  ), own_assignments AS (
    SELECT DISTINCT ON (proyecto_id) proyecto_id,asignado_en,finalizado_en FROM project_assignments
    WHERE tipo='editor' AND work_item_id IS NULL AND usuario_id=$1 ORDER BY proyecto_id,asignado_en DESC,id DESC
  ) SELECT p.id,p.codigo,coalesce(nullif(trim(p.titulo_definitivo),''),nullif(trim(p.titulo),''),'Proyecto editorial') title,
    coalesce((SELECT string_agg(a.nombre,', ' ORDER BY a.nombre) FROM proyectos_autores x JOIN autores a ON a.id=x.autor_id WHERE x.proyecto_id=p.id),author.nombre) authors,
    s.nombre service,s.id service_id,s.codigo service_code,
    CASE WHEN p.portada_decision_autor='aprobada' THEN p.propuesta_portada_url END cover,
    CASE WHEN ca.proyecto_id IS NULL THEN p.editor_id WHEN ca.finalizado_en IS NULL THEN ca.usuario_id END current_editor,
    u.nombre editor,own.asignado_en assigned_at,own.finalizado_en ended_at,p.estado IN ('culminado','retirado') closed
    FROM proyectos p JOIN autores author ON author.id=p.autor_id JOIN servicios s ON s.id=p.servicio_id
    LEFT JOIN current_assignments ca ON ca.proyecto_id=p.id LEFT JOIN own_assignments own ON own.proyecto_id=p.id
    LEFT JOIN usuarios u ON u.id=$1
    WHERE ($2::uuid IS NULL OR p.id=$2) AND (own.proyecto_id IS NOT NULL OR
      CASE WHEN ca.proyecto_id IS NULL THEN p.editor_id WHEN ca.finalizado_en IS NULL THEN ca.usuario_id END=$1)`, [editorId, projectId ?? null]);
  return rows;
}

async function eventsFor(projectIds: string[], activeIds: string[], editorId: string, latestOnly = false): Promise<Event[]> {
  if (!projectIds.length) return [];
  const { rows } = await pool.query<Event>(`SELECT ${latestOnly ? 'DISTINCT ON (a.proyecto_id)' : ''}
    a.id,a.proyecto_id,a.entity_id,a.accion,coalesce(u.nombre,'Sistema') actor,a.created_at,c.numero chapter
    FROM audit_logs a LEFT JOIN usuarios u ON u.id=a.actor_id
    LEFT JOIN capitulos c ON c.id=a.entity_id AND c.proyecto_id=a.proyecto_id
    WHERE a.proyecto_id=ANY($1::uuid[]) AND a.accion=ANY($4::text[]) AND (
      a.proyecto_id=ANY($2::uuid[]) OR a.actor_id=$3 OR
      EXISTS(SELECT 1 FROM project_assignments own WHERE own.proyecto_id=a.proyecto_id AND own.tipo='editor'
        AND own.work_item_id IS NULL AND own.usuario_id=$3 AND a.created_at>=own.asignado_en AND a.created_at<=coalesce(own.finalizado_en,now())) OR
      (a.entity_type='project_assignment' AND (a.detalles->>'anterior'=$3::text OR a.entity_id IN
        (SELECT id FROM project_assignments WHERE proyecto_id=a.proyecto_id AND tipo='editor' AND usuario_id=$3))))
    ORDER BY ${latestOnly ? 'a.proyecto_id,' : ''}a.created_at DESC,a.id DESC`, [projectIds, activeIds, editorId, Object.keys(EDITORIAL_EVENTS)]);
  return rows;
}
const eventDto = (e: Event) => ({ id: e.id, label: EDITORIAL_EVENTS[e.accion] ?? e.accion, actor: e.actor, at: e.created_at.toISOString() });
const typeName = (i: EditorialIntervention) => i.interventionType === 'feedback' ? 'Aplicación de feedback' : i.chapter ? 'Edición de capítulo' : i.label;
const toWork = (i: EditorialIntervention): EditorProjectWork => ({ id: i.id, label: i.label, type: typeName(i), state: i.state,
  dueDate: i.dueDate, deliveredAt: i.deliveredAt, startedAt: i.startedAt ?? null, waitingOn: i.waitingOn ?? null,
  overdue: i.overdue, actionable: i.actionable, historical: false });
const rank = (i: EditorialIntervention) => i.state === 'Bloqueadas' ? 0 : i.state === 'Requiere ajustes' ? 1 : i.actionable && i.startedAt ? 2 : i.actionable ? 3 : i.waitingOn ? 4 : 5;
const workOrder = (a: EditorialIntervention, b: EditorialIntervention) => rank(a) - rank(b) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || (a.chapter ?? 0) - (b.chapter ?? 0) || a.id.localeCompare(b.id);

async function portfolio(editorId: string, now: Date, projectId?: string) {
  const projects = await projectsFor(editorId, projectId);
  if (!projects.length) return { rows: [] as EditorProjectRow[], items: [] as EditorialIntervention[] };
  const ids = projects.map(p => p.id), activeIds = projects.filter(p => p.current_editor === editorId && !p.closed).map(p => p.id);
  const [items, specialists, events, historicalCounts] = await Promise.all([
    activeIds.length ? editorialInterventions(diaCaracas(now), projectId, editorId, undefined, true) : Promise.resolve([]),
    specialistsFor(ids), eventsFor(ids, activeIds, editorId, true),
    pool.query<{ project_id: string; completed: number }>('SELECT project_id,count(DISTINCT work_item_id)::int completed FROM editorial_deliveries WHERE project_id=ANY($1::uuid[]) AND submitted_by=$2 GROUP BY project_id', [ids, editorId]),
  ]);
  const workByProject = new Map<string, EditorialIntervention[]>();
  for (const item of items) { const group = workByProject.get(item.projectId) ?? []; group.push(item); workByProject.set(item.projectId, group); }
  const rows = projects.map(p => {
    const historical = !activeIds.includes(p.id);
    const work = historical ? [] : [...(workByProject.get(p.id) ?? [])].sort(workOrder);
    const pending = work.filter(i => i.actionable && !i.startedAt && i.state !== 'Bloqueadas' && i.state !== 'Requiere ajustes');
    const completed = historical ? historicalCounts.rows.find(c => c.project_id === p.id)?.completed ?? 0 : work.filter(i => i.state === 'Completadas').length;
    const blocked = work.filter(i => i.state === 'Bloqueadas').length, waiting = work.filter(i => i.waitingOn).length;
    const active = work.filter(i => i.actionable).length - pending.length - blocked;
    const workCounts = { known: historical ? completed : work.length, active, pending: pending.length, blocked, waiting, completed };
    const current = work.find(i => i.state !== 'Completadas') ?? null;
    const state = historical ? 'Completadas' : projectState(work.map(i => !i.startedAt && i.state === 'En edición' ? { ...i, state: 'Pendiente' as const } : i));
    const stateLabel = historical ? 'Participación finalizada' : !work.length ? 'Sin trabajo activo' : state === 'Completadas' ? 'Edición finalizada' : state === 'Bloqueadas' ? 'Bloqueado' : state;
    const next = work.filter(i => i.actionable && i.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || a.id.localeCompare(b.id))[0];
    const specialist = specialists.get(p.id), activity = events.find(e => e.proyecto_id === p.id);
    const countParts = [[completed, completed === 1 ? 'completada' : 'completadas'], [active, 'en curso'], [pending.length, 'por iniciar'], [waiting, 'en espera'], [blocked, blocked === 1 ? 'bloqueada' : 'bloqueadas']] as const;
    return {
      projectId: p.id, code: p.codigo, title: p.title, authors: p.authors, coverUrl: p.cover,
      service: p.service, serviceId: p.service_id, serviceCode: p.service_code, subtype: null,
      editorialState: state, stateLabel, participation: historical ? 'history' : 'active',
      assignedAt: p.assigned_at?.toISOString() ?? null, endedAt: p.ended_at?.toISOString() ?? null,
      risk: work.some(i => i.atRisk), overdue: work.some(i => i.overdue), blocker: work.find(i => i.state === 'Bloqueadas')?.block ?? null,
      responsibleNow: current?.waitingOn === 'author' ? 'autor' : current?.waitingOn === 'specialist' ? 'especialista' : current?.actionable ? 'editor' : null,
      interventionSummary: countParts.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`).join(' · ') || (historical ? 'Participación finalizada' : 'Sin trabajo activo actualmente.'),
      interventionCount: workCounts.known, workCounts, progress: null,
      currentIntervention: current?.label ?? null, currentWork: current ? toWork(current) : null, activeInterventions: active + pending.length + blocked,
      editorId, editor: p.editor, multipleEditors: false, editorCount: 1,
      specialist: specialist?.nombre ?? null, specialistId: specialist?.id ?? null,
      nextDelivery: next ? { label: next.label, date: next.dueDate! } : null,
      lastActivity: activity ? { label: EDITORIAL_EVENTS[activity.accion] ?? activity.accion, at: activity.created_at.toISOString() } : null,
      editingDriveUrl: null,
    } satisfies EditorProjectRow;
  });
  return { rows, items };
}

export async function listarMisProyectos(editorId: string, f: EditorProjectFilters, now = new Date()): Promise<EditorProjectList> {
  const { rows } = await portfolio(editorId, now);
  const choices = (pairs: [string, string][]) => [...new Map(pairs)].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const options = { services: choices(rows.map(p => [p.serviceId, p.service])), states: [...new Set(rows.map(p => p.stateLabel))].sort((a, b) => a.localeCompare(b, 'es')),
    editors: choices(rows.filter(p => p.editor).map(p => [editorId, p.editor!])),
    specialists: choices(rows.filter(p => p.specialistId).map(p => [p.specialistId!, p.specialist!])) };
  const search = f.search.trim().toLocaleLowerCase('es');
  const filtered = rows.filter(p => p.participation === (f.participation ?? 'active') &&
    (!search || `${p.title} ${p.authors} ${p.code}`.toLocaleLowerCase('es').includes(search)) &&
    (!f.state || p.stateLabel === f.state || p.editorialState === f.state) && (!f.service || p.serviceId === f.service) && (!f.specialist || p.specialistId === f.specialist));
  const attention = (p: EditorProjectRow) => p.participation === 'history' ? 3 : p.activeInterventions ? 0 : p.workCounts.waiting ? 1 : 2;
  filtered.sort((a, b) => (f.sort === 'priority' ? attention(a) - attention(b) : f.sort === 'title' ? a.title.localeCompare(b.title, 'es') : f.sort === 'delivery' ? (a.nextDelivery?.date ?? '9999').localeCompare(b.nextDelivery?.date ?? '9999') : f.sort === 'state' ? a.stateLabel.localeCompare(b.stateLabel, 'es') : 0) ||
    (b.lastActivity?.at ?? '').localeCompare(a.lastActivity?.at ?? '') || a.projectId.localeCompare(b.projectId));
  const pages = Math.max(1, Math.ceil(filtered.length / f.pageSize)), page = Math.min(f.page, pages);
  return { items: filtered.slice((page - 1) * f.pageSize, page * f.pageSize), total: filtered.length, pages, page, options };
}

const materialKeys = (service: string) => [{ key: 'EDITING', label: 'Carpeta de Edición' },
  service === 'EF' ? { key: 'CONTENT_EXTRACTIONS', label: 'Extracciones de contenido' } : { key: 'EDITING_INPUT', label: 'Material para editar' },
  { key: 'EDITING_OUTPUT', label: 'Capítulos editados' }, { key: 'EDITING_FEEDBACK', label: 'Feedback del autor' }, { key: 'EDITING_FEEDBACK_APPLIED', label: 'Feedback aplicado' },
  { key: 'FULL_MANUSCRIPT', label: 'Tripa completa' }, { key: 'FULL_MANUSCRIPT_FEEDBACK', label: 'Feedback de Tripa' }, { key: 'FULL_MANUSCRIPT_FEEDBACK_APPLIED', label: 'Feedback de Tripa aplicado' },
  { key: 'EDITORIAL_KIT', label: 'Kit editorial' }, { key: 'EDITORIAL_KIT_FEEDBACK', label: 'Feedback del Kit' }, { key: 'EDITORIAL_KIT_FEEDBACK_APPLIED', label: 'Feedback del Kit aplicado' }];

export async function obtenerMiProyecto(editorId: string, projectId: string, now = new Date()): Promise<EditorProjectDetail | null> {
  const { rows, items } = await portfolio(editorId, now, projectId);
  const summary = rows[0]; if (!summary) return null;
  const historical = summary.participation === 'history';
  const [events, deliveries, material, blockers] = await Promise.all([
    eventsFor([projectId], historical ? [] : [projectId], editorId),
    pool.query<{ id: string; work_item_id: string; drive_url: string; submitted_at: Date; observaciones: string | null; chapter: number | null; step: string | null }>(
      `SELECT d.id,d.work_item_id,d.drive_url,d.submitted_at,d.observaciones,c.numero chapter,s.nombre step
       FROM editorial_deliveries d JOIN work_items w ON w.id=d.work_item_id
       LEFT JOIN capitulos c ON w.business_key='capitulo:'||c.id::text LEFT JOIN pasos s ON s.id=w.paso_id
       WHERE d.project_id=$1 AND d.submitted_by=$2 ORDER BY d.submitted_at DESC,d.id DESC`, [projectId, editorId]),
    historical ? Promise.resolve({ rootUrl: null, links: [] as { key: string; label: string; url: string }[], failed: false }) : projectMaterial(projectId, summary.serviceCode),
    historical ? Promise.resolve({ rows: [] }) : pool.query<{ work_item_id: string; reason: string; created_at: Date }>(`SELECT b.work_item_id,b.reason,b.created_at FROM editorial_blockers b JOIN work_items w ON w.id=b.work_item_id WHERE w.proyecto_id=$1 AND b.resolved_at IS NULL ORDER BY b.created_at`, [projectId]),
  ]);
  const ownDeliveryLabel = (d: typeof deliveries.rows[number]) => d.chapter ? `Capítulo ${d.chapter}` : d.step ?? 'Inicio de edición';
  const historicalWork = [...new Map([...deliveries.rows].reverse().map(d => [d.work_item_id, d])).values()].map(d => ({ id: d.work_item_id, label: ownDeliveryLabel(d), type: d.chapter ? 'Edición de capítulo' : ownDeliveryLabel(d), state: 'Completadas' as const,
    dueDate: null, deliveredAt: d.submitted_at.toISOString(), startedAt: null, waitingOn: null, overdue: false, actionable: false, historical: true }));
  const work = historical ? historicalWork : [...items].sort(workOrder).map(toWork);
  const latestFeedback = new Map<string, string>();
  const feedback = events.flatMap(e => {
    if (!['CAPITULO_FEEDBACK_REGISTRADO', 'CAPITULO_FEEDBACK_APLICADO'].includes(e.accion)) return [];
    const item = work.find(i => i.id === e.entity_id) ?? (e.chapter ? work.find(i => i.label.endsWith('Capítulo ' + e.chapter)) : undefined);
    if (!item) return [];
    if (!latestFeedback.has(item.id)) latestFeedback.set(item.id, e.id);
    return [{ ...eventDto(e), workItemId: item.id, interventionLabel: item.label, kind: e.accion === 'CAPITULO_FEEDBACK_APLICADO' ? 'applied' as const : 'received' as const,
      pending: !historical && item.state === 'Requiere ajustes' && latestFeedback.get(item.id) === e.id && e.accion === 'CAPITULO_FEEDBACK_REGISTRADO' }];
  });
  const current = summary.currentWork;
  const nextStep = historical ? 'Tu participación en este proyecto finalizó. Conservas el contexto de tu trabajo anterior.' : blockers.rows[0] ? blockers.rows[0].reason : summary.blocker ? summary.blocker : current?.state === 'Bloqueadas' ? 'Consulta el bloqueo de esta intervención en Mi trabajo.' :
    current?.waitingOn === 'author' ? 'Esperando feedback del autor.' : current?.waitingOn === 'specialist' ? 'El Especialista tiene el siguiente paso.' : current?.waitingOn === 'project_pause' ? 'El proyecto está en pausa.' : current?.state === 'Requiere ajustes' ? `Aplica el feedback de ${current.label} en Mi trabajo.` : current && !current.startedAt ? `Abre ${current.label} en Mi trabajo para iniciar tu intervención.` : current ? `Continúa ${current.label} en Mi trabajo.` : summary.stateLabel === 'Edición finalizada' ? 'Todas tus intervenciones registradas están completadas.' : 'Sin trabajo activo actualmente.';
  return { summary, nextStep, interventions: work, interventionsTotal: work.length,
    blockers: blockers.rows.map(b => ({ workItemId: b.work_item_id, reason: b.reason, createdAt: b.created_at.toISOString() })),
    drive: { rootUrl: material.rootUrl, links: material.links }, materialUnavailable: material.failed,
    deliveries: deliveries.rows.map(d => ({ id: d.id, workItemId: d.work_item_id, label: ownDeliveryLabel(d), driveUrl: historical ? null : d.drive_url, submittedAt: d.submitted_at.toISOString(), observaciones: d.observaciones })),
    feedback, history: events.map(eventDto) };
}

async function projectMaterial(projectId: string, service: string) {
  try {
    const ws = (await workspaceSummaries([projectId])).get(projectId);
    if (!ws || ws.status !== 'READY' || ws.contextChanged) return { rootUrl: null, links: [], failed: false };
    const keys = materialKeys(service);
    const folders = await pool.query<{ key: string; drive_url: string }>('SELECT key,drive_url FROM project_drive_folders WHERE workspace_id=$1 AND status=\'READY\' AND key=ANY($2::text[])', [ws.id, keys.map(k => k.key)]);
    const links = keys.flatMap(k => { const folder = folders.rows.find(f => f.key === k.key); return folder?.drive_url ? [{ ...k, url: folder.drive_url }] : []; });
    return { rootUrl: links.find(l => l.key === 'EDITING')?.url ?? null, links, failed: false };
  } catch { return { rootUrl: null, links: [], failed: true }; }
}
