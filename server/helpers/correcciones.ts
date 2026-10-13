import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import { db } from '../db/client.js';
import type { Rol } from '../db/schema/index.js';
import { autores, contratosCorreccion, correcciones, decisiones, notificaciones, projectAssignments, proyectos, servicios, users, workItems as workItemsTable } from '../db/schema/index.js';
import { obtenerEspecialistaActual } from './carga.js';
import { asignarConHistorial } from './assignments.js';
import { registrarEvento } from './auditLog.js';
import {
  type AlcanceCorreccion,
  calcularDueAtCorreccion,
  type EstadoPlazoCorreccion,
  evaluarPlazoCorreccion,
  requiereRevisionPreviaPorPaginas,
} from './correccionSla.js';
import { crearDecisionRevisionPrevia } from './decisiones.js';
import { evaluarGateRevisionPreviaCorreccion } from './gates.js';
import type { Tx } from './tx.js';
import { crearWorkItemSiNoExiste, transicionarWorkItemPorId } from './workItems.js';

async function obtenerCorreccion(tx: Tx, correccionId: string) {
  const [fila] = await tx.select().from(correcciones).where(eq(correcciones.id, correccionId)).limit(1).for('update');
  return fila;
}

// businessKey del work_item 'correccion' para esta intervención — el
// alcance identifica la instancia (ej. 'tripa_completa'); una segunda
// ronda del MISMO alcance (ej. re-corrección tras un resultado
// "Deficiente") suma un sufijo numérico. Nunca una label de UI (Fase 5,
// master prompt §8) — siempre el alcance real + un contador.
async function siguienteBusinessKeyCorreccion(tx: Tx, proyectoId: string, alcance: AlcanceCorreccion): Promise<{ businessKey: string; abiertaExistente: string | null }> {
  const filas = await tx
    .select({ id: correcciones.id, businessKey: correcciones.alcance, workItemId: correcciones.workItemId })
    .from(correcciones)
    .innerJoin(proyectos, eq(correcciones.proyectoId, proyectos.id))
    .where(eq(correcciones.proyectoId, proyectoId));

  // Esta consulta no filtra por alcance en SQL (no hay índice por eso,
  // el volumen por proyecto es mínimo) — se filtra en memoria.
  const previas = filas.filter((f) => f.businessKey === alcance || f.businessKey.startsWith(`${alcance}-`));

  // Idempotencia real (master prompt §26): si ya existe una intervención
  // de este alcance que NO está cerrada (completado/cancelado), no se
  // crea una segunda — se devuelve la existente.
  for (const previa of previas) {
    const [wi] = await tx.select({ estado: workItemsTable.estado }).from(workItemsTable).where(eq(workItemsTable.id, previa.workItemId)).limit(1);
    if (wi && wi.estado !== 'completado' && wi.estado !== 'cancelado') {
      return { businessKey: previa.businessKey, abiertaExistente: previa.id };
    }
  }

  if (previas.length === 0) return { businessKey: alcance, abiertaExistente: null };
  // Todas las previas de este alcance ya cerraron — nueva ronda real.
  return { businessKey: `${alcance}-${previas.length + 1}`, abiertaExistente: null };
}

export interface DatosSolicitarCorreccion {
  alcance: AlcanceCorreccion;
  paginas?: number | null;
}

