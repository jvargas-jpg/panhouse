import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { preparacionesProyecto, projectAssignments, proyectos } from '../db/schema/index.js';
import { verificarAccesoFichaViva, ErrorFichaViva } from './fichaViva.js';
import { registrarEvento } from './auditLog.js';
import { crearWorkItemSiNoExiste, transicionarWorkItemPorId } from './workItems.js';
import type { ActorFicha } from './intakeRrpp.js';
import type { PreparacionProyecto } from '../../shared/operacionEspecialista.js';

const instante = z.string().datetime({ offset: true }).nullable().optional();
const link = z.string().url().max(2000).refine(s => /^https:\/\//.test(s), 'Utiliza un enlace HTTPS').nullable().optional();
export const preparacionInicialSchema = z.object({
  recibidoEn: instante, expedienteRevisadoEn: instante, primerContactoEn: instante,
  reunionOperativaFecha: instante, reunionOperativaRealizada: z.boolean().optional(),
  grabacionUrl: link, transcripcionUrl: link, minutaUrl: link, cronogramaUrl: link,
  driveCarpetaUrl: link.refine(s => !s || new URL(s).hostname === 'drive.google.com', 'Registra una carpeta real de Google Drive'),
  observaciones: z.string().trim().max(2000).nullable().optional(),
}).strict().refine(v => Object.keys(v).length > 0, 'Indica un cambio');

// Manual §1.2: 24 horas; no inventa un calendario laboral no documentado.
export const calcularPrimerContactoDueAt = (asignadoEn: Date | null) => asignadoEn ? new Date(asignadoEn.getTime() + 24 * 3600000).toISOString() : null;
export function proyectarPreparacion(row: typeof preparacionesProyecto.$inferSelect | undefined, asignadoEn: Date | null, editable: boolean): PreparacionProyecto {
  const f = row;
  const completo = !!(f?.recibidoEn && f.expedienteRevisadoEn && f.primerContactoEn && f.reunionOperativaRealizada && f.driveCarpetaUrl && f.minutaUrl && f.cronogramaUrl && f.grabacionUrl && f.transcripcionUrl);
  const iniciado = !!(f?.recibidoEn || f?.expedienteRevisadoEn || f?.primerContactoEn || f?.reunionOperativaFecha || f?.reunionOperativaRealizada || f?.driveCarpetaUrl || f?.minutaUrl || f?.cronogramaUrl || f?.grabacionUrl || f?.transcripcionUrl || f?.observaciones?.trim());
  return {
    recibidoEn: f?.recibidoEn?.toISOString() ?? null, expedienteRevisadoEn: f?.expedienteRevisadoEn?.toISOString() ?? null,
    primerContactoEn: f?.primerContactoEn?.toISOString() ?? null, primerContactoDueAt: calcularPrimerContactoDueAt(asignadoEn),
    reunionOperativaFecha: f?.reunionOperativaFecha?.toISOString() ?? null, reunionOperativaRealizada: f?.reunionOperativaRealizada ?? false,
    grabacionUrl: f?.grabacionUrl ?? null, transcripcionUrl: f?.transcripcionUrl ?? null, minutaUrl: f?.minutaUrl ?? null, cronogramaUrl: f?.cronogramaUrl ?? null,
    driveCarpetaUrl: f?.driveCarpetaUrl ?? null, driveEstado: f?.driveCarpetaUrl ? 'configurado' : 'no_configurado',
    observaciones: f?.observaciones ?? null, estado: completo ? 'Completo' : iniciado ? 'En curso' : 'Pendiente', editable,
  };
}
export async function guardarPreparacionInicial(id: string, input: z.infer<typeof preparacionInicialSchema>, actor: ActorFicha) {
  if (actor.rol !== 'especialista') throw new ErrorFichaViva(403, 'La preparación corresponde al Especialista asignado');
  return db.transaction(async tx => {
    await tx.select({ id: proyectos.id }).from(proyectos).where(eq(proyectos.id, id)).for('update');
    const p = await verificarAccesoFichaViva(id, actor, tx);
    if (['culminado', 'retirado'].includes(p.estado)) throw new ErrorFichaViva(409, 'El proyecto está cerrado');
    const [before] = await tx.select().from(preparacionesProyecto).where(eq(preparacionesProyecto.proyectoId, id));
    const datos = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, k.endsWith('En') || k === 'reunionOperativaFecha' ? v ? new Date(v as string) : null : v]));
    const merged = { ...before, ...datos } as typeof preparacionesProyecto.$inferSelect;
    const ahora = new Date();
    for (const k of ['recibidoEn', 'expedienteRevisadoEn', 'primerContactoEn'] as const) {
      if (merged[k] && merged[k]! > ahora) throw new ErrorFichaViva(400, 'Una acción realizada no puede tener fecha futura');
    }
    if (merged.reunionOperativaRealizada && (!merged.reunionOperativaFecha || merged.reunionOperativaFecha > ahora)) throw new ErrorFichaViva(400, 'La reunión realizada requiere una fecha hasta hoy');
    const cambios = Object.keys(datos).filter(k => JSON.stringify(before?.[k as keyof typeof before] ?? null) !== JSON.stringify(datos[k]));
    if (!cambios.length && before) return before;
    const [row] = await tx.insert(preparacionesProyecto).values({ proyectoId: id, ...datos }).onConflictDoUpdate({ target: preparacionesProyecto.proyectoId, set: { ...datos, updatedAt: ahora } }).returning();
    const [a] = await tx.select().from(projectAssignments).where(and(eq(projectAssignments.proyectoId, id), eq(projectAssignments.tipo, 'especialista'), isNull(projectAssignments.workItemId), isNull(projectAssignments.finalizadoEn))).orderBy(desc(projectAssignments.asignadoEn)).limit(1);
    const wi = await crearWorkItemSiNoExiste(tx, { proyectoId: id, tipo: 'preparacion_inicial' });
    const estado = proyectarPreparacion(row, a?.asignadoEn ?? null, true).estado;
    if(estado==='Pendiente') {
      // Un guardado sin hechos no simula el inicio del trabajo.
      const { workItems } = await import('../db/schema/index.js');
      await tx.update(workItems).set({estado:'pendiente',fechaFinReal:null}).where(eq(workItems.id,wi));
    } else await transicionarWorkItemPorId(tx, wi, estado === 'Completo' ? 'completado' : 'en_progreso');
    await registrarEvento(tx, { actorId: actor.id, accion: 'PREPARACION_INICIAL_ACTUALIZADA', entityType: 'proyecto', entityId: id, proyectoId: id, detalles: { campos: cambios } });
    return row;
  });
}
