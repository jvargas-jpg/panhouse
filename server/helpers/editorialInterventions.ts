import { and, eq } from 'drizzle-orm';
import { capitulos, proyectos, workItems } from '../db/schema/index.js';
import type { Tx } from './tx.js';
import { crearWorkItemSiNoExiste } from './workItems.js';
import { plazoCapituloEditor } from './edicionSla.js';
import { evaluateProjectGoals } from './monthlyGoalEvaluation.js';

// Una instancia por capítulo; cada vuelta queda en auditoría. El contenedor
// 'default' conserva la solicitud/asignación, nunca cuenta además del capítulo.
export async function sincronizarCapituloEditorial(tx: Tx, capituloId: string, evento: 'crear' | 'editor' | 'autor', entrega = false, feedback = false) {
  const [c] = await tx.select().from(capitulos).where(eq(capitulos.id, capituloId));
  if (!c) return;
  const [p] = await tx.select({ editorId: proyectos.editorId }).from(proyectos).where(eq(proyectos.id, c.proyectoId));
  const key = 'capitulo:' + c.id;
  const [prev] = await tx.select().from(workItems).where(and(eq(workItems.proyectoId, c.proyectoId), eq(workItems.tipo, 'edicion'), eq(workItems.businessKey, key)));
  const id = prev?.id ?? await crearWorkItemSiNoExiste(tx, { proyectoId: c.proyectoId, tipo: 'edicion', businessKey: key });
  const vuelve = evento === 'autor' && feedback;
  const legacyFeedback=!entrega && !prev && !!c.fechaRespuestaReal && (!c.fechaEntregaEditor || c.fechaRespuestaReal>=c.fechaEntregaEditor);
  const feedbackCycle=vuelve || legacyFeedback || !!(c.fechaRespuestaReal && prev?.fechaInicioReal===c.fechaRespuestaReal);
  const estado = vuelve || legacyFeedback ? 'en_progreso' : entrega || (!prev && c.fechaEntregaEditor) ? 'completado' : prev?.estado ?? (p?.editorId ? 'en_progreso' : 'pendiente');
  await tx.update(workItems).set({ estado,
    fechaInicioReal: feedbackCycle ? c.fechaRespuestaReal : c.fechaInicioEditor,
    // El manual no fija SLA de aplicación de feedback. No fabricar otro.
    fechaFinPautada: feedbackCycle ? (vuelve?null:prev?.fechaFinPautada??null) : c.fechaInicioEditor ? plazoCapituloEditor(c.fechaInicioEditor) : null,
    fechaFinReal: vuelve ? null : entrega ? c.fechaEntregaEditor : prev?.fechaFinReal ?? c.fechaEntregaEditor,
  }).where(eq(workItems.id, id));
  await evaluateProjectGoals(tx,c.proyectoId);
  return {stateChanged:prev?.estado!==estado,workItemId:id};
}