// Paso 1 del flujo real (Manual §3.1 "Se ubica un corrector..."): el
// Especialista identifica la necesidad. Idempotente por alcance abierto
// (ver siguienteBusinessKeyCorreccion) — pedirlo dos veces para el
// mismo alcance mientras uno está en curso devuelve la misma fila, no
// duplica work item ni notificación.
export async function solicitarCorreccion(proyectoId: string, datos: DatosSolicitarCorreccion, actorId: string): Promise<{ id: string; nueva: boolean }> {
  return db.transaction(async (tx) => {
    const [proyecto] = await tx.select({ id: proyectos.id }).from(proyectos).where(eq(proyectos.id, proyectoId)).limit(1).for('update');
    if (!proyecto) throw new Error(`Proyecto no encontrado: ${proyectoId}`);

    const { businessKey, abiertaExistente } = await siguienteBusinessKeyCorreccion(tx, proyectoId, datos.alcance);
    if (abiertaExistente) {
      // Older native requests gain the same decision when their authorized
      // requester retries; the correction/work item itself is never duplicated.
      const [actual]=await tx.select().from(correcciones).where(eq(correcciones.id,abiertaExistente));
      if(actual?.requiereRevisionPrevia && !actual.revisionPreviaConfirmada && actual.alcance==='tripa_completa' && actual.paginas!==null) {
        await crearDecisionRevisionPrevia(tx,{proyectoId,correccionId:actual.id,workItemId:actual.workItemId,requestedByUserId:actorId,paginas:actual.paginas});
      }
      return { id: abiertaExistente, nueva: false };
    }

    const workItemId = await crearWorkItemSiNoExiste(tx, { proyectoId, tipo: 'correccion', businessKey });

    const requiereRevisionPrevia = datos.alcance === 'tripa_completa' && requiereRevisionPreviaPorPaginas(datos.paginas);

    const [creada] = await tx
      .insert(correcciones)
      .values({
        proyectoId,
        workItemId,
        alcance: datos.alcance,
        paginas: datos.paginas ?? null,
        requiereRevisionPrevia,
      })
      .returning({ id: correcciones.id });
    if (!creada) throw new Error('El insert de correcciones no devolvió ninguna fila');

    await registrarEvento(tx, {
      actorId,
      accion: 'CORRECCION_SOLICITADA',
      entityType: 'work_item',
      entityId: workItemId,
      proyectoId,
      detalles: { alcance: datos.alcance, paginas: datos.paginas ?? null, requiereRevisionPrevia },
    });

    // GATE-06 (Jefatura · Decisiones, docs/arquitectura/17-jefatura-decisiones.md):
    // si la tripa supera 120 páginas, el caso queda expuesto para
    // Jefatura DESDE que se solicita la corrección -- no se espera a
    // que el Especialista intente asignar corrector para recién ahí
    // avisar. Misma transacción, idempotente por originCorreccionId.
    if (requiereRevisionPrevia) {
      await crearDecisionRevisionPrevia(tx, {
        proyectoId,
        correccionId: creada.id,
        workItemId,
        requestedByUserId: actorId,
        paginas: datos.paginas!,
      });
    }

    return { id: creada.id, nueva: true };
  });
}

export interface DatosAsignarCorrector {
  correctorId?: string | null;
  correctorNombre?: string | null;
  freelance: boolean;
  contratoConfirmado: boolean;
}

export type ResultadoAsignacion = { ok: true } | { ok: false; status: 400 | 403 | 409; error: string };

