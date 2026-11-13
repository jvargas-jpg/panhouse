import { recibirDisenoExterno } from './diseno.js';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { and, desc, eq, inArray, isNull, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { disenos, disenoVersiones, fichaCalidadFases, fichasTrazabilidad, notificaciones, projectAssignments, projectDriveFolders, projectDriveWorkspaces, proyectos, validationDeliveryOutbox, workItems, type Rol } from '../db/schema/index.js';
import { withCorporateDrive, type CorporateDriveOperation } from '../modules/integrations/google-drive/corporate.js';
import type { StorageItem } from '../modules/integrations/google-drive/provider.js';
import { asignarConHistorial } from './assignments.js';
import { registrarEvento } from './auditLog.js';
import { obtenerEspecialistaActual } from './carga.js';
import { crearWorkItemSiNoExiste } from './workItems.js';
import { lockValidation, validationEnsure, validationEvent } from './validaciones.js';
import { DRIVE_DELIVERY_SCOPE } from '../modules/integrations/google-drive/config.js';

export async function configureExternalDesign(id: string, input: { name: string; email: string }, actor: { id: string; rol: Rol }) {
 validationEnsure(actor.rol === 'especialista', 'Solo el Especialista configura el servicio externo', 403);
 return db.transaction(async tx => {
  const [d] = await tx.select().from(disenos).where(eq(disenos.id, id)); validationEnsure(d && ['diagramacion','muestra_diagramacion','cubierta_extendida'].includes(d.tipo), 'Diagramación no encontrada', 404);
  const [p] = await tx.select().from(proyectos).where(eq(proyectos.id, d.proyectoId)).for('update');
  validationEnsure(p && await obtenerEspecialistaActual(p.id, p.especialistaId, tx) === actor.id, 'Proyecto ajeno', 403);
  await tx.update(disenos).set({ externalProviderName: input.name, externalProviderEmail: input.email.toLowerCase() }).where(eq(disenos.id, id));
  await registrarEvento(tx, { actorId: actor.id, accion: 'VALIDACION_PROVEEDOR_CONFIGURADO', entityType: 'work_item', entityId: d.workItemId, proyectoId: p.id, detalles: { provider: input.name, email: input.email } });
  return { ok: true };
 });
}
export function relevantDesignFile(file: StorageItem, folderId: string, version: number, email: string, after?: Date | null, prefix = '') {
 return !file.trashed && file.mimeType === 'application/pdf' && !!file.size && file.size <= 50 * 1024 * 1024
  && file.parents.includes(folderId) && new RegExp(`^V${version}(?:[ _.-].*)?\\.pdf$`, 'i').test(prefix ? file.name.replace(new RegExp(`^${prefix}_`, 'i'), '') : file.name) && (!prefix || file.name.toLowerCase().startsWith(prefix.toLowerCase()+'_'))
  && !!file.contributorEmails?.some(e => e.toLowerCase() === email.toLowerCase())
  && (!after || (!!file.modifiedAt && new Date(file.modifiedAt).getTime() > after.getTime()));
}
// Poll only relevant, persisted project folders. Multiple candidates are ambiguous:
// preserve state for Specialist attention instead of choosing a random file.
export async function detectValidationDeliveries(operate: CorporateDriveOperation = withCorporateDrive) {
 const designs = await db.select().from(disenos);
 let received = 0;
 for (const d of designs) {
  if (!d.externalProviderEmail) continue;
  const [p] = await db.select().from(proyectos).where(eq(proyectos.id, d.proyectoId));
  if (!p || ['pausado', 'stand_by', 'retirado', 'culminado'].includes(p.estado)) continue;
  const [latest] = await db.select().from(disenoVersiones).where(eq(disenoVersiones.disenoId, d.id)).orderBy(desc(disenoVersiones.numero)).limit(1);
  if (latest && !latest.feedbackEn) continue;
  const expected = latest ? latest.numero + 1 : 0;
  const [w] = await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId, p.id));
  if (w?.status !== 'READY') continue;
  const [folder] = await db.select().from(projectDriveFolders).where(and(eq(projectDriveFolders.workspaceId, w.id), eq(projectDriveFolders.key, 'DESIGN_REVIEW_VERSIONS'), eq(projectDriveFolders.status, 'READY')));
  if (!folder) continue;
  await operate(async ({ integration, storage }) => {
   validationEnsure(integration.scope.includes(DRIVE_DELIVERY_SCOPE), 'Reconecta Google Drive con el permiso de entregas externas para detectar archivos del proveedor', 409);
   validationEnsure(integration.id === w.integrationId && integration.storageContextId === w.storageContextId && storage.listFiles && storage.pinAuthorRevision, 'Drive no admite detección de entregas', 503);
   const files: StorageItem[] = []; let pageToken: string | undefined;
   do { const page = await storage.listFiles({ parentFolderId: folder.driveFolderId, pageToken }); files.push(...page.items); pageToken = page.nextPageToken ?? undefined; validationEnsure(files.length <= 5000, 'Demasiados archivos en la carpeta de versiones'); } while (pageToken);
   if (!files.length) return;
   const knownFiles = new Set((await db.select({ fileId: disenoVersiones.driveFileId }).from(disenoVersiones).where(inArray(disenoVersiones.driveFileId, files.map(f => f.providerFileId)))).map(f => f.fileId));
   const candidates = files.filter(f => !knownFiles.has(f.providerFileId)).filter(f => relevantDesignFile(f, folder.driveFolderId, expected, d.externalProviderEmail!, latest?.feedbackEn ?? d.solicitadoEn, d.tipo === 'diagramacion' ? '' : d.tipo === 'muestra_diagramacion' ? 'Muestra' : 'Cubierta')); 
   if (candidates.length !== 1) return;
   const file = candidates[0]!;
   const revision = await storage.pinAuthorRevision(file.providerFileId);
   if (d.tipo !== 'diagramacion') { if (await recibirDisenoExterno(d.id, { id: file.providerFileId, revisionId: revision.revisionId, numero: expected, providerEmail: d.externalProviderEmail! })) received++; return; }
   await db.transaction(async tx => {
    const [project] = await tx.select().from(proyectos).where(eq(proyectos.id, p.id)).for('update');
    if (!project || ['pausado', 'stand_by', 'retirado', 'culminado'].includes(project.estado)) return;
    const [currentDesign] = await tx.select().from(disenos).where(eq(disenos.id, d.id));
    if (currentDesign?.externalProviderEmail !== d.externalProviderEmail) return;
    const [current] = await tx.select().from(disenoVersiones).where(eq(disenoVersiones.disenoId, d.id)).orderBy(desc(disenoVersiones.numero)).limit(1);
    if ((current?.id ?? null) !== (latest?.id ?? null) || (current && !current.feedbackEn)) return;
    if ((await tx.select().from(disenoVersiones).where(eq(disenoVersiones.driveFileId, file.providerFileId)))[0]) return;
    const previousPhase = current?.calidadFaseId ? (await tx.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.id, current.calidadFaseId)))[0] : null;
    if (current && (!previousPhase?.revisadoEn || (previousPhase.aprobado !== false && !current.enviadaAutorEn))) return;
    const [inserted] = await tx.insert(fichasTrazabilidad).values({ proyectoId: p.id }).onConflictDoNothing().returning();
    const ficha = inserted ?? (await tx.select().from(fichasTrazabilidad).where(eq(fichasTrazabilidad.proyectoId, p.id)))[0]!;
    const [v] = await tx.insert(disenoVersiones).values({ disenoId: d.id, numero: expected, entregaKey: randomUUID(), enlace: `https://drive.google.com/file/d/${file.providerFileId}/view`, driveFileId: file.providerFileId, driveRevisionId: revision.revisionId }).returning();
    const phase = previousPhase ? previousPhase.numeroFase >= 3 ? 4 : 2 : 1;
    const rounds = await tx.select().from(fichaCalidadFases).where(and(eq(fichaCalidadFases.fichaId, ficha.id), eq(fichaCalidadFases.numeroFase, phase)));
    const wi = await crearWorkItemSiNoExiste(tx, { proyectoId: p.id, tipo: 'calidad', businessKey: `diseno-version:${v!.id}` });
    const [q] = await tx.insert(fichaCalidadFases).values({ fichaId: ficha.id, numeroFase: phase, ronda: Math.max(0, ...rounds.map(r => r.ronda)) + 1, pdfVersion: `V${expected}`, pdfUrl: v!.enlace, disenoVersionId: v!.id, workItemId: wi, solicitadoEn: new Date(), fecha: new Date().toISOString().slice(0, 10), validatorRequestedAt: previousPhase?.validatorRequestedAt, validatorRequestedById: previousPhase?.validatorRequestedById, dueAt: previousPhase?.dueAt, numerosLegalesUrl: previousPhase?.numerosLegalesUrl, cambiosPorVerificar: previousPhase?.cantidadComentarios }).returning();
    await tx.update(disenoVersiones).set({ calidadFaseId: q!.id, calidadWorkItemId: wi, handoffEn: new Date() }).where(eq(disenoVersiones.id, v!.id));
    await tx.update(disenos).set({ cerradoEn: new Date() }).where(eq(disenos.id, d.id));
    await tx.update(workItems).set({ estado: 'completado', fechaFinReal: new Date().toISOString().slice(0, 10) }).where(eq(workItems.id, d.workItemId));
    const [priorAssignment] = previousPhase?.workItemId ? await tx.select().from(projectAssignments).where(and(eq(projectAssignments.workItemId, previousPhase.workItemId), eq(projectAssignments.tipo, 'validador'), isNull(projectAssignments.finalizadoEn))) : [];
    if (priorAssignment) {
     await asignarConHistorial(tx, { proyectoId: p.id, workItemId: wi, tipo: 'validador', usuarioId: priorAssignment.usuarioId, asignadoPorId: priorAssignment.asignadoPorId });
     await tx.insert(notificaciones).values({ proyectoId: p.id, rolDestino: 'validador', usuarioDestinoId: priorAssignment.usuarioId, mensaje: `Diseño entregó V${expected} para tu revisión.`, targetPath: `/?validacion=${q!.id}` });
    }
    const c = await lockValidation(tx, q!.id);
    await validationEvent(tx, c, null, 'VALIDACION_DISENO_RECIBIDO', { provider: d.externalProviderName, fileName: file.name, revisionId: revision.revisionId, respondsTo: previousPhase?.id });
    await tx.insert(notificaciones).values({ proyectoId: p.id, rolDestino: 'especialista', usuarioDestinoId: await obtenerEspecialistaActual(p.id, p.especialistaId, tx), mensaje: `Diseño externo entregó V${expected}. ${priorAssignment ? 'Validador notificado.' : 'Solicita Validador.'}`, targetPath: `/proyectos/${p.id}?proceso=calidad` });
    received++;
   });
  });
 }
 return { received };
}
export async function deliverValidationMail(send = async (mail: { id: string; recipient: string; subject: string; message: string }) => {
 validationEnsure(process.env.SMTP_URL && process.env.MAIL_FROM, 'Configura SMTP_URL y MAIL_FROM para los avisos externos', 503);
 await nodemailer.createTransport(process.env.SMTP_URL).sendMail({ from: process.env.MAIL_FROM, to: mail.recipient, subject: mail.subject, text: mail.message, messageId: `<validation-${mail.id}@panhouse.local>` });
}) {
 for (let n = 0; n < 20; n++) {
  const found = await db.transaction(async tx => {
   const [mail] = await tx.select().from(validationDeliveryOutbox).where(and(isNull(validationDeliveryOutbox.sentAt), lte(validationDeliveryOutbox.nextAttemptAt, new Date()))).limit(1).for('update', { skipLocked: true });
   if (!mail) return false;
   try {
    await send(mail);
    await tx.update(validationDeliveryOutbox).set({ sentAt: new Date(), attempts: mail.attempts + 1 }).where(eq(validationDeliveryOutbox.id, mail.id));
    if (mail.phaseId) { const c = await lockValidation(tx, mail.phaseId); await validationEvent(tx, c, null, 'VALIDACION_AVISO_ENVIADO', { outboxId: mail.id }); }
    else if (mail.versionId) {
     const [v] = await tx.select().from(disenoVersiones).where(eq(disenoVersiones.id, mail.versionId));
     const [d] = v ? await tx.select().from(disenos).where(eq(disenos.id, v.disenoId)) : [];
     if (d) await registrarEvento(tx, { actorId: null, accion: 'VALIDACION_AVISO_ENVIADO', entityType: 'work_item', entityId: d.workItemId, proyectoId: d.proyectoId, detalles: { outboxId: mail.id, versionId: mail.versionId } });
    }
   } catch {
    await tx.update(validationDeliveryOutbox).set({ attempts: mail.attempts + 1, nextAttemptAt: new Date(Date.now() + 15 * 60000) }).where(eq(validationDeliveryOutbox.id, mail.id));
   } return true;
  }); if (!found) break;
 }
}
