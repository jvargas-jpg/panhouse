import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { capitulos, contratosCorreccion, correcciones, decisiones, direccionesCreativas, disenoVersiones, disenos, fichaCalidadFases, proyectos, workItems } from '../db/schema/index.js';
import { diaCaracas } from './atencionEspecialista.js';
import { clasificarVencimiento } from './tiempoEspecialista.js';
import { obtenerDashboardJefatura, NOMBRES_PROCESO } from './jefatura.js';
import { preparacionesProyecto, projectAssignments } from '../db/schema/index.js';
import { contextosActivacion } from './solicitudesArea.js';
import { proyectarPreparacion } from './preparacionInicial.js';
import { emptyWorkspace,workspaceSummaries } from '../modules/project-workspaces/queries.js';
import type { ContextoActivacion } from '../../shared/operacionEspecialista.js';
import type { ProjectWorkspaceSummary } from '../../shared/projectWorkspace.js';
interface ColaPrecargada {
  workspaces?:Map<string,ProjectWorkspaceSummary>;
  trabajos: typeof workItems.$inferSelect[];
  datos: {id:string;titulo:string|null;subtitulo:string|null;editorId:string|null;feedbackTripa:string|null}[];
  casos: typeof decisiones.$inferSelect[];
  activaciones: Map<string,ContextoActivacion[]>;
  preparaciones: typeof preparacionesProyecto.$inferSelect[];
  asignaciones: {proyectoId:string;workItemId:string|null;finalizadoEn:Date|null;asignadoEn:Date}[];
}
import { evaluarGateMomentoReunionCreativa, evaluarGateRevisionPreviaCorreccion } from './gates.js';
import type { FiltrosMiTrabajo, ItemTrabajoEspecialista, MiTrabajo, TabMiTrabajo } from '../../shared/especialistaMiTrabajo.js';
import { TABS_MI_TRABAJO } from '../../shared/especialistaMiTrabajo.js';
const texto=(s:string)=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('es');
const DESTINOS:Record<string,{tipo:string;nombre:string}>={edicion:{tipo:'editor',nombre:'Editor'},correccion:{tipo:'corrector',nombre:'Corrector'},direccion_creativa:{tipo:'lider_creativo',nombre:'Líder Creativo'},diseno:{tipo:'disenador',nombre:'Diseño'},calidad:{tipo:'soporte_editorial',nombre:'Soporte Editorial'},soporte_digital:{tipo:'soporte_digital',nombre:'Soporte Digital'},lanzamiento:{tipo:'rrpp',nombre:'RRPP'}};
const dia=(s:string)=>s.length===10?s:diaCaracas(new Date(s));
export async function obtenerColaTrabajoEspecialista(actorId:string,f:FiltrosMiTrabajo,ahora=new Date(),proyectoScope?:string,snapshotProporcionado?:Awaited<ReturnType<typeof obtenerDashboardJefatura>>,precargada?:ColaPrecargada):Promise<MiTrabajo> {
  const snapshot=snapshotProporcionado ?? await obtenerDashboardJefatura(ahora,{especialistaId:actorId,...(proyectoScope?{proyectoId:proyectoScope}:{})});
  const activos=snapshot.proyectos.filter(p=>p.especialista?.id===actorId&&['en_proceso','retrasado','pausado','stand_by'].includes(p.estado)),ids=activos.map(p=>p.id),hoy=diaCaracas(ahora);
  const [datos,chapters,corrections,creatives,versions,works,cases,contracts]=ids.length?await Promise.all([
    precargada?.datos ?? db.select({id:proyectos.id,titulo:proyectos.tituloDefinitivo,subtitulo:proyectos.subtituloDefinitivo,editorId:proyectos.editorId,feedbackTripa:proyectos.fechaFeedbackTripa}).from(proyectos).where(inArray(proyectos.id,ids)),
    db.select().from(capitulos).where(inArray(capitulos.proyectoId,ids)),
    db.select().from(correcciones).where(inArray(correcciones.proyectoId,ids)),
    db.select().from(direccionesCreativas).where(inArray(direccionesCreativas.proyectoId,ids)),
    db.selectDistinctOn([disenos.id],{d:disenos,v:disenoVersiones,q:fichaCalidadFases,c:direccionesCreativas}).from(disenos).innerJoin(disenoVersiones,eq(disenoVersiones.disenoId,disenos.id)).leftJoin(fichaCalidadFases,eq(fichaCalidadFases.id,disenoVersiones.calidadFaseId)).leftJoin(direccionesCreativas,eq(direccionesCreativas.id,disenoVersiones.revisionCreativaId)).where(inArray(disenos.proyectoId,ids)).orderBy(asc(disenos.id),desc(disenoVersiones.numero)),
    precargada?.trabajos ?? db.select().from(workItems).where(inArray(workItems.proyectoId,ids)),
    precargada?.casos ?? db.select().from(decisiones).where(and(inArray(decisiones.proyectoId,ids),inArray(decisiones.status,['pendiente','en_revision','informacion_solicitada']))),
    db.select({r:contratosCorreccion,proyectoId:correcciones.proyectoId}).from(contratosCorreccion).innerJoin(correcciones,eq(correcciones.id,contratosCorreccion.correccionId)).where(inArray(correcciones.proyectoId,ids)).orderBy(desc(contratosCorreccion.ronda)),
  ]):[[],[],[],[],[],[],[],[]];
  const [activaciones,preparaciones,asignaciones,workspaces]=await Promise.all([
    precargada?.activaciones ?? contextosActivacion(ids),
    precargada?.preparaciones ?? (ids.length?db.select().from(preparacionesProyecto).where(inArray(preparacionesProyecto.proyectoId,ids)):[]),
    precargada?.asignaciones ?? (ids.length?db.select().from(projectAssignments).where(and(inArray(projectAssignments.proyectoId,ids),eq(projectAssignments.tipo,'especialista'))):[]),
    precargada?.workspaces??workspaceSummaries(ids),
  ]);
  const items:ItemTrabajoEspecialista[]=[];
  for(const p of activos) {
    const meta=datos.find(d=>d.id===p.id)!,allWork=works.filter(w=>w.proyectoId===p.id),pw=allWork.filter(w=>['pendiente','en_progreso','bloqueado'].includes(w.estado)),handled=new Set<string>();
    function add(key:string,proceso:string,accion:string,detalle:string,extra:Partial<ItemTrabajoEspecialista>={}) {
      const fecha=extra.fecha ?? null,late=fecha?clasificarVencimiento(fecha,ahora).vencido:false;
      const own=extra.estado!=='esperando'&&extra.estado!=='bloqueada';
      const estado=extra.estado==='bloqueada'?'bloqueada':late?'vencida':extra.estado==='esperando'?'esperando':fecha&&dia(fecha)===hoy?'hoy':fecha&&dia(fecha)>hoy?'proxima':'pendiente';
      items.push({id:p.id+':'+key,proyectoId:p.id,proyectoTitulo:p.titulo || 'Proyecto editorial',proyectoAutores:p.autores,proyectoCodigo:p.codigo,proceso,procesoNombre:NOMBRES_PROCESO[proceso] ?? proceso,accion,detalle,fecha,waitingOn:null,blockedBy:null,actionType:key.split(':')[0]!,ctaLabel:own?'Continuar':null,workItemId:null,source:{tipo:'proyecto',id:p.id,businessKey:key},waitingSince:null,waitingOnType:null,entregaRecibidaEn:null,context:{},...extra,estado});
    }
    function wait(key:string,proceso:string,accion:string,detalle:string,destino:{tipo:string;nombre:string},fecha:string|null,since:string|null,extra:Partial<ItemTrabajoEspecialista>={}) {
      const late=fecha?clasificarVencimiento(fecha,ahora).vencido:false;
      add(key,proceso,late?'Dar seguimiento: '+accion:accion,detalle,{estado:late?'vencida':'esperando',fecha,waitingOn:late?null:destino.nombre,waitingOnType:late?null:destino.tipo,waitingSince:since,ctaLabel:late?'Dar seguimiento':null,...extra});
    }
    const preparacion=proyectarPreparacion(preparaciones.find(r=>r.proyectoId===p.id),asignaciones.find(a=>a.proyectoId===p.id&&a.finalizadoEn===null&&a.workItemId===null)?.asignadoEn??null,true,workspaces.get(p.id)??emptyWorkspace());
    if(!preparacion.primerContactoEn)add('preparacion-contacto','preparacion_inicial','Realizar primer contacto con el autor','Presentarse y coordinar la reunión operativa',{fecha:preparacion.primerContactoDueAt,ctaLabel:'Registrar contacto'});
    if(!preparacion.recibidoEn||!preparacion.expedienteRevisadoEn)add('preparacion-expediente','preparacion_inicial','Revisar el expediente recibido','Registrar recepción y revisión del diagnóstico inicial',{ctaLabel:'Continuar preparación'});
    if(preparacion.driveEstado!=='configurado')add('preparacion-drive','preparacion_inicial','Configurar espacio documental',preparacion.workspace?.status==='ERROR'?'Completar la estructura documental conservando lo ya creado':'Crear las carpetas del proyecto según su servicio',{ctaLabel:preparacion.workspace?.status==='ERROR'?'Reintentar':'Configurar'});
    if(!preparacion.reunionOperativaRealizada)add('preparacion-reunion','preparacion_inicial',preparacion.reunionOperativaFecha?'Registrar reunión operativa':'Programar reunión operativa','Reunión, grabación, transcripción, minuta y cronograma',{fecha:preparacion.reunionOperativaFecha,ctaLabel:'Continuar preparación'});
    if(preparacion.reunionOperativaRealizada&&(!preparacion.grabacionUrl||!preparacion.transcripcionUrl||!preparacion.minutaUrl||!preparacion.cronogramaUrl))add('preparacion-documentos','preparacion_inicial','Completar documentos de preparación','Registrar grabación, transcripción, minuta y cronograma',{ctaLabel:'Continuar preparación'});
    for(const ctx of activaciones.get(p.id)??[]) {
      if(ctx.solicitud || !ctx.legacy)for(const wi of allWork.filter(w=>w.tipo===ctx.tipo))handled.add(wi.id);
      if(ctx.solicitud?.estado==='requiere_informacion')add('area-responder:'+ctx.solicitud.id,ctx.tipo,'Responder información a RRPP','RRPP necesita información adicional para activar el proceso',{href:'/?vista=solicitudes&request='+ctx.solicitud.id,ctaLabel:'Responder',source:{tipo:'solicitud',id:ctx.solicitud.id,businessKey:ctx.tipo}});
      else if(!ctx.solicitud&&!ctx.activo&&ctx.gate.desbloqueado)add('area-solicitar:'+ctx.tipo,ctx.tipo,ctx.tipo==='lanzamiento'?'Solicitar activación de Lanzamiento':'Solicitar Impresión',ctx.gate.motivo,{ctaLabel:'Solicitar'});
    }
    for(const d of cases.filter(d=>d.proyectoId===p.id&&d.status==='informacion_solicitada'&&d.requestedByUserId===actorId))add('decision:'+d.id,'correccion','Responder a Jefatura',d.subject,{href:'/decisiones/'+d.id+'/responder',ctaLabel:'Responder',source:{tipo:'decision',id:d.id,businessKey:d.id}});
    if(p.servicio.codigo!=='SE'&&!meta.editorId&&!allWork.some(w=>w.tipo==='edicion'))add('editor-solicitar','edicion','Solicitar Editor','La asignación corresponde a Jefatura de Edición',{ctaLabel:'Solicitar'});
    for(const c of chapters.filter(c=>c.proyectoId===p.id)) {
      const source={tipo:'capitulo',id:c.id,businessKey:'capitulo:'+c.numero},context={capitulo:c.numero};
      if(c.fechaEntregaEditor&&!c.fechaEnvioAutor)add('cap-enviar:'+c.id,'edicion','Enviar capítulo '+c.numero+' al autor','Entrega de Edición disponible',{ctaLabel:'Enviar',source,context,entregaRecibidaEn:c.fechaEntregaEditor});
      else if(c.fechaEnvioAutor&&!c.fechaRespuestaReal)wait('cap-feedback:'+c.id,'edicion','Feedback del autor · capítulo '+c.numero,'Registrar respuesta recibida desde Edición',{tipo:'autor',nombre:'Autor'},c.fechaPautadaFeedback,c.fechaEnvioAutor,{source,context});
    }
    const concepto=creatives.filter(c=>c.proyectoId===p.id&&c.tipo==='concepto_portada');
    if(!concepto.length) {
      const gate=evaluarGateMomentoReunionCreativa({tituloDefinitivo:meta.titulo,subtituloDefinitivo:meta.subtitulo,servicioCodigo:p.servicio.codigo,fechaFeedbackTripa:meta.feedbackTripa});
      add('creativa-solicitar','direccion_creativa','Solicitar reunión creativa',gate.desbloqueado?'Títulos y momento del servicio habilitados':gate.motivo!,{estado:gate.desbloqueado?'pendiente':'bloqueada',blockedBy:gate.desbloqueado?null:gate.motivo!,ctaLabel:gate.desbloqueado?'Solicitar':null});
    }
    for(const c of concepto.filter(c=>!c.fechaCierre)) {
      if(allWork.find(w=>w.id===c.workItemId)?.estado==='cancelado')continue;
      handled.add(c.workItemId);const source={tipo:'direccion_creativa',id:c.id,businessKey:'concepto_portada'},wi=pw.find(w=>w.id===c.workItemId);
      if(wi?.estado==='bloqueado'&&wi.gateBloqueante){add('creativa-gate:'+c.id,'direccion_creativa','Continuar Dirección creativa',wi.gateBloqueante,{estado:'bloqueada',blockedBy:wi.gateBloqueante,ctaLabel:null,source,workItemId:c.workItemId});continue;}
      if(c.fechaBriefEnviadoEspecialista&&!c.fechaBriefEnviadoAutor&&!c.fechaBriefAprobadoAutor)add('brief-enviar:'+c.id,'direccion_creativa','Enviar brief al autor','Brief creativo recibido',{ctaLabel:'Enviar',source,workItemId:c.workItemId,entregaRecibidaEn:c.fechaBriefEnviadoEspecialista});
      else if(c.fechaBriefEnviadoAutor&&!c.fechaBriefAprobadoAutor)wait('brief-autor:'+c.id,'direccion_creativa','Aprobación del brief','El autor debe confirmar el brief; no hay deadline nativo',{tipo:'autor',nombre:'Autor'},null,c.fechaBriefEnviadoAutor,{source,workItemId:c.workItemId});
      else wait('creativa:'+c.id,'direccion_creativa','Esperando Dirección creativa',c.reunionRealizada?'Conceptos y recursos del Líder Creativo':'Reunión creativa solicitada',DESTINOS.direccion_creativa!,wi?.fechaFinPautada ?? null,c.createdAt.toISOString(),{source,workItemId:c.workItemId});
    }
    for(const c of corrections.filter(c=>c.proyectoId===p.id)) {
      const wi=pw.find(w=>w.id===c.workItemId);if(allWork.find(w=>w.id===c.workItemId)?.estado==='cancelado' || !wi&&((!c.fechaEntrega&&!c.entregadoEn)||c.resultado))continue;
      handled.add(c.workItemId);const source={tipo:'correccion',id:c.id,businessKey:c.alcance},base={source,workItemId:c.workItemId},contrato=contracts.find(x=>x.r.correccionId===c.id)?.r;
      if((c.fechaEntrega||c.entregadoEn)&&!c.resultado)add('correccion-revisar:'+c.id,'correccion','Revisar entrega de Corrección',c.alcance.replaceAll('_',' '),{...base,ctaLabel:'Revisar',entregaRecibidaEn:c.entregadoEn?.toISOString() ?? c.fechaEntrega});
      else if(!c.fechaAsignada || contrato && (['pendiente','en_revision','requiere_informacion'].includes(contrato.estado) || contrato.estado==='resuelta' && (!c.freelance || c.correctorNombre!==contrato.correctorNombre))) {
        const gate=evaluarGateRevisionPreviaCorreccion(c),decision=cases.find(d=>d.proyectoId===p.id&&d.originCorreccionId===c.id);
        // GATE-06 (revisión previa >120 páginas) siempre crea una
        // decisión real (ver decisiones.ts) -- enlazar a su detalle en
        // vez de dejar un bloqueo sin salida; otros gates (gateBloqueante
        // genérico de work_items) no tienen una decisión que mostrar.
        if(!gate.desbloqueado||wi?.gateBloqueante)add('correccion-gate:'+c.id,'correccion','Asignar Corrector',gate.motivo ?? wi!.gateBloqueante!,{...base,estado:'bloqueada',blockedBy:gate.motivo ?? wi!.gateBloqueante,ctaLabel:null,...(decision?{href:'/decisiones/'+decision.id+'/responder'}:{})});
        else if(contrato&&['pendiente','en_revision','requiere_informacion'].includes(contrato.estado)) {
          const href='/?'+new URLSearchParams({vista:'solicitudes',tab:'todas',request:contrato.id}),contractBase={source:{tipo:'contrato',id:contrato.id,businessKey:'contrato:'+c.id+':'+contrato.ronda},workItemId:c.workItemId,href,context:{solicitudId:contrato.id}};
          if(contrato.estado==='requiere_informacion')add('contrato-responder:'+contrato.id,'correccion','Responder información de contrato','Talento Humano necesita información adicional',{...contractBase,ctaLabel:'Responder'});
          else wait('contrato-esperar:'+contrato.id,'correccion','Esperando contrato freelance',contrato.correctorNombre,{tipo:'talento_humano',nombre:'Talento Humano'},null,contrato.requestedAt.toISOString(),contractBase);
        } else add('corrector-asignar:'+c.id,'correccion',contrato?.estado==='resuelta'?'Formalizar asignación al Corrector':'Coordinar asignación de Corrector',contrato?.estado==='resuelta'?'Talento confirmó el contrato de '+contrato.correctorNombre:'Selecciona interno o solicita contrato freelance desde Corrección',{...base,ctaLabel:contrato?.estado==='resuelta'?'Asignar':'Continuar'});
      } else if(!c.resultado)wait('corrector-entrega:'+c.id,'correccion','Entrega del Corrector',c.correctorNombre ?? 'Corrector asignado',DESTINOS.correccion!,c.dueAt?.toISOString() ?? wi?.fechaFinPautada ?? null,c.asignadoEn?.toISOString() ?? c.fechaAsignada,base);
    }
    for(const {d,v,q,c} of versions.filter(x=>x.d.proyectoId===p.id)) {
      if(allWork.find(w=>w.id===d.workItemId)?.estado==='cancelado')continue;
      handled.add(d.workItemId);if(q?.workItemId)handled.add(q.workItemId);if(v.revisionInternaWorkItemId)handled.add(v.revisionInternaWorkItemId);if(c)handled.add(c.workItemId);
      if(v.aprobadaAutorEn)continue;
      const base={workItemId:d.workItemId,source:{tipo:'diseno_version',id:v.id,businessKey:'version:'+d.id+':'+v.numero},context:{versionId:v.id}},label='V'+v.numero+' · '+d.tipo.replaceAll('_',' ');
      if(v.feedbackEn){if(!d.cerradoEn)wait('diseno-ajustes:'+v.id,'diseno','Nueva versión de Diseño',label,DESTINOS.diseno!,d.dueAt?.toISOString() ?? null,v.feedbackEn.toISOString(),base);continue;}
      if(v.enviadaAutorEn){wait('version-autor:'+v.id,q?'calidad':'diseno','Respuesta del autor',label,{tipo:'autor',nombre:'Autor'},v.feedbackAutorDueAt?.toISOString() ?? null,v.enviadaAutorEn.toISOString(),base);continue;}
      if(v.handoffEn&&q){
        if(!q.revisadoEn)wait('calidad-revision:'+q.id,'calidad','Revisión de Calidad',`F${q.numeroFase} · ronda ${q.ronda}`,DESTINOS.calidad!,q.dueAt?.toISOString() ?? null,q.solicitadoEn?.toISOString() ?? null,{...base,workItemId:q.workItemId,context:{versionId:v.id,ronda:q.ronda}});
        else if(q.aprobado&&q.numeroFase<3)add('calidad-enviar:'+q.id,'calidad','Enviar versión aprobada al autor',`F${q.numeroFase} · ronda ${q.ronda} · ${label}`,{...base,ctaLabel:'Enviar',entregaRecibidaEn:q.revisadoEn.toISOString(),context:{versionId:v.id,ronda:q.ronda}});
        continue;
      }
      if(d.cerradoEn)continue;
      if(d.tipo==='cubierta_extendida'&&(c?.resultadoFinal!=='aprobado'||!v.aprobadaInternaEn))add('cubierta-gate:'+v.id,'diseno','Enviar cubierta al autor','Verificaciones de cubierta pendientes',{...base,estado:'bloqueada',blockedBy:[c?.resultadoFinal!=='aprobado'?'Verificación del Líder Creativo':null,!v.aprobadaInternaEn?'Aprobación de Jefatura de Edición':null].filter(Boolean).join(' y '),ctaLabel:null});
      else add('diseno-revisar:'+v.id,'diseno',d.tipo==='diagramacion'?'Activar Calidad para versión diagramada':'Revisar y enviar '+d.tipo.replaceAll('_',' '),label,{...base,ctaLabel:d.tipo==='diagramacion'?'Activar Calidad':'Revisar',entregaRecibidaEn:v.entregadoEn.toISOString()});
    }
    for(const w of pw.filter(w=>!handled.has(w.id)&&!['intake_rrpp','asignacion_especialista'].includes(w.tipo))) {
      const central=p.procesos.find(t=>t.id===w.id),destino=w.tipo==='edicion'&&!meta.editorId?{tipo:'jefe_edicion',nombre:'Jefatura de Edición'}:DESTINOS[w.tipo];if(!destino)continue;
      const base={source:{tipo:'work_item',id:w.id,businessKey:w.businessKey},workItemId:w.id};
      if(w.estado==='bloqueado'&&w.gateBloqueante)add('work-gate:'+w.id,w.tipo,'Continuar '+(NOMBRES_PROCESO[w.tipo] ?? w.tipo),w.gateBloqueante,{...base,estado:'bloqueada',blockedBy:w.gateBloqueante,ctaLabel:null});
      else if(!central?.entregado)wait('work-esperar:'+w.id,w.tipo,'Esperando '+destino.nombre,central?.responsable ?? 'Intervención registrada',destino,central?.vence ?? w.fechaFinPautada,w.createdAt.toISOString(),base);
    }
  }
  const own=(i:ItemTrabajoEspecialista)=>!['esperando','bloqueada'].includes(i.estado);
  const resumen={pendientes:items.filter(own).length,vencidas:items.filter(i=>i.estado==='vencida').length,esperando:items.filter(i=>i.estado==='esperando').length,bloqueadas:items.filter(i=>i.estado==='bloqueada').length};
  const filtrados=items.filter(i=>(!f.proceso||i.proceso===f.proceso)&&(!f.proyectoId||i.proyectoId===f.proyectoId)&&(!f.dependencia||i.waitingOnType===f.dependencia)&&(!f.search||texto([i.proyectoTitulo,i.proyectoAutores,i.proyectoCodigo,i.accion].join(' ')).includes(texto(f.search.trim()))));
  // 'proximas' (único caso que cae al fallback) es la contraparte con
  // fecha futura de 'pendientes' -- own(i) es obligatorio acá: sin él,
  // un item 'esperando'/'bloqueada' con fecha futura (ej. "Feedback del
  // autor" con vencimiento mañana) aparecía DUPLICADO en Esperando y en
  // Próximas con badges contradictorios.
  const pertenece=(i:ItemTrabajoEspecialista,tab:TabMiTrabajo)=>tab==='pendientes'?own(i):tab==='hoy'?i.estado==='hoy'||i.estado==='vencida':tab==='vencidas'?i.estado==='vencida':tab==='esperando'?i.estado==='esperando':tab==='bloqueadas'?i.estado==='bloqueada':own(i)&&!!i.fecha&&!clasificarVencimiento(i.fecha,ahora).vencido&&dia(i.fecha)>hoy;
  const contadores=Object.fromEntries(TABS_MI_TRABAJO.map(t=>[t,filtrados.filter(i=>pertenece(i,t)).length])) as Record<TabMiTrabajo,number>;
  const seleccion=filtrados.filter(i=>pertenece(i,f.tab)).sort((a,b)=>(f.orden==='fecha'?0:Number(b.estado==='vencida')-Number(a.estado==='vencida'))||(a.fecha ?? '9999').localeCompare(b.fecha ?? '9999')||a.id.localeCompare(b.id));
  const total=seleccion.length,pages=Math.max(1,Math.ceil(total/f.pageSize)),page=Math.min(f.page,pages),deps=new Map<string,{destino:string;cantidad:number;tipo:string}>();
  for(const i of items.filter(i=>i.estado==='esperando'&&i.waitingOnType)){const d=deps.get(i.waitingOnType!)??{destino:i.waitingOn!,cantidad:0,tipo:i.waitingOnType!};d.cantidad++;deps.set(d.tipo,d);}
  return {actualizadoEn:ahora.toISOString(),resumen,resumenDia:{accionesHoy:items.filter(i=>i.estado==='hoy').length,vencidas:resumen.vencidas,entregasRecibidas:items.filter(i=>i.entregaRecibidaEn&&dia(i.entregaRecibidaEn)===hoy).length},dependencias:[...deps.values()].sort((a,b)=>b.cantidad-a.cantidad),catalogos:{procesos:[...new Map(items.map(i=>[i.proceso,{tipo:i.proceso,nombre:i.procesoNombre}])).values()],proyectos:activos.map(p=>({id:p.id,titulo:p.titulo || p.codigo}))},contadores,items:seleccion.slice((page-1)*f.pageSize,page*f.pageSize),total,page,pageSize:f.pageSize,pages};
}
