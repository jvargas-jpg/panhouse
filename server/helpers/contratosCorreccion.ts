import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { contratosCorreccion, informacionContrato, correcciones, proyectos, notificaciones, workItems, type Rol } from '../db/schema/index.js';
import { obtenerEspecialistaActual } from './carga.js';
import { registrarEvento, type AccionAuditoria } from './auditLog.js';
import { ErrorFichaViva } from './fichaViva.js';
import type { Tx } from './tx.js';
type Actor = { id: string; rol: Rol };
const exigir = (ok: unknown, message: string, status = 409) => { if (!ok) throw new ErrorFichaViva(status,message); };
async function lockProyecto(tx: Tx, id: string, actor: Actor) {
  const [p] = await tx.select().from(proyectos).where(eq(proyectos.id,id)).for('update');
  exigir(p,'Proyecto no encontrado',404);
  const owner = await obtenerEspecialistaActual(id,p!.especialistaId,tx);
  exigir(actor.rol === 'talento_humano' || actor.rol === 'especialista' && owner === actor.id,'No autorizado para este contrato',403);
  exigir(['en_proceso','retrasado','pausado','stand_by'].includes(p!.estado),'Proyecto cerrado');
  return { ...p!, owner };
}
async function evento(tx: Tx, id: string, proyectoId: string, actor: Actor, accion: AccionAuditoria, detalles?: Record<string,unknown>) {
  await registrarEvento(tx,{actorId:actor.id,accion,entityType:'solicitud',entityId:id,proyectoId,detalles});
}
export async function solicitarContrato(correccionId: string, nombre: string, actor: Actor) {
  exigir(actor.rol==='especialista','Solo el Especialista solicita contratos',403);
  return db.transaction(async tx => {
    const [origen] = await tx.select({proyectoId:correcciones.proyectoId}).from(correcciones).where(eq(correcciones.id,correccionId));
    exigir(origen,'Corrección no encontrada',404);
    await lockProyecto(tx,origen!.proyectoId,actor);
    const [c] = await tx.select().from(correcciones).where(eq(correcciones.id,correccionId)).for('update');
    const [wi] = await tx.select().from(workItems).where(eq(workItems.id,c!.workItemId));
    exigir(wi && !['completado','cancelado'].includes(wi.estado),'Intervención no disponible para contrato');
    exigir(!c!.requiereRevisionPrevia || c!.revisionPreviaConfirmada,'Debe resolverse la revisión previa de Jefatura');
    const anteriores = await tx.select().from(contratosCorreccion).where(eq(contratosCorreccion.correccionId,correccionId)).orderBy(desc(contratosCorreccion.ronda));
    const actual = anteriores[0];
    if (actual && ['pendiente','en_revision','requiere_informacion'].includes(actual.estado)) {
      exigir(actual.correctorNombre===nombre,'La intervención ya tiene una solicitud para otro corrector');
      return {id:actual.id,nueva:false};
    }
    if(actual?.estado==='resuelta' && actual.correctorNombre===nombre)return {id:actual.id,nueva:false};
    const [r] = await tx.insert(contratosCorreccion).values({correccionId,correctorNombre:nombre,requestedById:actor.id,ronda:(actual?.ronda ?? 0)+1}).returning();
    await evento(tx,r!.id,origen!.proyectoId,actor,'CONTRATO_CORRECCION_SOLICITADO',{correccionId});
    await tx.insert(notificaciones).values({proyectoId:origen!.proyectoId,rolDestino:'talento_humano',mensaje:'Solicitud de contrato de corrector freelance para revisión de Talento Humano.'});
    return {id:r!.id,nueva:true};
  });
}
export async function gestionarContrato(id: string, datos: { accion: 'revisar' | 'informacion' | 'responder' | 'confirmar' | 'rechazar'; texto?: string; preguntaId?: string }, actor: Actor) {
  return db.transaction(async tx => {
    const [origen] = await tx.select({proyectoId:correcciones.proyectoId}).from(contratosCorreccion).innerJoin(correcciones,eq(correcciones.id,contratosCorreccion.correccionId)).where(eq(contratosCorreccion.id,id));
    exigir(origen,'Solicitud no encontrada',404);
    const p = await lockProyecto(tx,origen!.proyectoId,actor);
    const [r] = await tx.select().from(contratosCorreccion).where(eq(contratosCorreccion.id,id)).for('update');
    exigir(r && !['resuelta','rechazada'].includes(r.estado),'La solicitud ya fue resuelta');
    const ahora = new Date();
    let accion: AccionAuditoria;
    if (datos.accion==='responder') {
      exigir(actor.rol==='especialista','Solo el Especialista responde',403);
      exigir(r!.estado==='requiere_informacion','La solicitud ya no espera esta respuesta');
      const [q] = await tx.select().from(informacionContrato).where(and(eq(informacionContrato.contratoId,id),isNull(informacionContrato.answeredAt))).for('update');
      exigir(q && q.id===datos.preguntaId,'La pregunta pendiente cambió');
      await tx.update(informacionContrato).set({respuesta:datos.texto!,answeredAt:ahora,answeredById:actor.id}).where(eq(informacionContrato.id,q!.id));
      await tx.update(contratosCorreccion).set({estado:'en_revision'}).where(eq(contratosCorreccion.id,id));
      accion='CONTRATO_INFORMACION_RESPONDIDA';
      await tx.insert(notificaciones).values({proyectoId:p.id,rolDestino:'talento_humano',mensaje:'El Especialista respondió la información solicitada del contrato.'});
    } else {
      exigir(actor.rol==='talento_humano','Solo Talento Humano gestiona el contrato',403);
      if (datos.accion==='revisar') {
        exigir(r!.estado==='pendiente','La solicitud ya fue recibida');
        await tx.update(contratosCorreccion).set({estado:'en_revision',reviewedAt:ahora}).where(eq(contratosCorreccion.id,id));
        accion='CONTRATO_REVISION_INICIADA';
      } else if (datos.accion==='informacion') {
        exigir(r!.estado!=='requiere_informacion','Ya existe una pregunta pendiente');
        await tx.insert(informacionContrato).values({contratoId:id,pregunta:datos.texto!,askedById:actor.id});
        await tx.update(contratosCorreccion).set({estado:'requiere_informacion',reviewedAt:r!.reviewedAt ?? ahora}).where(eq(contratosCorreccion.id,id));
        accion='CONTRATO_INFORMACION_SOLICITADA';
      } else {
        exigir(r!.estado!=='requiere_informacion','Espere la respuesta solicitada antes de resolver');
        const [c] = await tx.select().from(correcciones).where(eq(correcciones.id,r!.correccionId)).for('update');
        exigir(c,'Intervención no encontrada',404);
        const [wi] = await tx.select().from(workItems).where(eq(workItems.id,c!.workItemId));
        exigir(wi && !['completado','cancelado'].includes(wi.estado),'La intervención ya fue cerrada');
        if (datos.accion==='confirmar') {
          await tx.update(correcciones).set({contratoConfirmado:true,...(!c!.fechaAsignada?{correctorNombre:r!.correctorNombre,freelance:true}:{})}).where(eq(correcciones.id,c!.id));
        }
        await tx.update(contratosCorreccion).set({estado:datos.accion==='confirmar'?'resuelta':'rechazada',resolvedAt:ahora,resolvedById:actor.id,motivo:datos.texto ?? null}).where(eq(contratosCorreccion.id,id));
        accion=datos.accion==='confirmar'?'CONTRATO_CONFIRMADO':'CONTRATO_RECHAZADO';
      }
      if (p.owner) await tx.insert(notificaciones).values({proyectoId:p.id,rolDestino:'especialista',usuarioDestinoId:p.owner,mensaje:datos.accion==='informacion'?'Talento Humano solicita información adicional del contrato.':datos.accion==='confirmar'?'Talento confirmó el contrato: puedes formalizar la asignación.':datos.accion==='rechazar'?'Talento rechazó la solicitud de contrato. Consulta el motivo.':'Talento inició la revisión del contrato.'});
    }
    await evento(tx,id,p.id,actor,accion,{preguntaId:datos.preguntaId ?? null});
    return {ok:true};
  });
}
