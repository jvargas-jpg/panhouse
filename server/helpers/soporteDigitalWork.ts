import { pool } from '../db/client.js';
import { createHash } from 'node:crypto';
import { diaCaracas } from './atencionEspecialista.js';
import { deriveWork, DIGITAL_WORK_ROWS_SQL, stage, type DigitalWorkItemRow } from './soporteDigitalHome.js';
import { specialistsFor } from './editorialProjects.js';
import { CAMPOS_DOCUMENTALES } from './fichaDocumentalCatalogo.js';
import { DIGITAL_STAGE_LABELS } from '../../shared/soporteDigitalHome.js';
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
  DIGITAL_TRABAJO_INICIADO: 'Tarea digital iniciada',
  DIGITAL_HITO_REGISTRADO: 'Hito digital registrado',
  DIGITAL_CONTROL_COMPLETADO: 'Control digital completado',
  DIGITAL_DATOS_ACTUALIZADOS: 'Datos digitales actualizados',
};
const MILESTONE_LABELS: Record<string, string> = {
  enviarFormulario: 'Envío del formulario registrado', registrarPrueba: 'Prueba de archivos KDP registrada', registrarCarga: 'Carga de archivos registrada',
};
const eventLabel = (action: string, details?: { kind?: string } | null) =>
  action === 'DIGITAL_HITO_REGISTRADO' ? MILESTONE_LABELS[details?.kind ?? ''] ?? EVENTS[action]! : EVENTS[action] ?? action;

export const digitalRevision = (r: DigitalWorkItemRow) => {
  // pg y Drizzle devuelven timestamps con representaciones diferentes.
  // Normalizar antes de comparar lectura fuera/dentro de una transacción.
  const stable = Object.entries(r).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key,
    key.endsWith('_at') && value ? new Date(value instanceof Date ? value.getTime() : String(value)).toISOString() : value,
  ]);
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
};

async function withLastActivity(rows: DigitalWorkRow[]): Promise<DigitalWorkRow[]> {
  const ids = rows.map(r => r.workItemId);
  if (!ids.length) return rows;
  const { rows: activity } = await pool.query<{ entity_id: string; accion: string; created_at: Date; detalles: { kind?: string } | null }>(
    `SELECT DISTINCT ON (w.id) w.id entity_id,l.accion,l.created_at,l.detalles FROM work_items w JOIN audit_logs l
      ON l.entity_id=w.id OR (l.proyecto_id=w.proyecto_id AND l.accion='FICHA_DOCUMENTAL_ACTUALIZADA'
        AND (l.detalles->>'area'='digital' OR (l.detalles->>'area'='diseno'
          AND coalesce(l.detalles->'campos','[]'::jsonb) ?| array['paqueteFinalCargado','paqueteFinalEntrega','paqueteFinalArchivos'])))
      WHERE w.id=ANY($1::uuid[]) AND l.accion=ANY($2::text[]) ORDER BY w.id,l.created_at DESC,l.id DESC`,
    [ids, Object.keys(EVENTS)]);
  const latest = new Map(activity.map(a => [a.entity_id, a]));
  return rows.map(r => {
    const a = latest.get(r.workItemId);
    return a ? { ...r, lastActivity: { label: eventLabel(a.accion, a.detalles), at: a.created_at.toISOString() } } : r;
  });
}

