import { pool } from '../db/client.js';
import { diaCaracas } from './atencionEspecialista.js';
import { compareDigitalTasks, deriveWork, DIGITAL_WORK_ROWS_SQL, stage, type DigitalWorkItemRow } from './soporteDigitalHome.js';
import { specialistsFor } from './editorialProjects.js';
import { CAMPOS_DOCUMENTALES } from './fichaDocumentalCatalogo.js';
import type {
  DigitalCatalogGroup, DigitalHistoryEntry, DigitalNextAction, DigitalWorkDetail,
  DigitalWorkFilters, DigitalWorkList, DigitalWorkRow, DigitalWorkTab,
} from '../../shared/soporteDigitalWork.js';

export const digitalWorkError = (message: string, statusCode = 404) => Object.assign(new Error(message), { statusCode });

function toWorkRow(r: DigitalWorkItemRow, today: string): DigitalWorkRow {
  return { workItemId: r.id, projectId: r.proyecto_id, projectTitle: r.title, projectCode: r.codigo, authors: r.authors, coverUrl: r.cover, lastActivity: null, ...deriveWork(r, today) };
}

// Mismos eventos reales que Inicio lee para Actividad reciente (ver
// soporteDigitalHome.ts) — una sola taxonomía de eventos digitales.
const EVENTS: Record<string, string> = {
  AMAZON_ACTIVACION_HABILITADA: 'Activación Amazon habilitada',
  AMAZON_ACTIVACION_REGISTRADA: 'Activación Amazon registrada',
  FICHA_DOCUMENTAL_ACTUALIZADA: 'Hitos digitales o paquete final actualizados',
};

async function withLastActivity(rows: DigitalWorkRow[]): Promise<DigitalWorkRow[]> {
  const ids = rows.map(r => r.workItemId);
  if (!ids.length) return rows;
  const { rows: activity } = await pool.query<{ entity_id: string; accion: string; created_at: Date }>(
    `SELECT DISTINCT ON (entity_id) entity_id,accion,created_at FROM audit_logs WHERE entity_id=ANY($1::uuid[]) AND accion=ANY($2::text[]) ORDER BY entity_id,created_at DESC,id DESC`,
    [ids, Object.keys(EVENTS)]);
  const latest = new Map(activity.map(a => [a.entity_id, a]));
  return rows.map(r => {
    const a = latest.get(r.workItemId);
    return a ? { ...r, lastActivity: { label: EVENTS[a.accion] ?? a.accion, at: a.created_at.toISOString() } } : r;
  });
}

function matchesTab(row: DigitalWorkRow, tab: DigitalWorkTab): boolean {
  return tab === 'all' || row.stage === tab;
}
function matchesSearch(row: DigitalWorkRow, search: string): boolean {
  if (!search) return true;
  const haystack = `${row.projectTitle} ${row.authors} ${row.projectCode} ${row.taskLabel}`.toLowerCase();
  return haystack.includes(search);
}

export async function listarMiTrabajoDigital(f: DigitalWorkFilters, now = new Date()): Promise<DigitalWorkList> {
  // Una sola consulta trae todas las tareas digitales de la bandeja
  // compartida (hoy, decenas de filas como mucho) -- tab/búsqueda/
  // proyecto/orden/página se resuelven en memoria sobre ese único
  // resultado, reusando exactamente deriveWork/stage (helpers/
  // soporteDigitalHome.ts) para que Inicio y Mi trabajo nunca puedan
  // mostrar una etapa distinta para la misma fila. Sin N+1: una segunda
  // consulta trae la última actividad solo de la página visible.
  const { rows } = await pool.query<DigitalWorkItemRow>(`${DIGITAL_WORK_ROWS_SQL} ORDER BY w.created_at,w.id`);
  const today = diaCaracas(now);
  const all = rows.filter(r => r.project_state !== 'culminado').map(r => toWorkRow(r, today));
  const search = f.search.trim().toLowerCase();
  const scoped = all.filter(r => matchesSearch(r, search) && (!f.project || r.projectId === f.project));
  const counts = { all: scoped.length, preparation: 0, testing: 0, loaded: 0, completed: 0 } as Record<DigitalWorkTab, number>;
  for (const r of scoped) counts[r.stage]++;
  const filtered = scoped.filter(r => matchesTab(r, f.tab)).sort(compareDigitalTasks);
  const total = filtered.length, pages = Math.max(1, Math.ceil(total / f.pageSize)), page = Math.min(Math.max(1, f.page), pages);
  const pageItems = filtered.slice((page - 1) * f.pageSize, page * f.pageSize);
  const projects = new Map(all.map(r => [r.projectId, r.projectTitle]));
  const options = { projects: [...projects.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es')) };
  return { items: await withLastActivity(pageItems), total, pages, page, counts, options };
}

// Grupos reales del catálogo documental 'digital' (fichaDocumentalCatalogo.ts,
// hoja real "SOPORTE DIGITAL" del negocio) -- ningún campo inventado,
// agrupados como ya los distingue el negocio (cuenta/formulario,
// criterios de la ficha Amazon, pruebas y carga, cierre/inducción).
const CATALOG_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'Formulario y cuenta', keys: ['recepcionFormulario', 'creacionCuenta', 'observacionesRegistro'] },
  { label: 'Criterios de la ficha Amazon', keys: ['reunionCriterios', 'grabacionCriterios', 'tapa', 'portada', 'papel', 'precioKdp', 'precioKindle', 'lanzamientoAmazon', 'observacionesCriterios'] },
  { label: 'Pruebas y carga KDP', keys: ['pruebaArchivos', 'cargaKdp', 'cargaKindle'] },
  { label: 'Inducción y cierre', keys: ['induccion', 'grabacionInduccion'] },
];
const DIGITAL_FIELDS = CAMPOS_DOCUMENTALES.filter(c => c.area === 'digital');

