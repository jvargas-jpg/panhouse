import { and, desc, eq, isNotNull, isNull, ne,sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import type { Rol } from '../db/schema/index.js';
import {
  autores,
  direccionesCreativas,
  fichaDisenoPropuestas,
  notificaciones,
  projectAssignments,
  proyectos,
  servicios,
  users,
  workItems as workItemsTable,
} from '../db/schema/index.js';
import { asignarConHistorial } from './assignments.js';
import { registrarEvento } from './auditLog.js';
import { evaluarGateAprobacionPortadaRrpp, evaluarGateBriefAprobadoParaConceptos, evaluarGateMomentoReunionCreativa } from './gates.js';
import { obtenerFichaPorProyecto } from './trazabilidad.js';
import type { Tx } from './tx.js';
import { crearWorkItemSiNoExiste, transicionarWorkItemPorId } from './workItems.js';
import {lockCreativeForLeader} from './creativeLeaderCommands.js';
import {saveCreativeDelivery} from './creativeDeliveries.js';
import {CreativeError} from './creativeLeader.js';
import {obtenerEspecialistaActual} from './carga.js';

async function obtenerDireccionCreativa(tx: Tx, id: string) {
  const [fila] = await tx.select().from(direccionesCreativas).where(eq(direccionesCreativas.id, id)).limit(1);
  if(!fila)return;
  await tx.select({id:proyectos.id}).from(proyectos).where(eq(proyectos.id,fila.proyectoId)).for('update');
  return (await tx.select().from(direccionesCreativas).where(eq(direccionesCreativas.id,id)))[0];
}

export type ResultadoAccion = { ok: true } | { ok: false; status: 400 | 403 | 404 | 409; error: string };

// Paso 0 (Manual §2.3.3/§4.1 + update "Solicitud de reunión creativa"):
// el Especialista solicita. Idempotente: una solicitud 'concepto_portada'
// abierta (work_item no completado/cancelado) para este proyecto no se
// duplica — mismo criterio que solicitarCorreccion.
export async function solicitarDireccionCreativa(proyectoId: string, actorId: string): Promise<ResultadoAccion & { id?: string }> {
  return db.transaction(async (tx) => {
    const [proyecto] = await tx
      .select({
        id: proyectos.id,
        tituloDefinitivo: proyectos.tituloDefinitivo,
        subtituloDefinitivo: proyectos.subtituloDefinitivo,
        fechaFeedbackTripa: proyectos.fechaFeedbackTripa,
        servicioId: proyectos.servicioId,
      })
      .from(proyectos)
      .where(eq(proyectos.id, proyectoId))
      .limit(1).for('update');
    if (!proyecto) return { ok: false, status: 404, error: 'Proyecto no encontrado' };

    const [servicio] = await tx.select({ codigo: servicios.codigo }).from(servicios).where(eq(servicios.id, proyecto.servicioId)).limit(1);

    const gate = evaluarGateMomentoReunionCreativa({
      tituloDefinitivo: proyecto.tituloDefinitivo,
      subtituloDefinitivo: proyecto.subtituloDefinitivo,
      servicioCodigo: servicio?.codigo ?? null,
      fechaFeedbackTripa: proyecto.fechaFeedbackTripa,
    });
    if (!gate.desbloqueado) return { ok: false, status: 400, error: gate.motivo ?? 'Gate bloqueado' };

    const [existente] = await tx
      .select({ id: direccionesCreativas.id, workItemId: direccionesCreativas.workItemId })
      .from(direccionesCreativas)
      .where(and(eq(direccionesCreativas.proyectoId, proyectoId), eq(direccionesCreativas.tipo, 'concepto_portada')))
      .orderBy(desc(direccionesCreativas.createdAt))
      .limit(1);

    if (existente) {
      const [wi] = await tx.select({ estado: workItemsTable.estado }).from(workItemsTable).where(eq(workItemsTable.id, existente.workItemId)).limit(1);
      if (wi && wi.estado !== 'completado' && wi.estado !== 'cancelado') {
        return { ok: true, id: existente.id };
      }
    }

    const workItemId = await crearWorkItemSiNoExiste(tx, { proyectoId, tipo: 'direccion_creativa', businessKey: existente?'concepto_portada:'+existente.id:'concepto_portada' });
    const fechaSolicitud = new Date().toISOString().slice(0, 10);

    const [creada] = await tx.insert(direccionesCreativas).values({ proyectoId, workItemId, tipo: 'concepto_portada', fechaSolicitud }).returning({ id: direccionesCreativas.id });
    if (!creada) throw new Error('El insert de direcciones_creativas no devolvió ninguna fila');

    await registrarEvento(tx, {
      actorId,
      accion: 'DIRECCION_CREATIVA_SOLICITADA',
      entityType: 'work_item',
      entityId: workItemId,
      proyectoId,
    });

    await tx.insert(notificaciones).values({
      proyectoId,
      rolDestino: 'lider_creativo',
      mensaje: 'Nueva solicitud de Dirección Creativa.',
    });

    return { ok: true, id: creada.id };
  });
}

// Asignación (master prompt 5C §6): la Matriz no muestra una columna
// estructurada de "Líder Creativo" (solo iniciales sueltas en
// observaciones libres, ej. "JC") — no hay evidencia de un rol de
// jefatura intermedio dedicado a Dirección Creativa (a diferencia de
// jefe_edicion para Edición). Se permite jefe_area (misma autoridad
// general que ya asigna especialista/editor en otros flujos) O que un
// lider_creativo se auto-asigne (reclame la solicitud) — nunca que
// asigne a OTRO lider_creativo, ver el chequeo en la ruta.
export async function asignarLiderCreativo(direccionCreativaId: string, liderCreativoId: string, actorId: string): Promise<ResultadoAccion> {
  return db.transaction(async (tx) => {
    const direccion = await obtenerDireccionCreativa(tx, direccionCreativaId);
    if (!direccion) return { ok: false, status: 404, error: 'Dirección creativa no encontrada' };
    const [actor]=await tx.select().from(users).where(eq(users.id,actorId));
    const [target]=await tx.select().from(users).where(eq(users.id,liderCreativoId));
    if(!target?.activo||target.rol!=='lider_creativo')return {ok:false,status:400,error:'Selecciona un Líder Creativo activo.'};
    if(!actor||!['jefe_area','lider_creativo'].includes(actor.rol)||actor.rol==='lider_creativo'&&liderCreativoId!==actorId)return {ok:false,status:403,error:'Asignación no autorizada.'};
    const currentLeader=await obtenerLiderCreativoActivo(tx,direccion.workItemId);
    if(actor.rol==='lider_creativo'&&currentLeader&&currentLeader!==actorId)return {ok:false,status:403,error:'Este trabajo pertenece a otro Líder Creativo.'};
    const [currentWork]=await tx.select().from(workItemsTable).where(eq(workItemsTable.id,direccion.workItemId));
    if(!currentWork||['completado','cancelado'].includes(currentWork.estado)||direccion.fechaCierre)return {ok:false,status:409,error:'Intervención ya resuelta.'};

    // Dependencia 5D/5E: reclamar una revisión de cubierta no permite
    // apropiarse de la revisión de otro líder ni reabrir una ya resuelta.
    if (direccion.tipo === 'revision_cubierta') {
      await tx.select().from(proyectos).where(eq(proyectos.id, direccion.proyectoId)).for('update');
      const [actor] = await tx.select().from(users).where(eq(users.id, actorId));
      const [destino] = await tx.select().from(users).where(eq(users.id, liderCreativoId));
      if (!destino?.activo || destino.rol !== 'lider_creativo') return { ok: false, status: 400, error: 'Líder creativo activo requerido' };
      const [wi] = await tx.select().from(workItemsTable).where(eq(workItemsTable.id, direccion.workItemId));
      if (wi?.estado === 'completado' || wi?.estado === 'cancelado') return { ok: false, status: 409, error: 'Revisión ya resuelta o histórica' };
      const activo = await obtenerLiderCreativoActivo(tx, direccion.workItemId);
      if (actor?.rol === 'lider_creativo' && activo && activo !== actorId) return { ok: false, status: 403, error: 'Revisión de otro líder creativo' };
    }
    const asignacion = await asignarConHistorial(tx, {
      proyectoId: direccion.proyectoId,
      workItemId: direccion.workItemId,
      tipo: 'lider_creativo',
      usuarioId: liderCreativoId,
      asignadoPorId: actorId,
    });
    if (!asignacion.cambio) return { ok: true };

    await transicionarWorkItemPorId(tx, direccion.workItemId, 'en_progreso');

    await registrarEvento(tx, {
      actorId,
      accion: 'LIDER_CREATIVO_ASIGNADO',
      entityType: 'work_item',
      entityId: direccion.workItemId,
      proyectoId: direccion.proyectoId,
      detalles: { liderCreativoId },
    });

    await tx.insert(notificaciones).values({
      proyectoId: direccion.proyectoId,
      rolDestino: 'lider_creativo',
      usuarioDestinoId: liderCreativoId,
      mensaje: 'Se te asignó una nueva Dirección Creativa.',
    });

    return { ok: true };
  });
}

export interface DatosReunionCreativa {
  fecha?: string | null;
  realizada?: boolean;
  enlaceGrabacion?: string | null;
}

export async function registrarReunionCreativa(direccionCreativaId: string, datos: DatosReunionCreativa, actorId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const direccion = await lockCreativeForLeader(tx, direccionCreativaId,actorId);
    if (!direccion) throw new Error(`Dirección creativa no encontrada: ${direccionCreativaId}`);

    await tx
      .update(direccionesCreativas)
      .set({
        fechaReunion: datos.fecha ?? direccion.fechaReunion,
        reunionRealizada: datos.realizada ?? direccion.reunionRealizada,
        enlaceGrabacion: datos.enlaceGrabacion ?? direccion.enlaceGrabacion,
      })
      .where(eq(direccionesCreativas.id, direccionCreativaId));

    await registrarEvento(tx, {
      actorId,
      accion: 'REUNION_CREATIVA_REGISTRADA',
      entityType: 'work_item',
      entityId: direccion.workItemId,
      proyectoId: direccion.proyectoId,
      detalles: { fecha: datos.fecha ?? null, realizada: datos.realizada ?? null },
    });
  });
}

