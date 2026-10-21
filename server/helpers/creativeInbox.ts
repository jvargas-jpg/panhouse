import {creativePendingCountSql} from './creativeRequests.js';
﻿import {sql,type SQL} from 'drizzle-orm';
import {db} from '../db/client.js';
import type {CreativeActionType,CreativeWorkFilters,CreativeWorkItem,CreativeWorkPage} from '../../shared/creativeLeader.js';
import {nombreServicioProyecto} from '../../shared/planificacion.js';
import {diaCaracas} from './atencionEspecialista.js';
import {clasificarVencimiento} from './tiempoEspecialista.js';

/** Canonical phase query for Inicio, inbox and operation detail. No notification or URL is a source of truth. */
const specialistForProject=sql`coalesce((select a.usuario_id from project_assignments a where a.proyecto_id=p.id and a.tipo='especialista' and a.work_item_id is null and a.finalizado_en is null),case when not exists(select 1 from project_assignments h where h.proyecto_id=p.id and h.tipo='especialista' and h.work_item_id is null) then p.especialista_id else null end)`;
export function creativeSourceSql(userId:string,processId?:string,projectId?:string):SQL {
 return sql`with source as (
 select dc.*, wi.estado as work_state, wi.gate_bloqueante, wi.fecha_fin_pautada::text as deadline,
 wi.created_at as work_created_at, greatest(wi.updated_at,dc.updated_at) as changed_at,
 pa.usuario_id as assigned_to, p.estado as project_state, p.id as project_id, p.codigo as code,
 coalesce(nullif(trim(p.titulo_definitivo),''),'Proyecto #'||p.codigo) as title,
 coalesce((select string_agg(a.nombre,' · ' order by a.nombre) from proyectos_autores x join autores a on a.id=x.autor_id where x.proyecto_id=p.id),author.nombre) as authors,
 p.titulo_definitivo as definitive_title,p.subtitulo_definitivo as subtitle,${specialistForProject} as specialist_id,
 s.id as service_id,s.codigo as service_code,s.nombre as service_name,f.ingreso_servicio_subtipo_crudo as subtype,p.propuesta_portada_url as cover,
 (select u.nombre from usuarios u where u.id=${specialistForProject}) as specialist,
 coalesce(c.total,0) as concept_count,coalesce(c.draft,false) as draft,coalesce(c.undecided,false) as undecided,
 coalesce(c.needs_rrpp,false) as needs_rrpp,coalesce(c.sent_author,false) as sent_author,c.approved_id,c.adjustment_id,c.feedback,c.feedback_source,
 v.numero as version_number,v.feedback_en,v.cerrado_en
 from direcciones_creativas dc join work_items wi on wi.id=dc.work_item_id and wi.proyecto_id=dc.proyecto_id
 join proyectos p on p.id=dc.proyecto_id join autores author on author.id=p.autor_id join servicios s on s.id=p.servicio_id
 left join fichas_trazabilidad f on f.proyecto_id=p.id
 left join project_assignments pa on pa.work_item_id=wi.id and pa.tipo='lider_creativo' and pa.finalizado_en is null
 left join lateral (
   select count(*) as total,bool_or(c.estado='Borrador') as draft,bool_or(c.fecha_aprobada_rrpp is not null or c.fecha_enviada_autor is not null) as undecided,
   bool_or(c.fecha_aprobada_rrpp is null) as needs_rrpp,bool_or(c.fecha_enviada_autor is not null) as sent_author,
   (array_agg(c.id order by exists(select 1 from creative_deliveries delivery where delivery.creative_process_id=c.direccion_creativa_id and delivery.concept_id=c.id and delivery.type in ('CONCEPT_IMAGE','CONCEPT_PDF')) desc,c.created_at,c.id) filter(where c.fecha_aprobada_autor is not null))[1] as approved_id,
   (array_agg(c.id order by c.created_at,c.id) filter(where c.estado in ('Devuelta por RRPP','Feedback del autor') or nullif(c.feedback_autor,'') is not null))[1] as adjustment_id,
   (array_agg(coalesce(c.feedback_autor,c.feedback_rrpp,c.descripcion) order by c.created_at,c.id) filter(where c.estado in ('Devuelta por RRPP','Feedback del autor') or nullif(c.feedback_autor,'') is not null))[1] as feedback,
   (array_agg(case when c.estado='Devuelta por RRPP' then 'RRPP' else 'AUTHOR' end order by c.created_at,c.id) filter(where c.estado in ('Devuelta por RRPP','Feedback del autor') or nullif(c.feedback_autor,'') is not null))[1] as feedback_source
   from ficha_diseno_propuestas c where c.direccion_creativa_id=dc.id
 ) c on true
 left join lateral (
   select v.numero,v.feedback_en,d.cerrado_en from diseno_versiones v join disenos d on d.id=v.diseno_id
   where v.revision_creativa_id=dc.id and d.proyecto_id=p.id and d.tipo='cubierta_extendida'
   and not exists(select 1 from diseno_versiones newer where newer.diseno_id=d.id and newer.numero>v.numero)
   order by v.numero desc limit 1
 ) v on true
 where dc.tipo in ('concepto_portada','revision_cubierta') and wi.tipo='direccion_creativa'
 and (p.estado not in ('culminado','retirado') or wi.estado='completado' or dc.fecha_cierre is not null) and wi.estado<>'cancelado' and (pa.usuario_id=${userId} or pa.id is null)
 ${projectId?sql`and p.id=${projectId}`:sql``}
 ${processId?sql`and dc.id=${processId} and pa.usuario_id=${userId}`:sql``}
 ), phased as (
 select *, case
 when fecha_cierre is not null or work_state='completado' then 'COMPLETED'
 when gate_bloqueante is not null or nullif(trim(definitive_title),'') is null or nullif(trim(subtitle),'') is null then 'BLOCKED'
 when tipo='revision_cubierta' then case when version_number is not null and feedback_en is null and cerrado_en is null and resultado_final is null then 'COVER_REVIEW' else 'WAIT_DESIGN' end
 when nullif(brief_feedback,'') is not null and fecha_brief_aprobado_autor is null then 'BRIEF_ADJUSTMENT'
 when nullif(brief_enlace,'') is null or fecha_brief_enviado_especialista is null then 'BRIEF'
 when fecha_brief_aprobado_autor is null then case when fecha_brief_enviado_autor is not null then 'WAIT_AUTHOR' else 'WAIT_SPECIALIST' end
 when approved_id is not null then case when nullif(recurso_imagen_url,'') is null or nullif(recurso_concepto_pdf_url,'') is null then 'RESOURCES' else 'COMPLETED' end
 when adjustment_id is not null then 'CONCEPT_ADJUSTMENT'
 when concept_count=0 or draft or (concept_count<2 and not undecided) then 'CONCEPTS'
 when needs_rrpp then 'WAIT_RRPP' when sent_author then 'WAIT_AUTHOR' else 'WAIT_SPECIALIST' end as phase,
 case when tipo='revision_cubierta' then 'COVER_REVIEW'
 when fecha_brief_aprobado_autor is null then 'BRIEF'
 when approved_id is not null then 'RESOURCES' else 'CONCEPT' end as task_group
 from source
 ), classified as (
 select *,phase in ('BRIEF','BRIEF_ADJUSTMENT','CONCEPTS','CONCEPT_ADJUSTMENT','RESOURCES','COVER_REVIEW') as actionable,
 case phase when 'COMPLETED' then 'Completada' when 'BLOCKED' then 'Bloqueada'
 when 'WAIT_RRPP' then 'Esperando RRPP' when 'WAIT_AUTHOR' then 'Esperando autor'
 when 'WAIT_DESIGN' then 'Esperando Diseño' when 'WAIT_SPECIALIST' then 'Esperando Especialista'
 when 'BRIEF_ADJUSTMENT' then 'Requiere ajustes' when 'CONCEPT_ADJUSTMENT' then 'Requiere ajustes'
 else case when work_state='en_progreso' then 'En curso' else 'Pendiente' end end as status,
 case when phase='BRIEF_ADJUSTMENT' then 'Ajustar brief creativo' when phase='BRIEF' then 'Elaborar brief creativo' when phase='CONCEPT_ADJUSTMENT' then 'Ajustar conceptos de portada' when phase='CONCEPTS' then 'Desarrollar conceptos de portada' when task_group='BRIEF' then 'Brief creativo' when task_group='CONCEPT' then 'Conceptos de portada' when task_group='RESOURCES' then 'Recursos del concepto aprobado' else 'Verificar cubierta extendida' end as task_label
 from phased
 )`;
}
export interface Row extends Record<string,unknown>{id:string;work_item_id:string;project_id:string;code:string;title:string;authors:string;service_id:string;service_code:string;service_name:string;subtype:string|null;cover:string|null;specialist:string|null;specialist_id:string|null;definitive_title:string|null;subtitle:string|null;phase:string;task_group:CreativeWorkItem['group'];status:CreativeWorkItem['state'];actionable:boolean;deadline:string|null;adjustment_id:string|null;approved_id:string|null;feedback:string|null;feedback_source:string|null;brief_feedback:string|null;brief_enlace:string|null;reunion_realizada:boolean;version_number:number|null;work_created_at:string;changed_at:string;assigned_to:string|null;fecha_solicitud:string|null;gate_bloqueante:string|null}
const actions:Record<CreativeActionType,{label:string;cta:string}>={
 BRIEF:{label:'Elaborar brief creativo',cta:'Preparar brief'},BRIEF_ADJUSTMENT:{label:'Ajustar brief creativo',cta:'Revisar feedback'},
 CONCEPTS:{label:'Desarrollar conceptos de portada',cta:'Crear conceptos'},CONCEPT_ADJUSTMENT:{label:'Ajustar concepto de portada',cta:'Revisar feedback'},
 RESOURCES:{label:'Entregar recursos del concepto aprobado',cta:'Entregar recursos'},COVER_REVIEW:{label:'Verificar cubierta extendida',cta:'Verificar cubierta'},
};
export function mapCreativeWorkRow(r:Row,now:Date):CreativeWorkItem {
 const type=(r.actionable?r.phase:r.task_group==='BRIEF'?'BRIEF':r.task_group==='CONCEPT'?'CONCEPTS':r.task_group) as CreativeActionType;
 const waitingTargets:Record<string,CreativeWorkItem['waitingOn']>={WAIT_RRPP:'RRPP',WAIT_AUTHOR:'AUTHOR',WAIT_DESIGN:'DESIGN',WAIT_SPECIALIST:'SPECIALIST'};
 const action=actions[type],waitingOn=waitingTargets[r.phase]??null;
 const context=r.phase==='BRIEF_ADJUSTMENT'?r.brief_feedback??'Feedback del autor recibido.':r.phase==='CONCEPT_ADJUSTMENT'?`Feedback de ${r.feedback_source==='RRPP'?'RRPP':'autor'} recibido. ${r.feedback??''}`:
 r.phase==='COVER_REVIEW'?`Diseño entregó la versión ${r.version_number}.`:
 r.phase==='RESOURCES'?'El autor aprobó el concepto. Entrega la imagen utilizada / Freepik y el concepto en PDF.':
 r.phase==='WAIT_RRPP'?'Esperando revisión de RRPP.':r.phase==='WAIT_AUTHOR'?'El Especialista gestiona la respuesta del autor.':
 r.phase==='WAIT_SPECIALIST'?'Entrega disponible para la gestión del Especialista.':r.phase==='WAIT_DESIGN'?'La siguiente entrega depende de Diseño.':
 r.phase==='COMPLETED'?'Intervención creativa finalizada.':r.phase==='BLOCKED'?(r.gate_bloqueante?`Gate pendiente: ${r.gate_bloqueante}`:'El Especialista debe confirmar título y subtítulo definitivos.'):
 r.phase==='CONCEPTS'?'Brief aprobado. Prepara de 2 a 3 conceptos para revisión de RRPP.':r.reunion_realizada?'Contexto de la reunión disponible.':'Revisa el contexto y registra la reunión creativa.';
 return {id:r.work_item_id,workItemId:r.work_item_id,creativeProcessId:r.id,conceptId:r.phase==='CONCEPT_ADJUSTMENT'?r.adjustment_id??undefined:r.phase==='RESOURCES'?r.approved_id??undefined:undefined,
 projectId:r.project_id,project:{id:r.project_id,code:r.code,title:r.title,authors:r.authors,service:nombreServicioProyecto(r.service_code,r.service_name,r.subtype),specialist:r.specialist,
 coverUrl:r.cover&&/^https:\/\/[^\s]+\.(png|jpe?g|webp)(\?.*)?$/i.test(r.cover)?r.cover:null},
 feedbackSource:r.feedback_source as CreativeWorkItem['feedbackSource']??undefined,feedback:r.phase==='CONCEPT_ADJUSTMENT'?r.feedback??undefined:undefined,type,group:r.task_group,label:r.actionable?action.label:({BRIEF:'Brief creativo',CONCEPT:'Conceptos de portada',RESOURCES:'Recursos del concepto aprobado',COVER_REVIEW:'Verificación de cubierta extendida'}[r.task_group]),cta:r.actionable?(type==='BRIEF'&&r.brief_enlace?'Continuar brief':type==='CONCEPT_ADJUSTMENT'&&r.feedback_source==='AUTHOR'?'Ajustar concepto':action.cta):'Ver proceso',context,state:r.status,waitingOn,actionable:r.actionable,serviceId:r.service_id,
 dueAt:r.deadline,overdue:r.actionable&&!!r.deadline&&clasificarVencimiento(r.deadline,now).vencido,dueToday:r.actionable&&r.deadline===diaCaracas(now),createdAt:r.work_created_at,updatedAt:r.changed_at};
}
function order(now:Date,sort='accion') {const today=diaCaracas(now);return sort==='fecha'?sql`deadline asc nulls last,work_item_id`:
 sql`case when actionable and deadline<${today} then 0 when actionable and deadline=${today} then 1 when status='Requiere ajustes' then 2 when actionable and deadline is not null then 3 when actionable then 4 else 5 end,deadline asc nulls last,work_item_id`;}
