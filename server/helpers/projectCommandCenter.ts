import { obtenerColaTrabajoEspecialista } from './especialistaMiTrabajo.js';
import { getProjectFinancialStatus } from './estadoFinanciero.js';
import { editorialInterventions } from './editorialChief.js';
import { and, asc, desc, eq, isNull, ne } from 'drizzle-orm';
import { db } from '../db/client.js';
import { fases, pasos, servicioFases, projectAssignments, users, workItems, pagos, proyectos, decisiones, preparacionesProyecto, fichasTrazabilidad } from '../db/schema/index.js';
import { PROCESOS_OPERATIVOS } from '../../shared/operacionEspecialista.js';
import { proyectarPreparacion } from './preparacionInicial.js';
import { emptyWorkspace,workspaceSummaries } from '../modules/project-workspaces/queries.js';
import { contextosActivacion } from './solicitudesArea.js';
import { ErrorFichaViva, resumenFichaViva, verificarAccesoFichaViva } from './fichaViva.js';
import { NOMBRES_PROCESO, obtenerDashboardJefatura } from './jefatura.js';
import { registrarEvento } from './auditLog.js';
import type { ActorFicha } from './intakeRrpp.js';
import type { ProjectCommandCenter, ProcesoProyecto, TrabajoProyecto } from '../../shared/projectCommandCenter.js';