export interface DatosBrief {
  briefEnlace?: string | null;
  fechaBriefEnviadoEspecialista?: string | null;
}

// Manual §4.1.1: "Lo elabora el líder creativo" — enlace al documento
// real en Drive (no se reconstruye contenido, ver comentario de la
// columna en server/db/schema/direccionCreativa.ts).
export async function registrarBrief(direccionCreativaId: string, datos: DatosBrief, actorId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const direccion = await lockCreativeForLeader(tx, direccionCreativaId,actorId);
    if (!direccion) throw new Error(`Dirección creativa no encontrada: ${direccionCreativaId}`);
    if(direccion.fechaBriefAprobadoAutor)throw new CreativeError(409,'El brief aprobado por el autor no puede reemplazarse.');
    if(datos.briefEnlace===direccion.briefEnlace&&datos.fechaBriefEnviadoEspecialista===direccion.fechaBriefEnviadoEspecialista&&!direccion.briefFeedback)return;
    if(datos.briefEnlace)await saveCreativeDelivery(tx,{projectId:direccion.proyectoId,creativeProcessId:direccion.id,type:'BRIEF',url:datos.briefEnlace,actorId});

    await tx
      .update(direccionesCreativas)
      .set({
        briefEnlace: datos.briefEnlace ?? direccion.briefEnlace,
        fechaBriefEnviadoEspecialista: datos.fechaBriefEnviadoEspecialista ?? direccion.fechaBriefEnviadoEspecialista,
        briefFeedback:null,briefFeedbackAt:null,
        ...(direccion.briefFeedback?{fechaBriefEnviadoAutor:null,fechaBriefAprobadoAutor:null}:{}),
      })
      .where(eq(direccionesCreativas.id, direccionCreativaId));

    await registrarEvento(tx, {
      actorId,
      accion: 'BRIEF_CREATIVO_GENERADO',
      entityType: 'work_item',
      entityId: direccion.workItemId,
      proyectoId: direccion.proyectoId,
    });

    const [proyecto] = await tx.select({ especialistaId: proyectos.especialistaId }).from(proyectos).where(eq(proyectos.id, direccion.proyectoId)).limit(1);
    const specialist=await obtenerEspecialistaActual(direccion.proyectoId,proyecto?.especialistaId??null,tx);
    if (specialist) {
      await tx.insert(notificaciones).values({
        proyectoId: direccion.proyectoId,
        rolDestino: 'especialista',
        usuarioDestinoId: specialist,
        mensaje: 'El brief creativo está disponible para enviarlo al autor.',
      });
    }
  });
}

