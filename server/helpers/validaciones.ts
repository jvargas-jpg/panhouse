import { coverRound, createCoverValidation, saveValidationRound, type ValidationRound } from './coverValidation.js';
import { validationWorkIdentity, validationWorkLabel } from '../../shared/validationWork.js';
import { createHash } from 'node:crypto';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditLogs, autores, colecciones, direccionesCreativas, disenos, disenoVersiones, externalIntegrations, fichaCalidadFases, fichasTrazabilidad, notificaciones, projectAssignments, projectDriveFolders, projectDriveWorkspaces, proyectos, users, validationDeliveryOutbox, workItems, type Rol } from '../db/schema/index.js';
import { withCorporateDrive, type CorporateDriveOperation } from '../modules/integrations/google-drive/corporate.js';
import { asignarConHistorial } from './assignments.js';
import { registrarEvento, type AccionAuditoria } from './auditLog.js';
import { obtenerEspecialistaActual } from './carga.js';
import { ErrorDiseno } from './diseno.js';
import { parseEditorialDriveId } from './editorDrive.js';
import type { Tx } from './tx.js';
import { transicionarWorkItemPorId } from './workItems.js';
import { DRIVE_DELIVERY_SCOPE } from '../modules/integrations/google-drive/config.js';

type Actor = { id: string; rol: Rol };
export function validationEnsure(value: unknown, message: string, status = 409): asserts value { if (!value) throw new ErrorDiseno(status, message); }
const activeAssignment = (workId: string) => and(eq(projectAssignments.workItemId, workId), eq(projectAssignments.tipo, 'validador'), isNull(projectAssignments.finalizadoEn));
export const validationPhaseLabel = (phase: number) => validationWorkLabel(validationWorkIdentity('diagramacion', phase));
const contextLabel = (c: Context) => validationWorkLabel(validationWorkIdentity(c.d.tipo, c.q.numeroFase));

// Project lock is shared with the existing workflow. Reassignment, upload,
// delivery and decisions serialize on the same row; no parallel round store.
export async function lockValidation(tx: Tx, id: string, actor?: Actor) {
 const [relation] = await tx.select({ projectId: fichasTrazabilidad.proyectoId }).from(fichaCalidadFases).innerJoin(fichasTrazabilidad, eq(fichaCalidadFases.fichaId, fichasTrazabilidad.id)).where(eq(fichaCalidadFases.id, id));
 const [cover] = relation ? [] : await tx.select().from(workItems).where(and(eq(workItems.id, id), eq(workItems.tipo, 'validacion_cubierta')));
 validationEnsure(relation || cover, 'Validación no encontrada', 404);
 const [p] = await tx.select().from(proyectos).where(eq(proyectos.id, relation?.projectId ?? cover!.proyectoId)).for('update');
 const [work] = cover ? await tx.select().from(workItems).where(eq(workItems.id, id)) : [];
 const [quality] = relation ? await tx.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.id, id)) : [];
 const q: ValidationRound | undefined = work ? coverRound(work) : quality;
 validationEnsure(p && q?.workItemId && q.disenoVersionId, 'Validación no operativa', 404);
 const [v] = await tx.select().from(disenoVersiones).where(eq(disenoVersiones.id, q.disenoVersionId));
 validationEnsure(v, 'Versión no encontrada', 404);
 const [d] = await tx.select().from(disenos).where(eq(disenos.id, v.disenoId));
 validationEnsure(d?.proyectoId === p.id && (!cover || d.tipo === 'cubierta_extendida'), 'Versión ajena', 404);
 const [assignment] = await tx.select().from(projectAssignments).where(activeAssignment(q.workItemId));
 if (actor) {
  if (actor.rol === 'validador') validationEnsure(assignment?.usuarioId === actor.id, 'Validación no encontrada', 404);
  else if (actor.rol === 'especialista') validationEnsure(await obtenerEspecialistaActual(p.id, p.especialistaId, tx) === actor.id, 'Proyecto ajeno', 403);
  else validationEnsure(actor.rol === 'jefe_area', 'Rol no autorizado', 403);
 }
 return { p, q, v, d, assignment, isCover: !!cover };
}

