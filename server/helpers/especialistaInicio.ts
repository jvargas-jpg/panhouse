import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { auditLogs, capitulos, decisiones, direccionesCreativas, disenos, disenoVersiones, fichaCalidadFases, proyectos, projectAssignments, users, workItems } from '../db/schema/index.js';
import { obtenerDashboardJefatura, NOMBRES_PROCESO } from './jefatura.js';
import { ESTADOS_ACTIVOS, calcularCarga, especialistaActualSql, scopeEspecialista } from './carga.js';
import { accionesEspecialista, diaCaracas } from './atencionEspecialista.js';
import { UMBRAL_PROXIMO_A_VENCER_HORAS } from './correccionSla.js';
import { etiquetaEventoFicha } from './fichaViva.js';
import type { ActividadInicio, EspecialistaInicio, VencimientoEspecialista } from '../../shared/especialistaInicio.js';

export function clasificarVencimiento(fecha: string, ahora: Date) {
  const precision = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? 'dia' as const : 'instante' as const;
  if (precision === 'dia') {
    const hoy = diaCaracas(ahora), horizonte = diaCaracas(new Date(ahora.getTime()+UMBRAL_PROXIMO_A_VENCER_HORAS*3600000));
    return { precision, vencido: fecha < hoy, proximo: fecha >= hoy && fecha <= horizonte };
  }
  const ms = Date.parse(fecha)-ahora.getTime();
  return { precision, vencido: ms < 0, proximo: ms >= 0 && ms <= UMBRAL_PROXIMO_A_VENCER_HORAS*3600000 };
}

