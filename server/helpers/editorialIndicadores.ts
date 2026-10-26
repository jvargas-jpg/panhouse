import { pool } from '../db/client.js';
import { editorialInterventions, editorialActivity } from './editorialChief.js';
import { projectState } from './editorialProjects.js';
import { ajustarPlazoEdicionPorPausas, evaluarPlazoEdicion, plazoCapituloEditor } from './edicionSla.js';
import { diaCaracas } from './atencionEspecialista.js';
import { ventanaRrpp } from './rrppIndicadores.js';
import type { EditorialIntervention } from '../../shared/editorialChief.js';
import type {
  ActividadIndicadorEdicion, CicloTipoIndicador, DistribucionEstadoEdicion, EditorIndicador,
  FiltrosIndicadoresEdicion, IndicadoresEdicion, KpiIndicadorEdicion, PeriodoIndicadoresEdicion,
  ProyectoRiesgoEdicion, SemanaFlujoEdicion, ServicioIndicadorEdicion,
} from '../../shared/editorialIndicadores.js';

// ---------------------------------------------------------------------
// Período: presets reales (prompt §11-12), nunca "Agosto 2026" fijo.
// Reusa ventanaRrpp (mismo cálculo de ventana anterior/zona horaria que
// Jefatura y Líder Creativo) -- solo se resuelve from/to según el preset acá.
// ---------------------------------------------------------------------
function resolverPreset(f: FiltrosIndicadoresEdicion, hoy: string): { from: string; to: string } {
  const [y, m] = hoy.split('-').map(Number) as [number, number];
  const primerDiaMes = (año: number, mes: number) => `${año}-${String(mes).padStart(2, '0')}-01`;
  const ultimoDiaMes = (año: number, mes: number) => new Date(Date.UTC(año, mes, 0)).toISOString().slice(0, 10);
  const mesesAtras = (n: number) => { const d = new Date(Date.UTC(y, m - 1 - n, 1)); return primerDiaMes(d.getUTCFullYear(), d.getUTCMonth() + 1); };
  switch (f.preset) {
    case 'mes-anterior': { const d = new Date(Date.UTC(y, m - 2, 1)); return { from: primerDiaMes(d.getUTCFullYear(), d.getUTCMonth() + 1), to: ultimoDiaMes(d.getUTCFullYear(), d.getUTCMonth() + 1) }; }
    case 'ultimos-3-meses': return { from: mesesAtras(2), to: hoy };
    case 'ultimos-6-meses': return { from: mesesAtras(5), to: hoy };
    case 'este-anio': return { from: `${y}-01-01`, to: hoy };
    case 'personalizado': return { from: f.from ?? primerDiaMes(y, m), to: f.to ?? hoy };
    case 'este-mes': default: return { from: primerDiaMes(y, m), to: hoy };
  }
}