// Paso 2 (Manual §3.1, hasta "se realiza la asignación formal por
// correo electrónico al corrector"): lo decide el propio Especialista
// (a diferencia de Edición, acá no hay jefatura intermedia — confirmado
// contra el Manual, no asumido). dueAt se deriva centralmente del SLA
// por alcance (server/helpers/correccionSla.ts), nunca en el frontend.
//
// EXCEPCIÓN real desde Jefatura · Decisiones (docs/arquitectura/
// 17-jefatura-decisiones.md): cuando `requiereRevisionPrevia` es true
// (>120 páginas), el Especialista ya NO puede autoconfirmar la revisión
// previa acá -- ese booleano ahora SOLO lo escribe la resolución de la
// decisión correspondiente (server/helpers/decisiones.ts,
// resolverDecision). Este endpoint solo LEE `correccion.revisionPreviaConfirmada`
// tal cual está en la base; nunca la recibe del cliente.
export async function asignarCorrector(correccionId: string, datos: DatosAsignarCorrector, actorId: string): Promise<ResultadoAsignacion> {
  if (!datos.correctorId && !datos.correctorNombre?.trim()) {
    return { ok: false, status: 400, error: 'Debe indicarse un corrector (interno o freelance)' };
  }

  return db.transaction(async (tx) => {
    const [origen] = await tx.select({proyectoId:correcciones.proyectoId}).from(correcciones).where(eq(correcciones.id,correccionId));
    if(!origen)return {ok:false,status:400,error:'Corrección no encontrada'};
    const [p] = await tx.select().from(proyectos).where(eq(proyectos.id,origen.proyectoId)).for('update');
    if(!p || await obtenerEspecialistaActual(p.id,p.especialistaId,tx)!==actorId)return {ok:false,status:403,error:'Proyecto de otro especialista'};
    if(['culminado','retirado'].includes(p.estado))return {ok:false,status:409,error:'Proyecto cerrado'};
    const correccion = await obtenerCorreccion(tx, correccionId);
    if (!correccion) return { ok: false, status: 400, error: 'Corrección no encontrada' };

    // Reasignación (master prompt §27): ya había un corrector distinto
    // asignado antes — el historial de quién estuvo antes vive en
    // project_assignments (asignarConHistorial lo cierra más abajo), acá
    // solo cambia qué evento de auditoría se registra.
    const esReasignacion = Boolean(correccion.correctorId || correccion.correctorNombre) && correccion.fechaAsignada !== null;

    const gate = evaluarGateRevisionPreviaCorreccion({
      requiereRevisionPrevia: correccion.requiereRevisionPrevia,
      revisionPreviaConfirmada: correccion.revisionPreviaConfirmada,
    });
    if (!gate.desbloqueado) return { ok: false, status: 400, error: gate.motivo ?? 'Gate bloqueado' };

    const [contrato] = await tx.select().from(contratosCorreccion).where(eq(contratosCorreccion.correccionId,correccionId)).orderBy(desc(contratosCorreccion.ronda)).limit(1);
    if(datos.freelance && !contrato && !correccion.contratoConfirmado)return {ok:false,status:409,error:'Solicita el contrato a Talento Humano y espera su confirmación antes de asignar al freelance'};
    if(contrato && (contrato.estado!=='resuelta' || !datos.freelance || datos.correctorId || datos.correctorNombre?.trim()!==contrato.correctorNombre))return {ok:false,status:409,error:'El contrato de Talento debe estar confirmado para este corrector antes de formalizar la asignación'};

    const ahora = new Date();
    if (datos.correctorId) {
      const [persona] = await tx.select().from(users).where(eq(users.id, datos.correctorId));
      if (!persona?.activo || persona.rol !== 'corrector') return { ok: false, status: 400, error: 'Seleccione un Corrector activo' };
    }
    const fechaAsignada = ahora.toISOString().slice(0, 10);
    const alcance = correccion.alcance as AlcanceCorreccion;
    // Instante real de la asignación (no solo la fecha) como base del
    // cálculo — ver el comentario de calcularDueAtCorreccion: un SLA de
    // 12h necesita saber la hora exacta, no solo el día.
    const dueAt = new Date(calcularDueAtCorreccion(ahora.toISOString(), alcance));

    await tx
      .update(correcciones)
      .set({
        correctorId: datos.correctorId ?? null,
        correctorNombre: datos.correctorId ? null : (datos.correctorNombre?.trim() ?? null),
        freelance: datos.freelance,
        contratoConfirmado: contrato ? true : correccion.contratoConfirmado,
        fechaAsignada,
        asignadoEn: correccion.asignadoEn ?? ahora,
        dueAt,
      })
      .where(eq(correcciones.id, correccionId));

    // El historial de assignments (proposito='corrector') solo tiene
    // sentido para un corrector con cuenta de sistema — un freelance sin
    // usuarioId no puede modelarse ahí (FK NOT NULL a usuarios).
    if (datos.correctorId) {
      await asignarConHistorial(tx, {
        proyectoId: correccion.proyectoId,
        workItemId: correccion.workItemId,
        tipo: 'corrector',
        usuarioId: datos.correctorId,
        asignadoPorId: actorId,
      });
    } else {
      // Un externo sin cuenta no puede abrir un assignment FK. La asignación
      // interna anterior sí debe finalizar para no mostrar ownership obsoleto.
      await tx.update(projectAssignments).set({finalizadoEn: ahora,motivoFin:'Reasignado a corrector externo'})
        .where(and(eq(projectAssignments.workItemId,correccion.workItemId),eq(projectAssignments.tipo,'corrector'),isNull(projectAssignments.finalizadoEn)));
    }

    await transicionarWorkItemPorId(tx, correccion.workItemId, 'en_progreso');

    await registrarEvento(tx, {
      actorId,
      accion: esReasignacion ? 'CORRECTOR_REASIGNADO' : 'CORRECTOR_ASIGNADO',
      entityType: 'work_item',
      entityId: correccion.workItemId,
      proyectoId: correccion.proyectoId,
      detalles: { anteriorCorrectorId: correccion.correctorId, anteriorCorrectorNombre: correccion.correctorNombre, correctorId: datos.correctorId ?? null, correctorNombre: datos.correctorNombre ?? null, freelance: datos.freelance, dueAt },
    });

    if (datos.correctorId) {
      await tx.insert(notificaciones).values({
        proyectoId: correccion.proyectoId,
        rolDestino: 'corrector',
        usuarioDestinoId: datos.correctorId,
        mensaje: esReasignacion ? 'Se te reasignó una corrección.' : 'Se te asignó una nueva corrección.',
      });
    }

    return { ok: true };
  });
}

