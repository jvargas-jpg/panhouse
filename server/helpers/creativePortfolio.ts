import {creativePendingCountSql} from './creativeRequests.js';
import {diaCaracas} from './atencionEspecialista.js';
﻿import {and,eq,sql,type SQL} from 'drizzle-orm';
import {db} from '../db/client.js';
import {projectDriveFolders} from '../db/schema/index.js';
import {creativeSourceSql,mapCreativeWorkRow,type Row as CreativeSourceRow} from './creativeInbox.js';
import {CreativeError,creativeEvents} from './creativeLeader.js';
import {workspaceSummaries} from '../modules/project-workspaces/queries.js';
import type {CreativePortfolioConcept,CreativePortfolioFilters,CreativePortfolioPage,CreativeProjectActivity,CreativeProjectDetail,CreativeProjectStage,CreativeProjectSummary} from '../../shared/creativePortfolio.js';

interface EventRow {id:string;at:string;action:string;actor:string;approved:boolean|null}
interface ProjectRow extends CreativeSourceRow {
 root_id:string;root_work_item_id:string;root_brief_url:string|null;root_brief_approved:string|null;
 root_image_url:string|null;root_pdf_url:string|null;root_approved_id:string|null;root_concept_count:number;root_approved_count:number;
 portfolio_phase:string;creative_stage:CreativeProjectStage;has_action:boolean;current_deadline:string|null;
 last_activity:EventRow|null;version_number:number|null;version_url:string|null;review_result:string|null;
}
const portfolioEvents:Record<string,string>={...creativeEvents,DISENO_SOLICITADO:'Se solicitó la cubierta extendida',DISENADOR_ASIGNADO:'Se asignó Diseño para la cubierta',DISENADOR_REASIGNADO:'Se reasignó Diseño de la cubierta',DISENO_FEEDBACK:'Se recibieron ajustes para la cubierta',DISENO_ENVIAR_AUTOR:'El Especialista envió la cubierta al autor',DISENO_APROBAR_AUTOR:'El autor aprobó la cubierta'};
const imageUrl=(url:string|null)=>url&&/^https:\/\/[^\s]+\.(png|jpe?g|webp)(\?.*)?$/i.test(url)?url:null;
const eventLabel=(e:EventRow)=>e.action==='CUBIERTA_REVISION_CREATIVA'?(e.approved?'La cubierta fue verificada por Dirección Creativa':'Se solicitaron ajustes creativos a Diseño'):portfolioEvents[e.action]??'Actividad creativa registrada';
const mapActivity=(e:EventRow):CreativeProjectActivity=>({id:e.id,at:e.at,label:eventLabel(e),actor:e.actor??'Sistema'});