const dia = (v: string | Date | null) => v == null ? null : typeof v === 'string' ? v.slice(0, 10) : diaCaracas(v);
const cambio = (actual: number, anterior: number): number | null => anterior === 0 ? null : Math.round(((actual - anterior) / anterior) * 1000) / 10;
const round1 = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------
// Fuente histórica propia: completadas/SLA/ciclo necesitan abarcar
// proyectos que pueden haber cerrado desde entonces -- editorialInterventions()
// es a propósito un snapshot de proyectos ACTIVOS (ver editorialChief.ts),
// así que no sirve para esto. Reusa exactamente las mismas columnas y
// reglas de SLA (edicionSla.ts), solo con alcance histórico/por período.
// ---------------------------------------------------------------------
const HISTORIA_SQL = `WITH pause_summary AS (
 SELECT proyecto_id, jsonb_agg(jsonb_build_object('start',(fecha_inicio AT TIME ZONE 'America/Caracas')::date::text,'end',(fecha_fin AT TIME ZONE 'America/Caracas')::date::text)) pauses
 FROM pausas GROUP BY proyecto_id
), capitulo_items AS (
 SELECT c.id, c.proyecto_id, p.codigo, coalesce(nullif(trim(p.titulo_definitivo),''),nullif(trim(p.titulo),''),'Proyecto editorial') title,
 s.id service_id, s.nombre service_name,
 c.fecha_inicio_editor::text start_date, c.fecha_entrega_editor::text completed_at, w.fecha_fin_pautada::text due_date_raw, (w.id IS NOT NULL) has_work_item,
 true is_chapter, 'chapter'::text intervention_type
 FROM capitulos c JOIN proyectos p ON p.id=c.proyecto_id JOIN servicios s ON s.id=p.servicio_id
 LEFT JOIN work_items w ON w.proyecto_id=c.proyecto_id AND w.tipo='edicion' AND w.business_key='capitulo:'||c.id::text
 WHERE c.fecha_entrega_editor IS NOT NULL
), work_item_items AS (
 SELECT w.id, w.proyecto_id, p.codigo, coalesce(nullif(trim(p.titulo_definitivo),''),nullif(trim(p.titulo),''),'Proyecto editorial') title,
 s.id service_id, s.nombre service_name,
 w.fecha_inicio_real::text start_date, w.fecha_fin_real::text completed_at, w.fecha_fin_pautada::text due_date_raw, true has_work_item,
 false is_chapter, (CASE WHEN step.nombre IS NOT NULL THEN 'step:'||step.nombre ELSE w.business_key END)::text intervention_type
 FROM work_items w JOIN proyectos p ON p.id=w.proyecto_id JOIN servicios s ON s.id=p.servicio_id
 LEFT JOIN pasos step ON step.id=w.paso_id
 WHERE w.tipo='edicion' AND w.business_key NOT LIKE 'capitulo:%' AND w.estado='completado' AND w.fecha_fin_real IS NOT NULL
), items AS (
 SELECT * FROM capitulo_items UNION ALL SELECT * FROM work_item_items
)
SELECT i.*, coalesce(ps.pauses,'[]'::jsonb) pauses,
 (SELECT a.usuario_id FROM project_assignments a WHERE a.proyecto_id=i.proyecto_id AND a.tipo='editor' AND a.work_item_id IS NULL
   AND a.asignado_en<=i.completed_at::timestamptz AND (a.finalizado_en IS NULL OR a.finalizado_en>i.completed_at::timestamptz)
   ORDER BY a.asignado_en DESC LIMIT 1) editor_id,
 (SELECT u.nombre FROM project_assignments a JOIN usuarios u ON u.id=a.usuario_id WHERE a.proyecto_id=i.proyecto_id AND a.tipo='editor' AND a.work_item_id IS NULL
   AND a.asignado_en<=i.completed_at::timestamptz AND (a.finalizado_en IS NULL OR a.finalizado_en>i.completed_at::timestamptz)
   ORDER BY a.asignado_en DESC LIMIT 1) editor_name
FROM items i LEFT JOIN pause_summary ps ON ps.proyecto_id=i.proyecto_id
WHERE i.completed_at::date >= $1::date AND i.completed_at::date <= $2::date
  AND ($3::uuid IS NULL OR i.service_id=$3) AND ($4::uuid IS NULL OR
    (SELECT a.usuario_id FROM project_assignments a WHERE a.proyecto_id=i.proyecto_id AND a.tipo='editor' AND a.work_item_id IS NULL
     AND a.asignado_en<=i.completed_at::timestamptz AND (a.finalizado_en IS NULL OR a.finalizado_en>i.completed_at::timestamptz) ORDER BY a.asignado_en DESC LIMIT 1)=$4)
  AND ($5::text IS NULL OR ($5='chapter' AND i.is_chapter) OR ($5<>'chapter' AND NOT i.is_chapter AND i.intervention_type=$5))`;

interface HistRow {
  id: string; proyecto_id: string; codigo: string; title: string; service_id: string; service_name: string;
  start_date: string | null; completed_at: string; due_date_raw: string | null; has_work_item: boolean; is_chapter: boolean; intervention_type: string;
  pauses: { start: string; end: string | null }[]; editor_id: string | null; editor_name: string | null;
}

