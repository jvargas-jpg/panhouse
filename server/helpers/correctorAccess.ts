import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { correcciones, proyectos, workItems } from '../db/schema/index.js';
import type { Tx } from './tx.js';

export const correctorError = (message: string, statusCode = 409) => Object.assign(new Error(message), { statusCode });

// Mismo criterio que lockEditorWork (editorAccess.ts): revalida la
// asignación vigente DENTRO de la transacción de escritura -- si el
// corrector fue reasignado mientras la pantalla seguía abierta (master
// prompt Mi trabajo §51/§99), correcciones.correctorId ya cambió y esta
// verificación falla, sin depender de lo que el cliente todavía muestre.
// correcciones.correctorId siempre refleja al corrector VIGENTE: cada
// (re)asignación lo sobreescribe (ver asignarCorrector en correcciones.ts).
export async function lockCorrectorWork(tx: Tx, workItemId: string, actorId: string) {
  const [item] = await tx.select().from(workItems).where(eq(workItems.id, workItemId));
  if (!item || item.tipo !== 'correccion') throw correctorError('Corrección no encontrada', 404);
  const [project] = await tx.select().from(proyectos).where(eq(proyectos.id, item.proyectoId)).for('update');
  const [correccion] = await tx.select().from(correcciones).where(eq(correcciones.workItemId, workItemId)).for('update');
  if (!project || !correccion) throw correctorError('Corrección no encontrada', 404);
  if (correccion.correctorId !== actorId) throw correctorError('Esta corrección ya no está asignada a tu cuenta', 403);
  if (['culminado', 'retirado'].includes(project.estado)) throw correctorError('El proyecto está cerrado');
  return { item, project, correccion };
}

export async function correctorWorkContext(workItemId: string, actorId: string) {
  const [item] = await db.select().from(workItems).where(eq(workItems.id, workItemId));
  if (!item || item.tipo !== 'correccion') throw correctorError('Corrección no encontrada', 404);
  const [correccion] = await db.select().from(correcciones).where(eq(correcciones.workItemId, workItemId));
  if (!correccion || correccion.correctorId !== actorId) throw correctorError('Esta corrección no está asignada a tu cuenta', 403);
  return { item, correccion };
}