export async function marcarInicioCorreccion(correccionId: string, fecha: string | undefined, actorId: string, motivo?: string): Promise<void> {
  await db.transaction(async (tx) => {
    const correccion = await obtenerCorreccion(tx, correccionId);
    if (!correccion) throw new Error(`Corrección no encontrada: ${correccionId}`);
    if (correccion.fechaInicio) return; // Idempotente: ya estaba iniciada.

    const ahora = new Date();
    const diaActual = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(ahora);
    // Llamadas nuevas registran el instante real. Un DATE histórico conserva
    // su precisión original y nunca se convierte en una hora ficticia.
    const iniciadoEn = !fecha || fecha === diaActual ? ahora : null;
    await tx.update(correcciones).set({ fechaInicio: fecha ?? diaActual, iniciadoEn }).where(eq(correcciones.id, correccionId));

    await registrarEvento(tx, {
      actorId,
      accion: 'CORRECCION_INICIADA',
      entityType: 'work_item',
      entityId: correccion.workItemId,
      proyectoId: correccion.proyectoId,
      detalles: { fechaInicio: fecha ?? diaActual, iniciadoEn: iniciadoEn?.toISOString() ?? null, motivo: motivo ?? null, antes: { fechaInicio: correccion.fechaInicio, iniciadoEn: correccion.iniciadoEn } },
    });
  });
}

export interface DatosEntregaCorreccion {
  fecha?: string;
  entregadoEn?: string;
  motivo?: string;
  controlCambiosUrl?: string | null;
  informeTecnicoUrl?: string | null;
}

