import { pool } from '../db/client.js';
import { specialistsFor } from './editorialProjects.js';
import { plazoDiseno } from './disenoSla.js';
import type {
  EstadoPlazoCalidad, ValidatorCriterion, ValidatorHistoryEntry, ValidatorMaterial,
  ValidatorWorkDetail, ValidatorWorkFilters, ValidatorWorkList, ValidatorWorkRow, ValidatorWorkStatus,
} from '../../shared/soporteEditorialWork.js';

// Mismas cuatro fases que SeccionCalidadOperativa.tsx (`fases`) y
// soporteEditorialHome.ts (`FASE_LABELS`) — duplicado a propósito, no
// importado, para no acoplar este módulo de servidor a un componente de
// frontend ni crear un módulo compartido solo por una constante.
const FASE_LABELS: Record<number, string> = { 1: 'Validación de textos diagramados', 2: 'Validación de comentarios', 3: 'Revisión final', 4: 'Validación final de comentarios' };
// Mismos 26 criterios y etiquetas reales de CRITERIOS_CALIDAD (server/helpers/calidad.ts)
// y `criterios` (SeccionCalidadOperativa.tsx) — duplicado, no inventado.
const CRITERIOS_LABELS: Record<string, string> = { textos_diagramados: 'Textos diagramados', palabras_cortadas: 'Palabras cortadas', citas: 'Citas', epigrafes: 'Epígrafes', paginas_ejercicios: 'Páginas de ejercicios', portadillas: 'Portadillas', sangria: 'Sangría', casita_panhouse: 'Casita PanHouse', logo_coleccion: 'Logo de colección', creditos: 'Créditos / números legales', notas_pie: 'Notas a pie', titulos: 'Títulos', intertitulos: 'Intertítulos', vinetas: 'Viñetas', indice: 'Índice y cuerpo de tripa', paginacion: 'Enumeración de páginas', foliaturas: 'Foliaturas', fotografias: 'Fotografías', tablas: 'Tablas', dedicatoria: 'Dedicatoria', agradecimientos: 'Agradecimientos', sobre_autor: 'Sobre el autor', prologo: 'Prólogo', comentarios: 'Comentarios', datos: 'Fechas, nombres y lugares', textos_incorporar: 'Archivos / textos por incorporar' };
const CRITERIOS_DE_FASE = (fase: number): string[] => fase === 1 ? Object.keys(CRITERIOS_LABELS) : fase === 3 ? Object.keys(CRITERIOS_LABELS).filter(c => c !== 'textos_diagramados' && c !== 'datos') : [];

const EVENTS: Record<string, string> = {
  CALIDAD_INICIADA: 'Validación iniciada', CALIDAD_REVISADA: 'Resultado registrado', CALIDAD_ENVIADA_AUTOR: 'Enviada al autor',
  CALIDAD_FEEDBACK_AUTOR: 'Feedback del autor aplicado', CALIDAD_APROBADA_AUTOR: 'Aprobada por el autor', CALIDAD_REVISION_FINAL_SOLICITADA: 'Revisión final solicitada',
};

type Fila = {
  id: string; work_item_id: string; numero_fase: number; ronda: number; pdf_version: string; pdf_url: string;
  due_at: Date | null; iniciado_en: Date | null; revisado_en: Date | null; aprobado: boolean | null; solicitado_en: Date;
  observaciones: string | null; comentarios_url: string | null; cantidad_comentarios: number | null; cantidad_paginas: number | null;
  cambios_por_verificar: number | null; cambios_pendientes_por_aplicar: number | null; cambios_nuevos_sugeridos: number | null;
  numeros_legales_url: string | null; checklist: Record<string, { cumple: boolean | null; observaciones?: string }> | null;
  nombre_quien_recibe: string | null;
  proyecto_id: string; codigo: string; project_state: string; title: string; authors: string; cover: string | null;
  work_item_estado: string; gate_bloqueante: string | null; activa: boolean; diseno_id: string; diseno_version_id: string; version_numero: number;
  fuente_url: string; especialista_id: string | null; disenador_id: string | null;
};

