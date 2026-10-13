import { gateLanzamiento } from '../../shared/gatesOperacion.js';
export { gateLanzamiento } from '../../shared/gatesOperacion.js';
import { and, desc, eq, inArray, isNull, getTableColumns } from 'drizzle-orm';
import { db } from '../db/client.js';
import { capitulos, fichaDocumentalDatos, fichasTrazabilidad, informacionSolicitudArea, notificaciones, proyectos, servicios, solicitudesArea, workItems, users } from '../db/schema/index.js';
import { obtenerEspecialistaActual } from './carga.js';
import { ErrorFichaViva } from './fichaViva.js';
import { registrarEvento } from './auditLog.js';
import { crearWorkItemSiNoExiste, transicionarWorkItemPorId } from './workItems.js';
import type { Tx } from './tx.js';
import type { ActorFicha } from './intakeRrpp.js';
import type { ContextoActivacion, SolicitudAreaResumen } from '../../shared/operacionEspecialista.js';

export type TipoSolicitudArea = 'lanzamiento' | 'impresion';
export function gateImpresion(datos: Record<string, unknown> | undefined) {
  return { desbloqueado: datos?.paqueteFinalCargado === true, motivo: datos?.paqueteFinalCargado === true
    ? 'Paquete final cargado; disponible para solicitar coordinación de impresión'
    : 'Disponible cuando se registre el paquete final cargado en Diseño' };
}
export async function verificarOperacionImpresion(tx: Tx, id: string, actor: ActorFicha) {
  if (!['rrpp', 'impresion'].includes(actor.rol)) throw new ErrorFichaViva(403, 'Impresión corresponde a RRPP y al área de Impresión');
  if (actor.rol === 'impresion') return; // Ejecutor downstream conservado.
  const [r] = await tx.select().from(solicitudesArea).where(and(eq(solicitudesArea.proyectoId, id), eq(solicitudesArea.tipo, 'impresion')));
  const [f] = await tx.select().from(fichasTrazabilidad).where(eq(fichasTrazabilidad.proyectoId, id));
  if (r?.estado !== 'resuelta' && !(!r && (f?.impresionFechaInicio || f?.impresionEstatus))) throw new ErrorFichaViva(409, 'Acepta la solicitud de Impresión antes de operar');
}
export const resumenSolicitudArea = (r: typeof solicitudesArea.$inferSelect): SolicitudAreaResumen => ({
  id: r.id, tipo: r.tipo, estado: r.estado, requestedAt: r.requestedAt.toISOString(), resolvedAt: r.resolvedAt?.toISOString() ?? null, outcome: r.outcome,
});

