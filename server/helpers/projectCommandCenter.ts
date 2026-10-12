import { accionesEspecialista } from './atencionEspecialista.js';
import { and, asc, desc, eq, isNull, ne } from 'drizzle-orm';
import { db } from '../db/client.js';
import { fases, pasos, servicioFases, projectAssignments, users, workItems, pagos, proyectos, decisiones, direccionesCreativas, disenos, disenoVersiones, fichaCalidadFases, capitulos } from '../db/schema/index.js';
import { ErrorFichaViva, resumenFichaViva, verificarAccesoFichaViva } from './fichaViva.js';
import { NOMBRES_PROCESO, obtenerDashboardJefatura } from './jefatura.js';
import { registrarEvento } from './auditLog.js';
import type { ActorFicha } from './intakeRrpp.js';
import type { ProjectCommandCenter, ProcesoProyecto, TrabajoProyecto } from '../../shared/projectCommandCenter.js';

const activos = ['en_proceso', 'retrasado', 'stand_by', 'pausado'];
export async function accesoCommandCenter(id: string, actor: ActorFicha) {
  if (!['especialista', 'jefe_area'].includes(actor.rol)) throw new ErrorFichaViva(403, 'No autorizado para el centro del proyecto');
  return verificarAccesoFichaViva(id, actor);
}

export function agruparProcesos(trabajos: TrabajoProyecto[]): ProcesoProyecto[] {
  const grupos = new Map<string, TrabajoProyecto[]>();
  for (const t of trabajos) { const grupo = grupos.get(t.tipo) ?? []; grupo.push(t); grupos.set(t.tipo, grupo); }
  return [...grupos].map(([tipo, items]) => ({ tipo, nombre: items[0]!.nombre,
    estado: items.some(t => t.estado === 'bloqueado' || t.decisionId) ? 'Bloqueado' : items.some(t => t.estado === 'en_progreso') ? 'En curso' : items.some(t => t.estado === 'pendiente') ? 'Pendiente' : items.some(t => t.estado === 'completado') ? 'Completo' : 'Cancelado',
    detalle: `${items.length} ${items.length === 1 ? 'intervención registrada' : 'intervenciones registradas'}`,
    trabajos: items,
  }));
}