const FILA_SQL = `WITH latest_version AS (
    SELECT dv.id, dv.diseno_id, dv.calidad_fase_id, row_number() OVER (PARTITION BY dv.diseno_id ORDER BY dv.numero DESC) rn
    FROM diseno_versiones dv WHERE dv.calidad_fase_id IS NOT NULL
  )
  SELECT q.id, q.work_item_id, q.numero_fase, q.ronda, q.pdf_version, q.pdf_url, q.due_at, q.iniciado_en, q.revisado_en, q.aprobado, q.solicitado_en,
    q.observaciones, q.comentarios_url, q.cantidad_comentarios, q.cantidad_paginas, q.cambios_por_verificar, q.cambios_pendientes_por_aplicar, q.cambios_nuevos_sugeridos,
    q.numeros_legales_url, q.checklist, q.nombre_quien_recibe,
    p.id proyecto_id, p.codigo, p.estado project_state,
    coalesce(nullif(trim(p.titulo_definitivo),''), nullif(trim(p.titulo),''), 'Proyecto editorial') title,
    coalesce((SELECT string_agg(a.nombre, ', ' ORDER BY a.nombre) FROM proyectos_autores x JOIN autores a ON a.id = x.autor_id WHERE x.proyecto_id = p.id), author.nombre) authors,
    CASE WHEN p.portada_decision_autor = 'aprobada' THEN p.propuesta_portada_url END cover,
    w.estado work_item_estado, w.gate_bloqueante, (lv.rn = 1 AND lv.calidad_fase_id = q.id) activa,
    d.id diseno_id, v.id diseno_version_id, v.numero version_numero, d.fuente_url, p.especialista_id, p.disenador_id
  FROM ficha_calidad_fases q
  JOIN work_items w ON w.id = q.work_item_id
  JOIN diseno_versiones v ON v.id = q.diseno_version_id
  JOIN disenos d ON d.id = v.diseno_id
  JOIN proyectos p ON p.id = d.proyecto_id
  JOIN autores author ON author.id = p.autor_id
  LEFT JOIN latest_version lv ON lv.diseno_id = d.id AND lv.rn = 1
  WHERE q.work_item_id IS NOT NULL AND w.estado <> 'cancelado' AND p.estado <> 'retirado'
    AND (p.estado <> 'culminado' OR q.revisado_en IS NOT NULL)`;

async function filas(id?: string): Promise<Fila[]> {
  const { rows } = id
    ? await pool.query<Fila>(FILA_SQL + ' AND q.id = $1 ORDER BY q.solicitado_en DESC', [id])
    : await pool.query<Fila>(FILA_SQL + ' ORDER BY q.solicitado_en DESC');
  return rows;
}

function estado(f: Fila): ValidatorWorkStatus {
  if (!f.activa || f.project_state === 'culminado') return 'completed';
  if (f.revisado_en) return f.aprobado ? 'completed' : 'waiting_design';
  if (!f.iniciado_en) return 'new_round';
  return 'in_review';
}
const STATUS_LABEL: Record<ValidatorWorkStatus, string> = { new_round: 'Nueva ronda', in_review: 'En revisión', waiting_design: 'Esperando Diseño', completed: 'Completada' };
function cta(f: Fila, status: ValidatorWorkStatus): string {
  if (status === 'new_round' && f.numero_fase === 3) return 'Iniciar revisión final';
  if (status === 'new_round') return f.numero_fase === 1 && f.ronda === 1 ? 'Iniciar validación' : 'Revisar nueva versión';
  if (status === 'in_review') return 'Continuar validación';
  if (status === 'waiting_design') return 'Ver contexto';
  return 'Ver resultado';
}

function fila(f: Fila, now: Date): ValidatorWorkRow {
  const status = estado(f);
  const open = status === 'new_round' || status === 'in_review';
  const paused = open && f.project_state === 'pausado';
  const blockedReason = open && f.work_item_estado === 'bloqueado' ? f.gate_bloqueante || 'Esta ronda tiene un bloqueo pendiente.' : null;
  const actionable = (status === 'new_round' || status === 'in_review') && !paused && !blockedReason;
  // El plazo del Validador deja de aplicar una vez resuelta la ronda
  // (master prompt §68: "no contar deadline del Validador si SLA está
  // pausado"): esperando Diseño o completada no muestran vencimiento.
  const deadlineState: EstadoPlazoCalidad | null = actionable ? plazoDiseno(f.due_at, null, now) : null;
  return {
    id: f.id, workItemId: f.work_item_id, projectId: f.proyecto_id, projectCode: f.codigo, title: f.title, authors: f.authors, coverUrl: f.cover,
    numeroFase: f.numero_fase, ronda: f.ronda, versionLabel: f.pdf_version, validationType: FASE_LABELS[f.numero_fase] ?? `Fase ${f.numero_fase}`,
    status, statusLabel: STATUS_LABEL[status],
    deadline: actionable ? (f.due_at?.toISOString() ?? null) : null, deadlineState,
    lastActivity: { label: 'Ronda recibida', at: f.solicitado_en.toISOString() }, actionable, paused, blockedReason, cta: actionable || status === 'completed' ? cta(f, status) : 'Ver contexto',
  };
}

