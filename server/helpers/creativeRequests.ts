import {and,desc,eq,isNull,sql,type SQL} from 'drizzle-orm';
import {db} from '../db/client.js';
import {auditLogs,direccionesCreativas,notificaciones,preparacionesProyecto,projectAssignments,projectDriveFolders,proyectos,servicios,solicitudesArea,users,workItems} from '../db/schema/index.js';
import {asignarConHistorial} from './assignments.js';
import {registrarEvento} from './auditLog.js';
import {obtenerEspecialistaActual} from './carga.js';
import {evaluarGateMomentoReunionCreativa,evaluarMomentoServicioCreativo} from './gates.js';
import {crearWorkItemSiNoExiste,transicionarWorkItemPorId} from './workItems.js';
import {diaCaracas} from './atencionEspecialista.js';
import {nombreServicioProyecto} from '../../shared/planificacion.js';
import {creativeSourceSql} from './creativeInbox.js';
import {workspaceSummaries} from '../modules/project-workspaces/queries.js';
import type {Tx} from './tx.js';
import type {CreativeRequestDetail,CreativeRequestFilters,CreativeRequestPage,CreativeRequestSummary} from '../../shared/creativeRequests.js';

export const CREATIVE_REQUEST_TYPE={type:'CREATIVE_MEETING_REQUEST' as const,label:'Reunión creativa',summary:'Activación de reunión, brief y conceptualización del proyecto.',conversion:'Registrar reunión creativa y elaborar el brief'};
const fail=(statusCode:number,message:string):never=>{throw Object.assign(new Error(message),{statusCode});};
const currentLeader=sql`(select a.usuario_id from project_assignments a where a.work_item_id=r.work_item_id and a.tipo='lider_creativo' and a.finalizado_en is null)`;
/** Native handoffs plus unconverted legacy processes. No query writes or invented audit events. */
function requestSource():SQL {return sql`with request_origins as (
 select r.id,r.proyecto_id,r.work_item_id,r.requested_by_id,r.target_user_id,r.descripcion,r.estado,r.requested_at,r.resolved_at,r.resolved_by_id,r.motivo,dc.id as process_id,${currentLeader} as leader_id
 from solicitudes_area r left join direcciones_creativas dc on dc.work_item_id=r.work_item_id and dc.tipo='concepto_portada' where r.tipo='creativa'
 union all
 select dc.id,dc.proyecto_id,dc.work_item_id,origin.actor_id,null::uuid,null::text,
 case when wi.estado='cancelado' then 'cancelada' when a.usuario_id is not null or dc.reunion_realizada or dc.fecha_cierre is not null or wi.estado='completado' then 'resuelta' else 'pendiente' end,
 coalesce(origin.created_at,dc.created_at),a.asignado_en,a.asignado_por_id,null::text,dc.id,a.usuario_id
 from direcciones_creativas dc join work_items wi on wi.id=dc.work_item_id
 left join project_assignments a on a.work_item_id=wi.id and a.tipo='lider_creativo' and a.finalizado_en is null
 left join lateral (select actor_id,created_at from audit_logs where entity_id=wi.id and accion='DIRECCION_CREATIVA_SOLICITADA' order by created_at,id limit 1) origin on true
 where dc.tipo='concepto_portada' and not exists(select 1 from solicitudes_area r where r.tipo='creativa' and (r.id=dc.id or r.work_item_id=wi.id))
 ), request_context as (
 select r.*,p.codigo,p.estado as project_state,p.titulo_definitivo,p.subtitulo_definitivo,p.fecha_feedback_tripa,
 coalesce(nullif(trim(p.titulo_definitivo),''),'Proyecto #'||p.codigo) as title,p.propuesta_portada_url as cover,
 coalesce((select string_agg(a.nombre,' · ' order by a.nombre) from proyectos_autores x join autores a on a.id=x.autor_id where x.proyecto_id=p.id),author.nombre) as authors,
 s.id as service_id,s.codigo as service_code,s.nombre as service_name,f.ingreso_servicio_subtipo_crudo as subtype,
 specialist.id as specialist_id,specialist.nombre as specialist_name,requester.nombre as requester_name,resolver.nombre as resolver_name,
 case r.estado when 'resuelta' then 'ACCEPTED' when 'rechazada' then 'REJECTED' when 'cancelada' then 'CANCELLED' else 'PENDING' end as status
 from request_origins r join proyectos p on p.id=r.proyecto_id join autores author on author.id=p.autor_id join servicios s on s.id=p.servicio_id
 left join fichas_trazabilidad f on f.proyecto_id=p.id
 left join usuarios specialist on specialist.id=coalesce((select a.usuario_id from project_assignments a where a.proyecto_id=p.id and a.tipo='especialista' and a.work_item_id is null and a.finalizado_en is null),case when not exists(select 1 from project_assignments h where h.proyecto_id=p.id and h.tipo='especialista' and h.work_item_id is null) then p.especialista_id end)
 left join usuarios requester on requester.id=r.requested_by_id left join usuarios resolver on resolver.id=r.resolved_by_id
 )`;}
