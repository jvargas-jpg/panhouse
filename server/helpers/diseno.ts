import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { autores, correcciones, direccionesCreativas, disenos, disenoVersiones, fichaCalidadFases, fichaDisenoPropuestas, fichasTrazabilidad, notificaciones, projectAssignments, proyectos, servicios, users, workItems } from '../db/schema/index.js';
import type { Rol } from '../db/schema/index.js';
import type { Tx } from './tx.js';
import { asignarConHistorial } from './assignments.js';
import { registrarEvento, type AccionAuditoria } from './auditLog.js';
import { evaluarGateTituloAprobado } from './gates.js';
import { diasReferenciaDiseno, plazoDiseno, type TipoDiseno } from './disenoSla.js';
import { crearWorkItemSiNoExiste, transicionarWorkItemPorId } from './workItems.js';

type Actor = { id: string; rol: Rol };
export class ErrorDiseno extends Error {
  constructor(public status: number, mensaje: string) { super(mensaje); }
}
function exigir(condicion: unknown, mensaje: string, status = 409): asserts condicion {
  if (!condicion) throw new ErrorDiseno(status, mensaje);
}
// Un único lock de proyecto serializa solicitud/asignación/entrega/revisión/handoff.
// Garantiza retries y doble clic concurrente sin duplicar hechos ni avisos.
async function proyectoBloqueado(tx: Tx, proyectoId: string) {
  const [p] = await tx.select().from(proyectos).where(eq(proyectos.id, proyectoId)).for('update');
  exigir(p, 'Proyecto no encontrado', 404); return p;
}
async function conDiseno<T>(id: string, actor: Actor, rol: Rol, fn: (tx: Tx, d: typeof disenos.$inferSelect, p: typeof proyectos.$inferSelect) => Promise<T>) {
  return db.transaction(async tx => {
    const [d] = await tx.select().from(disenos).where(eq(disenos.id, id));
    exigir(d, 'Trabajo de Diseño no encontrado', 404);
    const p = await proyectoBloqueado(tx, d.proyectoId);
    exigir(actor.rol === rol, 'Rol no autorizado', 403);
    if (rol === 'especialista') exigir(p.especialistaId === actor.id, 'Proyecto de otro especialista', 403);
    if (rol === 'disenador') exigir(p.disenadorId === actor.id, 'Proyecto de otro diseñador', 403);
    const [actual] = await tx.select().from(disenos).where(eq(disenos.id, id));
    exigir(actual, 'Trabajo no encontrado', 404);
    return fn(tx, actual, p);
  });
}
async function evento(tx: Tx, d: typeof disenos.$inferSelect, actorId: string, accion: AccionAuditoria, detalles?: Record<string, unknown>) {
  await registrarEvento(tx, { actorId, accion, entityType: 'work_item', entityId: d.workItemId, proyectoId: d.proyectoId, detalles });
}
async function aviso(tx: Tx, proyectoId: string, rolDestino: string, usuarioDestinoId: string | null, mensaje: string) {
  await tx.insert(notificaciones).values({ proyectoId, rolDestino, usuarioDestinoId, mensaje });
}
async function versionActual(tx: Tx, disenoId: string) {
  const [v] = await tx.select().from(disenoVersiones).where(eq(disenoVersiones.disenoId, disenoId)).orderBy(desc(disenoVersiones.numero)).limit(1);
  return v;
}
async function creativaLista(tx: Tx, proyectoId: string) {
  const [c] = await tx.select({ dc: direccionesCreativas, propuesta: fichaDisenoPropuestas })
    .from(direccionesCreativas).innerJoin(fichaDisenoPropuestas, eq(fichaDisenoPropuestas.direccionCreativaId, direccionesCreativas.id))
    .where(and(eq(direccionesCreativas.proyectoId, proyectoId), eq(direccionesCreativas.tipo, 'concepto_portada'),
      eq(direccionesCreativas.resultadoFinal, 'aprobado'), isNotNull(fichaDisenoPropuestas.fechaAprobadaAutor), isNotNull(fichaDisenoPropuestas.fechaAprobadaRrpp)))
    .orderBy(desc(direccionesCreativas.createdAt)).limit(1);
  exigir(c?.dc.briefEnlace && c.dc.fechaBriefAprobadoAutor && c.dc.recursoImagenUrl && c.dc.recursoConceptoPdfUrl,
    'GATE-DISEÑO: se requiere brief aprobado, concepto aprobado y recursos de Creativa', 400);
  return c.dc;
}
export interface SolicitudDiseno {
  tipo: TipoDiseno; solicitudKey: string; fuenteUrl: string; capitulosMuestra?: number;
  correccionId?: string; aprobacionEdicionUrl?: string; preparacionConfirmada: boolean; dueAt?: string;
}
export async function solicitarDiseno(proyectoId: string, datos: SolicitudDiseno, actor: Actor) {
  return db.transaction(async tx => {
    const p = await proyectoBloqueado(tx, proyectoId);
    exigir(actor.rol === 'especialista' && p.especialistaId === actor.id, 'Proyecto de otro especialista', 403);
    const [retry] = await tx.select().from(disenos).where(and(eq(disenos.proyectoId, proyectoId), eq(disenos.solicitudKey, datos.solicitudKey)));
    if (retry) {
      exigir(retry.tipo === datos.tipo && retry.fuenteUrl === datos.fuenteUrl, 'Clave de solicitud ya usada para otro trabajo');
      return { id: retry.id, nueva: false };
    }
    const [abierta] = await tx.select().from(disenos).where(and(eq(disenos.proyectoId, proyectoId), eq(disenos.tipo, datos.tipo), isNull(disenos.cerradoEn)));
    if (abierta) return { id: abierta.id, nueva: false };
    const titulo = evaluarGateTituloAprobado(p); exigir(titulo.desbloqueado, titulo.motivo ?? 'Título pendiente', 400);
    const dc = await creativaLista(tx, proyectoId);
    exigir(datos.preparacionConfirmada, 'Confirme preparación de los archivos según §4.2 del Manual', 400);
    if (datos.tipo === 'muestra_diagramacion') exigir((datos.capitulosMuestra ?? 0) >= 3, 'La muestra requiere al menos tres capítulos', 400);
    if (datos.tipo === 'diagramacion') {
      exigir(datos.correccionId && datos.aprobacionEdicionUrl, 'Se requiere tripa corregida y evidencia de aprobación de Jefatura de Edición', 400);
      const [c] = await tx.select().from(correcciones).where(and(eq(correcciones.id, datos.correccionId), eq(correcciones.proyectoId, proyectoId), eq(correcciones.alcance, 'tripa_completa')));
      exigir(c?.fechaEntrega, 'Corrección de tripa no entregada o de otro proyecto', 400);
      const [m] = await tx.select().from(disenos).innerJoin(disenoVersiones, eq(disenoVersiones.disenoId, disenos.id))
        .where(and(eq(disenos.proyectoId, proyectoId), eq(disenos.tipo, 'muestra_diagramacion'), isNotNull(disenoVersiones.aprobadaAutorEn)));
      exigir(m, 'La muestra de diagramación requiere aprobación del autor', 400);
    }
    const [f] = await tx.select().from(fichasTrazabilidad).where(eq(fichasTrazabilidad.proyectoId, proyectoId));
    const wi = await crearWorkItemSiNoExiste(tx, { proyectoId, tipo: 'diseno', businessKey: `${datos.tipo}:${datos.solicitudKey}` });
    const [d] = await tx.insert(disenos).values({ proyectoId, workItemId: wi, direccionCreativaId: dc.id, tipo: datos.tipo,
      solicitudKey: datos.solicitudKey, fuenteUrl: datos.fuenteUrl, preparacionConfirmada: true, capitulosMuestra: datos.capitulosMuestra,
      correccionId: datos.correccionId, aprobacionEdicionUrl: datos.aprobacionEdicionUrl,
      diasReferencia: diasReferenciaDiseno(datos.tipo, f?.condicionesEspeciales ?? null), dueAt: datos.dueAt ? new Date(datos.dueAt) : null }).returning();
    exigir(d, 'No se pudo crear Diseño');
    if (p.disenadorId) {
      const [disenador] = await tx.select().from(users).where(and(eq(users.id, p.disenadorId), eq(users.rol, 'disenador'), eq(users.activo, true)));
      exigir(disenador, 'El diseñador del proyecto debe estar activo y tener rol de diseñador', 400);
      await asignarConHistorial(tx, { proyectoId, tipo: 'disenador', usuarioId: p.disenadorId, asignadoPorId: actor.id });
      await transicionarWorkItemPorId(tx, wi, 'en_progreso');
      await aviso(tx, proyectoId, 'disenador', p.disenadorId, `Nuevo trabajo: ${datos.tipo.replaceAll('_', ' ')}.`);
    }
    await evento(tx, d, actor.id, 'DISENO_SOLICITADO', { tipo: d.tipo, dueAt: d.dueAt, diasReferencia: d.diasReferencia });
    return { id: d.id, nueva: true };
  });
}
export async function asignarDiseno(id: string, datos: { disenadorId: string; dueAt?: string }, actor: Actor) {
  return conDiseno(id, actor, 'especialista', async (tx, d, p) => {
    exigir(!d.cerradoEn, 'Diseño cerrado');
    const [u] = await tx.select().from(users).where(and(eq(users.id, datos.disenadorId), eq(users.rol, 'disenador'), eq(users.activo, true)));
    exigir(u, 'Diseñador activo no encontrado', 400);
    const a = await asignarConHistorial(tx, { proyectoId: p.id, tipo: 'disenador', usuarioId: u.id, asignadoPorId: actor.id });
    await tx.update(proyectos).set({ disenadorId: u.id }).where(eq(proyectos.id, p.id));
    if (datos.dueAt) {
      const v = await versionActual(tx, d.id);
      exigir(!v || d.dueAt?.getTime() === new Date(datos.dueAt).getTime(), 'El plazo histórico no puede cambiar después de la entrega');
      await tx.update(disenos).set({ dueAt: new Date(datos.dueAt) }).where(eq(disenos.id, d.id));
    }
    await tx.update(workItems).set({ estado: 'en_progreso' }).where(and(eq(workItems.proyectoId, p.id), eq(workItems.tipo, 'diseno'), eq(workItems.estado, 'pendiente')));
    if (!a.cambio) return { ok: true };
    await evento(tx, d, actor.id, a.anteriorUsuarioId ? 'DISENADOR_REASIGNADO' : 'DISENADOR_ASIGNADO', { anterior: a.anteriorUsuarioId, nuevo: u.id });
    await aviso(tx, p.id, 'disenador', u.id, 'Tienes trabajos de Diseño asignados.');
    return { ok: true };
  });
}
export async function entregarDiseno(id: string, datos: { enlace: string; entregaKey: string }, actor: Actor) {
  return conDiseno(id, actor, 'disenador', async (tx, d, p) => {
    const [retry] = await tx.select().from(disenoVersiones).where(and(eq(disenoVersiones.disenoId, id), eq(disenoVersiones.entregaKey, datos.entregaKey)));
    if (retry) { exigir(retry.enlace === datos.enlace, 'Clave de entrega ya usada con otro archivo'); return { id: retry.id, nueva: false }; }
    exigir(!d.cerradoEn, 'Diseño cerrado');
    const previa = await versionActual(tx, id);
    exigir(!previa || previa.feedbackEn, 'La versión actual aún espera revisión');
    const [v] = await tx.insert(disenoVersiones).values({ disenoId: id, numero: (previa?.numero ?? 0) + 1, enlace: datos.enlace, entregaKey: datos.entregaKey, entregadoPorId: actor.id }).returning();
    exigir(v, 'No se pudo guardar la versión');
    await transicionarWorkItemPorId(tx, d.workItemId, 'bloqueado');
    if (d.tipo === 'cubierta_extendida') {
      const wi = await crearWorkItemSiNoExiste(tx, { proyectoId: p.id, tipo: 'direccion_creativa', businessKey: `revision_cubierta:${v.id}` });
      const [dc] = await tx.insert(direccionesCreativas).values({ proyectoId: p.id, workItemId: wi, tipo: 'revision_cubierta', fechaSolicitud: new Date().toISOString().slice(0, 10) }).returning();
      exigir(dc, 'No se pudo solicitar revisión creativa');
      const [a] = await tx.select().from(projectAssignments).innerJoin(direccionesCreativas, eq(projectAssignments.workItemId, direccionesCreativas.workItemId))
        .where(and(eq(direccionesCreativas.id, d.direccionCreativaId), eq(projectAssignments.tipo, 'lider_creativo'), isNull(projectAssignments.finalizadoEn)));
      if (a) await asignarConHistorial(tx, { proyectoId: p.id, workItemId: wi, tipo: 'lider_creativo', usuarioId: a.project_assignments.usuarioId, asignadoPorId: actor.id });
      const interna = await crearWorkItemSiNoExiste(tx, { proyectoId: p.id, tipo: 'revision_interna_cubierta', businessKey: v.id });
      await tx.update(disenoVersiones).set({ revisionCreativaId: dc.id, revisionInternaWorkItemId: interna }).where(eq(disenoVersiones.id, v.id));
      await evento(tx, d, actor.id, 'REVISION_CUBIERTA_SOLICITADA', { versionId: v.id, revisionCreativaId: dc.id });
      await aviso(tx, p.id, 'lider_creativo', a?.project_assignments.usuarioId ?? null, 'Cubierta extendida pendiente de verificación creativa.');
      await aviso(tx, p.id, 'jefe_edicion', null, 'Cubierta extendida pendiente de corrección interna y validación de identidad.');
    }
    await evento(tx, d, actor.id, 'DISENO_VERSION_ENTREGADA', { versionId: v.id, numero: v.numero, tipo: d.tipo });
    await aviso(tx, p.id, 'especialista', p.especialistaId, 'Nueva versión de Diseño entregada.');
    return { id: v.id, nueva: true };
  });
}
// Los IDs de versión deben pertenecer al trabajo y ser la versión activa.
async function versionParaAccion(tx: Tx, d: typeof disenos.$inferSelect, versionId: string) {
  const v = await versionActual(tx, d.id); exigir(v && v.id === versionId, 'Versión ajena o histórica', 404); return v;
}
export async function coordinarVersion(id: string, versionId: string, datos: { accion: 'enviar_autor' | 'feedback' | 'aprobar_autor' | 'handoff_calidad'; feedback?: string; cantidadComentarios?: number; feedbackAutorDueAt?: string }, actor: Actor) {
  return conDiseno(id, actor, 'especialista', async (tx, d, p) => {
    const v = await versionParaAccion(tx, d, versionId);
    const ahora = new Date();
    if (datos.accion === 'feedback') {
      if (v.feedbackEn) { exigir(v.feedback === datos.feedback, 'Feedback ya registrado'); return { ok: true }; }
      exigir(!v.aprobadaAutorEn && !v.handoffEn, 'Versión ya aprobada o transferida');
      exigir(datos.feedback?.trim(), 'Indique el feedback', 400);
      await tx.update(disenoVersiones).set({ feedback: datos.feedback, feedbackEn: ahora, cantidadComentarios: datos.cantidadComentarios }).where(eq(disenoVersiones.id, v.id));
      await transicionarWorkItemPorId(tx, d.workItemId, 'en_progreso');
      await aviso(tx, p.id, 'disenador', p.disenadorId, 'Tu versión necesita ajustes: revisa el feedback.');
    } else if (datos.accion === 'enviar_autor') {
      if (v.enviadaAutorEn) return { ok: true };
      exigir(d.tipo !== 'diagramacion', 'La tripa diagramada se envía primero a Calidad');
      exigir(!v.feedbackEn, 'Debe entregar una nueva versión con ajustes');
      if (d.tipo === 'cubierta_extendida') {
        const [c] = await tx.select().from(direccionesCreativas).where(eq(direccionesCreativas.id, v.revisionCreativaId!));
        exigir(c?.resultadoFinal === 'aprobado' && v.aprobadaInternaEn, 'Faltan verificación creativa y aprobación interna de cubierta');
      }
      await tx.update(disenoVersiones).set({ enviadaAutorEn: ahora, feedbackAutorDueAt: datos.feedbackAutorDueAt ? new Date(datos.feedbackAutorDueAt) : null }).where(eq(disenoVersiones.id, v.id));
    } else if (datos.accion === 'aprobar_autor') {
      if (v.aprobadaAutorEn) return { ok: true };
      exigir(v.enviadaAutorEn && !v.feedbackEn, 'La versión debe enviarse al autor y no tener ajustes pendientes');
      await tx.update(disenoVersiones).set({ aprobadaAutorEn: ahora }).where(eq(disenoVersiones.id, v.id));
      await tx.update(disenos).set({ cerradoEn: ahora }).where(eq(disenos.id, d.id));
      await transicionarWorkItemPorId(tx, d.workItemId, 'completado');
    } else {
      if (v.handoffEn) return { ok: true };
      exigir(d.tipo === 'diagramacion' && !v.feedbackEn, 'Handoff requiere diagramación activa sin feedback pendiente');
      const [f] = await tx.insert(fichasTrazabilidad).values({ proyectoId: p.id }).onConflictDoNothing().returning();
      const ficha = f ?? (await tx.select().from(fichasTrazabilidad).where(eq(fichasTrazabilidad.proyectoId, p.id)))[0];
      exigir(ficha, 'Ficha no encontrada');
      const anteriores = await tx.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.fichaId, ficha.id));
      // 5D entrega la diagramación inicial a Fase 1 (Manual §5.1).
      // El número de registros históricos no define una transición de Calidad.
      const numeroFase = 1;
      const ronda = Math.max(0, ...anteriores.filter(x => x.numeroFase === numeroFase).map(x => x.ronda)) + 1;
      const wi = await crearWorkItemSiNoExiste(tx, { proyectoId: p.id, tipo: 'calidad', businessKey: `diseno-version:${v.id}` });
      const contexto = { disenoId: d.id, versionId: v.id, fuenteUrl: d.fuenteUrl, correccionId: d.correccionId, aprobacionEdicionUrl: d.aprobacionEdicionUrl };
      await tx.update(workItems).set({ observaciones: JSON.stringify(contexto) }).where(eq(workItems.id, wi));
      const [q] = await tx.insert(fichaCalidadFases).values({ fichaId: ficha.id, numeroFase, ronda, pdfUrl: v.enlace, pdfVersion: `V${v.numero}`, fecha: ahora.toISOString().slice(0, 10) }).returning();
      exigir(q, 'No se pudo crear la ronda');
      await tx.update(disenoVersiones).set({ handoffEn: ahora, calidadWorkItemId: wi, calidadFaseId: q.id }).where(eq(disenoVersiones.id, v.id));
      await tx.update(disenos).set({ cerradoEn: ahora }).where(eq(disenos.id, d.id));
      await transicionarWorkItemPorId(tx, d.workItemId, 'completado');
      await aviso(tx, p.id, 'soporte_editorial', null, 'Versión diagramada lista para Calidad, con fuente y contexto en Diseño.');
    }
    await evento(tx, d, actor.id, ({ enviar_autor: 'DISENO_ENVIAR_AUTOR', feedback: 'DISENO_FEEDBACK', aprobar_autor: 'DISENO_APROBAR_AUTOR', handoff_calidad: 'DISENO_HANDOFF_CALIDAD' } as const)[datos.accion], { versionId: v.id, feedback: datos.feedback });
    return { ok: true };
  });
}
export async function revisarCubierta(id: string, versionId: string, datos: { aprobar: boolean; feedback?: string }, actor: Actor, interna = false) {
  return conDiseno(id, actor, interna ? 'jefe_edicion' : 'lider_creativo', async (tx, d, p) => {
    const v = await versionParaAccion(tx, d, versionId);
    exigir(d.tipo === 'cubierta_extendida', 'No es una cubierta', 400);
    exigir(v.revisionCreativaId && v.revisionInternaWorkItemId, 'Revisión no creada');
    const [c] = await tx.select().from(direccionesCreativas).where(eq(direccionesCreativas.id, v.revisionCreativaId));
    exigir(c, 'Revisión no encontrada');
    if (!interna) {
      const [a] = await tx.select().from(projectAssignments).where(and(eq(projectAssignments.workItemId, c.workItemId), eq(projectAssignments.tipo, 'lider_creativo'), isNull(projectAssignments.finalizadoEn)));
      exigir(a?.usuarioId === actor.id, 'Revisión de otro líder creativo', 403);
    }
    const [wi] = await tx.select().from(workItems).where(eq(workItems.id, interna ? v.revisionInternaWorkItemId : c.workItemId));
    if (wi?.estado === 'completado') {
      exigir(interna ? !!v.aprobadaInternaEn === datos.aprobar : (c.resultadoFinal === 'aprobado') === datos.aprobar, 'La revisión ya tiene otro resultado');
      return { ok: true };
    }
    exigir(!v.feedbackEn && !d.cerradoEn, 'Esta versión ya necesita ajustes o está cerrada');
    if (!datos.aprobar) {
      exigir(datos.feedback?.trim(), 'Indique correcciones', 400);
      await tx.update(disenoVersiones).set({ feedback: datos.feedback, feedbackEn: new Date() }).where(eq(disenoVersiones.id, v.id));
      await transicionarWorkItemPorId(tx, d.workItemId, 'en_progreso');
      // La otra revisión de esta entrega ya no es accionable: se retomará
      // con una revisión nueva ligada a V(n+1). Se conserva su resultado.
      const otraId = interna ? c.workItemId : v.revisionInternaWorkItemId;
      const [otra] = await tx.select().from(workItems).where(eq(workItems.id, otraId));
      if (otra && otra.estado !== 'completado') await transicionarWorkItemPorId(tx, otraId, 'cancelado');
      await aviso(tx, p.id, 'disenador', p.disenadorId, 'Cubierta devuelta: aplica las correcciones de revisión.');
    }
    if (interna) {
      if (datos.aprobar) await tx.update(disenoVersiones).set({ aprobadaInternaEn: new Date() }).where(eq(disenoVersiones.id, v.id));
      await transicionarWorkItemPorId(tx, v.revisionInternaWorkItemId, 'completado');
    } else {
      await tx.update(direccionesCreativas).set({ resultadoFinal: datos.aprobar ? 'aprobado' : 'rechazado', observaciones: datos.feedback, fechaCierre: new Date().toISOString().slice(0, 10) }).where(eq(direccionesCreativas.id, c.id));
      await transicionarWorkItemPorId(tx, c.workItemId, 'completado');
    }
    await evento(tx, d, actor.id, interna ? 'CUBIERTA_REVISION_INTERNA' : 'CUBIERTA_REVISION_CREATIVA', { versionId: v.id, aprobar: datos.aprobar });
    await aviso(tx, p.id, 'especialista', p.especialistaId, datos.aprobar ? 'Revisión de cubierta aprobada.' : 'Revisión de cubierta requiere ajustes.');
    return { ok: true };
  });
}
export async function listarDisenos(actor: Actor, proyectoId?: string, revisiones = false) {
  const condiciones = proyectoId ? [eq(proyectos.id, proyectoId)] : [];
  if (actor.rol === 'especialista') condiciones.push(eq(proyectos.especialistaId, actor.id));
  else if (actor.rol === 'disenador') condiciones.push(eq(proyectos.disenadorId, actor.id));
  else exigir(['jefe_area', 'jefe_edicion', 'lider_creativo', 'soporte_editorial'].includes(actor.rol), 'Rol no autorizado', 403);
  if (actor.rol === 'lider_creativo' || revisiones) condiciones.push(eq(disenos.tipo, 'cubierta_extendida'));
  if (proyectoId && ['especialista', 'disenador'].includes(actor.rol)) {
    const [p] = await db.select().from(proyectos).where(eq(proyectos.id, proyectoId));
    exigir(p, 'Proyecto no encontrado', 404);
    exigir(actor.rol === 'especialista' ? p.especialistaId === actor.id : p.disenadorId === actor.id, 'Proyecto ajeno', 403);
  }
  const filas = await db.select({ trabajo: disenos, proyecto: proyectos, autorNombre: autores.nombre, servicioCodigo: servicios.codigo, creativa: direccionesCreativas, disenadorNombre: users.nombre, modalidad: fichasTrazabilidad.ingresoServicioSubtipoCrudo })
    .from(disenos).innerJoin(proyectos, eq(disenos.proyectoId, proyectos.id)).innerJoin(autores, eq(proyectos.autorId, autores.id))
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id)).innerJoin(direccionesCreativas, eq(disenos.direccionCreativaId, direccionesCreativas.id))
    .leftJoin(users, eq(proyectos.disenadorId, users.id)).leftJoin(fichasTrazabilidad, eq(fichasTrazabilidad.proyectoId, proyectos.id))
    .where(and(...condiciones)).orderBy(desc(disenos.solicitadoEn));
  const salida = [];
  for (const f of filas) {
    const versiones = await db.select().from(disenoVersiones).where(eq(disenoVersiones.disenoId, f.trabajo.id)).orderBy(desc(disenoVersiones.numero));
    const actual = versiones[0];
    if (actor.rol === 'lider_creativo') {
      if (!actual?.revisionCreativaId) continue;
      const [asignada] = await db.select().from(projectAssignments).innerJoin(direccionesCreativas, eq(projectAssignments.workItemId, direccionesCreativas.workItemId))
        .where(and(eq(direccionesCreativas.id, actual.revisionCreativaId), eq(projectAssignments.usuarioId, actor.id), eq(projectAssignments.tipo, 'lider_creativo'), isNull(projectAssignments.finalizadoEn)));
      if (!asignada) continue;
    }
    const [wi] = await db.select().from(workItems).where(eq(workItems.id, f.trabajo.workItemId));
    const [revision] = actual?.revisionCreativaId ? await db.select().from(direccionesCreativas).where(eq(direccionesCreativas.id, actual.revisionCreativaId)) : [];
    salida.push({ ...f.trabajo, versiones, estado: wi?.estado, plazo: plazoDiseno(f.trabajo.dueAt, versiones.at(-1)?.entregadoEn ?? null),
      proyectoCodigo: f.proyecto.codigo, autorNombre: f.autorNombre, servicioCodigo: f.servicioCodigo, disenadorId: f.proyecto.disenadorId,
      modalidad: f.modalidad, disenadorNombre: f.disenadorNombre,
      tituloDefinitivo: f.proyecto.tituloDefinitivo, subtituloDefinitivo: f.proyecto.subtituloDefinitivo,
      briefEnlace: f.creativa.briefEnlace, recursoImagenUrl: f.creativa.recursoImagenUrl, recursoConceptoPdfUrl: f.creativa.recursoConceptoPdfUrl,
      revisionCreativaResultado: revision?.resultadoFinal ?? null });
  }
  return salida;
}