export async function obtenerCommandCenter(id: string, actor: ActorFicha): Promise<ProjectCommandCenter> {
  const p = await accesoCommandCenter(id, actor);
  const [ficha, snapshot, rows, assignments, configuracion, paymentStates, cases, creatives, versions, reviews, chapters] = await Promise.all([
    resumenFichaViva(id, actor),
    obtenerDashboardJefatura(new Date(), { historico: true, incluirRetirados: true, proyectoId: id }),
    db.select({ item: workItems, paso: pasos.nombre, fase: fases.nombre }).from(workItems)
      .leftJoin(pasos, eq(pasos.id, workItems.pasoId)).leftJoin(fases, eq(fases.id, pasos.faseId))
      .where(eq(workItems.proyectoId, id)).orderBy(asc(workItems.createdAt), asc(workItems.id)),
    db.select({ workItemId: projectAssignments.workItemId, nombre: users.nombre }).from(projectAssignments)
      .innerJoin(users, eq(users.id, projectAssignments.usuarioId))
      .where(and(eq(projectAssignments.proyectoId, id), isNull(projectAssignments.finalizadoEn))),
    db.select({ codigo: fases.codigo, nombre: fases.nombre }).from(servicioFases)
      .innerJoin(fases, eq(fases.id, servicioFases.faseId))
      .where(and(eq(servicioFases.servicioId, p.servicioId), eq(servicioFases.activo, true), eq(fases.activo, true)))
      .orderBy(asc(servicioFases.orden)),
    db.select({ estado: pagos.estatus }).from(pagos).where(eq(pagos.proyectoId, id)),
    db.select({id:decisiones.id,subject:decisiones.subject,status:decisiones.status,requester:decisiones.requestedByUserId}).from(decisiones).where(and(eq(decisiones.proyectoId,id),eq(decisiones.targetRole,'jefe_area'),ne(decisiones.status,'resuelta'))),
    db.select({id:direccionesCreativas.id,brief:direccionesCreativas.fechaBriefEnviadoEspecialista,autor:direccionesCreativas.fechaBriefAprobadoAutor,enviado:direccionesCreativas.fechaBriefEnviadoAutor,workId:direccionesCreativas.workItemId}).from(direccionesCreativas).where(and(eq(direccionesCreativas.proyectoId,id),isNull(direccionesCreativas.fechaCierre))),
    db.selectDistinctOn([disenos.id],{id:disenos.id,tipo:disenos.tipo,enviado:disenoVersiones.enviadaAutorEn,aprobado:disenoVersiones.aprobadaAutorEn,feedback:disenoVersiones.feedbackEn,handoff:disenoVersiones.handoffEn,venceAutor:disenoVersiones.feedbackAutorDueAt,calidadId:disenoVersiones.calidadFaseId}).from(disenos).innerJoin(disenoVersiones,eq(disenoVersiones.disenoId,disenos.id)).where(eq(disenos.proyectoId,id)).orderBy(asc(disenos.id),desc(disenoVersiones.numero)),
    db.select({id:fichaCalidadFases.id,revisado:fichaCalidadFases.revisadoEn,aprobado:fichaCalidadFases.aprobado,autor:disenoVersiones.aprobadaAutorEn,fase:fichaCalidadFases.numeroFase}).from(fichaCalidadFases).innerJoin(disenoVersiones,eq(disenoVersiones.calidadFaseId,fichaCalidadFases.id)).innerJoin(disenos,eq(disenos.id,disenoVersiones.disenoId)).where(eq(disenos.proyectoId,id)),
    db.select({numero:capitulos.numero,entrega:capitulos.fechaEntregaEditor,envio:capitulos.fechaEnvioAutor,respuesta:capitulos.fechaRespuestaReal,vence:capitulos.fechaPautadaFeedback}).from(capitulos).where(eq(capitulos.proyectoId,id)),
  ]);
  const salud = snapshot.proyectos[0] ?? null;
  const procesos = agruparProcesos(rows.map(({ item, paso, fase }) => {
    const central = salud?.procesos.find(t => t.id === item.id);
    return { id: item.id, tipo: item.tipo, nombre: NOMBRES_PROCESO[item.tipo] ?? fase ?? paso ?? 'Proceso registrado',
      instancia: paso ?? (item.businessKey.startsWith('diseno-version:') ? 'Versión diagramada' : item.businessKey === 'activacion_amazon' ? 'Activación de cuenta Amazon' : item.businessKey === 'default' ? 'Intervención inicial' : item.businessKey === 'planificacion' ? 'Planificación de lanzamiento' : item.businessKey === 'revision-adicional-demo' ? 'Revisión adicional' : item.businessKey.startsWith('tripa_completa') ? 'Tripa completa' : item.businessKey.startsWith('preliminares') ? 'Preliminares' : item.businessKey.startsWith('cubierta') ? 'Cubierta' : 'Intervención editorial'), estado: central?.estado ?? item.estado,
      responsable: central?.responsable ?? (assignments.filter(a => a.workItemId === item.id).map(a => a.nombre).join(', ') || null),
      vence: central?.vence ?? item.fechaFinPautada, vencido: central?.vencido ?? false,
      gate: item.gateBloqueante, decisionId: central?.decisionId ?? null,
      inicio: item.fechaInicioReal, cierre: item.fechaFinReal };
  }));
  const editoriales = procesos.flatMap(p => p.trabajos).filter(t => !['intake_rrpp', 'asignacion_especialista'].includes(t.tipo));
  for (const [key, estado] of [['active', 'en_progreso'], ['pending', 'pendiente'], ['blocked', 'bloqueado'], ['completed', 'completado']] as const)
    ficha.summary[key] = editoriales.filter(t => t.estado === estado).length;
  // Existing work always wins over applicability: preserve historical/legacy cases.
  for (const c of configuracion) if (!procesos.some(g => g.tipo === c.codigo))
    procesos.push({ tipo: c.codigo, nombre: c.nombre, estado: 'No iniciado', detalle: 'Configuración activa del servicio; sin intervención registrada', trabajos: [] });
  // Native area projection distinguishes No aplica / not enabled; never ten fake phases.
  const tipos: Record<string, string> = { proyecto: 'intake_rrpp', edicion: 'edicion', correccion: 'correccion', diseno: 'diseno', calidad: 'calidad', digital: 'soporte_digital', lanzamiento: 'lanzamiento', impresion: 'impresion', distribucion: 'distribucion' };
  for (const area of ficha.traceability) if (!procesos.some(g => g.tipo === tipos[area.id]))
    procesos.push({ tipo: tipos[area.id]!, nombre: area.name, estado: area.state, detalle: area.detail, trabajos: [] });
  if (!procesos.some(g => g.tipo === 'direccion_creativa')) procesos.push({ tipo: 'direccion_creativa', nombre: 'Dirección creativa', estado: 'No iniciado', detalle: 'Brief, conceptos y aprobaciones mediante el flujo creativo', trabajos: [] });
  const atencion: ProjectCommandCenter['atencion'] = [];
  if (activos.includes(p.estado)) {
    for (const c of cases) atencion.push({id:c.id,titulo:actor.rol==='jefe_area'?'Revisar decisión: '+c.subject:c.status==='informacion_solicitada'&&c.requester===actor.id?'Responder a Jefatura':'Decisión pendiente: '+c.subject,detalle:c.status==='informacion_solicitada'?'Información adicional solicitada':'Revisión de Jefatura en curso',href:actor.rol==='jefe_area'?`/?vista=decisiones&decision=${c.id}`:c.requester===actor.id?`/decisiones/${c.id}/responder`:undefined,proceso:c.requester===actor.id?undefined:'correccion'});
    if(actor.rol === 'jefe_area') for (const trabajo of editoriales.filter(t=>['pendiente','en_progreso','bloqueado'].includes(t.estado)&&t.vencido)) atencion.push({id:'vence-'+trabajo.id,titulo:trabajo.nombre+' · entrega vencida',detalle:trabajo.responsable??'Consultar responsable del proceso',proceso:trabajo.tipo});
    if (actor.rol === 'jefe_area') {
      if (salud?.porAsignar) atencion.push({id:'asignacion',titulo:'Asignar Especialista',detalle:'Ingreso completo y pendiente de distribución',href:`/?vista=asignaciones&proyecto=${id}`});
      for(const request of snapshot.requests.filter(r=>r.requiereJefatura)) atencion.push({id:request.id,titulo:request.titulo,detalle:'Solicitud operativa pendiente',href:'/?vista=solicitudes'});
    } else if (salud) {
      atencion.push(...accionesEspecialista(salud, { titulo: p.tituloDefinitivo, subtitulo: p.subtituloDefinitivo, editorId: p.editorId, capitulos: chapters, decisiones: cases, creativas: creatives, versiones: versions, revisiones: reviews.filter(q=>versions.some(v=>v.calidadId===q.id)) }, actor.id));
    }
  }
  return { atencion, ficha, salud: salud ? { especialista: salud.especialista, express: salud.express, riesgo: salud.riesgo, fechaObjetivo: salud.fechaObjetivo } : null,
    datosEditoriales: { titulo: p.tituloDefinitivo, subtitulo: p.subtituloDefinitivo, manuscritoUrl: p.manuscritoUrl },
    procesos, capabilities: { supervisar: actor.rol === 'jefe_area', registrarAvance: actor.rol === 'especialista' && activos.includes(p.estado) },
    administracion: [
      { key: 'contratoFirmado', label: 'Contrato firmado', value: p.contratoFirmado, source: 'proyectos.contratoFirmado', editable: false },
      { key: 'pagosRegistrados', label: 'Abonos registrados', value: paymentStates.length, source: 'pagos', editable: false },
      { key: 'pagosVerificados', label: 'Abonos verificados', value: paymentStates.filter(a => a.estado === 'Verificado').length, source: 'pagos.estatus', editable: false },
      { key: 'solvencia', label: 'Solvencia', value: 'Sin confirmación de Cobranzas', source: 'Comercial / Cobranzas; no inferida de los abonos', editable: false },
      ...ficha.overview.filter(f => ['budget', 'ingresoServicioPresupuesto', 'ingresoServicioAlianza', 'capitulosPactados', 'paginasPactadas'].includes(f.key)).map(f => ({ ...f, editable: false })),
    ],
  };
}