function nextAction(r: DigitalWorkItemRow): DigitalNextAction {
  if (r.project_state === 'pausado' || r.project_state === 'culminado') return null;
  if (r.estado === 'bloqueado' || r.gate_bloqueante) return null;
  // La cuenta activada (r.activation) es la señal más avanzada y, por lo
  // tanto, la autoritativa -- igual que en deriveWork (soporteDigitalHome.ts).
  // Comprobar form_sent primero rompía esto: una cuenta ya activada sin
  // form_sent explícito (dato cargado fuera de orden, o backfill) volvía
  // a pedir "enviar el formulario" en vez de reconocer que el proceso ya
  // avanzó -- mismo tipo de bug ya encontrado y corregido en Inicio.
  if (!r.activation) return r.form_sent ? { kind: 'registrarActivacion' } : { kind: 'enviarFormulario' };
  if (!r.package_available) return null; // depende de Diseño, no de esta cuenta
  if (!r.tested) return { kind: 'registrarPrueba' };
  if (!r.loaded) return { kind: 'registrarCarga' };
  if (stage(r) !== 'completed') return { kind: 'marcarCompletado' };
  return null;
}
const WAITING_ON: (r: DigitalWorkItemRow) => string | null = r =>
  r.project_state === 'pausado' ? null
  : r.estado === 'bloqueado' || r.gate_bloqueante ? null
  : !!r.activation && !r.package_available ? 'Diseño/Calidad — paquete final' : null;

export async function obtenerDetalleTrabajoDigital(workItemId: string, now = new Date()): Promise<DigitalWorkDetail | null> {
  const { rows } = await pool.query<DigitalWorkItemRow>(`${DIGITAL_WORK_ROWS_SQL} WHERE w.id=$1`, [workItemId]);
  const r = rows[0];
  if (!r) return null;
  const today = diaCaracas(now);
  const [row] = await withLastActivity([toWorkRow(r, today)]);
  const [specialists, catalogRow, history] = await Promise.all([
    specialistsFor([r.proyecto_id]),
    pool.query<{ datos: Record<string, string | number | boolean | null> }>(
      `SELECT datos FROM ficha_documental_datos WHERE proyecto_id=$1 AND seccion='digital'`, [r.proyecto_id]).then(res => res.rows[0]?.datos ?? {}),
    pool.query<{ id: string; accion: string; created_at: Date }>(
      `SELECT id,accion,created_at FROM audit_logs WHERE proyecto_id=$1 AND accion=ANY($2::text[])
       AND (accion<>'FICHA_DOCUMENTAL_ACTUALIZADA' OR detalles->>'area' IN ('digital','diseno'))
       ORDER BY created_at DESC,id DESC LIMIT 20`, [r.proyecto_id, Object.keys(EVENTS)]),
  ]);
  const catalog: DigitalCatalogGroup[] = CATALOG_GROUPS.map(g => ({
    label: g.label,
    fields: g.keys.map(key => {
      const def = DIGITAL_FIELDS.find(f => f.key === key);
      const value = catalogRow[key];
      return { key, label: def?.label ?? key, type: (def?.type ?? 'texto') as 'texto' | 'fecha' | 'enlace', value: value == null ? null : String(value) };
    }),
  }));
  const historyEntries: DigitalHistoryEntry[] = history.rows.map(h => ({ id: h.id, label: EVENTS[h.accion] ?? h.accion, at: h.created_at.toISOString() }));
  return {
    summary: row!,
    specialist: specialists.get(r.proyecto_id)?.nombre ?? null,
    assignedAt: r.created_at.toISOString(),
    cuentaAmazon: null, // nunca se muestra: ver soporteDigitalCuentaAmazon "contenido protegido" en fichaViva.ts
    formSentAt: r.form_sent, activatedAt: r.activation, digitalEstatus: r.digital_status,
    packageAvailable: r.package_available,
    nextAction: nextAction(r), waitingOn: WAITING_ON(r),
    catalog, materialsAvailable: r.package_available,
    history: historyEntries,
  };
}