async function historiaCompletadas(from: string, to: string, service?: string, editor?: string, interventionType?: string, hoy = diaCaracas(new Date())): Promise<(HistRow & { dueDate: string | null; onTime: boolean | null })[]> {
  const { rows } = await pool.query<HistRow>(HISTORIA_SQL, [from, to, service ?? null, editor ?? null, interventionType ?? null]);
  return rows.map(r => {
    // has_work_item distingue "nunca se sincronizó" (fabricar un plazo de
    // respaldo tiene sentido) de "el work_item existe y a propósito no
    // tiene plazo" (ej. aplicación de feedback, sin SLA definido por el
    // manual -- edicionSla/sincronizarCapituloEditorial ya lo deja en
    // NULL a propósito). Sin esta distinción, un NULL intencional caía
    // en el mismo `??` que un NULL por falta de sync, resucitando un
    // plazo que el propio dominio decidió no fijar.
    const rawDue = r.has_work_item ? r.due_date_raw : (r.is_chapter && r.start_date ? plazoCapituloEditor(r.start_date) : null);
    const dueDate = r.start_date ? ajustarPlazoEdicionPorPausas(r.start_date, rawDue, r.pauses, hoy) : rawDue;
    const completedDay = dia(r.completed_at)!;
    return { ...r, dueDate, onTime: dueDate ? completedDay <= dueDate : null };
  });
}

// ---------------------------------------------------------------------
// Tendencia semanal: iniciadas/completadas/vencidas por semana (prompt §31-32).
// "Vencidas" acá = intervenciones de la semana que vencieron sin completarse
// EN ESA SEMANA bajo responsabilidad de Edición -- se deriva del snapshot
// actual (editorialInterventions), agrupando por la semana de su dueDate
// vencido; no existe un registro histórico de "cuándo se volvió vencida".
// ---------------------------------------------------------------------
function semanasDelPeriodo(from: string, to: string): { semana: string; from: string; to: string }[] {
  const semanas: { semana: string; from: string; to: string }[] = [];
  let cursor = new Date(`${from}T00:00:00Z`);
  // Alinear al lunes de la semana del `from`.
  const dow = cursor.getUTCDay();
  cursor.setUTCDate(cursor.getUTCDate() - ((dow + 6) % 7));
  const end = new Date(`${to}T00:00:00Z`);
  let n = 1;
  while (cursor <= end) {
    const weekFrom = cursor.toISOString().slice(0, 10);
    const weekToDate = new Date(cursor); weekToDate.setUTCDate(weekToDate.getUTCDate() + 6);
    const weekTo = weekToDate.toISOString().slice(0, 10);
    semanas.push({ semana: `S${n}`, from: weekFrom, to: weekTo });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
    n++;
  }
  return semanas.slice(0, 12); // techo razonable (ver prompt §100, mobile stacked)
}

// Mismo mapeo que editorialChief.ts (label de EditorialIntervention): 'default'
// es el contenedor interno del pedido inicial, no un paso con nombre real --
// nunca se muestra el business_key técnico tal cual.
const ETIQUETAS_TIPO: Record<string, string> = { chapter: 'Capítulo', feedback: 'Aplicación de feedback', default: 'Inicio de edición' };
function etiquetaTipo(tipo: string): string {
  if (ETIQUETAS_TIPO[tipo]) return ETIQUETAS_TIPO[tipo]!;
  if (tipo.startsWith('step:')) return tipo.slice(5);
  return tipo.replaceAll('_', ' ');
}

