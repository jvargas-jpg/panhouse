import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { projectAssignments, proyectos, workItems } from '../db/schema/index.js';
import type { Tx } from './tx.js';

export const editorError = (message: string, statusCode = 409) => Object.assign(new Error(message), { statusCode });

// All Editor commands lock project before work item, like asignarEditor.
// Revalidate the canonical assignment inside the write transaction.
export async function lockEditorWork(tx: Tx, id: string, actorId: string) {
  const [origin] = await tx.select().from(workItems).where(eq(workItems.id, id));
  if (!origin || origin.tipo !== 'edicion') throw editorError('Intervención no encontrada', 404);
  const [project] = await tx.select().from(proyectos).where(eq(proyectos.id, origin.proyectoId)).for('update');
  const assignments = await tx.select().from(projectAssignments).where(and(eq(projectAssignments.proyectoId, origin.proyectoId), eq(projectAssignments.tipo, 'editor'), isNull(projectAssignments.workItemId)));
  const current = assignments.find(a => !a.finalizadoEn);
  const owner = assignments.length ? current?.usuarioId : project?.editorId;
  if (!project || owner !== actorId || project.editorId !== actorId) throw editorError('Esta intervención ya no está asignada a este Editor', 403);
  if (['culminado','retirado'].includes(project.estado)) throw editorError('El proyecto está cerrado');
  const [item] = await tx.select().from(workItems).where(eq(workItems.id, id)).for('update');
  return { item: item!, project };
}

export async function editorWorkProject(id: string, actorId: string) {
  const [item] = await db.select().from(workItems).where(eq(workItems.id, id));
  if (!item || item.tipo !== 'edicion') throw editorError('Intervención no encontrada', 404);
  const [project] = await db.select().from(proyectos).where(eq(proyectos.id, item.proyectoId));
  if (project?.editorId !== actorId) throw editorError('Esta intervención no está asignada a este Editor', 403);
  return { item, project };
}