export interface DatosBriefAutor {
  fechaBriefEnviadoAutor?: string | null;
  fechaBriefAprobadoAutor?: string | null;
  feedback?:string;
}

// Autor sin Portal todavía (master prompt 5C §13): el Especialista
// registra en su nombre el envío y la aprobación/feedback reales.
export async function registrarBriefAutor(direccionCreativaId: string, datos: DatosBriefAutor, actorId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const direccion = await obtenerDireccionCreativa(tx, direccionCreativaId);
    if (!direccion) throw new Error(`Dirección creativa no encontrada: ${direccionCreativaId}`);
    if(direccion.fechaCierre)throw new CreativeError(409,'La intervención está cerrada.');

    const yaAprobado = Boolean(direccion.fechaBriefAprobadoAutor);
    const nuevoAprobado = datos.feedback?null:datos.fechaBriefAprobadoAutor ?? direccion.fechaBriefAprobadoAutor;

    await tx
      .update(direccionesCreativas)
      .set({
        fechaBriefEnviadoAutor: datos.fechaBriefEnviadoAutor ?? direccion.fechaBriefEnviadoAutor,
        fechaBriefAprobadoAutor: nuevoAprobado,
        ...(datos.feedback?{briefFeedback:datos.feedback,briefFeedbackAt:new Date()}:{}),
        ...(datos.fechaBriefAprobadoAutor?{briefFeedback:null,briefFeedbackAt:null}:{}),
      })
      .where(eq(direccionesCreativas.id, direccionCreativaId));

    if(datos.feedback){
      await registrarEvento(tx,{actorId,accion:'BRIEF_FEEDBACK_AUTOR',entityType:'work_item',entityId:direccion.workItemId,proyectoId:direccion.proyectoId,detalles:{feedback:datos.feedback}});
      const leader=await obtenerLiderCreativoActivo(tx,direccion.workItemId);
      if(leader)await tx.insert(notificaciones).values({proyectoId:direccion.proyectoId,rolDestino:'lider_creativo',usuarioDestinoId:leader,mensaje:'El autor solicitó ajustes al brief creativo.'});
    }

    if (!yaAprobado && nuevoAprobado) {
      await registrarEvento(tx, {
        actorId,
        accion: 'BRIEF_CREATIVO_APROBADO',
        entityType: 'work_item',
        entityId: direccion.workItemId,
        proyectoId: direccion.proyectoId,
      });

      const liderCreativoId = await obtenerLiderCreativoActivo(tx, direccion.workItemId);
      if (liderCreativoId) {
        await tx.insert(notificaciones).values({
          proyectoId: direccion.proyectoId,
          rolDestino: 'lider_creativo',
          usuarioDestinoId: liderCreativoId,
          mensaje: 'El autor aprobó el brief — puedes iniciar la conceptualización de portadas.',
        });
      }
    }
  });
}

async function obtenerLiderCreativoActivo(tx: Tx | typeof db, workItemId: string): Promise<string | null> {
  const [fila] = await tx
    .select({ usuarioId: projectAssignments.usuarioId })
    .from(projectAssignments)
    .where(and(eq(projectAssignments.workItemId, workItemId), eq(projectAssignments.tipo, 'lider_creativo'), isNull(projectAssignments.finalizadoEn)))
    .limit(1);
  return fila?.usuarioId ?? null;
}

