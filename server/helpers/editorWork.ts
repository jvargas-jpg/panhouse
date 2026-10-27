import { specialistsFor } from './editorialProjects.js';
import { desc, eq, isNull, and } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { capitulos, editorialBlockers, editorialDeliveries } from '../db/schema/index.js';
import { editorialInterventions, EDITORIAL_EVENTS } from './editorialChief.js';
import { getProjectWorkspaceFolders } from '../modules/project-workspaces/service.js';
import { diaCaracas } from './atencionEspecialista.js';
import type { EditorialIntervention } from '../../shared/editorialChief.js';
import type { EditorWorkDetail } from '../../shared/editorOwn.js';

export type MiTrabajoTab = 'all' | 'today' | 'inProgress' | 'feedback' | 'waiting' | 'completed';
export interface MiTrabajoFiltros {
  tab: MiTrabajoTab; search: string; status?: string; risk?: string; service?: string; interventionType?: string; project?: string; date?: string;
  page: number; pageSize: number;
}

// Mi trabajo (prompt Editor §36-61): UNA FILA = UN WORK ITEM, nunca
// proyecto. Reusa editorialInterventions() ya acotado al Editor; filtra/
// ordena/pagina en memoria -- mismo patrón ya probado en
// /editores/intervenciones (Jefe de Edición), válido acá porque el volumen
// por Editor es intrínsecamente chico (su propia carga, no la del área).
// Orden por defecto de la bandeja (prompt Mi trabajo §52): vencidas,
// por vencer, bloqueadas, feedback por aplicar, en edición, por
// iniciar, en espera, completadas -- deriva únicamente de señales
// reales ya presentes en EditorialIntervention (overdue/atRisk/state/
// waitingOn), nunca una prioridad inventada aparte del dominio.
function priority(i: EditorialIntervention): number {
  if (i.overdue) return 0;
  if (i.atRisk) return 1;
  if (i.state === 'Bloqueadas') return 2;
  if (i.state === 'Requiere ajustes') return 3;
  if (i.state === 'En edición') return 4;
  if (i.state === 'Pendiente') return 5;
  if (i.waitingOn) return 6;
  if (i.state === 'Completadas') return 7;
  return 8;
}

export async function listarMiTrabajo(editorId: string, f: MiTrabajoFiltros, ahora = new Date()) {
  const hoy = diaCaracas(ahora);
  const all = await editorialInterventions(hoy, undefined, editorId);
  const search = f.search.trim().toLocaleLowerCase('es');
  const filtered = all.filter(i =>
    (!f.project || i.projectId===f.project) &&
    (!f.status || i.state === f.status) && (!f.risk || (f.risk === 'dueSoon' ? i.actionable && i.atRisk && !i.overdue : i.overdue)) &&
    (!search || `${i.title} ${i.authors} ${i.code} ${i.label}`.toLocaleLowerCase('es').includes(search)) &&
    (!f.service || i.serviceId === f.service) &&
    (!f.interventionType || i.interventionType === f.interventionType) &&
    (!f.date || i.dueDate === f.date));
  const inTab = (i: EditorialIntervention): boolean => {
    switch (f.tab) {
      case 'today': return i.actionable && (i.overdue || i.dueDate === hoy);
      case 'inProgress': return i.state === 'En edición';
      case 'feedback': return i.state === 'Requiere ajustes';
      case 'waiting': return i.state === 'Esperando autor' || i.state === 'Esperando Especialista' || i.state === 'En pausa';
      case 'completed': return i.state === 'Completadas';
      default: return true;
    }
  };
  const bucket = filtered.filter(inTab).sort((a, b) => priority(a) - priority(b) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(bucket.length / f.pageSize)), page = Math.min(f.page, pages);
  const counts = {
    all: filtered.length,
    today: filtered.filter(i => i.actionable && (i.overdue || i.dueDate === hoy)).length,
    inProgress: filtered.filter(i => i.state === 'En edición').length,
    feedback: filtered.filter(i => i.state === 'Requiere ajustes').length,
    waiting: filtered.filter(i => i.state === 'Esperando autor' || i.state === 'Esperando Especialista' || i.state === 'En pausa').length,
    completed: filtered.filter(i => i.state === 'Completadas').length,
  };
  const options = {states:[...new Set(all.map(i=>i.state))], services:[...new Map(all.map(i=>[i.serviceId,{id:i.serviceId,name:i.service.split(' · ')[0]}])).values()],
    types:[...new Map(all.map(i=>[i.interventionType,{id:i.interventionType,name:i.interventionType==='chapter'?'Edición de capítulo':i.interventionType==='feedback'?'Aplicación de feedback':i.label}])).values()],
    projects:[...new Map(all.map(i=>[i.projectId,{id:i.projectId,name:i.title}])).values()]};
  const summary = {inProgress:all.filter(i=>i.state==='En edición').length,dueSoon:all.filter(i=>i.actionable&&i.atRisk&&!i.overdue).length,blocked:all.filter(i=>i.state==='Bloqueadas').length,feedback:all.filter(i=>i.state==='Requiere ajustes'&&i.actionable).length};
  const page_items = bucket.slice((page - 1) * f.pageSize, page * f.pageSize);
  const items = await withLastActivity(page_items);
  return { items, total: bucket.length, pages, page, counts, options, summary };
}

