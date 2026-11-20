import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { notificaciones, projectDriveFolders, projectDriveWorkspaces, proyectos, reunionesExtraccion, reunionExtraccionSolicitudes } from '../db/schema/index.js';
import { verificarAccesoFichaViva, ErrorFichaViva } from './fichaViva.js';
import { registrarEvento } from './auditLog.js';
import { authorNotice, portalProject } from './authorPortal.js';
import { withCorporateDrive, type CorporateDriveOperation } from '../modules/integrations/google-drive/corporate.js';
import { safeDriveError } from '../modules/integrations/google-drive/errors.js';
import { findOrCreateChapterInterviewFolder } from '../modules/project-workspaces/interviewFolders.js';
import { workspaceSummaries } from '../modules/project-workspaces/queries.js';
import type { ActorFicha } from './intakeRrpp.js';
import type { AuthenticatedUser } from './session.js';
import type { Tx } from './tx.js';

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

// El Editor marca la sesión que acaba de conducir — nunca una futura
// (misma regla que reunion_operativa_realizada: no se simula una entrevista
// que todavía no pasó).
export async function marcarSesionExtraccionCompletada(proyectoId: string, reunionId: string, actor: ActorFicha) {
  if (actor.rol !== 'editor') throw new ErrorFichaViva(403, 'Esta acción corresponde al Editor asignado');
  return db.transaction(async tx => {
    await verificarAccesoFichaViva(proyectoId, actor, tx);
    const [reunion] = await tx.select().from(reunionesExtraccion).where(and(eq(reunionesExtraccion.id, reunionId), eq(reunionesExtraccion.proyectoId, proyectoId))).for('update');
    if (!reunion) throw new ErrorFichaViva(404, 'Sesión no encontrada en este proyecto');
    if (reunion.realizada) return reunion;
    if (!reunion.fechaHora || reunion.fechaHora > new Date()) throw new ErrorFichaViva(400, 'No puedes marcar como realizada una sesión que todavía no ocurre');
    const [actualizada] = await tx.update(reunionesExtraccion).set({ realizada: true }).where(eq(reunionesExtraccion.id, reunionId)).returning();
    await registrarEvento(tx, { actorId: actor.id, accion: 'REUNION_EXTRACCION_COMPLETADA', entityType: 'proyecto', entityId: proyectoId, proyectoId, detalles: { reunionId, numero: reunion.numero } });
    return actualizada!;
  });
}

