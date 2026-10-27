import { lockEditorWork, editorError } from './editorAccess.js';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { editorialBlockers, proyectos, workItems, notificaciones } from '../db/schema/index.js';
import { registrarEvento } from './auditLog.js';
import { sincronizarCapituloEditorial } from './editorialInterventions.js';

// "Reportar bloqueo" (prompt Editor §55-56): bloqueo EXPLÍCITO con
// lifecycle propio (editorial_blockers), nunca un request automático --
// solicitar apoyo sobre este bloqueo es una acción aparte (ver
// editorialRequests.ts, tipo 'editor_apoyo'). Marca el work item
// 'bloqueado' para que 'Bloqueadas' aparezca donde ya se deriva ese
// estado (editorialChief.ts), sin tocar esa consulta compartida.
export async function reportarBloqueoEditorial(workItemId: string, reason: string, actorId: string) {
  return db.transaction(async tx => {
    if(reason.trim().length<5||reason.trim().length>1000)throw editorError('Escribe un motivo de entre 5 y 1000 caracteres',400);
    const {item}=await lockEditorWork(tx,workItemId,actorId);
    if(['completado','cancelado'].includes(item.estado))throw editorError('La intervención ya no admite un bloqueo');
    const [existing] = await tx.select({ id: editorialBlockers.id }).from(editorialBlockers).where(and(eq(editorialBlockers.workItemId, workItemId), isNull(editorialBlockers.resolvedAt)));
    if (existing) throw Object.assign(new Error('Ya hay un bloqueo abierto para esta intervención'), { statusCode: 409 });
    const [blocker] = await tx.insert(editorialBlockers).values({ workItemId, reason, createdBy: actorId }).returning();
    await tx.update(workItems).set({ estado: 'bloqueado', gateBloqueante: reason }).where(eq(workItems.id, workItemId));
    await registrarEvento(tx, { actorId, accion: 'EDITOR_BLOQUEO_REPORTADO', entityType: 'work_item', entityId: workItemId, proyectoId: item.proyectoId, detalles: { reason } });
    await tx.insert(notificaciones).values({proyectoId:item.proyectoId,rolDestino:'jefe_edicion',targetPath:'/?vista=seguimiento-edicion&workItem='+workItemId,mensaje:'El Editor reportó un bloqueo: '+reason.trim()});
    return blocker!;
  });
}

// jefe_edicion también puede resolver (supervisión), sin requerir que el
// Editor asignado sea quien lo haga -- pero un Editor solo puede resolver
// el suyo, nunca el de otro (IDOR, prompt §171).
export async function resolverBloqueoEditorial(workItemId: string, actor: { id: string; rol: string }, resolution?: string) {
  return db.transaction(async tx => {
    if(!['editor','jefe_edicion'].includes(actor.rol))throw editorError('No autorizado',403);
    let item;
    if(actor.rol==='editor')item=(await lockEditorWork(tx,workItemId,actor.id)).item;
    else {
      const [origin]=await tx.select().from(workItems).where(eq(workItems.id,workItemId));
      if(!origin||origin.tipo!=='edicion')throw editorError('Intervención no encontrada',404);
      await tx.select({id:proyectos.id}).from(proyectos).where(eq(proyectos.id,origin.proyectoId)).for('update');
      [item]=await tx.select().from(workItems).where(eq(workItems.id,workItemId)).for('update');
    }
    if(!item)throw editorError('Intervención no encontrada',404);
    const [blocker] = await tx.select().from(editorialBlockers).where(and(eq(editorialBlockers.workItemId, workItemId), isNull(editorialBlockers.resolvedAt))).for('update');
    if (!blocker) throw Object.assign(new Error('No hay un bloqueo abierto para esta intervención'), { statusCode: 404 });
    await tx.update(editorialBlockers).set({ resolvedBy: actor.id, resolvedAt: new Date(), resolution: resolution ?? null }).where(eq(editorialBlockers.id, blocker.id));
    // Limpia ANTES de resincronizar: sincronizarCapituloEditorial, en su
    // rama de respaldo, copia hacia adelante el estado PREVIO del work item
    // cuando ninguna otra condición aplica -- si ese previo sigue siendo
    // 'bloqueado' (leído al inicio de su propia llamada), el bloqueo
    // resuelto quedaría "fantasma" en la UI. 'en_progreso' es la base
    // limpia desde la que el sync recalcula completado/feedback cycle según
    // las fechas reales del capítulo.
    await tx.update(workItems).set({ gateBloqueante: null, estado: 'en_progreso' }).where(eq(workItems.id, workItemId));
    if (item.businessKey.startsWith('capitulo:')) await sincronizarCapituloEditorial(tx, item.businessKey.slice('capitulo:'.length), 'editor');
    await registrarEvento(tx, { actorId: actor.id, accion: 'EDITOR_BLOQUEO_RESUELTO', entityType: 'work_item', entityId: workItemId, proyectoId: item.proyectoId, detalles: { resolution } });
    const [project]=await tx.select({editorId:proyectos.editorId}).from(proyectos).where(eq(proyectos.id,item.proyectoId));
    if(actor.rol==='jefe_edicion'&&project?.editorId)await tx.insert(notificaciones).values({proyectoId:item.proyectoId,rolDestino:'editor',usuarioDestinoId:project.editorId,targetPath:'/?vista=mi-trabajo&workItem='+workItemId,mensaje:'Se resolvió el bloqueo de tu intervención.'});
    return blocker;
  });
}
