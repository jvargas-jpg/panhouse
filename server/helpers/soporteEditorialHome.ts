import { pool } from '../db/client.js';
import { plazoDiseno } from './disenoSla.js';
import { diaCaracas } from './atencionEspecialista.js';
import type { SoporteEditorialActivity, SoporteEditorialDashboard, ValidationItem } from '../../shared/soporteEditorialHome.js';

// Mismas cuatro fases que SeccionCalidadOperativa.tsx (`fases`) — Calidad
// solo valida tripa/diagramación (work_items tipo 'calidad'); revisión de
// cubierta es un proceso aparte de Dirección Creativa/Jefe de Edición que
// soporte_editorial no opera, así que no aparece acá.
const FASE_LABELS: Record<number, string> = { 1: 'Validación de textos diagramados', 2: 'Validación de comentarios', 3: 'Revisión final', 4: 'Validación final de comentarios' };

type Row = {
  id: string; work_item_id: string; numero_fase: number; ronda: number; due_at: Date | null; iniciado_en: Date | null; revisado_en: Date | null; aprobado: boolean | null; solicitado_en: Date;
  proyecto_id: string; codigo: string; project_state: string; title: string; authors: string; cover: string | null; work_item_estado: string; activa: boolean;
};

// soporte_editorial es acceso por rol, no asignación individual (ver
// server/db/schema/trazabilidad.ts, comentario de nombreQuienRecibe) —
// por eso esta bandeja no filtra por usuario: todo validador ve la misma
// cola compartida de rondas de Calidad.
//
// Una fila de resultado = una fase/ronda (`ficha_calidad_fases`), nunca
// un proyecto: un proyecto con dos rondas activas en su historial produce
// dos filas, y solo la ronda vigente de cada diseño (`activa`) cuenta
// para el resumen operativo del día.
export async function getValidatorDashboard(now = new Date()): Promise<SoporteEditorialDashboard> {
  const { rows } = await pool.query<Row>(`WITH latest_version AS (
      SELECT dv.id, dv.diseno_id, dv.calidad_fase_id, row_number() OVER (PARTITION BY dv.diseno_id ORDER BY dv.numero DESC) rn
      FROM diseno_versiones dv
    )
    SELECT q.id, q.work_item_id, q.numero_fase, q.ronda, q.due_at, q.iniciado_en, q.revisado_en, q.aprobado, q.solicitado_en,
      p.id proyecto_id, p.codigo, p.estado project_state,
      coalesce(nullif(trim(p.titulo_definitivo),''), nullif(trim(p.titulo),''), 'Proyecto editorial') title,
      coalesce((SELECT string_agg(a.nombre, ', ' ORDER BY a.nombre) FROM proyectos_autores x JOIN autores a ON a.id = x.autor_id WHERE x.proyecto_id = p.id), author.nombre) authors,
      CASE WHEN p.portada_decision_autor = 'aprobada' THEN p.propuesta_portada_url END cover,
      w.estado work_item_estado,
      (lv.rn = 1 AND lv.calidad_fase_id = q.id) activa
    FROM ficha_calidad_fases q
    JOIN work_items w ON w.id = q.work_item_id
    JOIN diseno_versiones v ON v.id = q.diseno_version_id
    JOIN disenos d ON d.id = v.diseno_id
    JOIN proyectos p ON p.id = d.proyecto_id
    JOIN autores author ON author.id = p.autor_id
    LEFT JOIN latest_version lv ON lv.diseno_id = d.id AND lv.rn = 1
    WHERE q.work_item_id IS NOT NULL AND w.estado <> 'cancelado'
      AND (w.estado <> 'completado' OR q.revisado_en >= $1)
    ORDER BY q.solicitado_en DESC`, [new Date(now.getTime() - 30 * 86400000)]);

  const live = rows.filter(r => !['culminado', 'retirado'].includes(r.project_state));
  const active = live.filter(r => r.activa && r.work_item_estado !== 'completado');

  const toItem = (r: Row): ValidationItem => {
    const state: ValidationItem['state'] = r.iniciado_en ? 'inProgress' : 'new';
    return {
      faseId: r.id, workItemId: r.work_item_id, projectId: r.proyecto_id, code: r.codigo, title: r.title, authors: r.authors, coverUrl: r.cover,
      numeroFase: r.numero_fase, ronda: r.ronda, validationType: FASE_LABELS[r.numero_fase] ?? `Fase ${r.numero_fase}`,
      state, stateLabel: state === 'inProgress' ? 'En revisión' : 'Nueva ronda', actionable: true,
      deadline: r.due_at?.toISOString() ?? null, deadlineState: plazoDiseno(r.due_at, null, now),
      cta: state === 'inProgress' ? 'Continuar validación' : 'Abrir validación',
      requestedAt: r.solicitado_en.toISOString(), startedAt: r.iniciado_en?.toISOString() ?? null,
    };
  };
  const items = active.map(toItem);
  const rank = (i: ValidationItem) => i.deadlineState === 'vencido' ? 0 : i.deadlineState === 'proximo_a_vencer' ? 1 : i.state === 'new' ? 2 : 3;
  const attention = [...items].sort((a, b) => rank(a) - rank(b) || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') || a.title.localeCompare(b.title, 'es') || a.workItemId.localeCompare(b.workItemId));
  const upcoming = items.filter(i => i.deadline && i.deadline >= now.toISOString()).sort((a, b) => a.deadline!.localeCompare(b.deadline!) || a.workItemId.localeCompare(b.workItemId));

  const activity: SoporteEditorialActivity[] = live.map((r): SoporteEditorialActivity => {
    if (r.revisado_en) return { id: r.id, label: r.aprobado ? 'Validación aprobada' : 'Validación devuelta con comentarios', projectTitle: r.title, at: r.revisado_en.toISOString() };
    if (r.iniciado_en) return { id: r.id, label: 'Validación iniciada', projectTitle: r.title, at: r.iniciado_en.toISOString() };
    return { id: r.id, label: 'Nueva ronda disponible', projectTitle: r.title, at: r.solicitado_en.toISOString() };
  }).sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id)).slice(0, 5);

  return {
    today: diaCaracas(now),
    summary: { active: items.length, dueSoon: items.filter(i => i.deadlineState === 'proximo_a_vencer').length, overdue: items.filter(i => i.deadlineState === 'vencido').length, newRounds: items.filter(i => i.state === 'new').length },
    attentionItems: attention.slice(0, 8), upcomingDeadlines: upcoming.slice(0, 5), recentActivity: activity,
  };
}