type Context = Awaited<ReturnType<typeof lockValidation>>;
export async function validationEvent(tx: Tx, c: Context, actorId: string | null, accion: AccionAuditoria, extra: Record<string, unknown> = {}) {
 await registrarEvento(tx, { actorId, accion, entityType: 'work_item', entityId: c.q.workItemId!, proyectoId: c.p.id, detalles: { faseId: c.q.id, fase: c.q.numeroFase, ronda: c.q.ronda, version: c.q.pdfVersion, versionId: c.v.id, driveFileId: c.v.driveFileId, driveRevisionId: c.v.driveRevisionId, ...validationWorkIdentity(c.d.tipo, c.q.numeroFase), ...extra } });
}
async function notice(tx: Tx, projectId: string, role: string, userId: string | null, message: string, targetPath: string) {
 await tx.insert(notificaciones).values({ proyectoId: projectId, rolDestino: role, usuarioDestinoId: userId, mensaje: message, targetPath });
}
function mutable(c: Context) {
 validationEnsure(!['pausado', 'stand_by', 'retirado', 'culminado'].includes(c.p.estado), 'El proyecto no admite revisiones');
 validationEnsure(c.isCover ? !c.v.feedbackEn || !!c.q.revisadoEn : c.v.calidadFaseId === c.q.id, 'Ronda histórica o devuelta a Diseño');
}
async function current(c: Context, tx: Tx) {
 mutable(c);
 const [v] = await tx.select().from(disenoVersiones).where(eq(disenoVersiones.disenoId, c.d.id)).orderBy(desc(disenoVersiones.numero)).limit(1);
 validationEnsure(v?.id === c.v.id, 'La versión cambió. Actualiza tu trabajo.');
 const [w] = await tx.select().from(workItems).where(eq(workItems.id, c.q.workItemId!));
 validationEnsure(w && !['bloqueado', 'cancelado'].includes(w.estado), 'La validación está bloqueada');
}
export async function requestValidator(id: string, actor: Actor, operate: CorporateDriveOperation = withCorporateDrive) {
 validationEnsure(actor.rol === 'especialista', 'Solo el Especialista solicita', 403);
 return db.transaction(async tx => {
  const c = await lockValidation(tx, id, actor); await current(c, tx);
  validationEnsure(!c.q.revisadoEn, 'Ronda cerrada');
  validationEnsure(c.d.externalProviderEmail, 'Configura el servicio externo de Diseño antes de solicitar Validador');
  if (!c.v.driveFileId || !c.v.driveRevisionId) {
   const { w, folder } = await workspace(c.p.id, 'DESIGN_REVIEW_VERSIONS');
   const fileId = parseEditorialDriveId(c.v.enlace);
   const revisionId = await operate(async ({ integration, storage }) => {
    validationEnsure(w.integrationId === integration.id && w.storageContextId === integration.storageContextId && storage.pinAuthorRevision, 'La conexión de Drive cambió');
    const metadata = await storage.getMetadata(fileId);
    validationEnsure(!metadata.trashed && metadata.mimeType === 'application/pdf' && metadata.parents.includes(folder.driveFolderId), 'La versión debe ser un PDF en Versiones_para_corregir del proyecto');
    return (await storage.pinAuthorRevision(fileId)).revisionId;
   });
   await tx.update(disenoVersiones).set({ driveFileId: fileId, driveRevisionId: revisionId }).where(eq(disenoVersiones.id, c.v.id));
  }
  if (c.q.validatorRequestedAt) return { ok: true };
  await saveValidationRound(tx, c, { validatorRequestedAt: new Date(), validatorRequestedById: actor.id });
  await validationEvent(tx, c, actor.id, 'VALIDADOR_SOLICITADO');
  await notice(tx, c.p.id, 'jefe_area', null, `${c.p.tituloDefinitivo?.trim() || c.p.titulo || c.p.codigo} necesita Validador para ${contextLabel(c)}`, '/?vista=solicitudes');
  return { ok: true };
 });
}
// Explicitly enables an already delivered cover without inferring assignments
// or mutating data during reads. New external deliveries create this task too.
export async function requestCoverValidator(designId: string, actor: Actor, operate: CorporateDriveOperation = withCorporateDrive) {
 validationEnsure(actor.rol === 'especialista', 'Solo el Especialista solicita', 403);
 const id = await db.transaction(async tx => {
  const [design] = await tx.select().from(disenos).where(eq(disenos.id, designId));
  validationEnsure(design?.tipo === 'cubierta_extendida', 'Cubierta no encontrada', 404);
  const [p] = await tx.select().from(proyectos).where(eq(proyectos.id, design.proyectoId)).for('update');
  validationEnsure(p && await obtenerEspecialistaActual(p.id, p.especialistaId, tx) === actor.id, 'Proyecto ajeno', 403);
  validationEnsure(!['pausado','stand_by','retirado','culminado'].includes(p.estado), 'Proyecto no operativo');
  const [v] = await tx.select().from(disenoVersiones).where(eq(disenoVersiones.disenoId, designId)).orderBy(desc(disenoVersiones.numero)).limit(1);
  validationEnsure(v && !v.feedbackEn && !v.aprobadaAutorEn, 'Se requiere una cubierta entregada y pendiente de revisión');
  return createCoverValidation(tx, design, p, v);
 });
 await requestValidator(id, actor, operate);
 return { ok: true, id };
}
export async function assignValidator(id: string, validatorId: string, dueAt: string | undefined, actor: Actor) {
 validationEnsure(actor.rol === 'jefe_area', 'Solo Jefatura asigna Validadores', 403);
 return db.transaction(async tx => {
  const c = await lockValidation(tx, id, actor); await current(c, tx);
  validationEnsure(c.q.validatorRequestedAt && !c.q.revisadoEn, 'Solicita Validador antes de asignar');
  const [user] = await tx.select().from(users).where(and(eq(users.id, validatorId), eq(users.rol, 'validador'), eq(users.activo, true)));
  validationEnsure(user, 'Validador activo no encontrado', 400);
  const result = await asignarConHistorial(tx, { proyectoId: c.p.id, workItemId: c.q.workItemId, tipo: 'validador', usuarioId: validatorId, asignadoPorId: actor.id });
  if (!result.cambio) return { ok: true };
  await saveValidationRound(tx, c, { dueAt: dueAt ? new Date(dueAt) : c.q.dueAt, iniciadoEn: null, iniciadoPorId: null, commentsUpload: null });
  await validationEvent(tx, c, actor.id, 'VALIDADOR_ASIGNADO', { validador: user.nombre, validatorId, assignmentId: result.asignacionId, anterior: result.anteriorUsuarioId });
  await notice(tx, c.p.id, 'validador', validatorId, `Te asignaron como Validador: ${contextLabel(c)}.`, `/?validacion=${id}`);
  await notice(tx, c.p.id, 'especialista', await obtenerEspecialistaActual(c.p.id, c.p.especialistaId, tx), `${user.nombre} fue asignado como Validador para ${contextLabel(c)}.`, `/proyectos/${c.p.id}?proceso=${c.isCover ? 'validacion_cubierta' : 'calidad'}`);
  return { ok: true };
 });
}
export async function startValidation(id: string, actor: Actor) {
 return db.transaction(async tx => {
  const c = await lockValidation(tx, id, actor); await current(c, tx);
  validationEnsure(actor.rol === 'validador' && !c.q.revisadoEn, 'La ronda no admite revisión');
  if (c.q.iniciadoEn) return { ok: true };
  await saveValidationRound(tx, c, { iniciadoEn: new Date(), iniciadoPorId: actor.id });
  await transicionarWorkItemPorId(tx, c.q.workItemId!, 'en_progreso');
  await validationEvent(tx, c, actor.id, c.isCover ? 'VALIDACION_INICIADA' : 'CALIDAD_INICIADA'); return { ok: true };
 });
}
const mimeTypes: Record<string, string> = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword' };
export function validationFileName(version: string, phase: number, round: number, original: string, token: string) {
 const extension = original.split('.').pop()?.toLowerCase();
 validationEnsure(extension && mimeTypes[extension] && !/[\x00-\x1f]/.test(original), 'Selecciona un PDF o documento Word', 400);
 return `${version.replace(/[^A-Za-z0-9_-]/g, '')}_${phase === 0 ? 'CUBIERTA' : `F${phase}`}_R${round}_correcciones_a_aplicar_${token.replace(/[^a-z0-9-]/gi, '')}.${extension}`;
}
async function workspace(projectId: string, folderKey: string) {
 const [w] = await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId, projectId));
 validationEnsure(w?.status === 'READY', 'El espacio de Drive no está disponible');
 const [folder] = await db.select().from(projectDriveFolders).where(and(eq(projectDriveFolders.workspaceId, w.id), eq(projectDriveFolders.key, folderKey), eq(projectDriveFolders.status, 'READY')));
 validationEnsure(folder, 'La carpeta de Drive no está disponible'); return { w, folder };
}
export async function uploadValidation(id: string, input: { name: string; contentBase64: string; key: string }, actor: Actor, operate: CorporateDriveOperation = withCorporateDrive) {
 validationEnsure(actor.rol === 'validador', 'Rol no autorizado', 403);
 validationEnsure(input.contentBase64.length <= 28_000_000 && /^[A-Za-z0-9+/]+={0,2}$/.test(input.contentBase64), 'Archivo inválido o demasiado grande', 400);
 const content = Buffer.from(input.contentBase64, 'base64');
 validationEnsure(content.length && content.length <= 20 * 1024 * 1024 && content.toString('base64') === input.contentBase64, 'El archivo debe pesar entre 1 byte y 20 MB', 400);
 const ext = input.name.split('.').pop()?.toLowerCase();
 validationEnsure(ext && mimeTypes[ext] && !/[\x00-\x1f]/.test(input.name), 'Selecciona un PDF o documento Word', 400);
 validationEnsure(ext === 'pdf' ? content.subarray(0, 5).toString() === '%PDF-' : ext === 'docx' ? content.subarray(0, 2).toString() === 'PK' : content.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])), 'El contenido no coincide con el tipo de archivo', 400);
 // Do not hold a database lock during the network upload. Recheck assignment
 // under lock afterwards and remove only our newly created file on failure.
 const initial = await db.transaction(async tx => { const c = await lockValidation(tx, id, actor); await current(c, tx); validationEnsure(!c.q.revisadoEn, 'Ronda cerrada'); return c; });
 const { w, folder } = await workspace(initial.p.id, 'QUALITY_COMMENTS');
 const canonicalName = validationFileName(`V${initial.v.numero}`, initial.q.numeroFase, initial.q.ronda, input.name, input.key);
 const sha256 = createHash('sha256').update(content).digest('hex');
 if (initial.q.commentsUpload?.name === canonicalName) {
  validationEnsure(initial.q.commentsUpload.sha256 === sha256, 'La clave de carga pertenece a otro archivo');
  return initial.q.commentsUpload;
 }
 return operate(async ({ integration, storage }) => {
  validationEnsure(w.integrationId === integration.id && w.storageContextId === integration.storageContextId, 'La conexión de Drive cambió');
  validationEnsure(storage.uploadFile && storage.pinAuthorRevision, 'Drive no permite subir y conservar revisiones', 503);
  const file = await storage.uploadFile({ name: canonicalName, mimeType: mimeTypes[ext]!, parentFolderId: folder.driveFolderId, content });
  try {
   // PDF revisions are retained by Drive; Word uploads retain the immutable
   // file ID and are never updated by PanHouse.
   const revision = (await storage.pinAuthorRevision(file.providerFileId)).revisionId;
   const upload = { fileId: file.providerFileId, revisionId: revision, name: canonicalName, folderKey: folder.key, assignmentId: initial.assignment!.id, sha256 };
   let saved = upload;
   await db.transaction(async tx => {
    const c = await lockValidation(tx, id, actor); await current(c, tx);
    validationEnsure(!c.q.revisadoEn && c.assignment?.id === initial.assignment?.id, 'La asignación cambió durante la carga');
    if (c.q.commentsUpload?.name === canonicalName) {
     validationEnsure(c.q.commentsUpload.sha256 === sha256, 'La clave de carga pertenece a otro archivo');
     saved = c.q.commentsUpload; return;
    }
    await saveValidationRound(tx, c, { commentsUpload: upload });
    await validationEvent(tx, c, actor.id, 'VALIDACION_ARCHIVO_CARGADO', upload);
   });
   if (saved.fileId !== upload.fileId) await storage.deleteFileOrFolder(upload.fileId);
   return saved;
  } catch (error) { await storage.deleteFileOrFolder(file.providerFileId); throw error; }
 });
}
async function commentsPrecede(tx: Tx, c: Context, previous?: typeof disenoVersiones.$inferSelect) {
 if (c.v.numero <= 0 || !previous?.feedbackArchivoUrl || !previous.feedbackEn) return false;
 if (c.isCover) {
  const [work] = await tx.select().from(workItems).where(and(eq(workItems.proyectoId, c.p.id), eq(workItems.tipo, 'validacion_cubierta'), eq(workItems.businessKey, previous.id)));
  const q = work ? coverRound(work) : null;
  return !!q?.revisadoEn && q.aprobado === false && !!q.commentsUpload;
 }
 if (!previous.calidadFaseId) return false;
 const [q] = await tx.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.id, previous.calidadFaseId));
 return !!q?.revisadoEn && q.aprobado === false && (q.numeroFase >= 3) === (c.q.numeroFase >= 3);
}
export async function decideValidation(id: string, input: { result: 'comentarios' | 'todos_aplicados'; key: string; assignmentId: string; comments?: number; observations?: string }, actor: Actor) {
 validationEnsure(actor.rol === 'validador', 'Rol no autorizado', 403);
 return db.transaction(async tx => {
  const c = await lockValidation(tx, id, actor);
  validationEnsure(c.assignment?.id === input.assignmentId, 'La asignación cambió. Actualiza tu trabajo.');
  if (c.q.decisionKey) { validationEnsure(c.q.decisionKey === input.key && c.q.aprobado === (input.result === 'todos_aplicados') && c.q.cantidadComentarios === (input.result === 'todos_aplicados' ? 0 : input.comments ?? null) && c.q.observaciones === (input.observations ?? null), 'La ronda ya tiene otro resultado'); return { ok: true }; }
  await current(c, tx); validationEnsure(!c.q.revisadoEn, 'Ronda cerrada');
  const approved = input.result === 'todos_aplicados';
  const [previous] = await tx.select().from(disenoVersiones).where(and(eq(disenoVersiones.disenoId, c.d.id), eq(disenoVersiones.numero, c.v.numero - 1)));
  if (approved) validationEnsure(await commentsPrecede(tx, c, previous), 'Disponible al revisar una versión posterior generada después de tus comentarios.');
  else {
   validationEnsure(c.q.commentsUpload?.assignmentId === c.assignment.id, 'Sube primero el archivo con tus comentarios.');
   validationEnsure(c.d.externalProviderEmail, 'El Especialista debe configurar el proveedor externo de Diseño');
  }
  const now = new Date(), url = !approved ? `https://drive.google.com/file/d/${c.q.commentsUpload!.fileId}/view` : null;
  const [person] = await tx.select().from(users).where(eq(users.id, actor.id));
  await saveValidationRound(tx, c, { aprobado: approved, decisionKey: input.key, iniciadoEn: c.q.iniciadoEn ?? now, iniciadoPorId: c.q.iniciadoPorId ?? actor.id, revisadoEn: now, revisadoPorId: actor.id, nombreQuienRecibe: person?.nombre, comentariosUrl: url, cantidadComentarios: approved ? 0 : input.comments ?? null, observaciones: input.observations ?? null });
  await transicionarWorkItemPorId(tx, c.q.workItemId!, 'completado');
  if (!approved) {
   await tx.update(disenoVersiones).set({ feedback: input.observations ?? 'Aplicar comentarios del Validador', feedbackArchivoUrl: url, feedbackEn: now, cantidadComentarios: input.comments ?? null }).where(eq(disenoVersiones.id, c.v.id));
   await tx.update(disenos).set({ cerradoEn: null }).where(eq(disenos.id, c.d.id));
   await tx.update(workItems).set({ estado: 'en_progreso', fechaFinReal: null }).where(eq(workItems.id, c.d.workItemId));
   if (c.isCover) {
    const [creative] = c.v.revisionCreativaId ? await tx.select().from(direccionesCreativas).where(eq(direccionesCreativas.id, c.v.revisionCreativaId)) : [];
    const reviewIds = [creative?.workItemId, c.v.revisionInternaWorkItemId].filter((id): id is string => !!id);
    for (const reviewId of reviewIds) {
     const [review] = await tx.select().from(workItems).where(eq(workItems.id, reviewId));
     if (review && !['completado','cancelado'].includes(review.estado)) await transicionarWorkItemPorId(tx, reviewId, 'cancelado');
    }
   }
   const { folder } = await workspace(c.p.id, 'DESIGN_REVIEW_VERSIONS');
   await tx.insert(validationDeliveryOutbox).values({ ...(c.isCover ? { versionId: c.v.id } : { phaseId: id }), recipient: c.d.externalProviderEmail!, subject: `${c.p.tituloDefinitivo?.trim() || c.p.titulo || c.p.codigo}: aplicar comentarios ${c.q.pdfVersion}`, message: `Aplica los comentarios de ${contextLabel(c)}, ronda ${c.q.ronda}.\n${url}\nEntrega un archivo nuevo ${c.isCover ? 'Cubierta_' : ''}V${c.v.numero + 1}.pdf en:\nhttps://drive.google.com/drive/folders/${folder.driveFolderId}\nPanHouse detectará la entrega automáticamente.` });
  }
  await validationEvent(tx, c, actor.id, approved ? 'VALIDACION_TODOS_APLICADOS' : 'VALIDACION_COMENTARIOS_ENVIADOS', { resultado: input.result, commentedFileId: c.q.commentsUpload?.fileId, cantidadComentarios: input.comments ?? null });
  await notice(tx, c.p.id, 'especialista', await obtenerEspecialistaActual(c.p.id, c.p.especialistaId, tx), approved ? `${contextLabel(c)} completada. Versión validada: ${c.q.pdfVersion}. ${c.isCover ? 'Se conservan las aprobaciones creativas e internas requeridas.' : c.q.numeroFase < 3 ? 'Enviar al Autor para aprobación.' : 'Revisión Final completada; verifica los requisitos de Paquete Final.'}` : `${contextLabel(c)}: comentarios enviados. Esperando nueva versión de Diseño.`, `/proyectos/${c.p.id}?proceso=${c.isCover ? 'validacion_cubierta' : 'calidad'}`);
  return { ok: true };
 });
}

