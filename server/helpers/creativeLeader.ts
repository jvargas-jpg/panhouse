import {and,desc,eq,inArray,isNull,or,sql} from 'drizzle-orm';
import {alias} from 'drizzle-orm/pg-core';
import {db} from '../db/client.js';
import {auditLogs,autores,direccionesCreativas,disenos,disenoVersiones,fichaDisenoPropuestas,fichasTrazabilidad,projectAssignments,projectDriveFolders,proyectos,servicios,users,workItems} from '../db/schema/index.js';
import type {CreativeActivity,CreativeDashboard,CreativeProject,CreativeTask,CreativeWorkDetail} from '../../shared/creativeLeader.js';
import {nombreServicioProyecto} from '../../shared/planificacion.js';
import {creativeOverview} from './creativeInbox.js';
import {workspaceSummaries} from '../modules/project-workspaces/queries.js';
import {especialistaActualSql} from './carga.js';

export class CreativeError extends Error {constructor(public status:number,message:string){super(message);}}
export function creativeHref(id:string,projectId:string,workItemId:string,action?:string){
  return '/?'+new URLSearchParams({vista:'mi-trabajo',trabajo:id,proyecto:projectId,workItem:workItemId,volver:'/',...(action?{accion:action}:{})});
}
const source=alias(direccionesCreativas,'creative_source');
/** Current work-item assignment is the scope. Unassigned formal requests are a separate inbox. */
async function readCreativeWork(userId:string,processId?:string){
  const rows=await db.select({dc:direccionesCreativas,wi:workItems,assignedTo:projectAssignments.usuarioId,
    project:{id:proyectos.id,code:proyectos.codigo,title:proyectos.tituloDefinitivo,cover:proyectos.propuestaPortadaUrl},
    authors:sql<string>`coalesce((select string_agg(a.nombre, ' · ' order by a.nombre) from proyectos_autores pa join autores a on a.id=pa.autor_id where pa.proyecto_id=${proyectos.id}),${autores.nombre})`,
    specialist:sql<string|null>`(select u.nombre from usuarios u where u.id=${especialistaActualSql})`,
    serviceCode:servicios.codigo,serviceName:servicios.nombre,subtype:fichasTrazabilidad.ingresoServicioSubtipoCrudo,
  }).from(direccionesCreativas).innerJoin(workItems,eq(workItems.id,direccionesCreativas.workItemId))
    .innerJoin(proyectos,eq(proyectos.id,direccionesCreativas.proyectoId)).innerJoin(autores,eq(autores.id,proyectos.autorId))
    .innerJoin(servicios,eq(servicios.id,proyectos.servicioId)).leftJoin(fichasTrazabilidad,eq(fichasTrazabilidad.proyectoId,proyectos.id))
    .leftJoin(projectAssignments,and(eq(projectAssignments.workItemId,workItems.id),eq(projectAssignments.tipo,'lider_creativo'),isNull(projectAssignments.finalizadoEn)))
    .where(and(processId?eq(direccionesCreativas.id,processId):undefined,
      processId?eq(projectAssignments.usuarioId,userId):or(eq(projectAssignments.usuarioId,userId),isNull(projectAssignments.id)),
      inArray(direccionesCreativas.tipo,['concepto_portada','revision_cubierta']),
      sql`${workItems.estado}<>'cancelado'`))
    .orderBy(desc(direccionesCreativas.createdAt));
  if(!rows.length)return {rows,concepts:[],versions:[]};
  const ids=rows.map(r=>r.dc.id),projects=[...new Set(rows.map(r=>r.project.id))];
  const [concepts,versions]=await Promise.all([
    db.select().from(fichaDisenoPropuestas).where(inArray(fichaDisenoPropuestas.direccionCreativaId,ids)).orderBy(fichaDisenoPropuestas.createdAt,fichaDisenoPropuestas.id),
    db.selectDistinctOn([disenoVersiones.disenoId],{v:disenoVersiones,design:disenos,source})
      .from(disenoVersiones).innerJoin(disenos,eq(disenos.id,disenoVersiones.disenoId))
      .innerJoin(source,eq(source.id,disenos.direccionCreativaId)).where(and(inArray(disenos.proyectoId,projects),eq(disenos.tipo,'cubierta_extendida')))
      .orderBy(disenoVersiones.disenoId,desc(disenoVersiones.numero)),
  ]);
  return {rows,concepts,versions};
}
type WorkData=Awaited<ReturnType<typeof readCreativeWork>>;
function projectFor(row:WorkData['rows'][number]):CreativeProject{
  return {id:row.project.id,code:row.project.code,title:row.project.title?.trim()||'Proyecto #'+row.project.code,
    authors:row.authors,service:nombreServicioProyecto(row.serviceCode,row.serviceName,row.subtype),specialist:row.specialist,
    coverUrl:row.project.cover&&/^https:\/\/[^\s]+\.(png|jpe?g|webp)(\?.*)?$/i.test(row.project.cover)?row.project.cover:null};
}
function projectWork(rows:Awaited<ReturnType<typeof creativeOverview>>,now:Date):CreativeDashboard{
  const tasks:CreativeTask[]=[],processes:CreativeDashboard['processes']=[],requests:CreativeDashboard['requests']=[];
  for(const {item,assigned,requestedAt} of rows){
    if(!assigned){if(item.state!=='Completada')requests.push({id:item.creativeProcessId,workItemId:item.workItemId,project:item.project,label:item.type==='COVER_REVIEW'?'Verificación de cubierta':'Solicitud de reunión creativa',requestedAt});continue;}
    const href=creativeHref(item.creativeProcessId,item.project.id,item.workItemId);
    processes.push({id:item.creativeProcessId,workItemId:item.workItemId,project:item.project,state:item.state==='Completada'?'Completado':item.state,actionCount:item.actionable?1:0,href});
    if(item.actionable)tasks.push({...item,id:item.workItemId+':'+item.type+(item.conceptId?':'+item.conceptId:''),context:item.feedback??item.context,state:item.state as CreativeTask['state'],href:creativeHref(item.creativeProcessId,item.project.id,item.workItemId,item.type)+(item.conceptId?'&concepto='+item.conceptId:'')});
  }
  const deadlines=tasks.filter(t=>t.dueAt&&!t.overdue).sort((a,b)=>a.dueAt!.localeCompare(b.dueAt!)||a.id.localeCompare(b.id)).slice(0,6);
  return {updatedAt:now.toISOString(),kpis:{briefs:tasks.filter(t=>t.type.startsWith('BRIEF')).length,concepts:tasks.filter(t=>t.type.startsWith('CONCEPT')).length,covers:tasks.filter(t=>t.type==='COVER_REVIEW').length,nextDueAt:deadlines[0]?.dueAt??null},tasks,attention:tasks.slice(0,6),totalActions:tasks.length,deadlines,processes,requests};
}
export async function getCreativeDashboard(userId:string,now=new Date(),order='accion'):Promise<CreativeDashboard>{return projectWork(await creativeOverview(userId,now,order),now);}
export async function getCreativeWorkDetail(id:string,userId:string):Promise<CreativeWorkDetail>{
  const data=await readCreativeWork(userId,id),row=data.rows[0];if(!row)throw new CreativeError(403,'Este trabajo no está asignado a tu usuario.');
  const view=projectWork(await creativeOverview(userId,new Date(),'accion',id),new Date()),dc=row.dc,version=data.versions.find(v=>v.v.revisionCreativaId===id);
  if(!view.processes.length)throw new CreativeError(404,'Esta intervención ya no está disponible.');
  const workspace=(await workspaceSummaries([row.project.id])).get(row.project.id);
  const [designFolder]=workspace?.id?await db.select({url:projectDriveFolders.driveUrl}).from(projectDriveFolders)
    .where(and(eq(projectDriveFolders.workspaceId,workspace.id),eq(projectDriveFolders.key,'DESIGN'),eq(projectDriveFolders.status,'READY'))):[];
  return {id,workItemId:row.wi.id,project:projectFor(row),state:view.processes[0]!.state,actions:view.tasks,
    reunionRealizada:dc.reunionRealizada,fechaReunion:dc.fechaReunion,enlaceGrabacion:dc.enlaceGrabacion,briefEnlace:dc.briefEnlace,briefFeedback:dc.briefFeedback,
    fechaBriefEnviadoEspecialista:dc.fechaBriefEnviadoEspecialista,fechaBriefAprobadoAutor:dc.fechaBriefAprobadoAutor,
    recursoImagenUrl:dc.recursoImagenUrl,recursoConceptoPdfUrl:dc.recursoConceptoPdfUrl,concepts:data.concepts,
    workspace:{rootUrl:workspace?.status==='READY'&&!workspace.contextChanged?workspace.rootFolderUrl:null,designUrl:workspace?.contextChanged?null:designFolder?.url??null},
    cover:version?{designId:version.design.id,versionId:version.v.id,number:version.v.numero,url:version.v.enlace,briefUrl:version.source.briefEnlace,imageUrl:version.source.recursoImagenUrl,conceptPdfUrl:version.source.recursoConceptoPdfUrl}:null};
}
const creativeEvents:Record<string,string>={DIRECCION_CREATIVA_SOLICITADA:'El Especialista solicitó una intervención creativa',LIDER_CREATIVO_ASIGNADO:'Se asignó el trabajo creativo',REUNION_CREATIVA_REGISTRADA:'Se registró la reunión creativa',BRIEF_CREATIVO_GENERADO:'El brief está disponible para el Especialista',BRIEF_CREATIVO_APROBADO:'El autor aprobó el brief',BRIEF_FEEDBACK_AUTOR:'El autor solicitó ajustes al brief',CONCEPTOS_ENTREGADOS:'Se entregaron conceptos para revisión de RRPP',CONCEPTO_APROBADO_RRPP:'RRPP aprobó un concepto',CONCEPTO_DEVUELTO_RRPP:'RRPP solicitó ajustes a un concepto',CONCEPTO_FEEDBACK_AUTOR:'El autor solicitó ajustes a un concepto',CONCEPTO_AJUSTADO:'Se entregó un concepto ajustado',CONCEPTO_APROBADO_AUTOR:'El autor aprobó un concepto',RECURSOS_CREATIVOS_ENTREGADOS:'Se entregaron los recursos del concepto aprobado',DIRECCION_CREATIVA_CERRADA:'Se completó la intervención creativa',DISENO_VERSION_ENTREGADA:'Diseño entregó una nueva cubierta extendida',REVISION_CUBIERTA_SOLICITADA:'La cubierta extendida requiere verificación creativa',CUBIERTA_REVISION_CREATIVA:'Se registró la verificación creativa de cubierta'};
export async function getCreativeActivity(userId:string):Promise<CreativeActivity[]>{
  const rows=await db.select({event:auditLogs,actor:users.nombre,title:proyectos.tituloDefinitivo,code:proyectos.codigo,
    processId:sql<string>`(select dc.id::text from direcciones_creativas dc join project_assignments a on a.work_item_id=dc.work_item_id where a.usuario_id=${userId} and a.tipo='lider_creativo' and a.finalizado_en is null and dc.proyecto_id=${auditLogs.proyectoId} and (dc.work_item_id=${auditLogs.entityId} or ${auditLogs.detalles}->>'revisionCreativaId'=dc.id::text or exists(select 1 from diseno_versiones v where v.revision_creativa_id=dc.id and ${auditLogs.detalles}->>'versionId'=v.id::text)) limit 1)`})
    .from(auditLogs).innerJoin(proyectos,eq(proyectos.id,auditLogs.proyectoId)).leftJoin(users,eq(users.id,auditLogs.actorId))
    .where(and(inArray(auditLogs.accion,Object.keys(creativeEvents)),sql`exists(select 1 from direcciones_creativas dc join project_assignments a on a.work_item_id=dc.work_item_id where a.usuario_id=${userId} and a.tipo='lider_creativo' and a.finalizado_en is null and dc.proyecto_id=${auditLogs.proyectoId} and (dc.work_item_id=${auditLogs.entityId} or ${auditLogs.detalles}->>'revisionCreativaId'=dc.id::text or exists(select 1 from diseno_versiones v where v.revision_creativa_id=dc.id and ${auditLogs.detalles}->>'versionId'=v.id::text)))`))
    .orderBy(desc(auditLogs.createdAt),desc(auditLogs.id)).limit(6);
  return rows.map(r=>({id:r.event.id,at:r.event.createdAt.toISOString(),label:creativeEvents[r.event.accion]!,actor:r.actor??'Sistema',projectTitle:r.title||'Proyecto #'+r.code,creativeProcessId:r.processId,
    href:'/?'+new URLSearchParams({vista:'proyectos-creativos',trabajo:r.processId,volver:'/'})}));
}
