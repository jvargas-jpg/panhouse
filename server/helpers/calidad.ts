import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { autores, direccionesCreativas, disenos, disenoVersiones, fichaCalidadFases, fichasTrazabilidad, notificaciones, proyectos, users, workItems, type Rol } from '../db/schema/index.js';
import { registrarEvento, type AccionAuditoria } from './auditLog.js';
import { ErrorDiseno } from './diseno.js';
import { plazoDiseno } from './disenoSla.js';
import type { Tx } from './tx.js';
import { crearWorkItemSiNoExiste, transicionarWorkItemPorId } from './workItems.js';

// Ficha, INS.CALIDAD EDITORIAL: checklist real de F1/F3. null = no aplica.
export const CRITERIOS_CALIDAD = ['textos_diagramados', 'palabras_cortadas', 'citas', 'epigrafes', 'paginas_ejercicios', 'portadillas', 'sangria', 'casita_panhouse', 'logo_coleccion', 'creditos', 'notas_pie', 'titulos', 'intertitulos', 'vinetas', 'indice', 'paginacion', 'foliaturas', 'fotografias', 'tablas', 'dedicatoria', 'agradecimientos', 'sobre_autor', 'prologo', 'comentarios', 'datos', 'textos_incorporar'] as const;
export const criteriosDeFase = (fase: number) => fase === 1 ? [...CRITERIOS_CALIDAD] : fase === 3 ? CRITERIOS_CALIDAD.filter(c => c !== 'textos_diagramados' && c !== 'datos') : [];
type Actor = { id: string; rol: Rol };
function exigir(c: unknown, error: string, status = 409): asserts c { if (!c) throw new ErrorDiseno(status, error); }
async function conRonda<T>(id: string, actor: Actor, rol: Rol, fn: (tx: Tx, q: typeof fichaCalidadFases.$inferSelect, v: typeof disenoVersiones.$inferSelect, d: typeof disenos.$inferSelect, p: typeof proyectos.$inferSelect) => Promise<T>, permitirRetryFinal = false) {
  return db.transaction(async tx => {
    exigir(actor.rol === rol, 'Rol no autorizado', 403);
    const [relacion] = await tx.select({ proyectoId: fichasTrazabilidad.proyectoId }).from(fichaCalidadFases)
      .innerJoin(fichasTrazabilidad, eq(fichaCalidadFases.fichaId, fichasTrazabilidad.id)).where(eq(fichaCalidadFases.id, id));
    exigir(relacion, 'Ronda no encontrada', 404);
    const [p] = await tx.select().from(proyectos).where(eq(proyectos.id, relacion.proyectoId)).for('update');
    exigir(p, 'Proyecto no encontrado', 404);
    if (rol === 'especialista') exigir(p.especialistaId === actor.id, 'Proyecto de otro especialista', 403);
    const [q] = await tx.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.id, id));
    exigir(q?.workItemId && q.disenoVersionId, 'Ronda histórica: use la consulta legacy', 400);
    const [v] = await tx.select().from(disenoVersiones).where(eq(disenoVersiones.id, q.disenoVersionId));
    exigir(v, 'Versión no encontrada', 404);
    const [d] = await tx.select().from(disenos).where(eq(disenos.id, v.disenoId));
    exigir(d && d.proyectoId === p.id, 'Versión de otro proyecto', 404);
    const [actual] = await tx.select().from(disenoVersiones).where(eq(disenoVersiones.disenoId, d.id)).orderBy(desc(disenoVersiones.numero)).limit(1);
    exigir(actual?.id === v.id && (v.calidadFaseId === q.id || permitirRetryFinal), 'Ronda o versión histórica', 404);
    return fn(tx, q, v, d, p);
  });
}
async function evento(tx: Tx, q: typeof fichaCalidadFases.$inferSelect, pId: string, actorId: string, accion: AccionAuditoria, detalles?: Record<string, unknown>) {
  await registrarEvento(tx, { actorId, accion, entityType: 'work_item', entityId: q.workItemId!, proyectoId: pId, detalles: { faseId: q.id, numeroFase: q.numeroFase, ronda: q.ronda, versionId: q.disenoVersionId, ...detalles } });
}
async function aviso(tx: Tx, proyectoId: string, rolDestino: string, usuarioDestinoId: string | null, mensaje: string) {
  await tx.insert(notificaciones).values({ proyectoId, rolDestino, usuarioDestinoId, mensaje });
}
async function abrirAjustes(tx: Tx, d: typeof disenos.$inferSelect, v: typeof disenoVersiones.$inferSelect, feedback: string, cantidad: number, archivoUrl: string) {
  await tx.update(disenoVersiones).set({ feedback, feedbackArchivoUrl: archivoUrl, feedbackEn: new Date(), cantidadComentarios: cantidad }).where(eq(disenoVersiones.id, v.id));
  await tx.update(disenos).set({ cerradoEn: null }).where(eq(disenos.id, d.id));
  await transicionarWorkItemPorId(tx, d.workItemId, 'en_progreso');
  await tx.update(workItems).set({ fechaFinReal: null }).where(eq(workItems.id, d.workItemId));
}
export async function iniciarCalidad(id: string, dueAt: string | undefined, actor: Actor) {
  return conRonda(id, actor, 'soporte_editorial', async (tx, q, _v, _d, p) => {
    if (q.iniciadoEn) { exigir(!dueAt || q.dueAt?.getTime() === new Date(dueAt).getTime(), 'El plazo ya fue registrado'); return { ok: true }; }
    exigir(!q.revisadoEn, 'Revisión ya resuelta');
    await tx.update(fichaCalidadFases).set({ iniciadoEn: new Date(), dueAt: dueAt ? new Date(dueAt) : q.dueAt }).where(eq(fichaCalidadFases.id, id));
    await transicionarWorkItemPorId(tx, q.workItemId!, 'en_progreso');
    await evento(tx, q, p.id, actor.id, 'CALIDAD_INICIADA'); return { ok: true };
  });
}
export interface ResultadoCalidad {
  aprobar: boolean; cantidadComentarios: number; cantidadPaginas?: number; comentariosUrl?: string;
  cambiosPendientesPorAplicar?: number; cambiosNuevosSugeridos?: number; observaciones?: string;
  checklist?: Record<string, { cumple: boolean | null; observaciones?: string }>;
}
function listaNormalizada(lista: ResultadoCalidad['checklist']) {
  return JSON.stringify(Object.fromEntries(Object.entries(lista ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, { cumple: v.cumple, observaciones: v.observaciones ?? '' }])));
}
export async function resolverCalidad(id: string, datos: ResultadoCalidad, actor: Actor) {
  return conRonda(id, actor, 'soporte_editorial', async (tx, q, v, d, p) => {
    if (q.revisadoEn) {
      exigir(q.aprobado === datos.aprobar && q.cantidadComentarios === datos.cantidadComentarios && q.comentariosUrl === (datos.comentariosUrl ?? null)
        && q.observaciones === (datos.observaciones ?? null) && q.cantidadPaginas === (datos.cantidadPaginas ?? null)
        && q.cambiosPendientesPorAplicar === (datos.cambiosPendientesPorAplicar ?? null) && q.cambiosNuevosSugeridos === (datos.cambiosNuevosSugeridos ?? null)
        && listaNormalizada(q.checklist ?? undefined) === listaNormalizada(datos.checklist), 'La ronda ya tiene otro resultado');
      return { ok: true };
    }
    const criterios = criteriosDeFase(q.numeroFase);
    exigir(criterios.every(c => datos.checklist && Object.hasOwn(datos.checklist, c)), 'Complete los criterios de esta fase o marque No aplica', 400);
    if (q.numeroFase === 2 || q.numeroFase === 4) {
      exigir(datos.cambiosPendientesPorAplicar !== undefined && datos.cambiosNuevosSugeridos !== undefined, 'Registre cambios pendientes y nuevos', 400);
      exigir(datos.cantidadComentarios === datos.cambiosPendientesPorAplicar + datos.cambiosNuevosSugeridos, 'El total debe coincidir con pendientes más nuevos', 400);
    }
    if (datos.aprobar) {
      exigir(datos.cantidadComentarios === 0 && !Object.values(datos.checklist ?? {}).some(c => c.cumple === false), 'No se aprueba una versión con comentarios o criterios pendientes');
    } else exigir(datos.cantidadComentarios > 0 && datos.comentariosUrl, 'Adjunte el PDF comentado y su cantidad de comentarios', 400);
    const [persona] = await tx.select({ nombre: users.nombre }).from(users).where(eq(users.id, actor.id));
    const ahora = new Date();
    await tx.update(fichaCalidadFases).set({ aprobado: datos.aprobar, iniciadoEn: q.iniciadoEn ?? ahora, revisadoEn: ahora, revisadoPorId: actor.id,
      nombreQuienRecibe: persona?.nombre, cantidadComentarios: datos.cantidadComentarios, comentariosUrl: datos.comentariosUrl ?? null, observaciones: datos.observaciones ?? null,
      cantidadPaginas: datos.cantidadPaginas ?? null, cambiosPendientesPorAplicar: datos.cambiosPendientesPorAplicar ?? null, cambiosNuevosSugeridos: datos.cambiosNuevosSugeridos ?? null,
      checklist: datos.checklist ?? null,
    }).where(eq(fichaCalidadFases.id, q.id));
    await transicionarWorkItemPorId(tx, q.workItemId!, 'completado');
    if (!datos.aprobar) {
      await abrirAjustes(tx, d, v, `Calidad F${q.numeroFase}.${q.ronda}: ${datos.observaciones ?? 'Aplicar comentarios'}`, datos.cantidadComentarios, datos.comentariosUrl!);
      await aviso(tx, p.id, 'disenador', p.disenadorId, 'Calidad devolvió la versión con comentarios: aplica los ajustes y entrega una nueva versión.');
    }
    await aviso(tx, p.id, 'especialista', p.especialistaId, datos.aprobar ? (q.numeroFase >= 3 ? 'Revisión final de tripa aprobada: revisa el estado de cubierta para solicitar el paquete final.' : 'Versión aprobada por Calidad: registra envío al autor.') : 'Calidad entregó comentarios para Diseño.');
    await evento(tx, q, p.id, actor.id, 'CALIDAD_REVISADA', { aprobar: datos.aprobar, cantidadComentarios: datos.cantidadComentarios, comentariosUrl: datos.comentariosUrl });
    return { ok: true };
  });
}
export interface CoordinacionCalidad {
  accion: 'enviar_autor' | 'feedback_autor' | 'aprobar_autor' | 'revision_final';
  feedback?: string; comentariosUrl?: string; cantidadComentarios?: number; feedbackAutorDueAt?: string; numerosLegalesUrl?: string;
}
export async function coordinarCalidad(id: string, datos: CoordinacionCalidad, actor: Actor) {
  return conRonda(id, actor, 'especialista', async (tx, q, v, d, p) => {
    exigir(q.aprobado === true && q.revisadoEn, 'La versión aún no está aprobada por Calidad');
    exigir(q.numeroFase <= 2, 'La revisión final aprobada está lista para paquete final');
    const ahora = new Date();
    if (datos.accion === 'enviar_autor') {
      if (v.enviadaAutorEn) return { ok: true };
      exigir(!v.feedbackEn, 'La versión necesita ajustes');
      await tx.update(disenoVersiones).set({ enviadaAutorEn: ahora, feedbackAutorDueAt: datos.feedbackAutorDueAt ? new Date(datos.feedbackAutorDueAt) : null }).where(eq(disenoVersiones.id, v.id));
    } else if (datos.accion === 'feedback_autor') {
      exigir(v.enviadaAutorEn && !v.aprobadaAutorEn, 'Registre envío al autor antes del feedback');
      const texto = `Autor: ${datos.feedback ?? ''}`;
      if (v.feedbackEn) { exigir(v.feedback === texto && v.feedbackArchivoUrl === datos.comentariosUrl && v.cantidadComentarios === datos.cantidadComentarios, 'Ya existe otro feedback'); return { ok: true }; }
      exigir(datos.feedback?.trim() && datos.comentariosUrl && (datos.cantidadComentarios ?? 0) > 0, 'Registre feedback, PDF comentado y total', 400);
      await abrirAjustes(tx, d, v, texto, datos.cantidadComentarios!, datos.comentariosUrl!);
      await aviso(tx, p.id, 'disenador', p.disenadorId, 'Feedback del autor pendiente: aplicar y entregar nueva versión para validación.');
    } else if (datos.accion === 'aprobar_autor') {
      if (v.aprobadaAutorEn) return { ok: true };
      exigir(v.enviadaAutorEn && !v.feedbackEn, 'Falta envío al autor o hay feedback pendiente');
      await tx.update(disenoVersiones).set({ aprobadaAutorEn: ahora }).where(eq(disenoVersiones.id, v.id));
    } else {
      exigir(v.aprobadaAutorEn && !v.feedbackEn, 'Revisión final requiere aprobación del autor');
      const [retry] = await tx.select().from(fichaCalidadFases).where(and(eq(fichaCalidadFases.disenoVersionId, v.id), eq(fichaCalidadFases.numeroFase, 3)));
      if (retry) { exigir(retry.numerosLegalesUrl === (datos.numerosLegalesUrl ?? null), 'La revisión final ya tiene otra evidencia legal'); return { ok: true }; }
      const anteriores = await tx.select().from(fichaCalidadFases).where(and(eq(fichaCalidadFases.fichaId, q.fichaId), eq(fichaCalidadFases.numeroFase, 3)));
      const wi = await crearWorkItemSiNoExiste(tx, { proyectoId: p.id, tipo: 'calidad', businessKey: `revision-final:${v.id}` });
      const [final] = await tx.insert(fichaCalidadFases).values({ fichaId: q.fichaId, numeroFase: 3, ronda: Math.max(0, ...anteriores.map(x => x.ronda)) + 1,
        pdfUrl: v.enlace, pdfVersion: `V${v.numero}`, fecha: ahora.toISOString().slice(0, 10), workItemId: wi, disenoVersionId: v.id, solicitadoEn: ahora, numerosLegalesUrl: datos.numerosLegalesUrl ?? null,
      }).returning();
      exigir(final, 'No se pudo solicitar revisión final');
      await tx.update(disenoVersiones).set({ calidadWorkItemId: wi, calidadFaseId: final.id }).where(eq(disenoVersiones.id, v.id));
      await aviso(tx, p.id, 'soporte_editorial', null, 'Versión aprobada por autor lista para revisión final. Verifique números legales adjuntos o indique su incorporación en comentarios.');
    }
    await evento(tx, q, p.id, actor.id, ({ enviar_autor: 'CALIDAD_ENVIADA_AUTOR', feedback_autor: 'CALIDAD_FEEDBACK_AUTOR', aprobar_autor: 'CALIDAD_APROBADA_AUTOR', revision_final: 'CALIDAD_REVISION_FINAL_SOLICITADA' } as const)[datos.accion]);
    return { ok: true };
  }, datos.accion === 'revision_final');
}
export async function listarCalidad(actor: Actor, proyectoId?: string) {
  exigir(['soporte_editorial', 'especialista', 'jefe_area', 'disenador'].includes(actor.rol), 'Rol no autorizado', 403);
  if (proyectoId) {
    const [p] = await db.select().from(proyectos).where(eq(proyectos.id, proyectoId)); exigir(p, 'Proyecto no encontrado', 404);
    if (actor.rol === 'especialista' || actor.rol === 'disenador') exigir((actor.rol === 'especialista' ? p.especialistaId : p.disenadorId) === actor.id, 'Proyecto ajeno', 403);
  }
  const condiciones = [isNotNull(fichaCalidadFases.workItemId)];
  if (proyectoId) condiciones.push(eq(proyectos.id, proyectoId));
  if (actor.rol === 'especialista') condiciones.push(eq(proyectos.especialistaId, actor.id));
  if (actor.rol === 'disenador') condiciones.push(eq(proyectos.disenadorId, actor.id));
  const filas = await db.select({ ronda: fichaCalidadFases, version: disenoVersiones, diseno: disenos, proyectoCodigo: proyectos.codigo, autorNombre: autores.nombre, estado: workItems.estado })
    .from(fichaCalidadFases).innerJoin(disenoVersiones, eq(fichaCalidadFases.disenoVersionId, disenoVersiones.id))
    .innerJoin(disenos, eq(disenoVersiones.disenoId, disenos.id)).innerJoin(proyectos, eq(disenos.proyectoId, proyectos.id))
    .innerJoin(autores, eq(proyectos.autorId, autores.id)).innerJoin(workItems, eq(fichaCalidadFases.workItemId, workItems.id))
    .where(and(...condiciones)).orderBy(desc(fichaCalidadFases.solicitadoEn));
  return Promise.all(filas.map(async f => {
    const [actual] = await db.select({ id: disenoVersiones.id }).from(disenoVersiones).where(eq(disenoVersiones.disenoId, f.diseno.id)).orderBy(desc(disenoVersiones.numero)).limit(1);
    const [anterior] = await db.select().from(disenoVersiones).where(and(eq(disenoVersiones.disenoId, f.diseno.id), eq(disenoVersiones.numero, f.version.numero - 1)));
    const activa = actual?.id === f.version.id && f.version.calidadFaseId === f.ronda.id;
    const tripaLista = activa && f.ronda.numeroFase >= 3 && f.ronda.aprobado === true;
    // Manual §6.1: el siguiente proceso consume tripa y cubierta aprobadas.
    // Se verifica la cubierta más reciente, no cualquier aprobación antigua.
    const [cubierta] = await db.select().from(disenos).where(and(eq(disenos.proyectoId, f.diseno.proyectoId), eq(disenos.tipo, 'cubierta_extendida'))).orderBy(desc(disenos.solicitadoEn)).limit(1);
    const [cv] = cubierta ? await db.select().from(disenoVersiones).where(eq(disenoVersiones.disenoId, cubierta.id)).orderBy(desc(disenoVersiones.numero)).limit(1) : [];
    const [creativa] = cv?.revisionCreativaId ? await db.select().from(direccionesCreativas).where(eq(direccionesCreativas.id, cv.revisionCreativaId)) : [];
    const cubiertaLista = !!(cubierta?.cerradoEn && cv?.aprobadaAutorEn && cv.aprobadaInternaEn && creativa?.resultadoFinal === 'aprobado');
    return { ...f.ronda, proyectoId: f.diseno.proyectoId, disenoId: f.diseno.id, proyectoCodigo: f.proyectoCodigo, autorNombre: f.autorNombre, estado: f.estado,
      fuenteUrl: f.diseno.fuenteUrl, version: f.version, activa,
      comentariosAnterioresUrl: anterior?.feedbackArchivoUrl ?? null, versionAnteriorUrl: anterior?.enlace ?? null,
      tripaLista, cubiertaLista, listoPaqueteFinal: tripaLista && cubiertaLista,
      criterios: criteriosDeFase(f.ronda.numeroFase), diasReferencia: f.ronda.numeroFase === 1 ? 1 : null, plazo: plazoDiseno(f.ronda.dueAt, f.ronda.revisadoEn),
    };
  }));
}
