import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { capitulos, editorialBlockers, editorialDeliveries, notificaciones, pausas, projectDriveWorkspaces, workItems } from '../db/schema/index.js';
import { actualizarCapituloEditor } from './capitulos.js';
import { transicionarWorkItemPorId } from './workItems.js';
import { registrarEvento } from './auditLog.js';
import { obtenerEspecialistaActual } from './carga.js';
import { diaCaracas } from './atencionEspecialista.js';
import { editorError, editorWorkProject, lockEditorWork } from './editorAccess.js';
import { validateEditorialDriveFile } from './editorDrive.js';
import type { Tx } from './tx.js';

async function assertExecution(tx: Tx, item: typeof workItems.$inferSelect, project: {id:string;estado:string}) {
  const [blocker] = await tx.select().from(editorialBlockers).where(and(eq(editorialBlockers.workItemId,item.id),isNull(editorialBlockers.resolvedAt)));
  if (blocker || item.estado === 'bloqueado') throw editorError('Esta intervención tiene un bloqueo abierto. Resuélvelo antes de continuar.');
  const pauses = await tx.select().from(pausas).where(eq(pausas.proyectoId,project.id));
  const now = new Date();
  if (['pausado','stand_by'].includes(project.estado) || pauses.some(p => p.fechaInicio <= now && (!p.fechaFin || p.fechaFin > now))) throw editorError('El proyecto está en pausa');
  if (['completado','cancelado'].includes(item.estado)) throw editorError('Esta intervención ya no requiere trabajo del Editor');
  if(item.businessKey==='default' && (await tx.select({id:capitulos.id}).from(capitulos).where(eq(capitulos.proyectoId,project.id)).limit(1)).length)throw editorError('Selecciona una intervención de capítulo para ejecutar el trabajo');
  if (item.businessKey.startsWith('capitulo:')) {
    const [chapter] = await tx.select().from(capitulos).where(eq(capitulos.id,item.businessKey.slice(9)));
    if (!chapter || chapter.proyectoId !== project.id) throw editorError('Capítulo no encontrado',404);
    if (chapter.fechaEnvioAutor && !chapter.fechaRespuestaReal || chapter.fechaEntregaEditor && !chapter.fechaRespuestaReal) throw editorError('La intervención está esperando al autor o al Especialista');
    return chapter;
  }
  return null;
}

export async function registrarEntregaEditorial(workItemId:string, driveUrl:string, actorId:string, observaciones?:string) {
  await editorWorkProject(workItemId,actorId);
  await db.transaction(async tx=>{const {item,project}=await lockEditorWork(tx,workItemId,actorId);if(item.estado!=='completado')await assertExecution(tx,item,project);});
  const verified = await validateEditorialDriveFile(workItemId,actorId,driveUrl);
  return db.transaction(async tx => {
    const {item,project} = await lockEditorWork(tx,workItemId,actorId);
    const [ws] = await tx.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.id,verified.workspaceId));
    if (!ws || ws.status !== 'READY' || ws.storageContextId !== verified.storageContextId) throw editorError('El espacio documental cambió; vuelve a seleccionar el archivo');
    const [last] = await tx.select().from(editorialDeliveries).where(eq(editorialDeliveries.workItemId,workItemId)).orderBy(desc(editorialDeliveries.submittedAt)).limit(1);
    // Completion identifies the delivery cycle; feedback reopens the same item.
    if (item.estado === 'completado' && last?.driveFileId === verified.driveFileId && last.submittedBy === actorId) return last;
    const chapter = await assertExecution(tx,item,project);
    const [delivery] = await tx.insert(editorialDeliveries).values({projectId:project.id,workItemId,driveUrl:verified.driveUrl,driveFileId:verified.driveFileId,observaciones,submittedBy:actorId}).returning();
    if (chapter) {
      await actualizarCapituloEditor(project.id,chapter.numero,{fechaEntregaEditor:diaCaracas(new Date())},actorId,tx);
    } else {
      await transicionarWorkItemPorId(tx,workItemId,'completado');
      const specialist = await obtenerEspecialistaActual(project.id,project.especialistaId,tx);
      if (specialist) await tx.insert(notificaciones).values({proyectoId:project.id,targetPath:'/proyectos/'+project.id,rolDestino:'especialista',usuarioDestinoId:specialist,mensaje:'El Editor entregó una nueva versión.'});
    }
    await registrarEvento(tx,{actorId,accion:'EDITOR_ENTREGA_REGISTRADA',entityType:'work_item',entityId:workItemId,proyectoId:project.id,detalles:{deliveryId:delivery!.id,driveFileId:verified.driveFileId}});
    return delivery!;
  });
}

export async function listarEntregasEditoriales(workItemId:string,actor:{id:string;rol:string}) {
  if (actor.rol === 'editor') await editorWorkProject(workItemId,actor.id);
  return db.select().from(editorialDeliveries).where(eq(editorialDeliveries.workItemId,workItemId)).orderBy(desc(editorialDeliveries.submittedAt));
}

export async function iniciarTrabajoEditorial(workItemId:string,actorId:string) {
  return db.transaction(async tx => {
    const {item,project} = await lockEditorWork(tx,workItemId,actorId);
    const chapter = await assertExecution(tx,item,project);
    if (chapter?.fechaInicioEditor || !chapter && item.fechaInicioReal) return;
    if (chapter) await actualizarCapituloEditor(project.id,chapter.numero,{fechaInicioEditor:diaCaracas(new Date())},actorId,tx);
    else await transicionarWorkItemPorId(tx,workItemId,'en_progreso');
    await registrarEvento(tx,{actorId,accion:'EDITOR_TRABAJO_INICIADO',entityType:'work_item',entityId:workItemId,proyectoId:project.id});
  });
}

export async function registrarAvanceEditorial(workItemId:string,actorId:string,note:string) {
  if (note.trim().length < 5 || note.trim().length > 1000) throw editorError('Escribe una observación de entre 5 y 1000 caracteres',400);
  return db.transaction(async tx => {
    const {item,project} = await lockEditorWork(tx,workItemId,actorId);
    await assertExecution(tx,item,project);
    await registrarEvento(tx,{actorId,accion:'EDITOR_AVANCE_REGISTRADO',entityType:'work_item',entityId:workItemId,proyectoId:project.id,detalles:{motivo:note.trim()}});
  });
}