export async function registrarAvanceProyecto(id: string, texto: string, actor: ActorFicha) {
  if (actor.rol !== 'especialista') throw new ErrorFichaViva(403, 'Solo el Especialista asignado puede registrar avances');
  await db.transaction(async tx => {
    // Serializes against project reassignment/closure; re-check scope inside transaction.
    await tx.select({ id: proyectos.id }).from(proyectos).where(eq(proyectos.id, id)).for('update');
    const p = await verificarAccesoFichaViva(id, actor, tx);
    if (!activos.includes(p.estado)) throw new ErrorFichaViva(409, 'El proyecto está cerrado');
    await registrarEvento(tx, { actorId: actor.id, accion: 'PROYECTO_AVANCE_REGISTRADO', entityType: 'proyecto', entityId: id, proyectoId: id, detalles: { texto } });
  });
  return { ok: true };
}

export async function guardarDatosEditoriales(id: string, datos: { titulo: string | null; subtitulo: string | null }, actor: ActorFicha) {
  if (actor.rol !== 'especialista') throw new ErrorFichaViva(403, 'Solo el Especialista asignado puede registrar títulos');
  await db.transaction(async tx => {
    await tx.select({id:proyectos.id}).from(proyectos).where(eq(proyectos.id,id)).for('update');
    const p = await verificarAccesoFichaViva(id,actor,tx);
    if (!activos.includes(p.estado)) throw new ErrorFichaViva(409,'El proyecto está cerrado');
    if (p.tituloDefinitivo === datos.titulo && p.subtituloDefinitivo === datos.subtitulo) return;
    await tx.update(proyectos).set({tituloDefinitivo:datos.titulo,subtituloDefinitivo:datos.subtitulo}).where(eq(proyectos.id,id));
    await registrarEvento(tx,{actorId:actor.id,accion:'PROYECTO_TITULOS_REGISTRADOS',entityType:'proyecto',entityId:id,proyectoId:id,detalles:{anterior:{titulo:p.tituloDefinitivo,subtitulo:p.subtituloDefinitivo},nuevo:datos}});
  });
  return {ok:true};
}