// La sesión siempre es por Meet — el Editor comparte el enlace y el Autor
// lo ve en su panel ("Tus próximas reuniones") para poder unirse.
export const registrarMeetSesionSchema = z.object({ meetUrl: z.string().url().max(500).refine(s => /^https:\/\/meet\.google\.com\//.test(s), 'Pega un enlace de Google Meet (https://meet.google.com/…)') }).strict();
export async function registrarMeetSesion(proyectoId: string, reunionId: string, input: z.infer<typeof registrarMeetSesionSchema>, actor: ActorFicha) {
  if (actor.rol !== 'editor') throw new ErrorFichaViva(403, 'Esta acción corresponde al Editor asignado');
  return db.transaction(async tx => {
    await verificarAccesoFichaViva(proyectoId, actor, tx);
    const [reunion] = await tx.select({ id: reunionesExtraccion.id }).from(reunionesExtraccion).where(and(eq(reunionesExtraccion.id, reunionId), eq(reunionesExtraccion.proyectoId, proyectoId)));
    if (!reunion) throw new ErrorFichaViva(404, 'Sesión no encontrada en este proyecto');
    const [actualizada] = await tx.update(reunionesExtraccion).set({ meetUrl: input.meetUrl }).where(eq(reunionesExtraccion.id, reunionId)).returning();
    return actualizada!;
  });
}

// Grabación y notas de Gemini de una sesión puntual. Ambas quedan
// organizadas en Edición/Extracciones de contenido/Capítulo N dentro del
// Drive del proyecto (ver CONTENT_EXTRACTIONS en templates.ts) — nunca
// sueltas en la raíz ni como un enlace externo colgando de otra cuenta.
function extraerDriveFileId(url: string): string | null {
  const porRuta = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (porRuta) return porRuta[1]!;
  const porQuery = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  return porQuery ? porQuery[1]! : null;
}
const driveLink = z.string().url().max(2000)
  .refine(s => /^https:\/\/(drive|docs)\.google\.com\//.test(s), 'Pega un enlace de Google Drive')
  .refine(s => !!extraerDriveFileId(s), 'No se pudo identificar el archivo en ese enlace. Copia el enlace para compartir desde Drive.');
export const registrarVideoSesionSchema = z.object({ videoUrl: driveLink }).strict();
export const subirNotasSesionSchema = z.object({ name: z.string().min(1).max(250), contentBase64: z.string().max(28_000_000) }).strict();

// Edición/Extracciones de contenido ya existe en la plantilla de todo
// proyecto EF (CONTENT_EXTRACTIONS) — es también donde el Editor ve su
// "Material recibido" (ver folderKeysPara en editorWork.ts). No se crea
// una carpeta aparte: los capítulos cuelgan de esa misma.
async function obtenerCarpetaExtraccionesContenido(proyectoId: string) {
  const workspace = (await workspaceSummaries([proyectoId])).get(proyectoId);
  if (!workspace || workspace.status !== 'READY' || workspace.contextChanged) throw new ErrorFichaViva(409, 'El espacio documental del proyecto no está listo');
  const [ws] = await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId, proyectoId));
  if (!ws) throw new ErrorFichaViva(409, 'El espacio documental del proyecto no está disponible. Intenta de nuevo.');
  const [carpeta] = await db.select().from(projectDriveFolders).where(and(eq(projectDriveFolders.workspaceId, ws.id), eq(projectDriveFolders.key, 'CONTENT_EXTRACTIONS'), eq(projectDriveFolders.status, 'READY')));
  if (!carpeta) throw new ErrorFichaViva(409, 'La carpeta "Extracciones de contenido" de Edición no está disponible');
  return { ws, carpeta };
}

// Primero se intenta la copia interna. Con drive.file, un video externo
// puede ser público y aun así invisible para la API. En ese caso se importa
// su descarga pública por streaming, sin guardar el video entero en memoria.
export async function registrarVideoSesion(proyectoId: string, reunionId: string, input: z.infer<typeof registrarVideoSesionSchema>, actor: ActorFicha, operate: CorporateDriveOperation = withCorporateDrive) {
  if (actor.rol !== 'editor') throw new ErrorFichaViva(403, 'Esta acción corresponde al Editor asignado');
  await verificarAccesoFichaViva(proyectoId, actor);
  const [reunion] = await db.select({ id: reunionesExtraccion.id, numero: reunionesExtraccion.numero }).from(reunionesExtraccion).where(and(eq(reunionesExtraccion.id, reunionId), eq(reunionesExtraccion.proyectoId, proyectoId)));
  if (!reunion) throw new ErrorFichaViva(404, 'Sesión no encontrada en este proyecto');
  const fileId = extraerDriveFileId(input.videoUrl)!;
  const resourceKey = new URL(input.videoUrl).searchParams.get('resourcekey') ?? undefined;
  if (resourceKey && !/^[\w-]+$/.test(resourceKey)) throw new ErrorFichaViva(400, 'El enlace de Drive contiene una clave de recurso inválida');
  const { ws, carpeta } = await obtenerCarpetaExtraccionesContenido(proyectoId);
  const url = await operate(async ({ integration, storage }) => {
    if (ws.integrationId !== integration.id || ws.storageContextId !== integration.storageContextId) throw new ErrorFichaViva(409, 'La conexión de Drive cambió');
    if (!storage.copyFile) throw new ErrorFichaViva(503, 'Drive no permite copiar archivos');
    const destino = await findOrCreateChapterInterviewFolder(storage, carpeta.driveFolderId, reunion.numero);
    try {
      const copyInput = { fileId, name: `Grabación · Capítulo ${reunion.numero}`, parentFolderId: destino.providerFileId, ...(resourceKey ? { resourceKey } : {}) };
      let copia;
      try { copia = await storage.copyFile(copyInput); }
      catch (e) {
        const error = safeDriveError(e);
        if (!['DRIVE_ACCESS_DENIED', 'NOT_FOUND'].includes(error.code) || !storage.importPublicVideo) throw error;
        copia = await storage.importPublicVideo(copyInput);
      }
      return `https://drive.google.com/file/d/${copia.providerFileId}/view`;
    } catch (e) {
      const err = safeDriveError(e);
      if (err.code === 'PUBLIC_VIDEO_UNAVAILABLE') throw new ErrorFichaViva(400, err.message);
      if (['DRIVE_ACCESS_DENIED', 'NOT_FOUND'].includes(err.code)) throw new ErrorFichaViva(409, 'No se pudo guardar el video en la carpeta del proyecto. Solicita revisar el acceso de la cuenta conectada a la carpeta de destino.');
      throw err;
    }
  });
  return db.transaction(async tx => {
    const [actualizada] = await tx.update(reunionesExtraccion).set({ videoUrl: url }).where(eq(reunionesExtraccion.id, reunionId)).returning();
    await registrarEvento(tx, { actorId: actor.id, accion: 'EXTRACCION_SESION_ARCHIVO_SUBIDO', entityType: 'proyecto', entityId: proyectoId, proyectoId, detalles: { reunionId, tipo: 'video' } });
    return actualizada!;
  });
}

const MIME_TYPES_NOTAS: Record<string, string> = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword', txt: 'text/plain' };
export async function subirNotasSesion(proyectoId: string, reunionId: string, input: z.infer<typeof subirNotasSesionSchema>, actor: ActorFicha, operate: CorporateDriveOperation = withCorporateDrive) {
  if (actor.rol !== 'editor') throw new ErrorFichaViva(403, 'Esta acción corresponde al Editor asignado');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.contentBase64)) throw new ErrorFichaViva(400, 'Archivo inválido');
  const content = Buffer.from(input.contentBase64, 'base64');
  if (!content.length || content.length > 20 * 1024 * 1024 || content.toString('base64') !== input.contentBase64) throw new ErrorFichaViva(400, 'El archivo debe pesar entre 1 byte y 20 MB');
  const ext = input.name.split('.').pop()?.toLowerCase();
  if (!ext || !MIME_TYPES_NOTAS[ext] || /[\x00-\x1f]/.test(input.name)) throw new ErrorFichaViva(400, 'Selecciona un PDF, Word o archivo de texto');
  await verificarAccesoFichaViva(proyectoId, actor);
  const [reunion] = await db.select({ id: reunionesExtraccion.id, numero: reunionesExtraccion.numero }).from(reunionesExtraccion).where(and(eq(reunionesExtraccion.id, reunionId), eq(reunionesExtraccion.proyectoId, proyectoId)));
  if (!reunion) throw new ErrorFichaViva(404, 'Sesión no encontrada en este proyecto');
  const { ws, carpeta } = await obtenerCarpetaExtraccionesContenido(proyectoId);
  const url = await operate(async ({ integration, storage }) => {
    if (ws.integrationId !== integration.id || ws.storageContextId !== integration.storageContextId) throw new ErrorFichaViva(409, 'La conexión de Drive cambió');
    if (!storage.uploadFile) throw new ErrorFichaViva(503, 'Drive no permite subir archivos');
    const destino = await findOrCreateChapterInterviewFolder(storage, carpeta.driveFolderId, reunion.numero);
    const file = await storage.uploadFile({ name: input.name, mimeType: MIME_TYPES_NOTAS[ext]!, parentFolderId: destino.providerFileId, content });
    return `https://drive.google.com/file/d/${file.providerFileId}/view`;
  });
  return db.transaction(async tx => {
    const [actualizada] = await tx.update(reunionesExtraccion).set({ notasGeminiUrl: url }).where(eq(reunionesExtraccion.id, reunionId)).returning();
    await registrarEvento(tx, { actorId: actor.id, accion: 'EXTRACCION_SESION_ARCHIVO_SUBIDO', entityType: 'proyecto', entityId: proyectoId, proyectoId, detalles: { reunionId, tipo: 'notas' } });
    return actualizada!;
  });
}