// DTO deliberately excludes commercial data, audit history, work IDs and Ficha.
export async function listValidations(actor: Actor, projectId?: string, authorizedProject?: typeof proyectos.$inferSelect) {
 validationEnsure(['validador', 'jefe_area', 'especialista', 'rrpp', 'admin'].includes(actor.rol), 'Rol no autorizado', 403);
 if (actor.rol === 'especialista') {
  validationEnsure(projectId, 'Indique proyecto', 400);
  if (authorizedProject?.id === projectId) validationEnsure(authorizedProject.especialistaId === actor.id, 'Proyecto ajeno', 403);
  else {
   const [p] = await db.select().from(proyectos).where(eq(proyectos.id, projectId));
   validationEnsure(p && await obtenerEspecialistaActual(p.id, p.especialistaId) === actor.id, 'Proyecto ajeno', 403);
  }
 }
 const rows = await db.select({ q: fichaCalidadFases, v: disenoVersiones, d: disenos, p: proyectos, author: autores.nombre, a: projectAssignments, validator: users.nombre }).from(fichaCalidadFases)
  .innerJoin(disenoVersiones, eq(fichaCalidadFases.disenoVersionId, disenoVersiones.id)).innerJoin(disenos, eq(disenoVersiones.disenoId, disenos.id)).innerJoin(proyectos, eq(disenos.proyectoId, proyectos.id)).innerJoin(autores, eq(proyectos.autorId, autores.id))
  .innerJoin(workItems, eq(workItems.id, fichaCalidadFases.workItemId))
  .leftJoin(projectAssignments, activeAssignmentColumn()).leftJoin(users, eq(users.id, projectAssignments.usuarioId))
  .where(and(sql`not exists (select 1 from diseno_versiones newer where newer.diseno_id=${disenoVersiones.disenoId} and newer.numero>${disenoVersiones.numero})`, projectId ? eq(proyectos.id, projectId) : undefined, actor.rol === 'validador' ? and(eq(projectAssignments.usuarioId, actor.id), isNull(fichaCalidadFases.revisadoEn), inArray(workItems.estado, ['pendiente','en_progreso'])) : undefined)).orderBy(desc(fichaCalidadFases.solicitadoEn));
 const latestByDesign = new Map<string, number>();
 for (const r of rows) latestByDesign.set(r.d.id, Math.max(latestByDesign.get(r.d.id) ?? -1, r.v.numero));
 const quality = rows.filter(r => !['retirado', 'culminado'].includes(r.p.estado) && r.v.calidadFaseId === r.q.id && r.v.numero === latestByDesign.get(r.d.id) && (actor.rol !== 'validador' || !['pausado','stand_by'].includes(r.p.estado))).map(r => ({ id: r.q.id, projectId: actor.rol === 'validador' ? undefined : r.p.id, title: r.p.tituloDefinitivo?.trim() || r.p.titulo || r.p.codigo, author: r.author, ...validationWorkIdentity(r.d.tipo, r.q.numeroFase), phase: validationWorkLabel(validationWorkIdentity(r.d.tipo, r.q.numeroFase)), round: r.q.ronda, version: `V${r.v.numero}`, dueAt: r.q.dueAt, pages: r.q.cantidadPaginas, provider: r.d.externalProviderName, validator: r.validator, requested: !!r.q.validatorRequestedAt, assigned: !!r.a, status: r.q.aprobado ? 'Todos los comentarios aplicados' : r.q.revisadoEn ? 'Esperando nueva versión de Diseño' : r.q.iniciadoEn ? `Validador revisando ${r.q.pdfVersion}` : r.a ? 'Esperando revisión del Validador' : r.q.validatorRequestedAt ? 'Esperando asignación de Jefatura' : 'Solicitar Validador' }));
 const covers = await db.select({ w: workItems, v: disenoVersiones, d: disenos, p: proyectos, author: autores.nombre, a: projectAssignments, validator: users.nombre }).from(workItems)
  .innerJoin(disenoVersiones, eq(workItems.businessKey, sql`${disenoVersiones.id}::text`)).innerJoin(disenos, eq(disenoVersiones.disenoId, disenos.id))
  .innerJoin(proyectos, and(eq(workItems.proyectoId, proyectos.id), eq(disenos.proyectoId, proyectos.id))).innerJoin(autores, eq(proyectos.autorId, autores.id))
  .leftJoin(projectAssignments, and(eq(projectAssignments.workItemId, workItems.id), eq(projectAssignments.tipo, 'validador'), isNull(projectAssignments.finalizadoEn))).leftJoin(users, eq(users.id, projectAssignments.usuarioId))
  .where(and(eq(workItems.tipo, 'validacion_cubierta'), projectId ? eq(proyectos.id, projectId) : undefined, sql`not exists (select 1 from diseno_versiones newer where newer.diseno_id=${disenoVersiones.disenoId} and newer.numero>${disenoVersiones.numero})`, actor.rol === 'validador' ? and(eq(projectAssignments.usuarioId, actor.id), inArray(workItems.estado, ['pendiente','en_progreso'])) : undefined));
 const coverItems = covers.filter(r => !['retirado', 'culminado'].includes(r.p.estado) && (actor.rol !== 'validador' || (!['pausado','stand_by'].includes(r.p.estado) && !r.v.feedbackEn))).map(r => {
  const q = coverRound(r.w), identity = validationWorkIdentity(r.d.tipo, 0);
  return { id: q.id, projectId: actor.rol === 'validador' ? undefined : r.p.id, title: r.p.tituloDefinitivo?.trim() || r.p.titulo || r.p.codigo, author: r.author, ...identity, phase: validationWorkLabel(identity), round: q.ronda, version: `V${r.v.numero}`, dueAt: q.dueAt, pages: null, provider: r.d.externalProviderName, validator: r.validator, requested: !!q.validatorRequestedAt, assigned: !!r.a, status: q.aprobado ? 'Todos los comentarios aplicados' : q.revisadoEn || r.v.feedbackEn ? 'Esperando nueva versión de Diseño' : q.iniciadoEn ? `Validador revisando V${r.v.numero}` : r.a ? 'Esperando revisión del Validador' : q.validatorRequestedAt ? 'Esperando asignación de Jefatura' : 'Solicitar Validador' };
 });
 return [...quality, ...coverItems];
}
function activeAssignmentColumn() { return and(eq(projectAssignments.workItemId, fichaCalidadFases.workItemId), eq(projectAssignments.tipo, 'validador'), isNull(projectAssignments.finalizadoEn)); }
export async function validationDetail(id: string, actor: Actor) {
 validationEnsure(actor.rol === 'validador', 'Rol no autorizado', 403);
 return db.transaction(async tx => {
  const c = await lockValidation(tx, id, actor); await current(c, tx);
  validationEnsure(!c.q.revisadoEn, 'Ronda cerrada', 404);
  const [author] = await tx.select().from(autores).where(eq(autores.id, c.p.autorId));
  const [collection] = c.p.coleccionId ? await tx.select({ name: colecciones.nombre }).from(colecciones).where(eq(colecciones.id, c.p.coleccionId)) : [];
  const [previous] = await tx.select().from(disenoVersiones).where(and(eq(disenoVersiones.disenoId, c.d.id), eq(disenoVersiones.numero, c.v.numero - 1)));
  const materials = [{ label: 'Versión para revisar', url: c.v.enlace, role: 'current' }, { label: c.isCover ? 'Referencia original de cubierta' : 'Tripa originalmente entregada a Diseño', url: safeDrive(c.d.fuenteUrl), role: 'source' }, { label: 'Versión anterior comentada', url: safeDrive(previous?.feedbackArchivoUrl), role: 'previous_comments' }, { label: 'Versión de referencia', url: safeDrive(previous?.enlace), role: 'previous' }, { label: 'Números legales', url: safeDrive(c.q.numerosLegalesUrl), role: 'legal' }].filter(m => m.url).map(m => ({ ...m, url: `/api/validaciones/${id}/archivo?material=${m.role}` }));
  return { id, title: c.p.tituloDefinitivo?.trim() || c.p.titulo || c.p.codigo, author: author?.nombre, collectionName: collection?.name ?? null, ...validationWorkIdentity(c.d.tipo, c.q.numeroFase), phase: contextLabel(c), phaseNumber: c.q.numeroFase, round: c.q.ronda, version: `V${c.v.numero}`, dueAt: c.q.dueAt, provider: c.d.externalProviderName, assignmentId: c.assignment!.id, started: !!c.q.iniciadoEn, canApprove: await commentsPrecede(tx, c, previous), upload: c.q.commentsUpload?.assignmentId === c.assignment!.id ? { name: c.q.commentsUpload.name, fileId: c.q.commentsUpload.fileId } : null, materials };
 });
}
function safeDrive(url: string | null | undefined) { if (!url) return null; try { parseEditorialDriveId(url); return url; } catch { return null; } }
export type ValidationMaterial = 'current' | 'source' | 'previous' | 'previous_comments' | 'legal';
export async function readValidationFile(id: string, actor: Actor, material: ValidationMaterial = 'current', operate: CorporateDriveOperation = withCorporateDrive) {
 const c = await db.transaction(async tx => { const c = await lockValidation(tx, id, actor); await current(c, tx); validationEnsure(!c.q.revisadoEn, 'Ronda cerrada', 404); return c; });
 validationEnsure(actor.rol === 'validador', 'Rol no autorizado', 403);
 const [previous] = await db.select().from(disenoVersiones).where(and(eq(disenoVersiones.disenoId, c.d.id), eq(disenoVersiones.numero, c.v.numero - 1)));
 const [qualityPrevious] = previous?.calidadFaseId ? await db.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.id, previous.calidadFaseId)) : [];
 const [coverPrevious] = c.isCover && previous ? await db.select().from(workItems).where(and(eq(workItems.tipo, 'validacion_cubierta'), eq(workItems.businessKey, previous.id), eq(workItems.proyectoId, c.p.id))) : [];
 const previousPhase = c.isCover ? coverPrevious ? coverRound(coverPrevious) : undefined : qualityPrevious;
 let fileId = material === 'current' ? c.v.driveFileId : material === 'previous' ? previous?.driveFileId : material === 'previous_comments' ? previousPhase?.commentsUpload?.fileId : null;
 let revisionId = material === 'current' ? c.v.driveRevisionId : material === 'previous' ? previous?.driveRevisionId : material === 'previous_comments' ? previousPhase?.commentsUpload?.revisionId : null;
 const url = material === 'source' ? c.d.fuenteUrl : material === 'legal' ? c.q.numerosLegalesUrl : material === 'previous_comments' ? previous?.feedbackArchivoUrl : material === 'previous' ? previous?.enlace : c.v.enlace;
 validationEnsure(safeDrive(url), 'Archivo de revisión no disponible', 404);
 fileId ??= parseEditorialDriveId(url!);
 const { w } = await workspace(c.p.id, 'DESIGN_REVIEW_VERSIONS');
 const folders = await db.select().from(projectDriveFolders).where(and(eq(projectDriveFolders.workspaceId, w.id), eq(projectDriveFolders.status, 'READY')));
 return operate(async ({ integration, storage }) => {
  validationEnsure(integration.id === w.integrationId && integration.storageContextId === w.storageContextId && storage.readAuthorRevision && storage.pinAuthorRevision, 'La conexión de Drive cambió');
  if (material === 'current' || material === 'previous' || material === 'previous_comments' && revisionId) {
   validationEnsure(revisionId, 'La revisión exacta del archivo no está disponible', 404);
   return { content: await storage.readAuthorRevision(fileId!, revisionId), mimeType: material === 'previous_comments' ? mimeTypes[previousPhase?.commentsUpload?.name.split('.').pop() ?? 'pdf'] ?? 'application/octet-stream' : 'application/pdf' };
  }
  // References are server-selected and must belong to this project's workspace.
  // Proxying them avoids granting the reviewer folder-wide Google permissions.
  const file = await storage.getMetadata(fileId!);
  validationEnsure(file && !file.trashed && Object.values(mimeTypes).includes(file.mimeType), 'El archivo de referencia debe ser PDF o Word', 409);
  const known = new Set(folders.map(f => f.driveFolderId)); let parents = file.parents, belongs = parents.some(p => known.has(p));
  const visited = new Set<string>();
  for (let depth = 0; !belongs && parents.length && depth < 12; depth++) {
   const next: string[] = [];
   for (const parent of parents) { if (visited.has(parent)) continue; visited.add(parent); next.push(...(await storage.getMetadata(parent)).parents); }
   belongs = next.some(p => known.has(p)); parents = next;
  }
  validationEnsure(belongs, 'El archivo de referencia no pertenece al proyecto', 403);
  revisionId = (await storage.pinAuthorRevision(fileId!)).revisionId;
  return { content: await storage.readAuthorRevision(fileId!, revisionId), mimeType: file.mimeType };
 });
}
export async function validationCandidates(actor: Actor) {
 validationEnsure(actor.rol === 'jefe_area', 'Solo Jefatura consulta candidatos', 403);
 const rows = await db.select({ id: users.id, name: users.nombre }).from(users).where(and(eq(users.rol, 'validador'), eq(users.activo, true)));
 const assignments = await db.select({ user: projectAssignments.usuarioId }).from(projectAssignments).innerJoin(workItems, eq(workItems.id, projectAssignments.workItemId)).where(and(eq(projectAssignments.tipo, 'validador'), isNull(projectAssignments.finalizadoEn), isNull(workItems.fechaFinReal)));
 return rows.map(u => ({ ...u, pending: assignments.filter(a => a.user === u.id).length }));
}
export async function validationConfigurationWarnings(actor: Actor) {
 if (actor.rol === 'validador') return [];
 const [integration] = await db.select().from(externalIntegrations).where(eq(externalIntegrations.provider, 'google_drive'));
 const warnings: string[] = [];
 if (integration?.status !== 'connected') warnings.push('Google Drive no está conectado. Las cargas y la detección automática requieren una conexión corporativa activa.');
 else if (!integration.scope.includes(DRIVE_DELIVERY_SCOPE)) warnings.push('Administración debe actualizar la conexión corporativa de Google Drive para detectar las entregas del proveedor.');
 if (!process.env.SMTP_URL || !process.env.MAIL_FROM) warnings.push('Los avisos externos están pendientes de configuración por Administración. PanHouse los conserva y reintentará enviarlos automáticamente.');
 return warnings;
}
export async function validationTimeline(projectId: string, actor: Actor) {
 validationEnsure(['especialista', 'jefe_area', 'admin', 'rrpp'].includes(actor.rol), 'Rol no autorizado', 403);
 if (actor.rol === 'especialista') await listValidations(actor, projectId);
 const events = await db.select({ id: auditLogs.id, action: auditLogs.accion, at: auditLogs.createdAt, details: auditLogs.detalles, actor: users.nombre }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorId)).where(eq(auditLogs.proyectoId, projectId)).orderBy(auditLogs.createdAt, auditLogs.id);
 return events.filter(e => /^(VALIDA|CALIDAD_|DISENO_)/.test(e.action));
}