export interface DatosConceptoPortada {
  descripcion?: string | null;
  enlace?: string | null;
}

// Conceptos de portada (Manual §4.1.2: "El líder creativo entrega de 2
// a 3 propuestas") — REUTILIZA ficha_diseno_propuestas (master prompt
// 5C §10), solo suma direccionCreativaId para saber a qué intervención
// real pertenece cada fila (el flujo legado de SeccionDiseno.tsx sigue
// creando filas sin ese vínculo, sin tocar ese camino).
export async function agregarConceptoPortada(direccionCreativaId: string, datos: DatosConceptoPortada, actorId: string): Promise<ResultadoAccion & { id?: string }> {
  return db.transaction(async (tx) => {
    const direccion = await lockCreativeForLeader(tx, direccionCreativaId,actorId);
    if (!direccion) return { ok: false, status: 404, error: 'Dirección creativa no encontrada' };

    const gate = evaluarGateBriefAprobadoParaConceptos({ fechaBriefAprobadoAutor: direccion.fechaBriefAprobadoAutor });
    if (!gate.desbloqueado) return { ok: false, status: 400, error: gate.motivo ?? 'Gate bloqueado' };
    const existing=await tx.select().from(fichaDisenoPropuestas).where(eq(fichaDisenoPropuestas.direccionCreativaId,direccionCreativaId));
    if(existing.length>=3||existing.some(p=>p.fechaAprobadaRrpp||p.estado==='Devuelta por RRPP'||p.feedbackAutor))return {ok:false,status:409,error:'Ya se entregaron los conceptos. Usa el flujo de ajustes.'};

    const ficha = await obtenerFichaPorProyecto(direccion.proyectoId);
    const [propuesta] = await tx
      .insert(fichaDisenoPropuestas)
      .values({ fichaId: ficha.id, direccionCreativaId, descripcion: datos.descripcion, enlace: datos.enlace,estado:existing.length?'Pendiente RRPP':'Borrador' })
      .returning({ id: fichaDisenoPropuestas.id });
    if (!propuesta) throw new Error('El insert de la propuesta no devolvió ninguna fila');
    if(existing.length)await tx.update(fichaDisenoPropuestas).set({estado:'Pendiente RRPP'}).where(and(eq(fichaDisenoPropuestas.direccionCreativaId,direccionCreativaId),eq(fichaDisenoPropuestas.estado,'Borrador')));

    await registrarEvento(tx, {
      actorId,
      accion: existing.length?'CONCEPTOS_ENTREGADOS':'CONCEPTO_GUARDADO',
      entityType: 'work_item',
      entityId: direccion.workItemId,
      proyectoId: direccion.proyectoId,
      detalles: { propuestaId: propuesta.id },
    });

    if(existing.length)await tx.insert(notificaciones).values({
      proyectoId: direccion.proyectoId,
      rolDestino: 'rrpp',
      mensaje: 'Hay un concepto de portada esperando tu aprobación.',
    });

    return { ok: true, id: propuesta.id };
  });
}

export interface DatosAprobacionRrpp {
  aprobar: boolean;
  observaciones?: string | null;
}

// RRPP aprueba o devuelve (Manual §4.1.2 + GATE-05, reusado — nunca
// reimplementado: aprobar simplemente escribe el campo que GATE-05 ya
// lee). "Devolver" no borra la propuesta, solo deja observaciones para
// que el líder creativo ajuste y la vuelva a dejar lista — no hay
// evidencia de una propuesta "V2" real distinta en la fuente, el mismo
// registro se corrige en el lugar.
export async function aprobarConceptoRrpp(propuestaId: string, datos: DatosAprobacionRrpp, actorId: string): Promise<ResultadoAccion> {
  return db.transaction(async (tx) => {
    const [propuesta] = await tx.select().from(fichaDisenoPropuestas).where(eq(fichaDisenoPropuestas.id, propuestaId)).limit(1);
    if (!propuesta || !propuesta.direccionCreativaId) return { ok: false, status: 404, error: 'Concepto de portada no encontrado' };

    const direccion = await obtenerDireccionCreativa(tx, propuesta.direccionCreativaId);
    if (!direccion) return { ok: false, status: 404, error: 'Dirección creativa no encontrada' };
    if(propuesta.estado==='Borrador')return {ok:false,status:409,error:'El Líder debe entregar al menos dos conceptos antes del checkpoint.'};
    if(propuesta.fechaAprobadaAutor)return {ok:false,status:409,error:'El concepto ya fue aprobado por el autor.'};
    const [item] = await tx.select({ estado: workItemsTable.estado }).from(workItemsTable).where(eq(workItemsTable.id, direccion.workItemId));
    if (direccion.tipo !== 'concepto_portada' || direccion.fechaCierre || !item || ['completado', 'cancelado'].includes(item.estado)) {
      return { ok: false, status: 409, error: 'Esta intervención no admite aprobación de conceptos por RRPP' };
    }

    await tx
      .update(fichaDisenoPropuestas)
      .set({
        fechaAprobadaRrpp: datos.aprobar ? new Date().toISOString().slice(0, 10) : null,
        estado: datos.aprobar ? 'Aprobada por RRPP' : 'Devuelta por RRPP',
        feedbackRrpp:datos.aprobar?null:datos.observaciones??null,
      })
      .where(eq(fichaDisenoPropuestas.id, propuestaId));

    await registrarEvento(tx, {
      actorId,
      accion: datos.aprobar ? 'CONCEPTO_APROBADO_RRPP' : 'CONCEPTO_DEVUELTO_RRPP',
      entityType: 'work_item',
      entityId: direccion.workItemId,
      proyectoId: direccion.proyectoId,
      detalles: { propuestaId,observaciones:datos.observaciones??null },
    });

    if (datos.aprobar) {
      const [proyecto] = await tx.select({ especialistaId: proyectos.especialistaId }).from(proyectos).where(eq(proyectos.id, direccion.proyectoId)).limit(1);
      if (proyecto?.especialistaId) {
        await tx.insert(notificaciones).values({
          proyectoId: direccion.proyectoId,
          rolDestino: 'especialista',
          usuarioDestinoId: proyecto.especialistaId,
          mensaje: 'RRPP aprobó un concepto de portada — ya puedes enviarlo al autor.',
        });
      }
    } else {
      const liderCreativoId = await obtenerLiderCreativoActivo(tx, direccion.workItemId);
      if (liderCreativoId) {
        await tx.insert(notificaciones).values({
          proyectoId: direccion.proyectoId,
          rolDestino: 'lider_creativo',
          usuarioDestinoId: liderCreativoId,
          mensaje: 'RRPP devolvió un concepto de portada — revisa las observaciones.',
        });
      }
    }

    return { ok: true };
  });
}