// Cambio de fecha/hora de una sesión — bidireccional (Editor↔Autor) y
// siempre con autorización de la otra parte: nunca se mueve la fecha sola.
export const solicitarCambioSesionSchema = z.object({
  fechaHora: z.string().datetime({ offset: true }),
  duracionMinutos: z.number().int().min(1).max(600).optional(),
  motivo: z.string().trim().max(1000).optional(),
}).strict();
async function crearSolicitudCambioSesion(tx: Tx, proyectoId: string, reunionId: string, solicitadoPor: 'editor' | 'autor', solicitadoPorUserId: string, input: z.infer<typeof solicitarCambioSesionSchema>) {
  const [reunion] = await tx.select().from(reunionesExtraccion).where(and(eq(reunionesExtraccion.id, reunionId), eq(reunionesExtraccion.proyectoId, proyectoId))).for('update');
  if (!reunion) throw new ErrorFichaViva(404, 'Sesión no encontrada en este proyecto');
  if (reunion.realizada) throw new ErrorFichaViva(409, 'Esta sesión ya se realizó');
  const [pendiente] = await tx.select({ id: reunionExtraccionSolicitudes.id }).from(reunionExtraccionSolicitudes).where(and(eq(reunionExtraccionSolicitudes.reunionId, reunionId), eq(reunionExtraccionSolicitudes.estado, 'pendiente')));
  if (pendiente) throw new ErrorFichaViva(409, 'Ya hay una solicitud de cambio pendiente para esta sesión');
  const [solicitud] = await tx.insert(reunionExtraccionSolicitudes).values({
    reunionId, proyectoId, solicitadoPor, solicitadoPorUserId,
    fechaHoraPropuesta: new Date(input.fechaHora), duracionPropuestaMinutos: input.duracionMinutos, motivo: input.motivo,
  }).returning();
  return { reunion, solicitud: solicitud! };
}
export async function editorSolicitaCambioSesion(proyectoId: string, reunionId: string, input: z.infer<typeof solicitarCambioSesionSchema>, actor: ActorFicha) {
  if (actor.rol !== 'editor') throw new ErrorFichaViva(403, 'Esta acción corresponde al Editor asignado');
  return db.transaction(async tx => {
    await verificarAccesoFichaViva(proyectoId, actor, tx);
    const { reunion, solicitud } = await crearSolicitudCambioSesion(tx, proyectoId, reunionId, 'editor', actor.id, input);
    const [p] = await tx.select({ autorId: proyectos.autorId }).from(proyectos).where(eq(proyectos.id, proyectoId));
    if (p?.autorId) await authorNotice(tx, p.autorId, proyectoId, 'Tu Editor propuso cambiar la fecha/hora de una sesión de extracción.', '/autor/proyectos/' + proyectoId, 'extraccion-cambio:' + solicitud.id);
    await registrarEvento(tx, { actorId: actor.id, accion: 'EXTRACCION_CAMBIO_SOLICITADO', entityType: 'proyecto', entityId: proyectoId, proyectoId, detalles: { reunionId, numero: reunion.numero, solicitadoPor: 'editor' } });
    return solicitud;
  });
}
export async function autorSolicitaCambioSesion(proyectoId: string, reunionId: string, input: z.infer<typeof solicitarCambioSesionSchema>, actor: AuthenticatedUser) {
  return db.transaction(async tx => {
    await portalProject(proyectoId, actor, tx);
    const { reunion, solicitud } = await crearSolicitudCambioSesion(tx, proyectoId, reunionId, 'autor', actor.id, input);
    const [p] = await tx.select({ editorId: proyectos.editorId, codigo: proyectos.codigo }).from(proyectos).where(eq(proyectos.id, proyectoId));
    if (p?.editorId) await tx.insert(notificaciones).values({ proyectoId, rolDestino: 'editor', usuarioDestinoId: p.editorId, mensaje: `El Autor propuso cambiar una sesión de extracción del proyecto #${p.codigo}.`, targetPath: '/?vista=mi-trabajo' });
    await registrarEvento(tx, { actorId: actor.id, accion: 'EXTRACCION_CAMBIO_SOLICITADO', entityType: 'proyecto', entityId: proyectoId, proyectoId, detalles: { reunionId, numero: reunion.numero, solicitadoPor: 'autor' } });
    return solicitud;
  });
}
export const responderCambioSesionSchema = z.object({ decision: z.enum(['aceptada', 'rechazada']), respuesta: z.string().trim().max(1000).optional() }).strict();
async function resolverSolicitudCambio(tx: Tx, proyectoId: string, solicitudId: string, esperadoDe: 'editor' | 'autor', respondidoPorUserId: string, input: z.infer<typeof responderCambioSesionSchema>) {
  const [solicitud] = await tx.select().from(reunionExtraccionSolicitudes).where(and(eq(reunionExtraccionSolicitudes.id, solicitudId), eq(reunionExtraccionSolicitudes.proyectoId, proyectoId))).for('update');
  if (!solicitud) throw new ErrorFichaViva(404, 'Solicitud no encontrada en este proyecto');
  if (solicitud.estado !== 'pendiente') throw new ErrorFichaViva(409, 'Esta solicitud ya fue respondida');
  if (solicitud.solicitadoPor !== esperadoDe) throw new ErrorFichaViva(403, 'Esta solicitud no espera tu respuesta');
  await tx.update(reunionExtraccionSolicitudes).set({ estado: input.decision, respondidoEn: new Date(), respondidoPorUserId, respuesta: input.respuesta }).where(eq(reunionExtraccionSolicitudes.id, solicitudId));
  if (input.decision === 'aceptada') await tx.update(reunionesExtraccion).set({ fechaHora: solicitud.fechaHoraPropuesta, duracionMinutos: solicitud.duracionPropuestaMinutos ?? undefined }).where(eq(reunionesExtraccion.id, solicitud.reunionId));
  return solicitud;
}
export async function editorRespondeCambioSesion(proyectoId: string, solicitudId: string, input: z.infer<typeof responderCambioSesionSchema>, actor: ActorFicha) {
  if (actor.rol !== 'editor') throw new ErrorFichaViva(403, 'Esta acción corresponde al Editor asignado');
  return db.transaction(async tx => {
    await verificarAccesoFichaViva(proyectoId, actor, tx);
    const solicitud = await resolverSolicitudCambio(tx, proyectoId, solicitudId, 'autor', actor.id, input);
    const [p] = await tx.select({ autorId: proyectos.autorId }).from(proyectos).where(eq(proyectos.id, proyectoId));
    if (p?.autorId) await authorNotice(tx, p.autorId, proyectoId, input.decision === 'aceptada' ? 'Tu Editor aceptó el cambio de horario que propusiste.' : 'Tu Editor no pudo aceptar el cambio de horario que propusiste.', '/autor/proyectos/' + proyectoId, 'extraccion-cambio-resuelto:' + solicitud.id);
    await registrarEvento(tx, { actorId: actor.id, accion: 'EXTRACCION_CAMBIO_RESUELTO', entityType: 'proyecto', entityId: proyectoId, proyectoId, detalles: { solicitudId, decision: input.decision } });
    return solicitud;
  });
}
export async function autorRespondeCambioSesion(proyectoId: string, solicitudId: string, input: z.infer<typeof responderCambioSesionSchema>, actor: AuthenticatedUser) {
  return db.transaction(async tx => {
    await portalProject(proyectoId, actor, tx);
    const solicitud = await resolverSolicitudCambio(tx, proyectoId, solicitudId, 'editor', actor.id, input);
    const [p] = await tx.select({ editorId: proyectos.editorId, codigo: proyectos.codigo }).from(proyectos).where(eq(proyectos.id, proyectoId));
    if (p?.editorId) await tx.insert(notificaciones).values({ proyectoId, rolDestino: 'editor', usuarioDestinoId: p.editorId, mensaje: `El Autor ${input.decision === 'aceptada' ? 'aceptó' : 'no aceptó'} el cambio de horario propuesto para #${p.codigo}.`, targetPath: '/?vista=mi-trabajo' });
    await registrarEvento(tx, { actorId: actor.id, accion: 'EXTRACCION_CAMBIO_RESUELTO', entityType: 'proyecto', entityId: proyectoId, proyectoId, detalles: { solicitudId, decision: input.decision } });
    return solicitud;
  });
}
export async function listarSolicitudesCambioSesion(proyectoId: string) {
  return db.select().from(reunionExtraccionSolicitudes).where(and(eq(reunionExtraccionSolicitudes.proyectoId, proyectoId), eq(reunionExtraccionSolicitudes.estado, 'pendiente')));
}