export async function obtenerInicioEspecialista(actorId: string, ahora = new Date()): Promise<EspecialistaInicio> {
  // Native risk/Express/pauses projection, SQL-scoped before reading related work.
  const snapshot = await obtenerDashboardJefatura(ahora, { historico: true, especialistaId: actorId });
  const cartera = snapshot.proyectos;
  const activos = cartera.filter(p => ESTADOS_ACTIVOS.includes(p.estado as typeof ESTADOS_ACTIVOS[number]));
  const ids = activos.map(p => p.id);
  const mes = diaCaracas(ahora).slice(0,7);
  const fallos = new Set<EspecialistaInicio['errores'][number]>();
  async function seguro<T>(bloques: EspecialistaInicio['errores'], lectura: PromiseLike<T>, fallback: T): Promise<T> {
    try { return await lectura; } catch { for(const bloque of bloques)fallos.add(bloque);return fallback; }
  }
  const [datos, chapters, cases, creatives, versions, requests, closures, cierresRegistrados] = await Promise.all([
    seguro(['acciones'], ids.length ? db.select({id: proyectos.id, titulo: proyectos.tituloDefinitivo, subtitulo: proyectos.subtituloDefinitivo, editorId: proyectos.editorId}).from(proyectos).where(inArray(proyectos.id, ids)) : Promise.resolve([]), []),
    seguro(['acciones','vencimientos'], ids.length ? db.select({proyectoId: capitulos.proyectoId, numero: capitulos.numero, entrega: capitulos.fechaEntregaEditor, envio: capitulos.fechaEnvioAutor, respuesta: capitulos.fechaRespuestaReal, vence: capitulos.fechaPautadaFeedback}).from(capitulos).where(inArray(capitulos.proyectoId, ids)) : Promise.resolve([]), []),
    seguro(['acciones','solicitudes'], ids.length ? db.select({id: decisiones.id, proyectoId: decisiones.proyectoId, subject: decisiones.subject, status: decisiones.status, requester: decisiones.requestedByUserId, fecha: decisiones.requestedAt}).from(decisiones).where(and(inArray(decisiones.proyectoId, ids), ne(decisiones.status, 'resuelta'), eq(decisiones.targetRole, 'jefe_area'))) : Promise.resolve([]), []),
    seguro(['acciones'], ids.length ? db.select({id: direccionesCreativas.id, proyectoId: direccionesCreativas.proyectoId, brief: direccionesCreativas.fechaBriefEnviadoEspecialista, autor: direccionesCreativas.fechaBriefAprobadoAutor, enviado: direccionesCreativas.fechaBriefEnviadoAutor}).from(direccionesCreativas).where(and(inArray(direccionesCreativas.proyectoId, ids), isNull(direccionesCreativas.fechaCierre))) : Promise.resolve([]), []),
    seguro(['acciones','vencimientos'], ids.length ? db.selectDistinctOn([disenos.id], {
      id: disenos.id, versionId: disenoVersiones.id, proyectoId: disenos.proyectoId, enviado: disenoVersiones.enviadaAutorEn,
      aprobado: disenoVersiones.aprobadaAutorEn, feedback: disenoVersiones.feedbackEn, handoff: disenoVersiones.handoffEn,
      venceAutor: disenoVersiones.feedbackAutorDueAt, calidadId: disenoVersiones.calidadFaseId,
      revisionId: fichaCalidadFases.id, revisado: fichaCalidadFases.revisadoEn, calidadAprobada: fichaCalidadFases.aprobado, fase: fichaCalidadFases.numeroFase,
    }).from(disenos).innerJoin(disenoVersiones, eq(disenoVersiones.disenoId, disenos.id)).leftJoin(fichaCalidadFases, eq(fichaCalidadFases.id, disenoVersiones.calidadFaseId)).where(inArray(disenos.proyectoId, ids)).orderBy(asc(disenos.id), desc(disenoVersiones.numero)) : Promise.resolve([]), []),
    seguro(['solicitudes'], ids.length ? db.select({id: workItems.id, proyectoId: workItems.proyectoId, tipo: workItems.tipo, estado: workItems.estado, fecha: workItems.createdAt}).from(workItems).where(and(inArray(workItems.proyectoId, ids), inArray(workItems.tipo, ['edicion','direccion_creativa','correccion','diseno','calidad','soporte_digital','lanzamiento']), inArray(workItems.estado,['pendiente','en_progreso','bloqueado']))) : Promise.resolve([]), []),
    // Responsible-at-close is historical. Reassignment afterwards must not move the achievement.
    seguro(['cierres'], pool.query<{count: string}>(`SELECT count(*)::text count FROM (SELECT DISTINCT ON (proyecto_id) detalles,created_at FROM audit_logs WHERE accion='PROYECTO_ESTADO_CAMBIADO' AND detalles->>'nuevo'='culminado' AND created_at <= $3::timestamptz ORDER BY proyecto_id,created_at,id) c WHERE detalles->>'especialistaId'=$1 AND to_char(created_at AT TIME ZONE 'America/Caracas','YYYY-MM')=$2`, [actorId, mes, ahora.toISOString()]).then(r=>r.rows), []),
    seguro(['cierres'], cartera.length ? db.selectDistinct({proyectoId: auditLogs.proyectoId}).from(auditLogs).where(and(inArray(auditLogs.proyectoId, cartera.map(p=>p.id)), eq(auditLogs.accion,'PROYECTO_ESTADO_CAMBIADO'),sql`${auditLogs.detalles}->>'nuevo'='culminado'`)) : Promise.resolve([]), []),
  ]);
  const acciones = activos.flatMap(p => {
    const d = datos.find(d => d.id === p.id);if(!d)return [];
    const vs = versions.filter(v => v.proyectoId === p.id);
    return accionesEspecialista(p, { ...d, capitulos: chapters.filter(c => c.proyectoId === p.id), decisiones: cases.filter(c => c.proyectoId === p.id), creativas: creatives.filter(c => c.proyectoId === p.id), versiones: vs,
      revisiones: vs.flatMap(v => v.revisionId ? [{id: v.revisionId, revisado: v.revisado, aprobado: v.calidadAprobada, autor: v.aprobado, fase: v.fase!}] : []),
    }, actorId, ahora);
  });
  const vencimientos: VencimientoEspecialista[] = [];
  const add = (id: string, proyectoId: string, proceso: string, titulo: string, fecha: string) => vencimientos.push({id, proyectoId, proceso, titulo, fecha, ...clasificarVencimiento(fecha, ahora)});
  for (const p of activos) for (const t of p.procesos) if(t.vence && !t.entregado) add(t.id, p.id, t.tipo, 'Entrega de '+t.nombre, t.vence);
  for (const c of chapters) if(c.envio && !c.respuesta && c.vence) add(c.proyectoId+':cap-'+c.numero, c.proyectoId, 'edicion', 'Feedback del autor · capítulo '+c.numero, c.vence);
  for (const v of versions) if(v.enviado && !v.aprobado && !v.feedback && v.venceAutor) {
    add(v.versionId+':autor', v.proyectoId, 'diseno', 'Respuesta del autor · versión de Diseño', v.venceAutor.toISOString());

  }
  acciones.sort((a,b) => Number(b.prioridad === 'vencida')-Number(a.prioridad === 'vencida') || (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999') || a.id.localeCompare(b.id));
  const claveFecha = (v: VencimientoEspecialista) => v.precision === 'dia' ? v.fecha+'T23:59:59' : diaCaracas(new Date(v.fecha))+'T'+new Intl.DateTimeFormat('en-GB',{timeZone:'America/Caracas',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(v.fecha));
  vencimientos.sort((a,b) => claveFecha(a).localeCompare(claveFecha(b)) || a.id.localeCompare(b.id));
  const destino: Record<string,string> = { edicion: 'Jefatura de Edición', direccion_creativa: 'Jefatura / Creativa', correccion: 'Corrector', diseno: 'Diseño', calidad: 'Soporte editorial', soporte_digital: 'Soporte digital', lanzamiento: 'RRPP' };
  return {
    actualizadoEn: ahora.toISOString(), mes,
    kpis: { activos: activos.length, acciones: fallos.has('acciones') ? null : acciones.length, proximos: fallos.has('vencimientos') ? null : vencimientos.filter(v => v.proximo).length,
      express: activos.filter(p => p.express.estado === 'confirmado').length, cerrados: fallos.has('cierres') ? null : Number(closures[0]?.count ?? 0),
      cierresSinFecha: cartera.filter(p => p.estado === 'culminado' && !cierresRegistrados.some(c=>c.proyectoId===p.id)).length },
    proyectos: cartera.sort((a,b) => b.creadoEn.localeCompare(a.creadoEn) || a.id.localeCompare(b.id)), acciones, vencimientos,
    solicitudes: [...requests.map(r => ({id:r.id, proyectoId:r.proyectoId, proceso:r.tipo, titulo:r.tipo === 'soporte_digital' ? 'Activación Amazon' : NOMBRES_PROCESO[r.tipo] ?? 'Intervención editorial', destino:destino[r.tipo]!, estado:r.estado, fecha:r.fecha.toISOString()})),
      ...cases.map(c => ({id:c.id, proyectoId:c.proyectoId, titulo:c.subject, destino:'Jefatura', estado:c.status, fecha:c.fecha.toISOString(), proceso:'correccion', ...(c.requester === actorId ? {href:'/decisiones/'+c.id+'/responder'} : {})}))].sort((a,b) => b.fecha.localeCompare(a.fecha) || a.id.localeCompare(b.id)),
    errores: [...fallos], carga: calcularCarga(activos.map(p => p.servicio.peso)), horizonteHoras: UMBRAL_PROXIMO_A_VENCER_HORAS,
    objetivos: { disponible:false, motivo:'La matriz contiene compromisos mensuales, pero todavía no existe un registro de objetivos conectado ni está definido quién los establece. Esta consulta estará disponible cuando se confirme ese modelo.' },
  };
}

export async function actividadInicioEspecialista(actorId: string): Promise<ActividadInicio[]> {
  const rows = await db.select({id:auditLogs.id, proyectoId:proyectos.id, titulo:proyectos.tituloDefinitivo, legacy:proyectos.titulo, fecha:auditLogs.createdAt, accion:auditLogs.accion, detalles:auditLogs.detalles, actor:users.nombre})
    .from(auditLogs).innerJoin(proyectos,eq(proyectos.id,auditLogs.proyectoId)).leftJoin(projectAssignments,scopeEspecialista()).leftJoin(users,eq(users.id,auditLogs.actorId))
    .where(eq(especialistaActualSql,actorId)).orderBy(desc(auditLogs.createdAt),desc(auditLogs.id)).limit(30);
  return rows.map(r => ({id:r.id, proyectoId:r.proyectoId, titulo:r.titulo?.trim() || r.legacy?.trim() || 'Proyecto editorial', texto:etiquetaEventoFicha(r.accion,r.detalles), actor:r.actor ?? 'Sistema', fecha:r.fecha.toISOString()}));
}