// Consultas en lote: constante respecto de proyectos/intervenciones.
export async function contextosActivacion(ids: string[], client: typeof db | Tx = db): Promise<Map<string, ContextoActivacion[]>> {
  const result = new Map<string, ContextoActivacion[]>();
  if (!ids.length) return result;
  const consultas = [
    client.select({ p: proyectos, f: fichasTrazabilidad, codigo: servicios.codigo }).from(proyectos).innerJoin(servicios, eq(servicios.id, proyectos.servicioId)).leftJoin(fichasTrazabilidad, eq(fichasTrazabilidad.proyectoId, proyectos.id)).where(inArray(proyectos.id, ids)),
    client.select({ proyectoId: capitulos.proyectoId, envio: capitulos.fechaEnvioAutor }).from(capitulos).where(and(inArray(capitulos.proyectoId, ids), eq(capitulos.numero, 4))),
    client.select().from(fichaDocumentalDatos).where(and(inArray(fichaDocumentalDatos.proyectoId, ids), eq(fichaDocumentalDatos.seccion, 'diseno'))),
    client.select({...getTableColumns(solicitudesArea),responsable:users.nombre}).from(solicitudesArea).leftJoin(users,eq(users.id,solicitudesArea.resolvedById)).where(inArray(solicitudesArea.proyectoId, ids)).orderBy(desc(solicitudesArea.requestedAt)),
    client.select().from(workItems).where(and(inArray(workItems.proyectoId, ids), inArray(workItems.tipo, ['lanzamiento', 'impresion']))),
  ] as const;
  const [ps, chapters, docs, requests, works] = client === db ? await Promise.all(consultas) : [await consultas[0],await consultas[1],await consultas[2],await consultas[3],await consultas[4]];
  for (const { p, f, codigo } of ps) result.set(p.id, (['lanzamiento', 'impresion'] as const).map(tipo => {
    const r = requests.find(r => r.proyectoId === p.id && r.tipo === tipo);
    const wi = works.find(w => w.proyectoId === p.id && w.tipo === tipo && w.businessKey === (tipo === 'lanzamiento' ? 'planificacion' : 'coordinacion'))
      ?? works.find(w => w.proyectoId === p.id && w.tipo === tipo && w.businessKey === 'default');
    return { tipo, gate: tipo === 'lanzamiento' ? gateLanzamiento(codigo, f?.ingresoServicioSubtipoCrudo ?? null,
      !!chapters.find(c => c.proyectoId === p.id)?.envio, !!(f?.edicionFechaEnvioAutor || p.fechaFeedbackTripa), p.disenadorId)
      : gateImpresion(docs.find(d => d.proyectoId === p.id)?.datos), solicitud: r ? resumenSolicitudArea(r) : null,
      activo: !!wi && ['en_progreso', 'completado'].includes(wi.estado) && (!r || r.estado === 'resuelta'),
      legacy: !!wi && !r, operadoPor:r?.responsable ?? null };
  }));
  return result;
}
async function proyectoBloqueado(id: string, actor: ActorFicha, tx: Tx, requiereEspecialista = false) {
  const [p] = await tx.select().from(proyectos).where(eq(proyectos.id, id)).for('update');
  if (!p) throw new ErrorFichaViva(404, 'Proyecto no encontrado');
  if (requiereEspecialista && (actor.rol !== 'especialista' || await obtenerEspecialistaActual(id, p.especialistaId, tx) !== actor.id)) throw new ErrorFichaViva(403, 'Proyecto fuera de tu ámbito');
  if (['culminado', 'retirado'].includes(p.estado)) throw new ErrorFichaViva(409, 'El proyecto está cerrado');
  return p;
}
export async function solicitarProcesoArea(id: string, tipo: TipoSolicitudArea, actor: ActorFicha) {
  if (actor.rol !== 'especialista') throw new ErrorFichaViva(403, 'Solo el Especialista asignado puede solicitar');
  return db.transaction(async tx => {
    const p = await proyectoBloqueado(id, actor, tx, true);
    const [r] = await tx.select().from(solicitudesArea).where(and(eq(solicitudesArea.proyectoId, id), eq(solicitudesArea.tipo, tipo)));
    if (r) return r; // La activación inicial no se repite; rondas/versiones tienen otra businessKey.
    const contexto = (await contextosActivacion([id], tx)).get(id)!.find(c => c.tipo === tipo)!;
    if (contexto.activo) throw new ErrorFichaViva(409, 'El proceso ya está activo');
    if (!contexto.gate.desbloqueado) throw new ErrorFichaViva(409, contexto.gate.motivo);
    const businessKey = tipo === 'lanzamiento' ? 'planificacion' : 'coordinacion';
    const wi = await crearWorkItemSiNoExiste(tx, { proyectoId: id, tipo, businessKey });
    const [request] = await tx.insert(solicitudesArea).values({ proyectoId: id, workItemId: wi, tipo, businessKey, requestedById: actor.id }).returning();
    await registrarEvento(tx, { actorId: actor.id, accion: 'SOLICITUD_AREA_CREADA', entityType: 'solicitud', entityId: request!.id, proyectoId: id, detalles: { tipo, workItemId: wi } });
    await tx.insert(notificaciones).values({ proyectoId: id, rolDestino: 'rrpp', mensaje: `El Especialista solicitó ${tipo === 'lanzamiento' ? 'Lanzamiento y promoción' : 'coordinación de Impresión'} para #${p.codigo}.` });
    return request!;
  });
}
export async function activarSolicitudAreaEnTransaccion(tx: Tx, proyectoId: string, tipo: TipoSolicitudArea, actorId: string) {
  const [r] = await tx.select().from(solicitudesArea).where(and(eq(solicitudesArea.proyectoId, proyectoId), eq(solicitudesArea.tipo, tipo))).for('update');
  if (!r || r.estado === 'resuelta') return; // Proceso legacy conservado; no se fabrica solicitante ni fecha.
  if (['requiere_informacion', 'rechazada', 'cancelada'].includes(r.estado)) throw new ErrorFichaViva(409, 'Resuelve la solicitud antes de operar el proceso');
  const now = new Date();
  await tx.update(solicitudesArea).set({ estado: 'resuelta', resolvedAt: now, resolvedById: actorId,
    outcome: tipo === 'lanzamiento' ? 'LANZAMIENTO_ACTIVADO' : 'IMPRESION_ACTIVADA', version: r.version + 1 }).where(eq(solicitudesArea.id, r.id));
  await transicionarWorkItemPorId(tx, r.workItemId, 'en_progreso');
  await tx.update(workItems).set({ fechaInicioReal: now.toISOString().slice(0, 10) }).where(eq(workItems.id, r.workItemId));
  if (tipo === 'impresion') await tx.update(fichasTrazabilidad).set({ impresionEstatus: 'En coordinación', impresionFechaInicio: now.toISOString().slice(0, 10) }).where(eq(fichasTrazabilidad.proyectoId, proyectoId));
  await registrarEvento(tx, { actorId, accion: 'SOLICITUD_AREA_ACTIVADA', entityType: 'solicitud', entityId: r.id, proyectoId, detalles: { tipo, workItemId: r.workItemId } });
  const [p] = await tx.select().from(proyectos).where(eq(proyectos.id, proyectoId));
  const owner = p && await obtenerEspecialistaActual(proyectoId, p.especialistaId, tx);
  if (owner) await tx.insert(notificaciones).values({ proyectoId, rolDestino: 'especialista', usuarioDestinoId: owner, mensaje: `RRPP inició ${tipo === 'lanzamiento' ? 'la planificación de Lanzamiento' : 'la coordinación de Impresión'}.` });
}
export async function actuarSolicitudArea(id: string, accion: 'revisar' | 'informacion' | 'responder' | 'aceptar' | 'rechazar', actor: ActorFicha, datos: { texto?: string; preguntaId?: string; expectedVersion?: number } = {}) {
  if (!(actor.rol === 'rrpp' || actor.rol === 'especialista' && accion === 'responder')) throw new ErrorFichaViva(403, 'Acción no autorizada');
  return db.transaction(async tx => {
    const [origin] = await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id, id));
    if (!origin) throw new ErrorFichaViva(404, 'Solicitud no encontrada');
    const p = await proyectoBloqueado(origin.proyectoId, actor, tx, actor.rol === 'especialista');
    const [r] = await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id, id)).for('update');
    if (accion === 'aceptar' && r!.estado === 'resuelta') return r;
    if (datos.expectedVersion !== undefined && r!.version !== datos.expectedVersion) throw new ErrorFichaViva(409, 'La solicitud cambió; actualiza el detalle');
    if (['resuelta', 'rechazada', 'cancelada'].includes(r!.estado)) throw new ErrorFichaViva(409, 'La solicitud está cerrada');
    if (accion === 'aceptar') { await activarSolicitudAreaEnTransaccion(tx, p.id, r!.tipo, actor.id); return r; }
    if (accion === 'revisar') {
      if (r!.estado !== 'pendiente') throw new ErrorFichaViva(409, 'La solicitud ya está en revisión');
    } else if (!datos.texto?.trim() || datos.texto.trim().length < 10) throw new ErrorFichaViva(400, 'Escribe al menos 10 caracteres');
    const estado: typeof solicitudesArea.$inferSelect.estado = accion === 'rechazar' ? 'rechazada' : accion === 'informacion' ? 'requiere_informacion' : 'en_revision';
    if (accion === 'informacion') {
      if (r!.estado === 'requiere_informacion') throw new ErrorFichaViva(409, 'Ya existe una pregunta pendiente');
      await tx.insert(informacionSolicitudArea).values({ solicitudId: id, pregunta: datos.texto!, askedById: actor.id });
    }
    if (accion === 'responder') {
      if (r!.estado !== 'requiere_informacion' || !datos.preguntaId) throw new ErrorFichaViva(409, 'No hay una pregunta pendiente');
      const [q] = await tx.select().from(informacionSolicitudArea).where(and(eq(informacionSolicitudArea.solicitudId, id), eq(informacionSolicitudArea.id, datos.preguntaId), isNull(informacionSolicitudArea.answeredAt)));
      if (!q) throw new ErrorFichaViva(409, 'La pregunta cambió o ya fue respondida');
      await tx.update(informacionSolicitudArea).set({ respuesta: datos.texto!, answeredById: actor.id, answeredAt: new Date() }).where(eq(informacionSolicitudArea.id, q.id));
    }
    await tx.update(solicitudesArea).set({ estado, version: r!.version + 1, ...(accion === 'rechazar' ? { motivo: datos.texto, resolvedAt: new Date(), resolvedById: actor.id, outcome: 'SOLICITUD_RECHAZADA' } : {}) }).where(eq(solicitudesArea.id, id));
    await registrarEvento(tx, { actorId: actor.id, accion: 'SOLICITUD_AREA_ACTUALIZADA', entityType: 'solicitud', entityId: id, proyectoId: p.id, detalles: { tipo: r!.tipo, accion, estado } });
    const owner = await obtenerEspecialistaActual(p.id, p.especialistaId, tx);
    await tx.insert(notificaciones).values({ proyectoId: p.id, rolDestino: accion === 'responder' ? 'rrpp' : 'especialista',
      usuarioDestinoId: accion === 'responder' ? null : owner, mensaje: `Solicitud de ${r!.tipo}: ${accion === 'informacion' ? 'RRPP requiere información adicional' : accion === 'responder' ? 'El Especialista respondió' : accion === 'rechazar' ? 'RRPP rechazó con motivo' : 'RRPP inició la revisión'}.` });
    return { ok: true };
  });
}