export async function obtenerIndicadoresEdicion(f: FiltrosIndicadoresEdicion, ahora = new Date()): Promise<IndicadoresEdicion> {
  const hoy = diaCaracas(ahora);
  const { from, to } = resolverPreset(f, hoy);
  const v = ventanaRrpp({ from, to }, hoy);
  const periodo: PeriodoIndicadoresEdicion = { preset: f.preset, from: v.from, to: v.to, anteriorFrom: v.anteriorFrom, anteriorTo: v.anteriorTo, zonaHoraria: 'America/Caracas', hoy };
  const insufficientData: string[] = [];

  const [snapshotAll, actividad, completadas, completadasAnterior] = await Promise.all([
    editorialInterventions(hoy),
    editorialActivity(),
    historiaCompletadas(v.from, v.to, f.service, f.editor, f.interventionType, hoy),
    historiaCompletadas(v.anteriorFrom, v.anteriorTo, f.service, f.editor, f.interventionType, hoy),
  ]);

  const snapshot = snapshotAll.filter(i =>
    (!f.service || i.serviceId === f.service) && (!f.editor || i.editorId === f.editor) && (!f.interventionType || i.interventionType === f.interventionType));

  // --- KPIs ---
  const projectsInEditing: KpiIndicadorEdicion = { value: new Set(snapshot.map(i => i.projectId)).size, deltaPct: null, snapshot: true };
  const overdueInterventions: KpiIndicadorEdicion = { value: snapshot.filter(i => i.overdue).length, deltaPct: null, snapshot: true };
  const waitingAuthor: KpiIndicadorEdicion = { value: snapshot.filter(i => i.waitingOn === 'author').length, deltaPct: null, snapshot: true };
  const completedDeliveries: KpiIndicadorEdicion = { value: completadas.length, deltaPct: cambio(completadas.length, completadasAnterior.length), snapshot: false };

  // --- Distribución de estado (snapshot actual, prompt §30 opción A) ---
  const distMap = new Map<string, number>();
  for (const i of snapshot) distMap.set(i.state, (distMap.get(i.state) ?? 0) + 1);
  const totalDist = snapshot.length || 1;
  const stateDistribution: DistribucionEstadoEdicion[] = [...distMap].map(([estado, cantidad]) => ({ estado, cantidad, porcentaje: round1((cantidad / totalDist) * 100) })).sort((a, b) => b.cantidad - a.cantidad);

  // --- Tendencia semanal ---
  const semanas = semanasDelPeriodo(v.from, v.to);
  const iniciadasPorSemana = new Map<string, number>(), completadasPorSemana = new Map<string, number>(), vencidasPorSemana = new Map<string, number>();
  for (const c of completadas) { const s = semanas.find(s => c.completed_at.slice(0, 10) >= s.from && c.completed_at.slice(0, 10) <= s.to); if (s) completadasPorSemana.set(s.semana, (completadasPorSemana.get(s.semana) ?? 0) + 1); }
  for (const c of completadas) { if (!c.start_date) continue; const s = semanas.find(s => c.start_date! >= s.from && c.start_date! <= s.to); if (s) iniciadasPorSemana.set(s.semana, (iniciadasPorSemana.get(s.semana) ?? 0) + 1); }
  for (const i of snapshot) { if (!i.overdue || !i.dueDate) continue; const s = semanas.find(s => i.dueDate! >= s.from && i.dueDate! <= s.to); if (s) vencidasPorSemana.set(s.semana, (vencidasPorSemana.get(s.semana) ?? 0) + 1); }
  const weeklyFlow: SemanaFlujoEdicion[] = semanas.map(s => ({ semana: s.semana, from: s.from, to: s.to, iniciadas: iniciadasPorSemana.get(s.semana) ?? 0, completadas: completadasPorSemana.get(s.semana) ?? 0, vencidas: vencidasPorSemana.get(s.semana) ?? 0 }));

  // --- Equipo editorial: snapshot (activas/vencidas/espera) + período (completadas/SLA) ---
  const porEditorSnapshot = new Map<string, { id: string; nombre: string; activas: number; vencidas: number; vencenEstaSemana: number; esperandoTerceros: number }>();
  const weekEnd = (() => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + (7 - d.getUTCDay()) % 7); return d.toISOString().slice(0, 10); })();
  for (const i of snapshot) {
    if (!i.editorId) continue;
    const e = porEditorSnapshot.get(i.editorId) ?? { id: i.editorId, nombre: i.editor ?? 'Editor', activas: 0, vencidas: 0, vencenEstaSemana: 0, esperandoTerceros: 0 };
    if (i.actionable) { e.activas++; if (i.overdue) e.vencidas++; if (i.dueDate && i.dueDate >= hoy && i.dueDate <= weekEnd) e.vencenEstaSemana++; }
    if (i.waitingOn) e.esperandoTerceros++;
    porEditorSnapshot.set(i.editorId, e);
  }
  const porEditorHistoria = new Map<string, { completadas: typeof completadas }>();
  for (const c of completadas) { if (!c.editor_id) continue; const g = porEditorHistoria.get(c.editor_id) ?? { completadas: [] as typeof completadas }; g.completadas.push(c); porEditorHistoria.set(c.editor_id, g); }
  const editorIds = new Set([...porEditorSnapshot.keys(), ...porEditorHistoria.keys()]);
  const editors: EditorIndicador[] = [...editorIds].map(id => {
    const snap = porEditorSnapshot.get(id);
    const hist = porEditorHistoria.get(id)?.completadas ?? [];
    const medibles = hist.filter(c => c.onTime !== null);
    const enPlazo = medibles.filter(c => c.onTime).length;
    return {
      id, nombre: snap?.nombre ?? hist[0]?.editor_name ?? 'Editor',
      activas: snap?.activas ?? 0, vencidas: snap?.vencidas ?? 0, vencenEstaSemana: snap?.vencenEstaSemana ?? 0, esperandoTerceros: snap?.esperandoTerceros ?? 0,
      entregasCompletadas: hist.length,
      slaPct: medibles.length ? round1((enPlazo / medibles.length) * 100) : null, slaMuestras: medibles.length,
    };
  }).sort((a, b) => b.activas - a.activas || a.nombre.localeCompare(b.nombre, 'es') || a.id.localeCompare(b.id));

  // --- Tiempo de ciclo por tipo (prompt §43-46: bajo responsabilidad de Edición) ---
  const tiposCiclo = [...new Set(completadas.map(c => c.intervention_type))];
  const cycleTimes: CicloTipoIndicador[] = tiposCiclo.map(tipo => {
    const muestras = completadas.filter(c => c.intervention_type === tipo && c.start_date && c.start_date <= c.completed_at.slice(0, 10));
    const dias = muestras.map(c => (Date.parse(c.completed_at) - Date.parse(c.start_date! + 'T00:00:00Z')) / 86400000);
    return {
      tipo, etiqueta: etiquetaTipo(tipo),
      promedioDias: dias.length ? round1(dias.reduce((a, b) => a + b, 0) / dias.length) : null,
      muestras: muestras.length,
      definicion: 'Tiempo bajo responsabilidad de Edición: desde el inicio registrado del Editor hasta su entrega, sin descontar espera del autor (esa espera es una intervención aparte).',
    };
  }).sort((a, b) => b.muestras - a.muestras);
  if (!cycleTimes.length) insufficientData.push('cycleTimes');

  // --- Servicios (snapshot activo, prompt §50) ---
  const servMap = new Map<string, number>();
  for (const i of snapshot) servMap.set(i.service, (servMap.get(i.service) ?? 0) + 1);
  const services: ServicioIndicadorEdicion[] = [...servMap].map(([servicio, cantidad]) => ({ servicio, cantidad })).sort((a, b) => b.cantidad - a.cantidad);

  // --- Proyectos en riesgo (prompt §52-56: una fila = proyecto) ---
  const porProyecto = new Map<string, EditorialIntervention[]>();
  for (const i of snapshot) { const g = porProyecto.get(i.projectId) ?? []; g.push(i); porProyecto.set(i.projectId, g); }
  const riskProjects: ProyectoRiesgoEdicion[] = [...porProyecto.entries()]
    .flatMap(([projectId, items]): ProyectoRiesgoEdicion[] => {
      const atRisk = items.filter(i => i.overdue || i.atRisk || i.state === 'Bloqueadas');
      if (!atRisk.length) return [];
      const next = items.filter(i => i.actionable && i.dueDate && !i.overdue).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0];
      return [{ projectId, code: items[0]!.code, title: items[0]!.title, authors: items[0]!.authors, interventionsAtRisk: atRisk.length, nextDelivery: next?.dueDate ?? null, editorialState: projectState(items) }];
    })
    .sort((a, b) => b.interventionsAtRisk - a.interventionsAtRisk || (a.nextDelivery ?? '9999').localeCompare(b.nextDelivery ?? '9999'))
    .slice(0, 8);

  const activity: ActividadIndicadorEdicion[] = actividad.slice(0, 8);

  const nombreServ = new Map(snapshotAll.filter(i => i.serviceId).map(i => [i.serviceId!, i.service.split(' · ')[0]!]));
  const nombreEditor = new Map(snapshotAll.filter(i => i.editorId && i.editor).map(i => [i.editorId!, i.editor!]));
  const tiposFiltro = new Map(snapshotAll.filter(i => i.interventionType).map(i => [i.interventionType!, etiquetaTipo(i.interventionType!)]));
  const choices = <T,>(map: Map<string, string>) => [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return {
    actualizadoEn: ahora.toISOString(), periodo,
    kpis: { projectsInEditing, completedDeliveries, overdueInterventions, waitingAuthor },
    stateDistribution, weeklyFlow, editors, cycleTimes, services, riskProjects, activity,
    filters: { services: choices(nombreServ), editors: choices(nombreEditor), interventionTypes: choices(tiposFiltro) },
    insufficientData,
  };
}