export interface DatosConceptoAutor {
  fechaEnviadaAutor?: string | null;
  fechaAprobadaAutor?: string | null;
  estado?: string | null;
  feedback?:string;
}

// GATE-05 (reusado, no reimplementado): sin fechaAprobadaRrpp no se
// puede marcar fechaEnviadaAutor. Autor sin Portal — el Especialista
// registra en su nombre (5C §13), mismo criterio que registrarBriefAutor.
export async function registrarConceptoAutor(propuestaId: string, datos: DatosConceptoAutor, actorId: string): Promise<ResultadoAccion> {

  return db.transaction(async (tx) => {
    const [propuesta] = await tx.select().from(fichaDisenoPropuestas).where(eq(fichaDisenoPropuestas.id, propuestaId)).limit(1);
    if (!propuesta || !propuesta.direccionCreativaId) return { ok: false, status: 404, error: 'Concepto de portada no encontrado' };

    if (datos.fechaEnviadaAutor || datos.fechaAprobadaAutor || datos.feedback) {
      const gate = evaluarGateAprobacionPortadaRrpp({ fechaAprobadaRrpp: propuesta.fechaAprobadaRrpp });
      if (!gate.desbloqueado) return { ok: false, status: 400, error: gate.motivo ?? 'Gate bloqueado' };
    }

    const direccion = await obtenerDireccionCreativa(tx, propuesta.direccionCreativaId);
    if (!direccion) return { ok: false, status: 404, error: 'Dirección creativa no encontrada' };
    if(direccion.fechaCierre)return {ok:false,status:409,error:'La intervención está cerrada.'};

    const yaAprobado = Boolean(propuesta.fechaAprobadaAutor);
    const nuevoAprobado = datos.feedback?null:datos.fechaAprobadaAutor ?? propuesta.fechaAprobadaAutor;

    await tx
      .update(fichaDisenoPropuestas)
      .set({
        fechaEnviadaAutor: datos.fechaEnviadaAutor ?? propuesta.fechaEnviadaAutor,
        fechaAprobadaAutor: nuevoAprobado,
        estado: datos.feedback?'Feedback del autor':datos.fechaAprobadaAutor?'Aprobada por autor':datos.estado ?? propuesta.estado,
        ...(datos.feedback?{feedbackAutor:datos.feedback}:{}),
      })
      .where(eq(fichaDisenoPropuestas.id, propuestaId));

    if(datos.feedback){
      await registrarEvento(tx,{actorId,accion:'CONCEPTO_FEEDBACK_AUTOR',entityType:'work_item',entityId:direccion.workItemId,proyectoId:direccion.proyectoId,detalles:{propuestaId,feedback:datos.feedback}});
      const leader=await obtenerLiderCreativoActivo(tx,direccion.workItemId);
      if(leader)await tx.insert(notificaciones).values({proyectoId:direccion.proyectoId,rolDestino:'lider_creativo',usuarioDestinoId:leader,mensaje:'El autor solicitó ajustes a un concepto de portada.'});
    }

    if (!yaAprobado && nuevoAprobado) {
      await registrarEvento(tx, {
        actorId,
        accion: 'CONCEPTO_APROBADO_AUTOR',
        entityType: 'work_item',
        entityId: direccion.workItemId,
        proyectoId: direccion.proyectoId,
        detalles: { propuestaId },
      });

      const liderCreativoId = await obtenerLiderCreativoActivo(tx, direccion.workItemId);
      if (liderCreativoId) {
        await tx.insert(notificaciones).values({
          proyectoId: direccion.proyectoId,
          rolDestino: 'lider_creativo',
          usuarioDestinoId: liderCreativoId,
          mensaje: 'El autor aprobó un concepto de portada — por favor envía los recursos (imagen y PDF).',
        });
      }
    }

    return { ok: true };
  });
}