export async function registrarEntregaCorreccion(correccionId: string, datos: DatosEntregaCorreccion, actorId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [correccion] = await tx.select().from(correcciones).where(eq(correcciones.id, correccionId)).for('update');
    if (!correccion) throw new Error(`Corrección no encontrada: ${correccionId}`);
    if (correccion.fechaEntrega) return; // Retry no modifica el hecho histórico ni duplica avisos.
    const ahora = new Date();
    const diaActual = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(ahora);
    const entregadoEn = datos.entregadoEn ? new Date(datos.entregadoEn) : datos.fecha && datos.fecha !== diaActual ? null : ahora;

    await tx
      .update(correcciones)
      .set({
        entregadoEn,
        fechaEntrega: datos.fecha ?? new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(entregadoEn ?? ahora),
        controlCambiosUrl: datos.controlCambiosUrl ?? correccion.controlCambiosUrl,
        informeTecnicoUrl: datos.informeTecnicoUrl ?? correccion.informeTecnicoUrl,
      })
      .where(eq(correcciones.id, correccionId));

    await transicionarWorkItemPorId(tx, correccion.workItemId, 'completado');

    await registrarEvento(tx, {
      actorId,
      accion: 'CORRECCION_ENTREGADA',
      entityType: 'work_item',
      entityId: correccion.workItemId,
      proyectoId: correccion.proyectoId,
      detalles: { fechaEntrega: datos.fecha ?? diaActual, entregadoEn: entregadoEn?.toISOString() ?? null, motivo: datos.motivo ?? null, antes: {fechaEntrega: correccion.fechaEntrega, entregadoEn: correccion.entregadoEn} },
    });

    const [proyecto] = await tx.select({ especialistaId: proyectos.especialistaId }).from(proyectos).where(eq(proyectos.id, correccion.proyectoId)).limit(1);
    if (proyecto?.especialistaId) {
      await tx.insert(notificaciones).values({
        proyectoId: correccion.proyectoId,
        rolDestino: 'especialista',
        usuarioDestinoId: proyecto.especialistaId,
        mensaje: 'Corrección entregada — lista para tu revisión de cierre.',
      });
    }
  });
}

export interface DatosCerrarCorreccion {
  resultado: 'buena' | 'regular' | 'deficiente';
  observaciones?: string | null;
}

// Paso final (Manual §... "Especialista continúa coordinación
// posterior"): el Especialista, no el corrector, califica el resultado
// (ver "Resultados corrección" en la Matriz — col "Especialista" junto
// al veredicto). No reabre el work_item (ya quedó 'completado' al
// entregar) — esto es un evento de cierre/auditoría, no un cambio de
// estado adicional (la Matriz real tampoco tiene un 4to Estatus).
export async function cerrarCorreccion(correccionId: string, datos: DatosCerrarCorreccion, actorId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const correccion = await obtenerCorreccion(tx, correccionId);
    if (!correccion) throw new Error(`Corrección no encontrada: ${correccionId}`);

    await tx
      .update(correcciones)
      .set({ resultado: datos.resultado, observaciones: datos.observaciones ?? correccion.observaciones })
      .where(eq(correcciones.id, correccionId));

    await registrarEvento(tx, {
      actorId,
      accion: 'CORRECCION_CERRADA',
      entityType: 'work_item',
      entityId: correccion.workItemId,
      proyectoId: correccion.proyectoId,
      detalles: { resultado: datos.resultado },
    });
  });
}

export type AccesoCorreccion = { ok: true } | { ok: false; status: 404 | 403; error: string };

// Ownership a nivel de INTERVENCIÓN, no de proyecto (a diferencia de
// verificarAccesoAProyecto): un proyecto puede tener varias
// correcciones con distinto corrector cada una (master prompt §7-8),
// así que "especialista dueño del proyecto" sí vale para cualquier
// corrección de ese proyecto, pero "corrector" solo vale para la(s)
// corrección(es) donde ESE usuario quedó asignado.
export async function verificarAccesoACorreccion(correccionId: string, usuario: { id: string; rol: Rol }): Promise<AccesoCorreccion> {
  const [fila] = await db
    .select({ correctorId: correcciones.correctorId, especialistaId: proyectos.especialistaId })
    .from(correcciones)
    .innerJoin(proyectos, eq(correcciones.proyectoId, proyectos.id))
    .where(eq(correcciones.id, correccionId))
    .limit(1);

  if (!fila) return { ok: false, status: 404, error: 'Corrección no encontrada' };

  if (usuario.rol === 'jefe_area') return { ok: true };
  if (usuario.rol === 'especialista') {
    return fila.especialistaId === usuario.id ? { ok: true } : { ok: false, status: 403, error: 'No autorizado para esta corrección' };
  }
  if (usuario.rol === 'corrector') {
    return fila.correctorId === usuario.id ? { ok: true } : { ok: false, status: 403, error: 'No autorizado para esta corrección' };
  }
  return { ok: false, status: 403, error: 'No autorizado para esta corrección' };
}