const celdaCsv = (value: string | number | null) => { const text = String(value ?? 'Sin datos suficientes'); return `"${(/^[\s]*[=+\-@]/.test(text) && typeof value === 'string' ? "'" : '') + text.replaceAll('"', '""')}"`; };
export function csvIndicadoresEdicion(data: IndicadoresEdicion): string {
  const rows: (string | number | null)[][] = [
    ['Indicadores de Edición', data.periodo.from, data.periodo.to],
    [],
    ['Resumen'],
    ['Proyectos en edición (corte actual)', data.kpis.projectsInEditing.value],
    ['Entregas completadas en el período', data.kpis.completedDeliveries.value],
    ['Intervenciones vencidas (corte actual)', data.kpis.overdueInterventions.value],
    ['En espera de autor (corte actual)', data.kpis.waitingAuthor.value],
    [],
    ['Estado actual de las intervenciones'],
    ['Estado', 'Cantidad', 'Porcentaje'],
    ...data.stateDistribution.map(d => [d.estado, d.cantidad, d.porcentaje]),
    [],
    ['Equipo editorial'],
    ['Editor', 'Activas', 'Vencidas', 'Vencen esta semana', 'Esperando terceros', 'Entregas completadas', 'Cumplimiento SLA (%)', 'Muestras SLA'],
    ...data.editors.map(e => [e.nombre, e.activas, e.vencidas, e.vencenEstaSemana, e.esperandoTerceros, e.entregasCompletadas, e.slaPct, e.slaMuestras]),
    [],
    ['Tiempo de ciclo por tipo de intervención (días bajo responsabilidad de Edición)'],
    ...data.cycleTimes.map(c => [c.etiqueta, c.promedioDias, c.muestras]),
    [],
    ['Intervenciones activas por servicio'],
    ...data.services.map(s => [s.servicio, s.cantidad]),
    [],
    ['Proyectos con intervenciones en riesgo'],
    ['Proyecto', 'Autor', 'Intervenciones en riesgo', 'Próxima entrega', 'Estado'],
    ...data.riskProjects.map(p => [p.title, p.authors, p.interventionsAtRisk, p.nextDelivery, p.editorialState]),
  ];
  return '﻿' + rows.map(row => row.map(celdaCsv).join(',')).join('\r\n') + '\r\n';
}