export interface DatosRecursosCreativos {
  recursoImagenUrl?: string | null;
  recursoConceptoPdfUrl?: string | null;
}

// Entregables del líder creativo tras concepto aprobado (Manual §4.1.2):
// "Imagen de freepik. Concepto de portada en PDF." Gate inline (no
// número propio: es la misma condición de GATE-05+aprobación de autor
// ya verificada por registrarConceptoAutor, no una regla nueva) —
// exige al menos una propuesta de esta intervención con fechaAprobadaAutor.
export async function registrarRecursosCreativos(direccionCreativaId: string, datos: DatosRecursosCreativos, actorId: string): Promise<ResultadoAccion> {
  return db.transaction(async (tx) => {
    const direccion = await lockCreativeForLeader(tx, direccionCreativaId,actorId,true);
    if (!direccion) return { ok: false, status: 404, error: 'Dirección creativa no encontrada' };
    const image=datos.recursoImagenUrl??direccion.recursoImagenUrl,pdf=datos.recursoConceptoPdfUrl??direccion.recursoConceptoPdfUrl;
    if(direccion.fechaCierre){
      if(image===direccion.recursoImagenUrl&&pdf===direccion.recursoConceptoPdfUrl)return {ok:true};
      return {ok:false,status:409,error:'Los recursos de la intervención cerrada no pueden reemplazarse.'};
    }

    const propuestasAprobadas = await tx
      .select({ id: fichaDisenoPropuestas.id })
      .from(fichaDisenoPropuestas)
      .where(and(eq(fichaDisenoPropuestas.direccionCreativaId, direccionCreativaId), isNotNull(fichaDisenoPropuestas.fechaAprobadaAutor)));
    if (propuestasAprobadas.length === 0) {
      return { ok: false, status: 400, error: 'Todavía no hay ningún concepto aprobado por el autor' };
    }
    for(const [type,url] of [['CONCEPT_IMAGE',image],['CONCEPT_PDF',pdf]] as const)if(url)await saveCreativeDelivery(tx,{projectId:direccion.proyectoId,creativeProcessId:direccion.id,conceptId:propuestasAprobadas[0]!.id,type,url,actorId});

    await tx
      .update(direccionesCreativas)
      .set({
        recursoImagenUrl: datos.recursoImagenUrl ?? direccion.recursoImagenUrl,
        recursoConceptoPdfUrl: datos.recursoConceptoPdfUrl ?? direccion.recursoConceptoPdfUrl,
      })
      .where(eq(direccionesCreativas.id, direccionCreativaId));

    if(image&&pdf){
      await tx.update(direccionesCreativas).set({resultadoFinal:'aprobado',fechaCierre:new Date().toISOString().slice(0,10)}).where(eq(direccionesCreativas.id,direccion.id));
      await transicionarWorkItemPorId(tx,direccion.workItemId,'completado');
      await registrarEvento(tx,{actorId,accion:'DIRECCION_CREATIVA_CERRADA',entityType:'work_item',entityId:direccion.workItemId,proyectoId:direccion.proyectoId,detalles:{resultadoFinal:'aprobado',reason:'Recursos completos del concepto aprobado'}});
      const [p]=await tx.select({especialistaId:proyectos.especialistaId}).from(proyectos).where(eq(proyectos.id,direccion.proyectoId));
      const specialist=await obtenerEspecialistaActual(direccion.proyectoId,p?.especialistaId??null,tx);
      if(specialist)await tx.insert(notificaciones).values({proyectoId:direccion.proyectoId,rolDestino:'especialista',usuarioDestinoId:specialist,mensaje:'Los recursos del concepto aprobado están listos para coordinar Diseño.'});
    }

    await registrarEvento(tx, {
      actorId,
      accion: 'RECURSOS_CREATIVOS_ENTREGADOS',
      entityType: 'work_item',
      entityId: direccion.workItemId,
      proyectoId: direccion.proyectoId,
    });

    return { ok: true };
  });
}

export interface DatosCierreCreativo {
  resultadoFinal: 'aprobado' | 'rechazado';
  observaciones?: string | null;
}

export async function cerrarDireccionCreativa(direccionCreativaId: string, datos: DatosCierreCreativo, actorId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const direccion = await obtenerDireccionCreativa(tx, direccionCreativaId);
    if (!direccion) throw new Error(`Dirección creativa no encontrada: ${direccionCreativaId}`);
    if(direccion.fechaCierre&&direccion.resultadoFinal===datos.resultadoFinal)return;

    const fechaCierre = new Date().toISOString().slice(0, 10);
    await tx
      .update(direccionesCreativas)
      .set({ resultadoFinal: datos.resultadoFinal, observaciones: datos.observaciones ?? direccion.observaciones, fechaCierre })
      .where(eq(direccionesCreativas.id, direccionCreativaId));

    await transicionarWorkItemPorId(tx, direccion.workItemId, 'completado');

    await registrarEvento(tx, {
      actorId,
      accion: 'DIRECCION_CREATIVA_CERRADA',
      entityType: 'work_item',
      entityId: direccion.workItemId,
      proyectoId: direccion.proyectoId,
      detalles: { resultadoFinal: datos.resultadoFinal },
    });
  });
}

export type AccesoDireccionCreativa = { ok: true } | { ok: false; status: 404 | 403; error: string };