export interface CorreccionDeProyecto {
  id: string;
  workItemId: string;
  alcance: string;
  paginas: number | null;
  requiereRevisionPrevia: boolean;
  revisionPreviaConfirmada: boolean;
  correctorId: string | null;
  correctorNombre: string | null;
  freelance: boolean | null;
  contratoConfirmado: boolean;
  fechaAsignada: string | null;
  dueAt: Date | null;
  fechaInicio: string | null;
  fechaEntrega: string | null;
  entregadoEn: Date | null;
  controlCambiosUrl: string | null;
  informeTecnicoUrl: string | null;
  resultado: string | null;
  observaciones: string | null;
  estado: string;
  // Derivado en el backend (nunca en React, mismo criterio que
  // ProyectoConRiesgo.riesgo) — ver server/helpers/correccionSla.ts.
  plazo: EstadoPlazoCorreccion | null;
}

function conPlazo<T extends { dueAt: Date | null; fechaEntrega: string | null; entregadoEn: Date | null }>(fila: T): T & { plazo: EstadoPlazoCorreccion | null } {
  return { ...fila, plazo: evaluarPlazoCorreccion(fila.dueAt, fila.fechaEntrega, new Date(), fila.entregadoEn) };
}

export async function listarCorreccionesDeProyecto(proyectoId: string): Promise<CorreccionDeProyecto[]> {
  const filas = await db
    .select({
      id: correcciones.id,
      workItemId: correcciones.workItemId,
      alcance: correcciones.alcance,
      paginas: correcciones.paginas,
      requiereRevisionPrevia: correcciones.requiereRevisionPrevia,
      revisionPreviaConfirmada: correcciones.revisionPreviaConfirmada,
      decisionId: decisiones.id,
      correctorId: correcciones.correctorId,
      correctorNombre: correcciones.correctorNombre,
      freelance: correcciones.freelance,
      contratoConfirmado: correcciones.contratoConfirmado,
      fechaAsignada: correcciones.fechaAsignada,
      dueAt: correcciones.dueAt,
      fechaInicio: correcciones.fechaInicio,
      fechaEntrega: correcciones.fechaEntrega,
      entregadoEn: correcciones.entregadoEn,
      controlCambiosUrl: correcciones.controlCambiosUrl,
      informeTecnicoUrl: correcciones.informeTecnicoUrl,
      resultado: correcciones.resultado,
      observaciones: correcciones.observaciones,
      estado: workItemsTable.estado,
    })
    .from(correcciones)
    .innerJoin(workItemsTable, eq(correcciones.workItemId, workItemsTable.id))
    .leftJoin(decisiones, eq(decisiones.originCorreccionId,correcciones.id))
    .where(eq(correcciones.proyectoId, proyectoId))
    .orderBy(desc(correcciones.createdAt));

  return filas.map(conPlazo);
}

export interface TrabajoCorrector extends CorreccionDeProyecto {
  proyectoId: string;
  proyectoCodigo: string;
  autorNombre: string;
  servicioCodigo: string;
}