/** One representative per project. Canonical work phases remain in creativeInbox; this adds only the project-level Design handoff. */
function portfolioSql(userId:string,projectId?:string):SQL {
 return sql`${creativeSourceSql(userId,undefined,projectId)}, scoped as (
 select * from classified where assigned_to=${userId}
 and ((nullif(trim(definitive_title),'') is not null and nullif(trim(subtitle),'') is not null) or fecha_solicitud is not null or phase='COMPLETED')
 ), representatives as (
 select distinct on (project_id) * from scoped
 order by project_id,actionable desc,(phase<>'COMPLETED') desc,created_at desc,work_item_id
 ), contexts as (
 select r.*,coalesce(root.id,r.id) as root_id,exists(select 1 from scoped owned where owned.id=coalesce(root.id,r.id)) as root_owned,coalesce(root.work_item_id,r.work_item_id) as root_work_item_id,
 coalesce(root.brief_enlace,r.brief_enlace) as root_brief_url,coalesce(root.fecha_brief_aprobado_autor,r.fecha_brief_aprobado_autor)::text as root_brief_approved,
 coalesce(root.recurso_imagen_url,r.recurso_imagen_url) as root_image_url,coalesce(root.recurso_concepto_pdf_url,r.recurso_concepto_pdf_url) as root_pdf_url,
 c.approved_id as root_approved_id,c.total as root_concept_count,c.approved_count as root_approved_count,
 d.id as design_id,d.work_item_id as design_work_id,d.design_deadline,
 v.id as version_id,v.numero as design_version_number,v.enlace as version_url,v.feedback_en as version_feedback,
 v.review_result,v.review_deadline,v.review_owner
 from representatives r
 left join lateral (
   select d.*,coalesce(w.fecha_fin_pautada,(d.due_at at time zone 'America/Caracas')::date)::text as design_deadline
   from disenos d join work_items w on w.id=d.work_item_id
   where d.proyecto_id=r.project_id and d.tipo='cubierta_extendida' and w.estado<>'cancelado'
   and (d.direccion_creativa_id=r.id or exists(select 1 from diseno_versiones v where v.diseno_id=d.id and v.revision_creativa_id=r.id))
   order by d.solicitado_en desc,d.id limit 1
 ) d on true
 left join direcciones_creativas root on root.id=coalesce(d.direccion_creativa_id,r.id) and root.proyecto_id=r.project_id
 left join lateral (
   select v.*,dc.resultado_final as review_result,w.fecha_fin_pautada::text as review_deadline,pa.usuario_id as review_owner
   from diseno_versiones v left join direcciones_creativas dc on dc.id=v.revision_creativa_id
   left join work_items w on w.id=dc.work_item_id
   left join project_assignments pa on pa.work_item_id=w.id and pa.tipo='lider_creativo' and pa.finalizado_en is null
   where v.diseno_id=d.id order by v.numero desc limit 1
 ) v on true
 left join lateral (
   select count(*)::int as total,count(*) filter(where c.fecha_aprobada_autor is not null)::int as approved_count,
   (array_agg(c.id order by exists(select 1 from creative_deliveries delivery where delivery.creative_process_id=c.direccion_creativa_id and delivery.concept_id=c.id and delivery.type in ('CONCEPT_IMAGE','CONCEPT_PDF')) desc,c.created_at,c.id) filter(where c.fecha_aprobada_autor is not null))[1] as approved_id
   from ficha_diseno_propuestas c where c.direccion_creativa_id=coalesce(root.id,r.id) and (exists(select 1 from scoped owned where owned.id=coalesce(root.id,r.id)) or c.fecha_aprobada_autor is not null)
 ) c on true
 ), project_phases as (
 select *,case
 when phase<>'COMPLETED' and (nullif(trim(definitive_title),'') is null or nullif(trim(subtitle),'') is null) then 'TITLE_REQUIRED'
 when tipo='concepto_portada' and phase<>'COMPLETED' then case when phase='BRIEF' and not reunion_realizada then 'MEETING' else phase end
 when design_id is not null then case
   when version_id is null or version_feedback is not null then 'DESIGN_WORK'
   when review_result='aprobado' then 'COMPLETED'
   when phase='COVER_REVIEW' and review_owner=${userId} then 'COVER_REVIEW'
   else 'COVER_EXTERNAL' end
 else phase end as portfolio_phase
 from contexts
 ), project_stages as (
 select *,case
 when portfolio_phase in ('COMPLETED') then 'COMPLETED'
 when portfolio_phase in ('BLOCKED','TITLE_REQUIRED') then 'BLOCKED'
 when portfolio_phase='MEETING' then 'MEETING'
 when portfolio_phase in ('DESIGN_WORK','COVER_EXTERNAL','COVER_REVIEW','WAIT_DESIGN') then 'COVER'
 when task_group='BRIEF' then 'BRIEF' when task_group='CONCEPT' then 'CONCEPTS' else 'RESOURCES' end as creative_stage,
 actionable and portfolio_phase not in ('TITLE_REQUIRED','DESIGN_WORK','COVER_EXTERNAL','COMPLETED') as has_action,
 case when portfolio_phase='DESIGN_WORK' then design_deadline when portfolio_phase='COVER_EXTERNAL' then review_deadline when portfolio_phase='COMPLETED' then null else deadline end as current_deadline
 from project_phases
 ), activity_events as (
 select a.id,a.proyecto_id as project_id,a.created_at as at,a.accion as action,coalesce(u.nombre,'Sistema') as actor,
 case when a.detalles->>'aprobar' in ('true','false') then (a.detalles->>'aprobar')::boolean else null end as approved
 from audit_logs a join project_stages x on x.project_id=a.proyecto_id left join usuarios u on u.id=a.actor_id
 where a.accion in (${sql.join(Object.keys(portfolioEvents).map(k=>sql`${k}`),sql`,`)})
 and (a.entity_id=x.root_work_item_id or a.entity_id=x.design_work_id
 or exists(select 1 from scoped q where q.project_id=x.project_id and (a.entity_id=q.work_item_id or a.detalles->>'revisionCreativaId'=q.id::text))
 or exists(select 1 from diseno_versiones v where v.diseno_id=x.design_id and a.detalles->>'versionId'=v.id::text))
 ), summaries as (
 select x.*,(select to_jsonb(e) from activity_events e where e.project_id=x.project_id order by e.at desc,e.id desc limit 1) as last_activity
 from project_stages x
 )`;
}
const stages:Record<CreativeProjectStage,string>={MEETING:'Reunión creativa',BRIEF:'Brief',CONCEPTS:'Conceptos',RESOURCES:'Recursos',COVER:'Cubierta extendida',COMPLETED:'Completado',BLOCKED:'Bloqueado'};
/** Project next step is not necessarily an action belonging to this leader. */
function describe(row:ProjectRow):Pick<CreativeProjectSummary,'stateDetail'|'nextStep'|'waitingOn'> {
 switch(row.portfolio_phase){
  case 'TITLE_REQUIRED':return {stateDetail:'Pendiente de título y subtítulo definitivos',nextStep:'El Especialista debe confirmar título y subtítulo.',waitingOn:'SPECIALIST'};
  case 'MEETING':return {stateDetail:'Reunión por registrar',nextStep:'Registrar reunión creativa y preparar el brief.',waitingOn:null};
  case 'BRIEF':return {stateDetail:'Brief en elaboración',nextStep:'Finalizar el brief creativo.',waitingOn:null};
  case 'BRIEF_ADJUSTMENT':return {stateDetail:'Feedback del autor recibido',nextStep:'Ajustar el brief creativo.',waitingOn:null};
  case 'CONCEPTS':return {stateDetail:'Conceptualización',nextStep:'Desarrollar de 2 a 3 conceptos de portada.',waitingOn:null};
  case 'CONCEPT_ADJUSTMENT':return {stateDetail:row.feedback_source==='RRPP'?'Ajustes solicitados por RRPP':'Feedback del autor recibido',nextStep:'Ajustar los conceptos de portada.',waitingOn:null};
  case 'RESOURCES':return {stateDetail:'Concepto aprobado por el autor',nextStep:'Entregar imagen fuente y concepto en PDF.',waitingOn:null};
  case 'WAIT_RRPP':return {stateDetail:'Esperando revisión de RRPP',nextStep:'RRPP debe revisar los conceptos.',waitingOn:'RRPP'};
  case 'WAIT_AUTHOR':return {stateDetail:'Esperando autor',nextStep:'El Especialista espera la respuesta del autor.',waitingOn:'AUTHOR'};
  case 'WAIT_SPECIALIST':return {stateDetail:'Esperando al Especialista',nextStep:'El Especialista debe gestionar la entrega al autor.',waitingOn:'SPECIALIST'};
  case 'DESIGN_WORK':case 'WAIT_DESIGN':return {stateDetail:row.version_feedback?'Ajustes en Diseño':'En Diseño',nextStep:row.version_feedback?'Diseño debe aplicar los ajustes de cubierta.':'Diseño debe entregar la cubierta extendida.',waitingOn:'DESIGN'};
  case 'COVER_EXTERNAL':return {stateDetail:'Verificación creativa pendiente',nextStep:'El Líder asignado debe verificar la cubierta.',waitingOn:'CREATIVE'};
  case 'COVER_REVIEW':return {stateDetail:'Cubierta por verificar',nextStep:'Verificar la cubierta extendida entregada por Diseño.',waitingOn:null};
  case 'BLOCKED':return {stateDetail:'Gate creativo pendiente',nextStep:'Resolver el requisito previo del proceso creativo.',waitingOn:null};
  default:return {stateDetail:'Intervención creativa cerrada',nextStep:'Proceso creativo cerrado. El proyecto editorial conserva su propio flujo.',waitingOn:null};
 }
}
function mapProject(row:ProjectRow,now:Date):CreativeProjectSummary {
 const work=mapCreativeWorkRow(row,now),state=describe(row);
 return {projectId:row.project_id,creativeProcessId:row.root_id,rootProcessId:row.root_id,project:work.project,
 service:{id:row.service_id,code:row.service_code,name:work.project.service},specialist:row.specialist_id&&row.specialist?{id:row.specialist_id,name:row.specialist}:null,
 creativeState:row.creative_stage,stateLabel:stages[row.creative_stage],...state,currentDeadline:row.current_deadline,
 lastActivity:row.last_activity?mapActivity(row.last_activity):null,
 currentWorkItem:row.has_action?{workItemId:work.workItemId,creativeProcessId:work.creativeProcessId,type:work.type,conceptId:work.conceptId,cta:work.cta}:null,
 conceptSummary:{total:row.root_concept_count,approved:row.root_approved_count},resourceSummary:{image:!!row.root_image_url,pdf:!!row.root_pdf_url},
 coverStatus:row.design_id?state.stateDetail:null};
}
const projectOrder=(now:Date,sort='attention')=>sort==='title'?sql`title asc,project_id`:sort==='activity'?sql`(last_activity->>'at')::timestamptz desc nulls last,project_id`:
 sql`has_action desc,(creative_stage='COMPLETED'),case when not has_action and current_deadline>=${diaCaracas(now)} then 0 else 1 end,case when not has_action and current_deadline>=${diaCaracas(now)} then current_deadline end asc nulls last,(last_activity->>'at')::timestamptz desc nulls last,project_id`;