// Ownership a nivel de INTERVENCIÓN (igual que correcciones): el
// Especialista dueño del proyecto siempre puede, el lider_creativo solo
// si es quien tiene el assignment activo de ESTA intervención puntual
// (no "cualquiera con el rol").
export async function verificarAccesoADireccionCreativa(direccionCreativaId: string, usuario: { id: string; rol: Rol }): Promise<AccesoDireccionCreativa> {
  const [fila] = await db
    .select({ workItemId: direccionesCreativas.workItemId, especialistaId: proyectos.especialistaId,projectId:proyectos.id })
    .from(direccionesCreativas)
    .innerJoin(proyectos, eq(direccionesCreativas.proyectoId, proyectos.id))
    .where(eq(direccionesCreativas.id, direccionCreativaId))
    .limit(1);

  if (!fila) return { ok: false, status: 404, error: 'Dirección creativa no encontrada' };

  if (usuario.rol === 'jefe_area') return { ok: true };
  if (usuario.rol === 'especialista') {
    return await obtenerEspecialistaActual(fila.projectId,fila.especialistaId) === usuario.id ? { ok: true } : { ok: false, status: 403, error: 'No autorizado para esta dirección creativa' };
  }
  if (usuario.rol === 'lider_creativo') {
    const liderActivo = await obtenerLiderCreativoActivo(db, fila.workItemId);
    return liderActivo === usuario.id ? { ok: true } : { ok: false, status: 403, error: 'No autorizado para esta dirección creativa' };
  }
  return { ok: false, status: 403, error: 'No autorizado para esta dirección creativa' };
}

export interface DireccionCreativaDeProyecto {
  id: string;
  tipo: string;
  fechaSolicitud: string | null;
  fechaReunion: string | null;
  reunionRealizada: boolean;
  enlaceGrabacion: string | null;
  briefEnlace: string | null;
  fechaBriefEnviadoEspecialista: string | null;
  fechaBriefEnviadoAutor: string | null;
  fechaBriefAprobadoAutor: string | null;
  recursoImagenUrl: string | null;
  recursoConceptoPdfUrl: string | null;
  resultadoFinal: string | null;
  fechaCierre: string | null;
  observaciones: string | null;
  estado: string;
  liderCreativoId: string | null;
}

async function conLiderCreativo<T extends { workItemId: string }>(filas: T[]): Promise<(T & { liderCreativoId: string | null })[]> {
  return Promise.all(filas.map(async (fila) => ({ ...fila, liderCreativoId: await obtenerLiderCreativoActivo(db, fila.workItemId) })));
}

export async function listarDireccionesCreativasDeProyecto(proyectoId: string): Promise<DireccionCreativaDeProyecto[]> {
  const filas = await db
    .select({
      id: direccionesCreativas.id,
      workItemId: direccionesCreativas.workItemId,
      tipo: direccionesCreativas.tipo,
      fechaSolicitud: direccionesCreativas.fechaSolicitud,
      fechaReunion: direccionesCreativas.fechaReunion,
      reunionRealizada: direccionesCreativas.reunionRealizada,
      enlaceGrabacion: direccionesCreativas.enlaceGrabacion,
      briefEnlace: direccionesCreativas.briefEnlace,
      fechaBriefEnviadoEspecialista: direccionesCreativas.fechaBriefEnviadoEspecialista,
      fechaBriefEnviadoAutor: direccionesCreativas.fechaBriefEnviadoAutor,
      fechaBriefAprobadoAutor: direccionesCreativas.fechaBriefAprobadoAutor,
      recursoImagenUrl: direccionesCreativas.recursoImagenUrl,
      recursoConceptoPdfUrl: direccionesCreativas.recursoConceptoPdfUrl,
      resultadoFinal: direccionesCreativas.resultadoFinal,
      fechaCierre: direccionesCreativas.fechaCierre,
      observaciones: direccionesCreativas.observaciones,
      estado: workItemsTable.estado,
    })
    .from(direccionesCreativas)
    .innerJoin(workItemsTable, eq(direccionesCreativas.workItemId, workItemsTable.id))
    .where(eq(direccionesCreativas.proyectoId, proyectoId))
    .orderBy(desc(direccionesCreativas.createdAt));

  const conLider = await conLiderCreativo(filas);
  return conLider.map(({ workItemId, ...resto }) => resto);
}

export interface PropuestaDeDireccionCreativa {
  id: string;
  descripcion: string | null;
  enlace: string | null;
  estado: string | null;
  fechaAprobadaRrpp: string | null;
  fechaEnviadaAutor: string | null;
  fechaAprobadaAutor: string | null;
  feedbackRrpp:string|null;
  feedbackAutor:string|null;
  createdAt: Date;
}

export async function listarPropuestasDeDireccionCreativa(direccionCreativaId: string): Promise<PropuestaDeDireccionCreativa[]> {
  return db
    .select({
      id: fichaDisenoPropuestas.id,
      descripcion: fichaDisenoPropuestas.descripcion,
      enlace: fichaDisenoPropuestas.enlace,
      estado: fichaDisenoPropuestas.estado,
      fechaAprobadaRrpp: fichaDisenoPropuestas.fechaAprobadaRrpp,
      fechaEnviadaAutor: fichaDisenoPropuestas.fechaEnviadaAutor,
      fechaAprobadaAutor: fichaDisenoPropuestas.fechaAprobadaAutor,
      feedbackRrpp:fichaDisenoPropuestas.feedbackRrpp,
      feedbackAutor:fichaDisenoPropuestas.feedbackAutor,
      createdAt: fichaDisenoPropuestas.createdAt,
    })
    .from(fichaDisenoPropuestas)
    .where(eq(fichaDisenoPropuestas.direccionCreativaId, direccionCreativaId))
    .orderBy(desc(fichaDisenoPropuestas.createdAt));
}