export async function creativeOverview(userId:string,now:Date,sort='accion',processId?:string){
 const result=await db.execute<Row>(sql`${creativeSourceSql(userId,processId)} select * from classified order by ${order(now,sort)}`);
 return result.rows.map(r=>({item:mapCreativeWorkRow(r,now),assigned:!!r.assigned_to,requestedAt:r.fecha_solicitud}));
}
export async function listCreativeWork(userId:string,f:CreativeWorkFilters={},now=new Date()):Promise<CreativeWorkPage>{
 const today=diaCaracas(now),date=new Date(today+'T12:00:00Z'),weekday=date.getUTCDay();date.setUTCDate(date.getUTCDate()+((7-weekday)%7));const weekEnd=date.toISOString().slice(0,10);
 const search=f.search?.trim(),pattern='%'+(search??'').replace(/[\\%_]/g,'\\$&')+'%';
 const scope=f.alcance??(f.estado==='Completada'?'completadas':'activas');
 const general=sql`assigned_to=${userId} ${search?sql`and (title ilike ${pattern} or authors ilike ${pattern} or task_label ilike ${pattern} or coalesce(feedback,brief_feedback,'') ilike ${pattern})`:sql``}
 ${f.fecha==='hoy'?sql`and deadline=${today}`:f.fecha==='semana'?sql`and deadline between ${today} and ${weekEnd}`:f.fecha==='proximos'?sql`and deadline>${today}`:f.fecha==='sin-fecha'?sql`and deadline is null`:f.fecha==='vencidos'?sql`and actionable and deadline<${today}`:sql``}`;
 const scoped=sql`${general} ${scope==='activas'?sql`and status<>'Completada'`:scope==='completadas'?sql`and status='Completada'`:sql``}`;
 const type=f.tipo?sql`and task_group=${f.tipo}`:sql``,state=f.estado?sql`and status=${f.estado}`:sql``,service=f.servicio?sql`and service_id=${f.servicio}`:sql``;
 const page=f.pagina??1,pageSize=f.pageSize??10;
 const result=await db.execute<{payload:{rows:Row[];total:number;counts:CreativeWorkPage['counts']}}>(sql`${creativeSourceSql(userId)},
 filtered as (select * from classified where ${scoped} ${type} ${state} ${service}),
 totals as (select count(*)::int as total from filtered),
 page_rows as (select * from filtered order by ${order(now,f.orden)} limit ${pageSize} offset ((least(${page},greatest(1,ceil((select total from totals)::numeric/${pageSize})))::int-1)*${pageSize}))
 select json_build_object('rows',coalesce((select json_agg(page_rows) from page_rows),'[]'::json),'total',(select total from totals),'counts',json_build_object(
 'all',(select count(*) from classified where ${scoped} ${state} ${service}),
 'types',coalesce((select json_object_agg(task_group,n) from (select task_group,count(*) as n from classified where ${scoped} ${state} ${service} group by task_group) a),'{}'::json),
 'states',coalesce((select json_object_agg(status,n) from (select status,count(*) as n from classified where ${general} ${type} ${service} group by status) a),'{}'::json),
 'services',coalesce((select json_agg(a) from (select service_id as id,service_name as label,count(*) as count from classified where ${scoped} ${type} ${state} group by service_id,service_name order by service_name) a),'[]'::json),
 'overdue',(select count(*) from classified where ${scoped} ${type} ${state} ${service} and actionable and deadline<${today}),
 'actionable',(select count(*) from classified where assigned_to=${userId} and actionable),
 'requests',${creativePendingCountSql(userId)}
 )) as payload`);
 const data=result.rows[0]!.payload;
 return {items:data.rows.map(r=>mapCreativeWorkRow(r,now)),total:data.total,page:Math.min(page,Math.max(1,Math.ceil(data.total/pageSize))),pageSize,counts:{...data.counts,types:Object.assign({BRIEF:0,CONCEPT:0,RESOURCES:0,COVER_REVIEW:0},data.counts.types)},updatedAt:now.toISOString()};
}
