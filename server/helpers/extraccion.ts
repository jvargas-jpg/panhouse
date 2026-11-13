import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { reunionesExtraccion } from '../db/schema/index.js';
import { verificarAccesoFichaViva, ErrorFichaViva } from './fichaViva.js';
import { registrarEvento } from './auditLog.js';
import type { ActorFicha } from './intakeRrpp.js';

export const registrarReunionExtraccionSchema = z.object({
  numero: z.number().int().min(1).max(20),
  fecha: z.string().date().nullable().optional(),
  realizada: z.boolean().optional(),
}).strict();

export async function listarReunionesExtraccion(proyectoId: string) {
  return db.select().from(reunionesExtraccion).where(eq(reunionesExtraccion.proyectoId, proyectoId)).orderBy(asc(reunionesExtraccion.numero));
}

export async function registrarReunionExtraccion(id: string, input: z.infer<typeof registrarReunionExtraccionSchema>, actor: ActorFicha) {
  if (actor.rol !== 'especialista') throw new ErrorFichaViva(403, 'Las reuniones de extracción corresponden al Especialista asignado');
  return db.transaction(async tx => {
    const p = await verificarAccesoFichaViva(id, actor, tx);
    if (['culminado', 'retirado'].includes(p.estado)) throw new ErrorFichaViva(409, 'El proyecto está cerrado');
    if (input.realizada && (!input.fecha || new Date(input.fecha) > new Date())) throw new ErrorFichaViva(400, 'Una reunión realizada requiere una fecha hasta hoy');
    const [row] = await tx.insert(reunionesExtraccion)
      .values({ proyectoId: id, numero: input.numero, fecha: input.fecha ?? null, realizada: input.realizada ?? false })
      .onConflictDoUpdate({ target: [reunionesExtraccion.proyectoId, reunionesExtraccion.numero], set: { fecha: input.fecha ?? null, realizada: input.realizada ?? false, updatedAt: new Date() } })
      .returning();
    await registrarEvento(tx, { actorId: actor.id, accion: 'REUNION_EXTRACCION_REGISTRADA', entityType: 'proyecto', entityId: id, proyectoId: id, detalles: { numero: input.numero, realizada: row!.realizada } });
    return row!;
  });
}