export interface TrabajoLiderCreativo extends DireccionCreativaDeProyecto {
  proyectoId: string;
  proyectoCodigo: string;
  autorNombre: string;
}

// "¿Qué necesita mi atención hoy?" (master prompt 5C §24) — por líder
// creativo asignado, cruzando proyectos (mismo criterio que
// listarMisCorrecciones).
export async function listarMisDireccionesCreativas(liderCreativoId: string): Promise<TrabajoLiderCreativo[]> {
  const filas = await db
    .select({
      id: direccionesCreativas.id,
      workItemId: direccionesCreativas.workItemId,
      tipo: direccionesCreativas.tipo,
      fechaSolicitud: direccionesCreativas.fechaSolicitud,
      fechaReunion: direccionesCreativas.fechaReunion,
      reunionRealizada: direccionesCreativas.reunionRealizada,
      enlaceGrabacion: direccionesCreativas.enlaceGrabacion,
      briefEnlace: direccionesCreativas.briefEnlace,
      fechaBriefEnviadoEspecialista: direccionesCreativas.fechaBriefEnviadoEspecialista,
      fechaBriefEnviadoAutor: direccionesCreativas.fechaBriefEnviadoAutor,
      fechaBriefAprobadoAutor: direccionesCreativas.fechaBriefAprobadoAutor,
      recursoImagenUrl: direccionesCreativas.recursoImagenUrl,
      recursoConceptoPdfUrl: direccionesCreativas.recursoConceptoPdfUrl,
      resultadoFinal: direccionesCreativas.resultadoFinal,
      fechaCierre: direccionesCreativas.fechaCierre,
      observaciones: direccionesCreativas.observaciones,
      estado: workItemsTable.estado,
      proyectoId: proyectos.id,
      proyectoCodigo: proyectos.codigo,
      autorNombre: autores.nombre,
    })
    .from(projectAssignments)
    .innerJoin(direccionesCreativas, eq(projectAssignments.workItemId, direccionesCreativas.workItemId))
    .innerJoin(workItemsTable, eq(direccionesCreativas.workItemId, workItemsTable.id))
    .innerJoin(proyectos, eq(direccionesCreativas.proyectoId, proyectos.id))
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .where(
      and(
        eq(projectAssignments.usuarioId, liderCreativoId),
        eq(projectAssignments.tipo, 'lider_creativo'),
        isNull(projectAssignments.finalizadoEn),
        ne(workItemsTable.estado, 'cancelado'),
      ),
    )
    .orderBy(desc(direccionesCreativas.createdAt));

  return filas.map((fila) => ({ ...fila, liderCreativoId }));
}

export interface PropuestaPendienteRrpp {
  workItemEstado: string;
  estado: string | null;
  tipo: string;
  fechaCierre: string | null;
  propuestaId: string;
  direccionCreativaId: string;
  proyectoId: string;
  proyectoCodigo: string;
  autorNombre: string;
  descripcion: string | null;
  enlace: string | null;
  createdAt: Date;
}

// Bandeja "PENDIENTE DE APROBACIÓN CREATIVA" de RRPP (master prompt 5C
// §12/§27): createdAt de la propuesta ES el momento en que el líder
// creativo la entregó (no hay un campo "enviada a RRPP" separado — ver
// comentario en agregarConceptoPortada), así que sirve directamente
// como "fecha"/"antigüedad" sin inventar otra columna.
export async function listarPropuestasPendientesRrpp(): Promise<PropuestaPendienteRrpp[]> {
  return db
    .select({
      estado: fichaDisenoPropuestas.estado,
      workItemEstado: workItemsTable.estado,
      tipo: direccionesCreativas.tipo,
      fechaCierre: direccionesCreativas.fechaCierre,
      propuestaId: fichaDisenoPropuestas.id,
      direccionCreativaId: direccionesCreativas.id,
      proyectoId: proyectos.id,
      proyectoCodigo: proyectos.codigo,
      autorNombre: autores.nombre,
      descripcion: fichaDisenoPropuestas.descripcion,
      enlace: fichaDisenoPropuestas.enlace,
      createdAt: fichaDisenoPropuestas.createdAt,
    })
    .from(fichaDisenoPropuestas)
    .innerJoin(direccionesCreativas, eq(fichaDisenoPropuestas.direccionCreativaId, direccionesCreativas.id))
    .innerJoin(workItemsTable, eq(direccionesCreativas.workItemId, workItemsTable.id))
    .innerJoin(proyectos, eq(direccionesCreativas.proyectoId, proyectos.id))
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .where(and(isNull(fichaDisenoPropuestas.fechaAprobadaRrpp),sql`coalesce(${fichaDisenoPropuestas.estado},'') not in ('Borrador','Devuelta por RRPP')`,isNull(direccionesCreativas.fechaCierre),sql`${workItemsTable.estado} not in ('completado','cancelado')`))
    .orderBy(fichaDisenoPropuestas.createdAt);
}