// "Mis Correcciones" (master prompt §19): a diferencia de
// listarCorreccionesDeProyecto, resuelve por CORRECTOR, cruzando
// proyectos — mismo criterio que listarTrabajosEditor en capitulos.ts.
// Solo trae correcciones no cerradas o cerradas recientemente no hace
// falta filtrar: el corrector debe poder ver también lo que ya entregó
// (master prompt §19 "¿qué ya entregué?").
export async function listarMisCorrecciones(correctorId: string): Promise<TrabajoCorrector[]> {
  const filas = await db
    .select({
      id: correcciones.id,
      workItemId: correcciones.workItemId,
      alcance: correcciones.alcance,
      paginas: correcciones.paginas,
      requiereRevisionPrevia: correcciones.requiereRevisionPrevia,
      revisionPreviaConfirmada: correcciones.revisionPreviaConfirmada,
      correctorId: correcciones.correctorId,
      correctorNombre: correcciones.correctorNombre,
      freelance: correcciones.freelance,
      contratoConfirmado: correcciones.contratoConfirmado,
      fechaAsignada: correcciones.fechaAsignada,
      dueAt: correcciones.dueAt,
      fechaInicio: correcciones.fechaInicio,
      fechaEntrega: correcciones.fechaEntrega,
      entregadoEn: correcciones.entregadoEn,
      controlCambiosUrl: correcciones.controlCambiosUrl,
      informeTecnicoUrl: correcciones.informeTecnicoUrl,
      resultado: correcciones.resultado,
      observaciones: correcciones.observaciones,
      estado: workItemsTable.estado,
      proyectoId: proyectos.id,
      proyectoCodigo: proyectos.codigo,
      autorNombre: autores.nombre,
      servicioCodigo: servicios.codigo,
    })
    .from(correcciones)
    .innerJoin(workItemsTable, eq(correcciones.workItemId, workItemsTable.id))
    .innerJoin(proyectos, eq(correcciones.proyectoId, proyectos.id))
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .where(and(eq(correcciones.correctorId, correctorId), ne(workItemsTable.estado, 'cancelado')))
    .orderBy(desc(correcciones.fechaAsignada));

  return filas.map(conPlazo);
}

export interface CorreccionSeguimiento extends TrabajoCorrector {
  especialistaId: string | null;
}

// "Seguimiento de Corrección" (master prompt §18/§21) — jefatura: TODAS
// las correcciones activas, con lo que hace falta para detectar riesgo/
// carga, sin copiar cada columna del Excel real (la Matriz real tiene
// 25-33 columnas, muchas administrativas/de pago que no aplican al
// seguimiento operativo que pide jefatura).
export async function listarSeguimientoCorreccion(): Promise<CorreccionSeguimiento[]> {
  const filas = await db
    .select({
      id: correcciones.id,
      workItemId: correcciones.workItemId,
      alcance: correcciones.alcance,
      paginas: correcciones.paginas,
      requiereRevisionPrevia: correcciones.requiereRevisionPrevia,
      revisionPreviaConfirmada: correcciones.revisionPreviaConfirmada,
      correctorId: correcciones.correctorId,
      correctorNombre: correcciones.correctorNombre,
      freelance: correcciones.freelance,
      contratoConfirmado: correcciones.contratoConfirmado,
      fechaAsignada: correcciones.fechaAsignada,
      dueAt: correcciones.dueAt,
      fechaInicio: correcciones.fechaInicio,
      fechaEntrega: correcciones.fechaEntrega,
      entregadoEn: correcciones.entregadoEn,
      controlCambiosUrl: correcciones.controlCambiosUrl,
      informeTecnicoUrl: correcciones.informeTecnicoUrl,
      resultado: correcciones.resultado,
      observaciones: correcciones.observaciones,
      estado: workItemsTable.estado,
      proyectoId: proyectos.id,
      proyectoCodigo: proyectos.codigo,
      autorNombre: autores.nombre,
      servicioCodigo: servicios.codigo,
      especialistaId: proyectos.especialistaId,
    })
    .from(correcciones)
    .innerJoin(workItemsTable, eq(correcciones.workItemId, workItemsTable.id))
    .innerJoin(proyectos, eq(correcciones.proyectoId, proyectos.id))
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .where(ne(workItemsTable.estado, 'cancelado'))
    .orderBy(desc(correcciones.createdAt));

  return filas.map(conPlazo);
}
