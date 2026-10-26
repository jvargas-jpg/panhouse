import { pool } from '../db/client.js';
import { editorialInterventions } from './editorialChief.js';
import { diaCaracas } from './atencionEspecialista.js';
import type { EditorDashboard } from '../../shared/editorOwn.js';

// Inicio del Editor (prompt Editor §21-35): "¿qué necesita mi atención
// hoy?", nunca analytics. Reusa editorialInterventions() ya acotado al
// Editor (mismo read-model que Jefe de Edición) -- una sola fuente.
export async function getEditorDashboard(editorId: string, ahora = new Date()): Promise<EditorDashboard> {
  const hoy = diaCaracas(ahora);
  const items = await editorialInterventions(hoy, undefined, editorId);
  const pendingToday = items.filter(i => i.actionable && (i.overdue || i.dueDate === hoy));
  const dueSoon = items.filter(i => i.actionable && !i.overdue && i.atRisk);
  const blocked = items.filter(i => i.state === 'Bloqueadas');
  const feedbackToApply = items.filter(i => i.state === 'Requiere ajustes');

  const priority = (i: (typeof items)[number]) => i.overdue ? 0 : i.state === 'Requiere ajustes' ? 1 : i.state === 'Bloqueadas' ? 2 : i.atRisk ? 3 : 4;
  const attentionItems = items.filter(i => i.actionable).sort((a, b) => priority(a) - priority(b) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')).slice(0, 6);

  const upcomingDeliveries = items.filter(i => i.actionable && i.dueDate && !i.overdue).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)).slice(0, 6)
    .map(i => ({ id: i.id, label: i.label, title: i.title, dueDate: i.dueDate }));

  const { rows: feedback } = await pool.query<{ id: string; title: string; actor: string; at: Date; chapter: number | null }>(
    `SELECT a.id,coalesce(p.titulo_definitivo,p.titulo,'Proyecto editorial') title,coalesce(u.nombre,'Sistema') actor,a.created_at at,(a.detalles->>'numero')::int chapter
     FROM audit_logs a JOIN proyectos p ON p.id=a.proyecto_id LEFT JOIN usuarios u ON u.id=a.actor_id
     WHERE a.accion='CAPITULO_FEEDBACK_REGISTRADO' AND p.editor_id=$1::uuid ORDER BY a.created_at DESC,a.id DESC LIMIT 5`, [editorId]);
  const recentFeedback = feedback.map(f => ({ id: f.id, text: f.chapter ? `Feedback del autor para el capítulo ${f.chapter}` : 'Feedback del autor recibido', title: f.title, actor: f.actor, at: f.at.toISOString() }));

  const monday = new Date(`${hoy}T12:00:00Z`); monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const weekFrom = monday.toISOString().slice(0, 10);
  const weekStatus = {
    completed: items.filter(i => i.state === 'Completadas' && i.deliveredAt && i.deliveredAt.slice(0, 10) >= weekFrom).length,
    inProgress: items.filter(i => i.state === 'En edición').length,
    dueSoon: dueSoon.length,
    blocked: blocked.length,
  };

  return {
    today: hoy,
    summary: { pendingToday: pendingToday.length, dueSoon: dueSoon.length, blocked: blocked.length, feedbackToApply: feedbackToApply.length },
    attentionItems, upcomingDeliveries, recentFeedback, weekStatus,
  };
}