const visible=(userId:string)=>sql`((status='PENDING' and project_state not in ('culminado','retirado') and (target_user_id is null or target_user_id=${userId})) or (status='ACCEPTED' and leader_id=${userId}) or (status in ('REJECTED','CANCELLED') and target_user_id=${userId}))`;
export function creativePendingCountSql(userId:string):SQL{return sql`(${requestSource()} select count(*)::int from request_context where status='PENDING' and ${visible(userId)})`;}
interface RequestRow extends Record<string,unknown>{id:string;proyecto_id:string;work_item_id:string|null;process_id:string|null;requested_by_id:string|null;target_user_id:string|null;descripcion:string|null;status:CreativeRequestSummary['status'];requested_at:string;resolved_at:string|null;resolved_by_id:string|null;motivo:string|null;leader_id:string|null;codigo:string;title:string;cover:string|null;authors:string;service_id:string;service_code:string;service_name:string;subtype:string|null;specialist_id:string|null;specialist_name:string|null;requester_name:string|null;resolver_name:string|null;project_state:string;titulo_definitivo:string|null;subtitulo_definitivo:string|null;fecha_feedback_tripa:string|null}
function summary(r:RequestRow,userId:string):CreativeRequestSummary{
 const service=nombreServicioProyecto(r.service_code,r.service_name,r.subtype),specialist=r.specialist_id?{id:r.specialist_id,name:r.specialist_name??'Sin nombre registrado'}:null;
 return {id:r.id,type:CREATIVE_REQUEST_TYPE.type,typeLabel:CREATIVE_REQUEST_TYPE.label,summary:r.descripcion??CREATIVE_REQUEST_TYPE.summary,
 project:{id:r.proyecto_id,code:r.codigo,title:r.title,authors:r.authors,service,specialist:specialist?.name??null,coverUrl:r.cover&&/^https:\/\/[^\s]+\.(png|jpe?g|webp)(\?.*)?$/i.test(r.cover)?r.cover:null},
 service:{id:r.service_id,code:r.service_code,name:service},specialist,requestedBy:r.requested_by_id?{id:r.requested_by_id,name:r.requester_name??'Sin nombre registrado'}:null,status:r.status,requestedAt:r.requested_at,resolvedAt:r.resolved_at,
 resolvedBy:r.resolved_by_id?{id:r.resolved_by_id,name:r.resolver_name??'Sin nombre registrado'}:null,reason:r.motivo,
 generatedWorkItemId:r.status==='ACCEPTED'?r.work_item_id:null,creativeProcessId:r.status==='ACCEPTED'?r.process_id:null,canOpenWork:r.status==='ACCEPTED'&&r.leader_id===userId};
}
export async function listCreativeRequests(userId:string,f:CreativeRequestFilters={},now=new Date()):Promise<CreativeRequestPage>{
 const pattern='%'+(f.search?.trim()??'').replace(/[\\%_]/g,'\\$&')+'%',today=diaCaracas(now),week=new Date(today+'T12:00:00Z');week.setUTCDate(week.getUTCDate()-((week.getUTCDay()+6)%7));
 const search=f.search?.trim()?sql`and (title ilike ${pattern} or authors ilike ${pattern} or coalesce(requester_name,'') ilike ${pattern} or coalesce(specialist_name,'') ilike ${pattern} or ${CREATIVE_REQUEST_TYPE.label} ilike ${pattern})`:sql``;
 const date=f.date==='today'?sql`and (requested_at at time zone 'America/Caracas')::date=${today}`:f.date==='week'?sql`and (requested_at at time zone 'America/Caracas')::date between ${week.toISOString().slice(0,10)} and ${today}`:f.date==='range'?sql`${f.from?sql`and (requested_at at time zone 'America/Caracas')::date>=${f.from}`:sql``} ${f.to?sql`and (requested_at at time zone 'America/Caracas')::date<=${f.to}`:sql``}`:sql``;
 const service=f.service?sql`and service_id=${f.service}`:sql``,specialist=f.specialist?sql`and requested_by_id=${f.specialist}`:sql``,status=(f.status??'PENDING')==='ALL'?sql``:sql`and status=${f.status??'PENDING'}`;
 const page=f.page??1,pageSize=f.pageSize??10;
 const result=await db.execute<{payload:{rows:RequestRow[];total:number;counts:CreativeRequestPage['counts']}}>(sql`${requestSource()}, scoped as(select * from request_context where ${visible(userId)}),
 filtered as(select * from scoped where true ${search} ${date} ${service} ${specialist} ${status}),totals as(select count(*)::int as total from filtered),
 paged as(select * from filtered order by (status='PENDING') desc,requested_at,id limit ${pageSize} offset ((least(${page},greatest(1,ceil((select total from totals)::numeric/${pageSize})))::int-1)*${pageSize}))
 select json_build_object('rows',coalesce((select json_agg(paged) from paged),'[]'::json),'total',(select total from totals),'counts',json_build_object(
 'all',(select count(*) from scoped where true ${search} ${date} ${service} ${specialist}),
 'statuses',coalesce((select json_object_agg(status,n) from(select status,count(*) as n from scoped where true ${search} ${date} ${service} ${specialist} group by status)x),'{}'::json),
 'pending',(select count(*) from scoped where status='PENDING'),
 'actionableWork',(${creativeSourceSql(userId)} select count(*) from classified where assigned_to=${userId} and actionable),
 'services',coalesce((select json_agg(x) from(select service_id as id,service_name as label,count(*) as count from scoped where true ${search} ${date} ${specialist} ${status} group by service_id,service_name order by service_name)x),'[]'::json),
 'specialists',coalesce((select json_agg(x) from(select requested_by_id as id,requester_name as label,count(*) as count from scoped where requested_by_id is not null ${search} ${date} ${service} ${status} group by requested_by_id,requester_name order by requester_name)x),'[]'::json))) as payload`);
 const data=result.rows[0]!.payload;return {items:data.rows.map(r=>summary(r,userId)),total:data.total,page:Math.min(page,Math.max(1,Math.ceil(data.total/pageSize))),pageSize,counts:data.counts};
}
export const creativeRequestEvents:Record<string,string>={DIRECCION_CREATIVA_SOLICITADA:'Solicitud de reunión creativa creada',LIDER_CREATIVO_ASIGNADO:'Trabajo asignado al Líder Creativo',SOLICITUD_CREATIVA_ACEPTADA:'Solicitud aceptada',SOLICITUD_CREATIVA_CONVERTIDA:'Trabajo creativo iniciado',SOLICITUD_CREATIVA_RECHAZADA:'Solicitud rechazada'};
const safeUrl=(url:string|null)=>{if(!url)return null;try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?url:null;}catch{return null;}};
export async function getCreativeRequestDetail(id:string,userId:string):Promise<CreativeRequestDetail>{
 const result=await db.execute<RequestRow>(sql`${requestSource()} select * from request_context where id=${id} and ${visible(userId)}`),r=result.rows[0];if(!r)return fail(404,'Solicitud creativa no disponible en tu ámbito.');
 const gate=evaluarGateMomentoReunionCreativa({tituloDefinitivo:r.titulo_definitivo,subtituloDefinitivo:r.subtitulo_definitivo,servicioCodigo:r.service_code,fechaFeedbackTripa:r.fecha_feedback_tripa});
 const [preparation]=await db.select().from(preparacionesProyecto).where(eq(preparacionesProyecto.proyectoId,r.proyecto_id));
 const events=await db.select({id:auditLogs.id,action:auditLogs.accion,actor:users.nombre,at:auditLogs.createdAt}).from(auditLogs).leftJoin(users,eq(users.id,auditLogs.actorId))
 .where(and(eq(auditLogs.proyectoId,r.proyecto_id),sql`${auditLogs.accion} in (${sql.join(Object.keys(creativeRequestEvents).map(k=>sql`${k}`),sql`,`)})`,sql`(${auditLogs.entityId}=${r.id} or ${auditLogs.entityId}=${r.work_item_id})`)).orderBy(desc(auditLogs.createdAt),desc(auditLogs.id)).limit(6);
 const workspace=(await workspaceSummaries([r.proyecto_id])).get(r.proyecto_id),ready=workspace?.status==='READY'&&!workspace.contextChanged;
 const [design]=ready&&workspace.id?await db.select({url:projectDriveFolders.driveUrl}).from(projectDriveFolders).where(and(eq(projectDriveFolders.workspaceId,workspace.id),eq(projectDriveFolders.key,'DESIGN'),eq(projectDriveFolders.status,'READY'))):[];
 const materials:CreativeRequestDetail['materials']=[];
 // Preparación links are explicitly labelled as operational context, never as a creative meeting transcript.
 for(const [key,name,url] of [['transcription','Transcripción de reunión operativa',preparation?.transcripcionUrl],['minutes','Minuta de preparación',preparation?.minutaUrl],['recording','Grabación de reunión operativa',preparation?.grabacionUrl]] as const){const valid=safeUrl(url??null);if(valid)materials.push({key,name,kind:'Enlace registrado',url:valid,sizeBytes:null});}
 const pending=r.status==='PENDING',blocked=['culminado','retirado'].includes(r.project_state)?'El proyecto editorial está cerrado.':gate.desbloqueado?null:gate.motivo??'El proyecto aún no cumple el gate para activar la reunión creativa.';
 return {summary:summary(r,userId),description:r.descripcion??CREATIVE_REQUEST_TYPE.summary,descriptionSource:r.descripcion?'SPECIALIST':'WORKFLOW',
 gates:[{key:'title',label:'Título definitivo',met:!!r.titulo_definitivo?.trim(),required:true,detail:r.titulo_definitivo?.trim()||'Falta confirmar el título.'},{key:'subtitle',label:'Subtítulo definitivo',met:!!r.subtitulo_definitivo?.trim(),required:true,detail:r.subtitulo_definitivo?.trim()||'Falta confirmar el subtítulo.'},{key:'service',label:'Momento del servicio',met:evaluarMomentoServicioCreativo(r.service_code,r.fecha_feedback_tripa).desbloqueado,required:true,detail:evaluarMomentoServicioCreativo(r.service_code,r.fecha_feedback_tripa).motivo??'Habilitado por la regla del servicio.'}],
 canAccept:pending&&!blocked,canReject:pending,blockedReason:pending?blocked:null,conversionLabel:CREATIVE_REQUEST_TYPE.conversion,materials,activity:events.map(e=>({id:e.id,label:creativeRequestEvents[e.action]!,actor:e.actor??'Actor no registrado',at:e.at.toISOString()})),workspace:{rootUrl:ready?workspace.rootFolderUrl:null,designUrl:design?.url??null}};
}

