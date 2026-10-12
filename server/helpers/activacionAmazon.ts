import { and, eq } from 'drizzle-orm';
import { fichasTrazabilidad, notificaciones, workItems } from '../db/schema/index.js';
import type { Tx } from './tx.js';
import { registrarEvento } from './auditLog.js';
import { crearWorkItemSiNoExiste } from './workItems.js';

// F7 runs alongside the first validation; this does not release the final package.
export async function habilitarActivacionAmazon(tx: Tx, proyectoId: string, actorId: string) {
  const key = 'activacion_amazon';
  const [existing] = await tx.select({ id: workItems.id }).from(workItems).where(and(eq(workItems.proyectoId, proyectoId), eq(workItems.tipo, 'soporte_digital'), eq(workItems.businessKey, key)));
  if (existing) return existing.id;
  const [f] = await tx.select({ fecha: fichasTrazabilidad.soporteDigitalFechaActivacion }).from(fichasTrazabilidad).where(eq(fichasTrazabilidad.proyectoId, proyectoId));
  const id = await crearWorkItemSiNoExiste(tx, { proyectoId, tipo: 'soporte_digital', businessKey: key });
  if (f?.fecha) await tx.update(workItems).set({ estado: 'completado', fechaFinReal: f.fecha }).where(eq(workItems.id, id));
  else await tx.insert(notificaciones).values({ proyectoId, rolDestino: 'soporte_digital', mensaje: 'Primera validación habilitada: iniciar activación Amazon en paralelo a Calidad.' });
  await registrarEvento(tx, { actorId, accion: 'AMAZON_ACTIVACION_HABILITADA', entityType: 'work_item', entityId: id, proyectoId });
  return id;
}