// Última actividad por fila (prompt Editor §20): una sola consulta por
// de la página visible (nunca por fila -- §72 prohíbe N+1), contra los
// dos ids posibles de un work item de capítulo: el del capítulo mismo
// (eventos CAPITULO_*) y el del work_item (eventos EDITOR_*) -- se toma
// el más reciente de ambos, igual que obtenerDetalleMiTrabajo ya hace
// para el historial completo de una sola intervención.
async function withLastActivity(items: EditorialIntervention[]) {
  const ids = [...new Set(items.flatMap(i => [i.id, i.workItemId].filter((v): v is string => !!v)))];
  const activity = ids.length ? await pool.query<{ entity_id: string; accion: string; created_at: Date }>(
    `SELECT entity_id,accion,created_at FROM audit_logs WHERE entity_id=ANY($1::uuid[]) ORDER BY created_at DESC`, [ids]) : { rows: [] };
  const latest = new Map<string, { accion: string; created_at: Date }>();
  for (const r of activity.rows) if (!latest.has(r.entity_id)) latest.set(r.entity_id, r);
  return items.map(i => {
    const a = latest.get(i.id), b = i.workItemId ? latest.get(i.workItemId) : undefined;
    const pick = !a ? b : !b ? a : (a.created_at > b.created_at ? a : b);
    return { ...i, lastActivity: pick ? { label: EDITORIAL_EVENTS[pick.accion] ?? pick.accion, at: pick.created_at.toISOString() } : null };
  });
}

// folderKeys reales por tipo de intervención (server/modules/project-workspaces/templates.ts)
// -- nunca rutas hardcodeadas. Auditado contra datos reales: hoy los
// únicos work_items de Edición que existen son capítulos y el contenedor
// 'default' (business_key NOT LIKE 'capitulo:%' agrupa hoy en 'default' y
// artefactos puntuales de QA) -- Tripa completa/Kit editorial existen como
// carpetas documentales en el template, pero ningún work_item real todavía
// los usa como tipo de intervención. Por eso el mapeo cubre exactamente lo
// alcanzable hoy (capítulo/feedback) y cae a la carpeta raíz 'Edición' para
// cualquier otro business_key -- nunca se inventa una carpeta específica
// para un tipo que el dominio aún no modela como intervención real.
export function folderKeysPara(i: EditorialIntervention): { key: string; label: string }[] {
  if (i.chapter || i.interventionType === 'chapter' || i.interventionType === 'feedback') {
    const entrada = i.serviceCode === 'EF' ? { key: 'CONTENT_EXTRACTIONS', label: 'Material recibido' } : { key: 'EDITING_INPUT', label: 'Material recibido' };
    return [entrada, { key: 'EDITING_OUTPUT', label: 'Carpeta de trabajo' }, { key: 'EDITING_FEEDBACK', label: 'Feedback del autor' }, { key: 'EDITING_FEEDBACK_APPLIED', label: 'Feedback aplicado' }];
  }
  return [{ key: 'EDITING', label: 'Carpeta de Edición' }];
}