const activos = ['en_proceso', 'retrasado', 'stand_by', 'pausado'];
export async function accesoCommandCenter(id: string, actor: ActorFicha) {
  if (!['especialista', 'jefe_area', 'rrpp'].includes(actor.rol)) throw new ErrorFichaViva(403, 'No autorizado para el centro del proyecto');
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
  const financial = await getProjectFinancialStatus(id);
  const [ficha, snapshot, rows, assignments, configuracion, paymentStates, cases, preparaciones, activaciones, control, editorial] = await Promise.all([
    resumenFichaViva(id, actor),
    obtenerDashboardJefatura(new Date(), { historico: true, incluirRetirados: true, proyectoId: id }),
    db.select({ item: workItems, paso: pasos.nombre, fase: fases.nombre }).from(workItems)
      .leftJoin(pasos, eq(pasos.id, workItems.pasoId)).leftJoin(fases, eq(fases.id, pasos.faseId))
      .where(eq(workItems.proyectoId, id)).orderBy(asc(workItems.createdAt), asc(workItems.id)),
    db.select({ proyectoId: projectAssignments.proyectoId, finalizadoEn: projectAssignments.finalizadoEn, workItemId: projectAssignments.workItemId, nombre: users.nombre, tipo: projectAssignments.tipo, asignadoEn: projectAssignments.asignadoEn }).from(projectAssignments)
      .innerJoin(users, eq(users.id, projectAssignments.usuarioId))
      .where(and(eq(projectAssignments.proyectoId, id), isNull(projectAssignments.finalizadoEn))),
    db.select({ codigo: fases.codigo, nombre: fases.nombre }).from(servicioFases)
      .innerJoin(fases, eq(fases.id, servicioFases.faseId))
      .where(and(eq(servicioFases.servicioId, p.servicioId), eq(servicioFases.activo, true), eq(fases.activo, true)))
      .orderBy(asc(servicioFases.orden)),
    db.select({ estado: pagos.estatus }).from(pagos).where(eq(pagos.proyectoId, id)),
    db.select().from(decisiones).where(and(eq(decisiones.proyectoId,id),eq(decisiones.targetRole,'jefe_area'),ne(decisiones.status,'resuelta'))),
    db.select().from(preparacionesProyecto).where(eq(preparacionesProyecto.proyectoId, id)),
    contextosActivacion([id]),
    db.select().from(fichasTrazabilidad).where(eq(fichasTrazabilidad.proyectoId, id)),
    editorialInterventions(undefined,id),
  ]);
  const salud = snapshot.proyectos[0] ?? null;
  const editorialById=new Map(editorial.map(i=>[i.workItemId,i]));
  const procesos = agruparProcesos(rows.filter(({item}) => !['intake_rrpp', 'asignacion_especialista', 'preparacion_inicial'].includes(item.tipo) && !(item.tipo==='edicion'&&item.businessKey==='default'&&editorial.length&&!editorialById.has(item.id))).map(({ item, paso, fase }) => {
    const central = salud?.procesos.find(t => t.id === item.id);
    const edition=editorialById.get(item.id);
    return { id: item.id, tipo: item.tipo, nombre: NOMBRES_PROCESO[item.tipo] ?? fase ?? paso ?? 'Proceso registrado',
      instancia: paso ?? (item.businessKey.startsWith('diseno-version:') ? 'Versión diagramada' : item.businessKey === 'activacion_amazon' ? 'Activación de cuenta Amazon' : item.businessKey === 'default' ? 'Intervención inicial' : item.businessKey === 'planificacion' ? 'Planificación de lanzamiento' : item.businessKey === 'revision-adicional-demo' ? 'Revisión adicional' : item.businessKey.startsWith('tripa_completa') ? 'Tripa completa' : item.businessKey.startsWith('preliminares') ? 'Preliminares' : item.businessKey.startsWith('cubierta') ? 'Cubierta' : 'Intervención editorial'), estado: central?.estado ?? item.estado,
      responsable: central?.responsable ?? (assignments.filter(a => a.workItemId === item.id).map(a => a.nombre).join(', ') || null),
      vence: central?.vence ?? item.fechaFinPautada, vencido: central?.vencido ?? false,
      gate: item.gateBloqueante, decisionId: central?.decisionId ?? null,
      inicio: item.fechaInicioReal, cierre: item.fechaFinReal,
      ...(edition?{instancia:edition.label,responsable:edition.editor,vence:edition.dueDate,vencido:edition.overdue,stateLabel:edition.state}:{}), };
  }));
  const editionProcess=procesos.find(process=>process.tipo==='edicion');
  if(editionProcess&&editorial.length&&editorial.every(i=>!i.actionable&&!i.needsAssignment)){
    const waiting=[...new Set(editorial.filter(i=>i.state.startsWith('Esperando')).map(i=>i.state))];
    if(waiting.length)editionProcess.estado=waiting.length===1?waiting[0]!:'En coordinación';
  }
  const editoriales = procesos.flatMap(p => p.trabajos).filter(t => !['intake_rrpp', 'asignacion_especialista'].includes(t.tipo));
  for (const [key, estado] of [['active', 'en_progreso'], ['pending', 'pendiente'], ['blocked', 'bloqueado'], ['completed', 'completado']] as const)
    ficha.summary[key] = editoriales.filter(t => t.estado === estado).length;
  // Existing work always wins over applicability: preserve historical/legacy cases.
  for (const c of configuracion) if (!['intake_rrpp', 'asignacion_especialista', 'proyecto', 'ingreso'].includes(c.codigo) && !procesos.some(g => g.tipo === c.codigo))
    procesos.push({ tipo: c.codigo, nombre: c.nombre, estado: 'No iniciado', detalle: 'Configuración activa del servicio; sin intervención registrada', trabajos: [] });
  // Native area projection distinguishes No aplica / not enabled; never ten fake phases.
  const tipos: Record<string, string> = { proyecto: 'intake_rrpp', edicion: 'edicion', correccion: 'correccion', diseno: 'diseno', calidad: 'calidad', digital: 'soporte_digital', lanzamiento: 'lanzamiento', impresion: 'impresion', distribucion: 'distribucion' };
  for (const area of ficha.traceability) if (area.id !== 'proyecto' && !procesos.some(g => g.tipo === tipos[area.id]))
    procesos.push({ tipo: tipos[area.id]!, nombre: area.name, estado: area.state, detalle: area.detail, trabajos: [] });
  if (!procesos.some(g => g.tipo === 'direccion_creativa')) procesos.push({ tipo: 'direccion_creativa', nombre: 'Dirección creativa', estado: 'No iniciado', detalle: 'Brief, conceptos y aprobaciones mediante el flujo creativo', trabajos: [] });
  const assigned = assignments.find(a => a.tipo === 'especialista' && !a.workItemId);
  const workspaceMap=await workspaceSummaries([id]),workspace=workspaceMap.get(id)??emptyWorkspace();
  const preparacion = proyectarPreparacion(preparaciones[0], assigned?.asignadoEn ?? null, actor.rol === 'especialista' && activos.includes(p.estado),workspace);
  if (p.especialistaId || assigned) procesos.unshift({ tipo: 'preparacion_inicial', nombre: 'Preparación inicial', estado: preparacion.estado,
    detalle: [preparacion.primerContactoEn ? 'Primer contacto registrado' : 'Primer contacto pendiente', preparacion.reunionOperativaRealizada ? 'Reunión realizada' : preparacion.reunionOperativaFecha ? 'Reunión programada' : 'Reunión por programar', preparacion.driveEstado==='configurado' ? 'Drive configurado' : 'Drive sin configurar'].join(' · '), trabajos: [] });
  for (const proceso of procesos) {
    const owner = PROCESOS_OPERATIVOS[proceso.tipo];
    proceso.nombre = owner?.nombre ?? proceso.nombre;
    proceso.ownerRole = owner?.ownerRole; proceso.ownerLabel = owner?.ownerLabel;
    proceso.coordinacion = owner?.coordinacion;
    proceso.assignee = assignments.filter(a => a.tipo === owner?.ownerRole && (!a.workItemId || proceso.trabajos.some(t => t.id === a.workItemId))).map(a => a.nombre).join(', ') || null;
    if(proceso.tipo === 'impresion')proceso.assignee = control[0]?.impresionResponsable ?? null;
    if(proceso.detalle === 'Sin procesos operativos registrados')proceso.detalle = 'Aún no iniciado';
    const ctx = activaciones.get(id)?.find(c => c.tipo === proceso.tipo);
    if (ctx) {
      if(proceso.tipo==='impresion')proceso.assignee=control[0]?.impresionResponsable ?? ctx.operadoPor ?? null;
      const keys = proceso.tipo === 'lanzamiento' ? ['asesoriaFase', 'lanzamientoPromocionFechaPrimeraReunion', 'lanzamientoPromocionFechaSegundaReunion', 'lanzamientoPromocionFechaTentativa', 'lanzamientoPromocionObservaciones']
        : ['impresionEstatus', 'impresionResponsable', 'impresionEstadoCotizacion', 'impresionFechaInicio', 'impresionFechaEntrega', 'impresionObservaciones'];
      proceso.seguimiento = keys.map(key => ({ key, label: key === 'asesoriaFase' ? 'Estado de planificación' : key.replace(/^(lanzamientoPromocion|impresion)/, '').replace(/([a-z])([A-Z])/g, '$1 $2'), value: control[0]?.[key as keyof typeof fichasTrazabilidad.$inferSelect] ?? null, source: 'fichas_trazabilidad', editable: false }));
      proceso.activacion = ctx;
      if (ctx.solicitud && !ctx.activo) proceso.estado = ctx.solicitud.estado === 'requiere_informacion' ? 'Requiere información' : ctx.solicitud.estado === 'rechazada' ? 'Solicitud rechazada' : 'Pendiente RRPP';
      else if (ctx.activo) proceso.estado = proceso.tipo === 'lanzamiento' ? control[0]?.asesoriaFase ?? 'En planificación' : control[0]?.impresionEstatus ?? 'En coordinación';
      else proceso.estado = ctx.gate.desbloqueado ? 'Disponible para solicitar' : 'Aún no habilitado';
      proceso.detalle = ctx.solicitud && !ctx.activo ? 'Solicitud enviada; RRPP recibe y coordina' : ctx.activo ? 'Proceso operado por RRPP; consulta y seguimiento del Especialista' : ctx.gate.motivo;
      proceso.action = ctx.solicitud && !ctx.activo ? actor.rol === 'jefe_area' ? { label: 'Ver seguimiento', kind: 'seguimiento' } : { label: ctx.solicitud.estado === 'requiere_informacion' && actor.rol === 'especialista' ? 'Responder solicitud' : 'Ver solicitud', kind: 'solicitud', href: `/${actor.rol === 'rrpp' ? 'rrpp/solicitudes' : ''}?${actor.rol === 'rrpp' ? '' : 'vista=solicitudes&'}request=${ctx.solicitud.id}` }
        : ctx.activo ? { label: 'Ver seguimiento', kind: 'seguimiento' }
        : ctx.gate.desbloqueado && actor.rol === 'especialista' && activos.includes(p.estado) ? { label: proceso.tipo === 'lanzamiento' ? 'Solicitar activación' : 'Solicitar impresión', kind: 'solicitar' } : null;
    } else if (proceso.tipo === 'preparacion_inicial') proceso.action = { label: preparacion.editable ? 'Continuar preparación' : 'Ver preparación', kind: 'abrir' };
    else if (proceso.estado === 'No aplica') proceso.action = null;
    else {
      proceso.action = owner ? { label: actor.rol === 'especialista' && proceso.trabajos.some(t => t.estado === 'pendiente') ? 'Continuar coordinación' : 'Ver seguimiento', kind: 'abrir' } : null;
    }
  }
  const atencion: ProjectCommandCenter['atencion'] = [];
  if (activos.includes(p.estado)) {
    for (const c of cases) atencion.push({id:c.id,titulo:actor.rol==='jefe_area'?'Revisar decisión: '+c.subject:c.status==='informacion_solicitada'&&c.requestedByUserId===actor.id?'Responder a Jefatura':'Decisión pendiente: '+c.subject,detalle:c.status==='informacion_solicitada'?'Información adicional solicitada':'Revisión de Jefatura en curso',href:actor.rol==='jefe_area'?`/?vista=decisiones&decision=${c.id}`:c.requestedByUserId===actor.id?`/decisiones/${c.id}/responder`:undefined,proceso:c.requestedByUserId===actor.id?undefined:'correccion'});
    if(actor.rol === 'jefe_area') for (const trabajo of editoriales.filter(t=>['pendiente','en_progreso','bloqueado'].includes(t.estado)&&t.vencido)) atencion.push({id:'vence-'+trabajo.id,titulo:trabajo.nombre+' · entrega vencida',detalle:trabajo.responsable??'Consultar responsable del proceso',proceso:trabajo.tipo});
    if (actor.rol === 'jefe_area') {
      if (salud?.porAsignar) atencion.push({id:'asignacion',titulo:'Asignar Especialista',detalle:'Ingreso completo y pendiente de distribución',href:`/?vista=asignaciones&proyecto=${id}`});
      for(const request of snapshot.requests.filter(r=>r.requiereJefatura)) atencion.push({id:request.id,titulo:request.titulo,detalle:'Solicitud operativa pendiente',href:'/?vista=solicitudes'});
    } else if (salud && actor.rol === 'especialista') {
      atencion.length=0;
      const cola=await obtenerColaTrabajoEspecialista(actor.id,{tab:'pendientes',search:'',page:1,pageSize:50},new Date(),id,snapshot,{
        trabajos:rows.map(r=>r.item),datos:[{id:p.id,titulo:p.tituloDefinitivo,subtitulo:p.subtituloDefinitivo,editorId:p.editorId,feedbackTripa:p.fechaFeedbackTripa}],
        casos:cases,activaciones,preparaciones,asignaciones:assignments.filter(a=>a.tipo==='especialista'),workspaces:workspaceMap,
      });
      atencion.push(...cola.items.map(i=>({id:i.id,titulo:i.accion,detalle:i.detalle,proceso:i.proceso,href:i.href,editarContexto:i.editarContexto})));
    }
  }
  for(const proceso of procesos) {
    if(proceso.activacion || proceso.tipo==='preparacion_inicial')continue;
    const decision=proceso.trabajos.find(t=>t.decisionId)?.decisionId;
    const own=atencion.find(a=>a.proceso===proceso.tipo&&!a.href);
    if(decision)proceso.action={kind:'abrir',label:'Ver decisión',href:actor.rol==='jefe_area'?`/?vista=decisiones&decision=${decision}`:`/decisiones/${decision}/responder`};
    else if(own&&actor.rol==='especialista')proceso.action={kind:'abrir',label:own.titulo.startsWith('Revisar entrega')?'Revisar entrega':own.titulo};
  }
  const prioridad=(proceso:ProcesoProyecto)=>proceso.tipo==='preparacion_inicial'?0:proceso.action?.kind==='solicitar'?1:atencion.some(a=>a.proceso===proceso.tipo)?2:['En curso','En planificación','En coordinación'].includes(proceso.estado)?3:proceso.estado==='Requiere información'?4:proceso.estado==='Pendiente RRPP'?5:proceso.estado==='Completo'?8:proceso.estado==='No aplica'?9:6;
  procesos.sort((a,b)=>prioridad(a)-prioridad(b));
  return { atencion, ficha, salud: salud ? { especialista: salud.especialista, express: salud.express, riesgo: salud.riesgo, fechaObjetivo: salud.fechaObjetivo } : null,
    preparacion, contextoPrevio: [
      { key: 'rrpp', label: 'Entrega de RRPP a Jefatura', value: p.notificadoJefatura ? 'Registrada · ver Actividad' : 'Sin entrega registrada', source: 'proyectos.notificadoJefatura', editable: false },
      { key: 'asignacion', label: 'Asignación del Especialista', value: assigned?.asignadoEn.toISOString() ?? (p.especialistaId ? 'Asignación anterior sin fecha auditada' : 'Pendiente'), source: 'project_assignments.asignadoEn', editable: false },
    ],
    datosEditoriales: { titulo: p.tituloDefinitivo, subtitulo: p.subtituloDefinitivo, manuscritoUrl: p.manuscritoUrl },
    procesos, capabilities: { supervisar: actor.rol === 'jefe_area', registrarAvance: actor.rol === 'especialista' && activos.includes(p.estado) },
    administracion: [
      { key: 'contratoFirmado', label: 'Contrato firmado', value: p.contratoFirmado, source: 'proyectos.contratoFirmado', editable: false },
      { key: 'pagosRegistrados', label: 'Abonos registrados', value: paymentStates.length, source: 'pagos', editable: false },
      { key: 'pagosVerificados', label: 'Abonos verificados', value: paymentStates.filter(a => a.estado === 'Verificado').length, source: 'pagos.estatus', editable: false },
      { key: 'solvencia', label: 'Solvencia', value: !financial || financial.solvencyStatus === 'Pendiente' ? 'Sin confirmación de Comercial' : financial.solvencyStatus, source: 'Comercial; aprobación explícita', editable: false },
      { key: 'gateFinanciero', label: 'Gate de solvencia', value: financial?.financialGateStatus ?? 'No aplicable', source: 'Estado financiero central', editable: false },
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