// Última actividad real por ronda (mismo patrón que withLastActivity en
// correctorWork.ts/editorWork.ts): una sola consulta por página visible,
// filtrada a los códigos de evento reales de Calidad -- sin este filtro,
// un work_item puede traer eventos de otro dominio sobre el mismo
// entity_id y mostrar un código crudo ajeno a Calidad.
async function withLastActivity(rows: ValidatorWorkRow[]): Promise<ValidatorWorkRow[]> {
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

export async function listarMiTrabajoValidador(f: ValidatorWorkFilters, now = new Date()): Promise<ValidatorWorkList> {
  // La base de datos filtra, agrega y pagina. El listado no transfiere
  // checklist, observaciones, materiales ni todas las rondas al servidor.
  const labels = Object.entries(FASE_LABELS).map(([n, label]) => `WHEN ${n} THEN '${label}'`).join(' ');
  const base = `WITH base AS (${FILA_SQL}), classified AS (
    SELECT base.*, CASE WHEN NOT activa OR project_state = 'culminado' THEN 'completed'
      WHEN revisado_en IS NOT NULL THEN CASE WHEN aprobado THEN 'completed' ELSE 'waiting_design' END
      WHEN iniciado_en IS NULL THEN 'new_round' ELSE 'in_review' END status,
      CASE numero_fase ${labels} ELSE 'Fase ' || numero_fase END validation_type
    FROM base), filtered AS (
    SELECT * FROM classified WHERE
      ($1 = '' OR strpos(lower(concat_ws(' ', title, authors, codigo, validation_type, pdf_version,
        'F' || numero_fase || '.' || ronda, 'ronda ' || ronda)), lower($1)) > 0)
      AND ($2::text IS NULL OR status = $2) AND ($3::text IS NULL OR validation_type = $3)
      AND ($4::uuid IS NULL OR proyecto_id = $4))`;
  const values = [f.search.trim(), f.status ?? null, f.type ?? null, f.project ?? null];
  const [aggregate, choices] = await Promise.all([
    pool.query<ValidatorWorkList['counts']>(base + ` SELECT
      count(*) FILTER (WHERE status IN ('new_round','in_review'))::int active,
      count(*) FILTER (WHERE status = 'waiting_design')::int waiting,
      count(*) FILTER (WHERE status = 'completed')::int completed, count(*)::int "all" FROM filtered`, values),
    pool.query<{ projects: ValidatorWorkList['options']['projects']; types: ValidatorWorkList['options']['types'] }>(
      `WITH base AS (${FILA_SQL}) SELECT
        coalesce((SELECT json_agg(x ORDER BY name,id) FROM (SELECT DISTINCT proyecto_id id,title name FROM base) x),'[]') projects,
        coalesce((SELECT json_agg(x ORDER BY name) FROM (SELECT DISTINCT CASE numero_fase ${labels} ELSE 'Fase ' || numero_fase END id,
          CASE numero_fase ${labels} ELSE 'Fase ' || numero_fase END name FROM base) x),'[]') types`),
  ]);
  const counts = aggregate.rows[0]!;
  const total = counts[f.tab], pages = Math.max(1, Math.ceil(total / f.pageSize)), page = Math.min(f.page, pages);
  const tab = f.tab === 'active' ? `status IN ('new_round','in_review')` : f.tab === 'waiting' ? `status = 'waiting_design'` : f.tab === 'completed' ? `status = 'completed'` : 'true';
  const { rows } = await pool.query<Fila>(base + ` SELECT id,work_item_id,numero_fase,ronda,pdf_version,due_at,iniciado_en,revisado_en,
    aprobado,solicitado_en,proyecto_id,codigo,project_state,title,authors,cover,work_item_estado,gate_bloqueante,activa
    FROM filtered WHERE ${tab} ORDER BY CASE
      WHEN status IN ('new_round','in_review') AND project_state <> 'pausado' AND work_item_estado <> 'bloqueado' AND due_at < $5 THEN 0
      WHEN status IN ('new_round','in_review') AND project_state <> 'pausado' AND work_item_estado <> 'bloqueado' AND due_at <= $5::timestamptz + interval '1 day' THEN 1
      WHEN status = 'new_round' THEN 2 WHEN status = 'in_review' THEN 3 WHEN status = 'waiting_design' THEN 4 ELSE 5 END,
      CASE WHEN status IN ('new_round','in_review') AND project_state <> 'pausado' AND work_item_estado <> 'bloqueado' THEN due_at END ASC NULLS LAST,id
    LIMIT $6 OFFSET $7`, [...values, now, f.pageSize, (page - 1) * f.pageSize]);
  return { items: await withLastActivity(rows.map(r => fila(r, now))), total, pages, page, counts, options: choices.rows[0]! };
}

export async function obtenerDetalleTrabajoValidador(id: string, now = new Date()): Promise<ValidatorWorkDetail | null> {
  const [f] = await filas(id);
  if (!f) return null;
  const summary = fila(f, now);
  const [specialists, designer, anterior, previousRound, history] = await Promise.all([
    specialistsFor([f.proyecto_id]),
    f.disenador_id ? pool.query<{ nombre: string }>('SELECT nombre FROM usuarios WHERE id=$1', [f.disenador_id]).then(r => r.rows[0]?.nombre ?? null) : Promise.resolve(null),
    pool.query<{ enlace: string | null; feedback_archivo_url: string | null; calidad_fase_id: string | null; numero_fase: number | null; ronda: number | null }>(
      `SELECT v.enlace, v.feedback_archivo_url, v.calidad_fase_id, q.numero_fase, q.ronda
       FROM diseno_versiones v LEFT JOIN ficha_calidad_fases q ON q.id = v.calidad_fase_id
       WHERE v.diseno_id = $1 AND v.numero = $2`, [f.diseno_id, f.version_numero - 1]).then(r => r.rows[0] ?? null),
    pool.query<{ id: string; numero_fase: number; ronda: number }>(
      `SELECT q.id,q.numero_fase,q.ronda FROM ficha_calidad_fases q JOIN diseno_versiones v ON v.id=q.diseno_version_id
       WHERE v.diseno_id=$1 AND (v.numero<$2 OR (v.numero=$2 AND (q.numero_fase<$3 OR (q.numero_fase=$3 AND q.ronda<$4))))
       ORDER BY v.numero DESC,q.numero_fase DESC,q.ronda DESC LIMIT 1`, [f.diseno_id, f.version_numero, f.numero_fase, f.ronda]).then(r => r.rows[0] ?? null),
    pool.query<{ id: string; accion: string; created_at: Date }>(
      `SELECT id,accion,created_at FROM audit_logs WHERE entity_id=$1 AND accion=ANY($2::text[]) ORDER BY created_at DESC,id DESC LIMIT 15`,
      [f.work_item_id, Object.keys(EVENTS)]),
  ]);
  const [row] = await withLastActivity([summary]);
  const criteriaKeys = CRITERIOS_DE_FASE(f.numero_fase);
  const criteria: ValidatorCriterion[] = criteriaKeys.map(key => ({
    key, label: CRITERIOS_LABELS[key] ?? key,
    cumple: f.checklist?.[key]?.cumple ?? null, observaciones: f.checklist?.[key]?.observaciones ?? '',
  }));
  const materials: ValidatorMaterial[] = [
    { role: 'diagrammed' as const, label: 'PDF a validar', url: f.pdf_url },
    { role: 'source' as const, label: 'Tripa fuente', url: f.fuente_url },
    anterior?.enlace ? { role: 'previous' as const, label: 'Versión anterior', url: anterior.enlace } : null,
    anterior?.feedback_archivo_url ? { role: 'previous_comments' as const, label: 'Comentarios por verificar', url: anterior.feedback_archivo_url } : null,
    f.numeros_legales_url ? { role: 'legal' as const, label: 'Números legales', url: f.numeros_legales_url } : null,
    f.comentarios_url ? { role: 'comments' as const, label: 'PDF comentado de esta ronda', url: f.comentarios_url } : null,
  ].filter((m): m is ValidatorMaterial => m !== null);
  const history2: ValidatorHistoryEntry[] = [
    { id: 'ronda-creada', label: 'Ronda creada', at: f.solicitado_en.toISOString() },
    ...history.rows.map(h => ({ id: h.id, label: EVENTS[h.accion] ?? h.accion, at: h.created_at.toISOString() })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return {
    summary: row!, specialist: specialists.get(f.proyecto_id)?.nombre ?? null, designer,
    requestedAt: f.solicitado_en.toISOString(), startedAt: f.iniciado_en?.toISOString() ?? null, resolvedAt: f.revisado_en?.toISOString() ?? null,
    materials, criteria, approved: f.aprobado, reviewedBy: f.nombre_quien_recibe,
    pagesReviewed: f.cantidad_paginas, commentsCount: f.cantidad_comentarios, commentsUrl: f.comentarios_url,
    toVerifyChanges: f.cambios_por_verificar, pendingChanges: f.cambios_pendientes_por_aplicar, newChanges: f.cambios_nuevos_sugeridos,
    observations: f.observaciones,
    designAdjustment: f.revisado_en && f.aprobado === false ? { feedback: f.observaciones, attachmentUrl: f.comentarios_url } : null,
    previousRound: previousRound ? { id: previousRound.id, label: `F${previousRound.numero_fase}.${previousRound.ronda}` } : null,
    history: history2,
  };
}
