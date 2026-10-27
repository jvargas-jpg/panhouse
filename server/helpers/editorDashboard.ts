import { pool } from '../db/client.js';
import { editorialInterventions, editorialActivityForEditor } from './editorialChief.js';
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

  const recentActivity = await editorialActivityForEditor(editorId);

  const monday = new Date(`${hoy}T12:00:00Z`); monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const weekFrom = monday.toISOString().slice(0, 10);
  const completed=await pool.query<{total:number}>(`SELECT count(DISTINCT work_item_id)::int total FROM editorial_deliveries WHERE submitted_by=$1 AND (submitted_at AT TIME ZONE 'America/Caracas')::date >= $2::date AND (submitted_at AT TIME ZONE 'America/Caracas')::date <= $3::date`,[editorId,weekFrom,hoy]);
  const weekStatus = {
    completed: completed.rows[0]?.total??0,
    inProgress: items.filter(i => i.state === 'En edición').length,
    dueSoon: dueSoon.length,
    blocked: blocked.length,
  };

  return {
    today: hoy,
    summary: { pendingToday: pendingToday.length, dueSoon: dueSoon.length, blocked: blocked.length, feedbackToApply: feedbackToApply.length },
    attentionItems, upcomingDeliveries, recentActivity, weekStatus,
  };
}