export async function obtenerDetalleMiTrabajo(id: string, editorId: string, ahora = new Date()): Promise<EditorWorkDetail | null> {
  const hoy = diaCaracas(ahora);
  const [item] = await editorialInterventions(hoy, undefined, editorId, id);
  if (!item) return null;
  const wanted = new Set(folderKeysPara(item).map(f => f.key));
  // Los eventos de capítulo (CAPITULO_EDITOR_ENTREGADO, CAPITULO_FEEDBACK_*)
  // se auditan contra el id del CAPÍTULO, no el del work_item -- sin este id
  // adicional el historial quedaría vacío para toda intervención de capítulo.
  const capituloId = item.chapter ? (await db.select({ id: capitulos.id }).from(capitulos).where(and(eq(capitulos.proyectoId, item.projectId), eq(capitulos.numero, item.chapter))))[0]?.id : undefined;
  const entityIds = [...new Set([item.id, item.workItemId, capituloId].filter((v): v is string => !!v))];
  const [allFolders, deliveries, blocker, history] = await Promise.all([
    getProjectWorkspaceFolders(item.projectId, { id: editorId, rol: 'editor' }).catch(() => []),
    item.workItemId ? db.select().from(editorialDeliveries).where(eq(editorialDeliveries.workItemId, item.workItemId)).orderBy(desc(editorialDeliveries.submittedAt)) : Promise.resolve([]),
    item.workItemId ? db.select().from(editorialBlockers).where(and(eq(editorialBlockers.workItemId, item.workItemId), isNull(editorialBlockers.resolvedAt))).then(r => r[0] ?? null) : Promise.resolve(null),
    pool.query<{ id: string; accion: string; actor: string; created_at: Date; detalles: { motivo?: string } | null }>(
      `SELECT a.id,a.accion,coalesce(u.nombre,'Sistema') actor,a.created_at,a.detalles FROM audit_logs a LEFT JOIN usuarios u ON u.id=a.actor_id
       WHERE a.entity_id=ANY($1::uuid[]) ORDER BY a.created_at DESC,a.id DESC LIMIT 8`, [entityIds]),
  ]);
  const folderLabels = Object.fromEntries(folderKeysPara(item).map(f => [f.key, f.label]));
  const folders = allFolders.filter(f => wanted.has(f.key)).map(f => ({ key: f.key, label: folderLabels[f.key] ?? f.displayName, driveUrl: f.driveUrl }));
  const specialists = await specialistsFor([item.projectId]);
  const assignment = item.assignmentId ? await pool.query<{at:Date}>('SELECT asignado_en at FROM project_assignments WHERE id=$1',[item.assignmentId]) : null;
  return {
    specialist:specialists.get(item.projectId)?.nombre??null,assignedAt:assignment?.rows[0]?.at.toISOString()??null,
    item,
    folders,
    deliveries: deliveries.map(d => ({ id: d.id, driveUrl: d.driveUrl, observaciones: d.observaciones, submittedAt: d.submittedAt.toISOString() })),
    blocker: blocker ? { id: blocker.id, reason: blocker.reason, createdAt: blocker.createdAt.toISOString(), resolvedAt: null, resolution: null } : null,
    history: history.rows.map(h => ({ id: h.id, label: (EDITORIAL_EVENTS[h.accion] ?? h.accion) + (h.detalles?.motivo ? ' · ' + h.detalles.motivo : ''), actor: h.actor, at: h.created_at.toISOString() })),
  };
}
