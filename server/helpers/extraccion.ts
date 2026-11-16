import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { reunionesExtraccion } from '../db/schema/index.js';
import { verificarAccesoFichaViva, ErrorFichaViva } from './fichaViva.js';
import { registrarEvento } from './auditLog.js';
import type { ActorFicha } from './intakeRrpp.js';

const sesion = z.object({
  fechaHora: z.string().datetime({ offset: true }),
  duracionMinutos: z.number().int().min(1).max(600),
});
export const programarSesionesExtraccionSchema = z.object({ sesiones: z.array(sesion).min(1).max(10) }).strict();
export const editarSesionExtraccionSchema = sesion.partial().strict().refine(datos => Object.keys(datos).length > 0, 'Indica la fecha, hora o duración a cambiar');

export async function listarReunionesExtraccion(proyectoId: string) {
  return db.select().from(reunionesExtraccion).where(eq(reunionesExtraccion.proyectoId, proyectoId)).orderBy(asc(reunionesExtraccion.numero));
}

export async function editarSesionExtraccion(proyectoId: string, reunionId: string, input: z.infer<typeof editarSesionExtraccionSchema>, actor: ActorFicha) {
  if (actor.rol !== 'especialista') throw new ErrorFichaViva(403, 'El cronograma de extracción corresponde al Especialista asignado');
  return db.transaction(async tx => {
    const p = await verificarAccesoFichaViva(proyectoId, actor, tx);
    if (['culminado', 'retirado'].includes(p.estado)) throw new ErrorFichaViva(409, 'El proyecto está cerrado');
    const [antes] = await tx.select().from(reunionesExtraccion).where(and(eq(reunionesExtraccion.id, reunionId), eq(reunionesExtraccion.proyectoId, proyectoId))).for('update');
    if (!antes) throw new ErrorFichaViva(404, 'Reunión no encontrada en este proyecto');
    if (antes.realizada) throw new ErrorFichaViva(409, 'Solo se pueden editar reuniones programadas');
    const fechaHora = input.fechaHora ? new Date(input.fechaHora) : antes.fechaHora;
    const duracionMinutos = input.duracionMinutos ?? antes.duracionMinutos;
    if (fechaHora?.getTime() === antes.fechaHora?.getTime() && duracionMinutos === antes.duracionMinutos) return antes;
    const [reunion] = await tx.update(reunionesExtraccion).set({ fechaHora, duracionMinutos }).where(eq(reunionesExtraccion.id, reunionId)).returning();
    await registrarEvento(tx, { actorId: actor.id, accion: 'REUNION_EXTRACCION_REPROGRAMADA', entityType: 'proyecto', entityId: proyectoId, proyectoId,
      detalles: { reunionId, numero: antes.numero, antes: {fechaHora: antes.fechaHora, duracionMinutos: antes.duracionMinutos}, despues: {fechaHora, duracionMinutos} } });
    return reunion!;
  });
}

// Programa N sesiones del cronograma de extracción en un solo envío — el
// Autor da su disponibilidad y el Especialista la carga de una vez, sin
// repetir el formulario por cada sesión. El Editor NO se registra aquí: se
// deriva del Editor asignado al proyecto en Edición (ver projectGuide.ts).
export async function programarSesionesExtraccion(id: string, input: z.infer<typeof programarSesionesExtraccionSchema>, actor: ActorFicha) {
  if (actor.rol !== 'especialista') throw new ErrorFichaViva(403, 'El cronograma de extracción corresponde al Especialista asignado');
  return db.transaction(async tx => {
    const p = await verificarAccesoFichaViva(id, actor, tx);
    if (['culminado', 'retirado'].includes(p.estado)) throw new ErrorFichaViva(409, 'El proyecto está cerrado');
    const existentes = await tx.select().from(reunionesExtraccion).where(eq(reunionesExtraccion.proyectoId, id));
    let siguiente = existentes.reduce((max, r) => Math.max(max, r.numero), 0);
    const filas = input.sesiones.map(s => ({ proyectoId: id, numero: ++siguiente, fechaHora: new Date(s.fechaHora), duracionMinutos: s.duracionMinutos, realizada: false }));
    const rows = await tx.insert(reunionesExtraccion).values(filas).returning();
    await registrarEvento(tx, { actorId: actor.id, accion: 'REUNION_EXTRACCION_REGISTRADA', entityType: 'proyecto', entityId: id, proyectoId: id, detalles: { sesionesProgramadas: rows.length } });
    return rows;
  });
}