export async function createCreativeMeetingRequest(projectId:string,actorId:string):Promise<string>{
 return db.transaction(async tx=>{
  const [p]=await tx.select().from(proyectos).where(eq(proyectos.id,projectId)).for('update');if(!p)return fail(404,'Proyecto no encontrado.');
  const [actor]=await tx.select().from(users).where(eq(users.id,actorId));if(actor?.rol!=='especialista'||!actor.activo||await obtenerEspecialistaActual(p.id,p.especialistaId,tx)!==actorId)return fail(403,'Solo el Especialista vigente puede solicitar esta intervención.');
  if(['culminado','retirado'].includes(p.estado))return fail(409,'El proyecto editorial está cerrado.');
  const [service]=await tx.select().from(servicios).where(eq(servicios.id,p.servicioId));const gate=evaluarGateMomentoReunionCreativa({...p,servicioCodigo:service?.codigo});if(!gate.desbloqueado)return fail(400,gate.motivo??'Gate creativo pendiente.');
  const [previous]=await tx.select().from(solicitudesArea).where(and(eq(solicitudesArea.proyectoId,p.id),eq(solicitudesArea.tipo,'creativa'))).orderBy(desc(solicitudesArea.requestedAt),desc(solicitudesArea.id)).limit(1);
  if(previous){const [wi]=previous.workItemId?await tx.select().from(workItems).where(eq(workItems.id,previous.workItemId)):[];if(previous.estado!=='resuelta'||!wi||!['completado','cancelado'].includes(wi.estado))return previous.id;}
  const [legacy]=await tx.select({id:direccionesCreativas.id}).from(direccionesCreativas).innerJoin(workItems,eq(workItems.id,direccionesCreativas.workItemId)).where(and(eq(direccionesCreativas.proyectoId,p.id),eq(direccionesCreativas.tipo,'concepto_portada'),isNull(direccionesCreativas.fechaCierre),sql`${workItems.estado} not in ('completado','cancelado')`)).limit(1);if(legacy)return legacy.id;
  const [request]=await tx.insert(solicitudesArea).values({proyectoId:p.id,tipo:'creativa',businessKey:previous?'concepto_portada:'+previous.id:'concepto_portada',requestedById:actorId}).returning();
  await registrarEvento(tx,{actorId,accion:'DIRECCION_CREATIVA_SOLICITADA',entityType:'solicitud',entityId:request!.id,proyectoId:p.id});
  await tx.insert(notificaciones).values({proyectoId:p.id,rolDestino:'lider_creativo',mensaje:'Nueva solicitud de reunión creativa para #'+p.codigo+'.'});return request!.id;
 });
}
/** Import a legacy request only on an explicit decision, preserving its reserved work item and real origin. */
async function lockedRequest(tx:Tx,id:string){
 const [existing]=await tx.select().from(solicitudesArea).where(and(eq(solicitudesArea.id,id),eq(solicitudesArea.tipo,'creativa')));
 const [legacy]=existing?[]:await tx.select().from(direccionesCreativas).where(and(eq(direccionesCreativas.id,id),eq(direccionesCreativas.tipo,'concepto_portada')));
 const projectId=existing?.proyectoId??legacy?.proyectoId;if(!projectId)return fail(404,'Solicitud creativa no encontrada.');
 const [p]=await tx.select().from(proyectos).where(eq(proyectos.id,projectId)).for('update');if(!p)return fail(404,'Proyecto no encontrado.');
 let [r]=await tx.select().from(solicitudesArea).where(and(eq(solicitudesArea.id,id),eq(solicitudesArea.tipo,'creativa'))).for('update');
 if(!r&&legacy){
  const [origin]=await tx.select().from(auditLogs).where(and(eq(auditLogs.entityId,legacy.workItemId),eq(auditLogs.accion,'DIRECCION_CREATIVA_SOLICITADA'))).orderBy(auditLogs.createdAt,auditLogs.id).limit(1);
  const [assigned]=await tx.select().from(projectAssignments).where(and(eq(projectAssignments.workItemId,legacy.workItemId),eq(projectAssignments.tipo,'lider_creativo'),isNull(projectAssignments.finalizadoEn)));
  const [wi]=await tx.select().from(workItems).where(eq(workItems.id,legacy.workItemId));
  [r]=await tx.insert(solicitudesArea).values({id:legacy.id,proyectoId:p.id,tipo:'creativa',businessKey:'legacy:'+legacy.id,workItemId:legacy.workItemId,requestedById:origin?.actorId??null,requestedAt:origin?.createdAt??legacy.createdAt,targetUserId:assigned?.usuarioId??null,estado:wi?.estado==='cancelado'?'cancelada':assigned||legacy.fechaCierre||legacy.reunionRealizada?'resuelta':'pendiente',resolvedAt:assigned?.asignadoEn??null,resolvedById:assigned?.asignadoPorId??null}).returning();
 }
 if(!r)return fail(404,'Solicitud creativa no encontrada.');return {r,p};
}
export async function decideCreativeRequest(id:string,actorId:string,decision:'accept'|'reject',reason?:string,assignedLeaderId=actorId){
 return db.transaction(async tx=>{
  const [actor]=await tx.select().from(users).where(eq(users.id,actorId)),[leader]=await tx.select().from(users).where(eq(users.id,assignedLeaderId));
  if(!actor?.activo||!['lider_creativo','jefe_area'].includes(actor.rol)||actor.rol==='lider_creativo'&&assignedLeaderId!==actorId||decision==='reject'&&actor.rol!=='lider_creativo')return fail(403,'Decisión creativa no autorizada.');
  if(!leader?.activo||leader.rol!=='lider_creativo')return fail(400,'Selecciona un Líder Creativo activo.');
  const {r,p}=await lockedRequest(tx,id);
  const [assignment]=r.workItemId?await tx.select().from(projectAssignments).where(and(eq(projectAssignments.workItemId,r.workItemId),eq(projectAssignments.tipo,'lider_creativo'),isNull(projectAssignments.finalizadoEn))):[];
  const owner=r.estado==='resuelta'?assignment?.usuarioId:r.targetUserId;
  if(owner&&owner!==assignedLeaderId)return fail(403,'Esta solicitud pertenece a otro Líder Creativo.');
  if(r.estado==='resuelta'){if(decision==='accept'&&r.workItemId&&assignment?.usuarioId===assignedLeaderId)return {requestId:r.id,workItemId:r.workItemId,creativeProcessId:r.id};return fail(409,'La solicitud ya fue aceptada.');}
  if(r.estado==='rechazada'){if(decision==='reject'&&r.targetUserId===actorId)return {requestId:r.id,workItemId:null,creativeProcessId:null};return fail(409,'La solicitud fue rechazada y no admite aceptación.');}
  if(r.estado!=='pendiente')return fail(409,'La solicitud ya no está pendiente.');
  if(['culminado','retirado'].includes(p.estado))return fail(409,'El proyecto editorial está cerrado.');
  const now=new Date();let workItemId=r.workItemId;
  if(decision==='accept'){
   const [service]=await tx.select().from(servicios).where(eq(servicios.id,p.servicioId));const gate=evaluarGateMomentoReunionCreativa({...p,servicioCodigo:service?.codigo});if(!gate.desbloqueado)return fail(409,gate.motivo??'El proyecto aún no cumple el gate de título para activar la reunión creativa.');
   workItemId??=await crearWorkItemSiNoExiste(tx,{proyectoId:p.id,tipo:'direccion_creativa',businessKey:'concepto_portada:'+r.id});
   const [wi]=await tx.select().from(workItems).where(eq(workItems.id,workItemId));if(!wi||wi.proyectoId!==p.id||wi.tipo!=='direccion_creativa'||['completado','cancelado'].includes(wi.estado))return fail(409,'El trabajo de origen ya no admite activación.');
   await tx.insert(direccionesCreativas).values({id:r.id,proyectoId:p.id,workItemId,tipo:'concepto_portada',fechaSolicitud:diaCaracas(r.requestedAt)}).onConflictDoNothing();
   await asignarConHistorial(tx,{proyectoId:p.id,workItemId,tipo:'lider_creativo',usuarioId:assignedLeaderId,asignadoPorId:actorId});
   await transicionarWorkItemPorId(tx,workItemId,'en_progreso');await tx.update(workItems).set({fechaInicioReal:diaCaracas(now)}).where(eq(workItems.id,workItemId));
   await registrarEvento(tx,{actorId,accion:'LIDER_CREATIVO_ASIGNADO',entityType:'work_item',entityId:workItemId,proyectoId:p.id,detalles:{liderCreativoId:assignedLeaderId}});
  }else{
   if(!reason?.trim()||reason.trim().length<10||reason.trim().length>3000)return fail(400,'Escribe un motivo de entre 10 y 3000 caracteres.');
   if(workItemId)await transicionarWorkItemPorId(tx,workItemId,'cancelado');
  }
  await tx.update(solicitudesArea).set({estado:decision==='accept'?'resuelta':'rechazada',workItemId,targetUserId:assignedLeaderId,resolvedAt:now,resolvedById:actorId,motivo:decision==='reject'?reason!.trim():null,outcome:decision==='accept'?'CREATIVE_WORK_STARTED':'CREATIVE_REQUEST_REJECTED',version:r.version+1}).where(eq(solicitudesArea.id,r.id));
  await registrarEvento(tx,{actorId,accion:decision==='accept'?'SOLICITUD_CREATIVA_ACEPTADA':'SOLICITUD_CREATIVA_RECHAZADA',entityType:'solicitud',entityId:r.id,proyectoId:p.id,detalles:decision==='accept'?{workItemId}:{reason:reason!.trim()}});
  if(decision==='accept')await registrarEvento(tx,{actorId,accion:'SOLICITUD_CREATIVA_CONVERTIDA',entityType:'solicitud',entityId:r.id,proyectoId:p.id,detalles:{workItemId,creativeProcessId:r.id}});
  const specialist=await obtenerEspecialistaActual(p.id,p.especialistaId,tx);if(specialist)await tx.insert(notificaciones).values({proyectoId:p.id,rolDestino:'especialista',usuarioDestinoId:specialist,mensaje:decision==='accept'?'Solicitud creativa aceptada: se inició reunión y brief para #'+p.codigo+'.':'Solicitud creativa rechazada para #'+p.codigo+': '+reason!.trim()});
  if(decision==='accept'&&actorId!==assignedLeaderId)await tx.insert(notificaciones).values({proyectoId:p.id,rolDestino:'lider_creativo',usuarioDestinoId:assignedLeaderId,mensaje:'Se te asignó la intervención creativa para #'+p.codigo+'.'});
  return {requestId:r.id,workItemId:decision==='accept'?workItemId:null,creativeProcessId:decision==='accept'?r.id:null};
 });
}