export async function listarMiTrabajoDigital(f: DigitalWorkFilters, now = new Date()): Promise<DigitalWorkList> {
  // SQL pagina antes de transferir filas. Tres consultas constantes:
  // totales/opciones, página, actividad de sus work items. Sin Drive.
  const today = diaCaracas(now);
  const values = [today, f.search.trim(), f.project ?? null, f.state ?? null, f.deadline ?? null, f.blocked ?? null, f.stage ?? null, f.tab];
  // Las proyecciones corresponden a deriveWork/stage; los tests verifican
  // que estado, vencimiento y etapa mantengan la misma semántica.
  const cte = `WITH base AS (${DIGITAL_WORK_ROWS_SQL}), staged AS (
    SELECT base.*, CASE WHEN lower(trim(digital_status))='completado' THEN 'completed' WHEN loaded THEN 'loaded'
      WHEN package_available AND activation IS NOT NULL THEN 'testing' ELSE 'preparation' END stage_key,
      coalesce(task_name,CASE WHEN activation IS NULL THEN CASE WHEN form_sent IS NULL THEN 'Enviar el formulario de activación Amazon' ELSE 'Registrar la activación Amazon' END
        WHEN loaded THEN 'Consultar el seguimiento digital' WHEN tested THEN 'Continuar la preparación de carga KDP' ELSE 'Revisar los archivos finales para KDP' END) task_label
    FROM base), classified AS (
    SELECT staged.*, CASE WHEN project_state='pausado' THEN 'paused'
      WHEN project_state='culminado' THEN 'completed'
      WHEN estado='bloqueado' OR nullif(gate_bloqueante,'') IS NOT NULL THEN 'blocked'
      WHEN activation IS NOT NULL AND NOT package_available THEN 'waiting_material'
      WHEN stage_key='completed' THEN 'completed' WHEN estado='en_progreso' THEN 'in_progress' ELSE 'pending' END state_key
    FROM staged), dated AS (
    SELECT classified.*,CASE WHEN state_key IN ('pending','in_progress') THEN CASE
      WHEN deadline IS NULL THEN 'none' WHEN deadline<$1 THEN 'overdue' WHEN deadline=$1 THEN 'today'
      WHEN deadline::date<=($1::date+2) THEN 'soon' ELSE 'scheduled' END ELSE 'none' END deadline_key
    FROM classified), filtered AS (
    SELECT * FROM dated WHERE ($2='' OR strpos(lower(concat_ws(' ',title,authors,codigo,task_label,
      CASE stage_key WHEN 'preparation' THEN '${DIGITAL_STAGE_LABELS.preparation}' WHEN 'testing' THEN '${DIGITAL_STAGE_LABELS.testing}'
      WHEN 'loaded' THEN '${DIGITAL_STAGE_LABELS.loaded}' ELSE '${DIGITAL_STAGE_LABELS.completed}' END)),lower($2))>0)
      AND ($3::uuid IS NULL OR proyecto_id=$3::uuid) AND ($4::text IS NULL OR state_key=$4)
      AND ($5::text IS NULL OR deadline_key=$5) AND ($6::text IS NULL OR (state_key='blocked')=($6='yes'))
      AND ($7::text IS NULL OR stage_key=$7)), selected AS (SELECT * FROM filtered WHERE $8='all' OR stage_key=$8)`;
  const { rows: [stats] } = await pool.query<{ counts: Record<DigitalWorkTab, number>; total: number; projects: { id: string; name: string }[] }>(`${cte}
    SELECT (SELECT json_build_object('all',count(*),'preparation',count(*) FILTER(WHERE stage_key='preparation'),
      'testing',count(*) FILTER(WHERE stage_key='testing'),'loaded',count(*) FILTER(WHERE stage_key='loaded'),
      'completed',count(*) FILTER(WHERE stage_key='completed')) FROM filtered) counts,
      (SELECT count(*)::int FROM selected) total,
      coalesce((SELECT json_agg(p ORDER BY name,id) FROM (SELECT DISTINCT proyecto_id id,title name FROM base) p),'[]') projects`, values);
  const total = stats!.total, pages = Math.max(1, Math.ceil(total / f.pageSize)), page = Math.min(Math.max(1, f.page), pages);
  const priorityOrder = `CASE deadline_key WHEN 'overdue' THEN 0 WHEN 'today' THEN 1 WHEN 'soon' THEN 2 ELSE CASE WHEN state_key='in_progress' THEN 3 WHEN state_key='pending' THEN 4 WHEN state_key='blocked' THEN 5 WHEN state_key='completed' THEN 7 ELSE 6 END END,deadline NULLS LAST`;
  const order = f.sort === 'recent' ? 'greatest(work_updated_at,control_updated_at,material_updated_at,digital_updated_at) DESC' : f.sort === 'deadline' ? 'deadline NULLS LAST' : priorityOrder;
  const { rows } = await pool.query<DigitalWorkItemRow>(`${cte} SELECT * FROM selected ORDER BY ${order},title,id LIMIT $9 OFFSET $10`, [...values, f.pageSize, (page - 1) * f.pageSize]);
  return { items: await withLastActivity(rows.map(r => toWorkRow(r, today))), total, pages, page, counts: stats!.counts, options: { projects: stats!.projects } };
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

export function canEditDigitalData(r: DigitalWorkItemRow) {
  return ['activacion_amazon', 'default'].includes(r.business_key) && !r.task_name
    && !['pausado', 'culminado', 'retirado'].includes(r.project_state)
    && r.estado !== 'bloqueado' && !r.gate_bloqueante && stage(r) !== 'completed';
}

export function nextDigitalAction(r: DigitalWorkItemRow): DigitalNextAction {
  // Las acciones documentales existentes pertenecen al control/activación.
  // Un paso adicional configurado conserva su fila, no hereda estas escrituras.
  if (!['activacion_amazon', 'default'].includes(r.business_key) || r.task_name) return null;
  if (r.project_state === 'pausado' || r.project_state === 'culminado') return null;
  if (r.estado === 'bloqueado' || r.gate_bloqueante) return null;
  if (stage(r) === 'completed') return null;
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
    pool.query<{ id: string; accion: string; created_at: Date; detalles: { kind?: string } | null }>(
      `SELECT id,accion,created_at,detalles FROM audit_logs WHERE proyecto_id=$1 AND accion=ANY($2::text[])
       AND (entity_id=$3 OR (accion='FICHA_DOCUMENTAL_ACTUALIZADA' AND (detalles->>'area'='digital' OR
         (detalles->>'area'='diseno' AND coalesce(detalles->'campos','[]'::jsonb) ?| array['paqueteFinalCargado','paqueteFinalEntrega','paqueteFinalArchivos']))))
       ORDER BY created_at DESC,id DESC LIMIT 20`, [r.proyecto_id, Object.keys(EVENTS), workItemId]),
  ]);
  const catalog: DigitalCatalogGroup[] = CATALOG_GROUPS.map(g => ({
    label: g.label,
    fields: g.keys.map(key => {
      const def = DIGITAL_FIELDS.find(f => f.key === key);
      const value = catalogRow[key];
      return { key, label: def?.label ?? key, type: (def?.type ?? 'texto') as 'texto' | 'fecha' | 'enlace', value: value == null ? null : String(value) };
    }),
  }));
  const historyEntries: DigitalHistoryEntry[] = history.rows.map(h => ({ id: h.id, label: eventLabel(h.accion, h.detalles), at: h.created_at.toISOString() }));
  return {
    summary: row!,
    revision: digitalRevision(r),
    canStart: !!nextDigitalAction(r) && r.estado === 'pendiente' && !r.activation && !r.started_at,
    canEditData: canEditDigitalData(r),
    currentLoads: { kdp: !!r.loaded_kdp, kindle: !!r.loaded_kindle },
    startedAt: r.started_at ?? null,
    specialist: specialists.get(r.proyecto_id)?.nombre ?? null,
    assignedAt: r.created_at.toISOString(),
    cuentaAmazon: null, // nunca se muestra: ver soporteDigitalCuentaAmazon "contenido protegido" en fichaViva.ts
    formSentAt: r.form_sent, activatedAt: r.activation, digitalEstatus: r.digital_status,
    packageAvailable: r.package_available,
    nextAction: nextDigitalAction(r), waitingOn: WAITING_ON(r),
    catalog, materialsAvailable: r.package_available,
    history: historyEntries,
  };
}