export async function listCreativeProjects(userId:string,filters:CreativePortfolioFilters={},now=new Date()):Promise<CreativePortfolioPage>{
 const search=filters.search?.trim(),pattern='%'+(search??'').replace(/[\\%_]/g,'\\$&')+'%';
 const general=search?sql`and (title ilike ${pattern} or authors ilike ${pattern} or specialist ilike ${pattern})`:sql``;
 const scope=filters.scope??(filters.creativeState==='COMPLETED'?'completed':'active');
 const scopeSql=scope==='active'?sql`and creative_stage<>'COMPLETED'`:scope==='completed'?sql`and creative_stage='COMPLETED'`:sql``;
 const service=filters.service?sql`and service_id=${filters.service}`:sql``,specialist=filters.specialist?sql`and specialist_id=${filters.specialist}`:sql``,stage=filters.creativeState?sql`and creative_stage=${filters.creativeState}`:sql``;
 const page=filters.page??1,pageSize=filters.pageSize??10;
 const result=await db.execute<{payload:{rows:ProjectRow[];total:number;counts:CreativePortfolioPage['counts']}}>(sql`${portfolioSql(userId)},
 filtered as(select * from summaries where true ${general} ${scopeSql} ${service} ${specialist} ${stage}),
 totals as(select count(*)::int as total from filtered),
 page_rows as(select * from filtered order by ${projectOrder(now,filters.sort)} limit ${pageSize} offset ((least(${page},greatest(1,ceil((select total from totals)::numeric/${pageSize})))::int-1)*${pageSize}))
 select json_build_object('rows',coalesce((select json_agg(page_rows) from page_rows),'[]'::json),'total',(select total from totals),
 'counts',json_build_object('all',(select count(*) from summaries where true ${general} ${scopeSql} ${service} ${specialist}),
 'stages',coalesce((select json_object_agg(creative_stage,n) from (select creative_stage,count(*) as n from summaries where true ${general} ${service} ${specialist} group by creative_stage) x),'{}'::json),
 'services',coalesce((select json_agg(x) from (select service_id as id,service_name as label,count(*) as count from summaries where true ${general} ${scopeSql} ${stage} ${specialist} group by service_id,service_name order by service_name) x),'[]'::json),
 'specialists',coalesce((select json_agg(x) from (select specialist_id as id,specialist as label,count(*) as count from summaries where specialist_id is not null ${general} ${scopeSql} ${stage} ${service} group by specialist_id,specialist order by specialist) x),'[]'::json),
 'actionable',(select count(*) from classified where assigned_to=${userId} and actionable),
 'requests',${creativePendingCountSql(userId)}
 )) as payload`);
 const data=result.rows[0]!.payload;
 return {items:data.rows.map(r=>mapProject(r,now)),total:data.total,page:Math.min(page,Math.max(1,Math.ceil(data.total/pageSize))),pageSize,counts:data.counts,updatedAt:now.toISOString()};
}
function conceptStatus(c:CreativePortfolioConcept){return c.fechaAprobadaAutor?'Aprobado por autor':c.estado==='Devuelta por RRPP'?'Ajustes de RRPP':c.feedbackAutor||c.estado==='Feedback del autor'?'Feedback del autor':c.estado==='Borrador'?'Borrador':c.fechaEnviadaAutor?'Esperando autor':c.fechaAprobadaRrpp?'Aprobado por RRPP':c.estado==='Pendiente RRPP'?'Esperando RRPP':c.estado??'Esperando RRPP';}
export async function getCreativeProjectDetail(projectId:string,userId:string,processId?:string):Promise<CreativeProjectDetail>{
 const result=await db.execute<{row:ProjectRow;concepts:CreativePortfolioConcept[];events:EventRow[];deliveries:{concept_id:string|null;type:string;submitted_at:string}[]}>(sql`${portfolioSql(userId,projectId)}
 select to_jsonb(summaries) as row,
 coalesce((select json_agg(json_build_object('id',c.id,'descripcion',c.descripcion,'enlace',c.enlace,'estado',c.estado,'fechaAprobadaRrpp',c.fecha_aprobada_rrpp,'fechaEnviadaAutor',c.fecha_enviada_autor,'fechaAprobadaAutor',c.fecha_aprobada_autor,'feedbackRrpp',c.feedback_rrpp,'feedbackAutor',c.feedback_autor) order by c.created_at,c.id) from ficha_diseno_propuestas c where c.direccion_creativa_id=root_id and (summaries.root_owned or c.fecha_aprobada_autor is not null)),'[]'::json) as concepts,
 coalesce((select json_agg(e) from (select * from activity_events order by at desc,id desc limit 6) e),'[]'::json) as events,
 coalesce((select json_agg(d) from creative_deliveries d where d.project_id=summaries.project_id and d.creative_process_id=root_id and d.concept_id=root_approved_id),'[]'::json) as deliveries
 from summaries limit 1`);
 const data=result.rows[0];if(!data)throw new CreativeError(404,'Proyecto creativo no disponible en tu ámbito.');
 const row=data.row;if(processId&&![row.id,row.root_id].includes(processId))throw new CreativeError(403,'El proceso no pertenece al contexto creativo seleccionado.');
 const workspace=(await workspaceSummaries([projectId])).get(projectId),usable=workspace?.status==='READY'&&!workspace.contextChanged;
 const [folder]=usable&&workspace.id?await db.select({url:projectDriveFolders.driveUrl}).from(projectDriveFolders).where(and(eq(projectDriveFolders.workspaceId,workspace.id),eq(projectDriveFolders.key,'DESIGN'),eq(projectDriveFolders.status,'READY'))):[];
 const concepts=data.concepts.map(c=>({...c,thumbnailUrl:imageUrl(c.enlace),statusLabel:conceptStatus(c),approved:!!c.fechaAprobadaAutor}));
 const resources:CreativeProjectDetail['resources']=[];
 if(row.root_approved_id)for(const [type,label,url] of [['CONCEPT_IMAGE','Imagen fuente / Freepik',row.root_image_url],['CONCEPT_PDF','Concepto de portada en PDF',row.root_pdf_url]] as const)if(url){const delivery=data.deliveries.find(d=>d.type===type&&d.concept_id===row.root_approved_id);resources.push({type,label,url,conceptId:row.root_approved_id,submittedAt:delivery?.submitted_at??null});}
 return {summary:mapProject(row,new Date()),concepts,resources,activity:data.events.map(mapActivity),workspace:{rootUrl:usable?workspace.rootFolderUrl:null,designUrl:folder?.url??null},brief:{url:row.root_brief_url,approvedAt:row.root_brief_approved},
 cover:row.version_url?{version:row.design_version_number as number,url:row.version_url,reviewResult:row.review_result}:null};
}
export async function getCreativeProjectConcept(projectId:string,conceptId:string,userId:string,processId?:string){
 const detail=await getCreativeProjectDetail(projectId,userId,processId),concept=detail.concepts.find(c=>c.id===conceptId);
 if(!concept)throw new CreativeError(404,'El concepto no pertenece al contexto creativo seleccionado.');
 const action=detail.summary.currentWorkItem;
 return {concept,currentWorkItem:action?.conceptId===conceptId?action:null};
}
