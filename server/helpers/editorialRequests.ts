import { and, eq } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { notificaciones, proyectos, solicitudesArea, users } from '../db/schema/index.js';
import { editorialInterventions, EDITORIAL_EVENTS } from './editorialChief.js';
import { specialistsFor } from './editorialProjects.js';
import { diaCaracas } from './atencionEspecialista.js';
import { getEditorLoadSummary, recommendEditorsForIntervention } from './editorialAssignments.js';
import { registrarEvento } from './auditLog.js';
import type { EditorialRequestDetail, EditorialRequestFilters, EditorialRequestList, EditorialRequestSummary } from '../../shared/editorialChief.js';

// The existing area handoff owns the decision. Execution remains in work_items.
// Legacy requests with no surviving actor remain readable without inventing one.
const SOURCE = `WITH origins AS (
 SELECT r.id,r.proyecto_id,r.work_item_id,r.business_key,r.requested_by_id,r.requested_at,r.estado,r.motivo,r.version,r.descripcion,r.tipo,r.outcome,r.resolved_at decided_at,r.resolved_by_id
 FROM solicitudes_area r WHERE r.tipo IN ('editor','editor_apoyo','editor_reasignacion')
 UNION ALL
 SELECT w.id,w.proyecto_id,w.id,w.business_key,a.actor_id,a.created_at,'pendiente',null::text,1,null::text,'editor',null::text,null::timestamptz,null::uuid
 FROM work_items w JOIN LATERAL (SELECT actor_id,created_at FROM audit_logs WHERE entity_id=w.id AND accion='EDITOR_SOLICITADO' ORDER BY created_at,id LIMIT 1) a ON true
 WHERE w.tipo='edicion' AND NOT EXISTS(SELECT 1 FROM solicitudes_area r WHERE r.tipo='editor' AND r.work_item_id=w.id)
), requests AS (
 SELECT r.*,p.codigo,p.estado::text project_state,coalesce(nullif(trim(p.titulo_definitivo),''),nullif(trim(p.titulo),''),'Proyecto editorial') title,
 coalesce(au.names,a.nombre) authors,s.nombre service,s.id service_id,
 req.nombre requester,req.rol::text requester_role,
 coalesce(step.nombre,CASE WHEN w.business_key='default' THEN 'Inicio de edición' WHEN chapter.numero IS NOT NULL THEN 'Capítulo '||chapter.numero ELSE replace(w.business_key,'_',' ') END) intervention_label,
 coalesce(r.descripcion,w.observaciones) notes,w.fecha_fin_pautada::text requested_date,p.manuscrito_url,
 resolution.id assignment_id,resolution.usuario_id editor_id,ed.nombre editor,coalesce(r.decided_at,resolution.asignado_en) resolved_at,coalesce(decider.nombre,rb.nombre) resolver,
 CASE WHEN resolution.id IS NOT NULL OR r.estado IN ('resuelta','rechazada') THEN 'resuelta' WHEN w.estado='cancelado' OR r.estado='cancelada' THEN 'cancelada'
 WHEN r.estado='requiere_informacion' THEN 'devuelta' ELSE 'pendiente' END status,
 (r.tipo='editor' AND r.estado='pendiente' AND resolution.id IS NULL AND p.estado IN ('en_proceso','retrasado')
  AND w.estado IN ('pendiente','en_progreso') AND w.gate_bloqueante IS NULL AND p.editor_id IS NULL
  AND NOT EXISTS(SELECT 1 FROM project_assignments x WHERE x.proyecto_id=p.id AND x.tipo='editor' AND x.work_item_id IS NULL)
  AND NOT EXISTS(SELECT 1 FROM pausas ps WHERE ps.proyecto_id=p.id AND ps.fecha_inicio<=now() AND (ps.fecha_fin IS NULL OR ps.fecha_fin>now()))) assignment_ready,
 (r.estado='pendiente' AND resolution.id IS NULL AND p.estado IN ('en_proceso','retrasado','pausado','stand_by')
  AND w.estado IN ('pendiente','en_progreso','bloqueado') AND p.editor_id IS NULL
  AND NOT EXISTS(SELECT 1 FROM project_assignments x WHERE x.proyecto_id=p.id AND x.tipo='editor' AND x.work_item_id IS NULL) OR r.tipo<>'editor' AND r.estado IN ('pendiente','en_revision') AND p.estado NOT IN ('culminado','retirado')) actionable
 FROM origins r JOIN work_items w ON w.id=r.work_item_id AND w.proyecto_id=r.proyecto_id AND w.tipo='edicion'
 JOIN proyectos p ON p.id=r.proyecto_id JOIN autores a ON a.id=p.autor_id JOIN servicios s ON s.id=p.servicio_id
 LEFT JOIN pasos step ON step.id=w.paso_id LEFT JOIN capitulos chapter ON w.business_key='capitulo:'||chapter.id::text
 LEFT JOIN (SELECT pa.proyecto_id,string_agg(au.nombre,', ' ORDER BY au.nombre) names FROM proyectos_autores pa JOIN autores au ON au.id=pa.autor_id GROUP BY pa.proyecto_id) au ON au.proyecto_id=p.id
 LEFT JOIN usuarios req ON req.id=r.requested_by_id
 LEFT JOIN LATERAL (SELECT pa.* FROM project_assignments pa WHERE r.tipo='editor' AND pa.proyecto_id=p.id AND pa.tipo='editor' AND pa.work_item_id IS NULL AND pa.asignado_en>=r.requested_at ORDER BY pa.asignado_en,pa.id LIMIT 1) resolution ON true
 LEFT JOIN usuarios ed ON ed.id=resolution.usuario_id LEFT JOIN usuarios rb ON rb.id=resolution.asignado_por_id LEFT JOIN usuarios decider ON decider.id=r.resolved_by_id
)`;
interface Row {
 tipo:string;outcome:string|null; id:string; proyecto_id:string; work_item_id:string; business_key:string; requested_by_id:string|null; requested_at:string|Date;
 title:string; codigo:string; authors:string; service:string; service_id:string; requester:string|null; requester_role:string|null;
 status:EditorialRequestSummary['status']; resolved_at:string|Date|null; resolver:string|null; editor_id:string|null; editor:string|null;
 assignment_id:string|null; intervention_label:string; notes:string|null; requested_date:string|null; motivo:string|null; version:number;
 actionable:boolean; assignment_ready:boolean; manuscrito_url:string|null; descripcion:string|null; project_state:string;
}
const iso=(value:string|Date)=>new Date(value).toISOString();
function summary(r:Row):EditorialRequestSummary {
 return {id:r.id,projectId:r.proyecto_id,workItemId:r.work_item_id,businessKey:r.business_key,outcome:r.outcome,requestType:r.tipo==='editor'?'ASSIGN_EDITOR':r.tipo as 'editor_apoyo'|'editor_reasignacion',projectActive:!['culminado','retirado'].includes(r.project_state),
  code:r.codigo,title:r.title,authors:r.authors,coverUrl:null,service:r.service,serviceId:r.service_id,
  requester:r.requester,requesterId:r.requested_by_id,requesterRole:r.requester_role,status:r.status,requestedAt:iso(r.requested_at),
  resolvedAt:r.resolved_at?iso(r.resolved_at):null,resolvedBy:r.resolver,resultEditorId:r.editor_id,resultEditor:r.editor,
  resultWorkItemId:r.assignment_id?r.work_item_id:null,resultAssignmentId:r.assignment_id,
  interventionLabel:r.intervention_label,description:r.descripcion??`Asignar Editor para ${r.intervention_label}.`,
  volume:null,requestedDate:r.requested_date,notes:r.notes,returnReason:r.motivo,actionable:r.actionable,assignmentReady:r.assignment_ready,version:r.version};
}

export async function listarSolicitudesEdicion(filters:EditorialRequestFilters, _now=new Date()):Promise<EditorialRequestList> {
 const args:unknown[]=[];const bind=(v:unknown)=>{args.push(v);return '$'+args.length;};const conditions:string[]=[];
 if(filters.search.trim()) conditions.push(`translate(lower(title||' '||authors||' '||codigo||' '||coalesce(requester,'')||' '||intervention_label||' '||coalesce(notes,'')),'áéíóúüñ','aeiouun') LIKE ${bind('%'+filters.search.trim().normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[\\%_]/g,'\\$&')+'%')}`);
 if(filters.service)conditions.push(`service_id=${bind(filters.service)}::uuid`);
 if(filters.requester)conditions.push(`requested_by_id=${bind(filters.requester)}::uuid`);
 if(filters.from)conditions.push(`(requested_at AT TIME ZONE 'America/Caracas')::date>=${bind(filters.from)}::date`);
 if(filters.to)conditions.push(`(requested_at AT TIME ZONE 'America/Caracas')::date<=${bind(filters.to)}::date`);
 const bucket=filters.tab==='pending'?"status='pendiente' AND actionable":filters.tab==='resolved'?"status='resuelta'":filters.tab==='returned'?"status='devuelta'":'true';
 const order={oldest:'requested_at ASC',newest:'requested_at DESC',project:'title ASC'}[filters.sort];
 const size=bind(filters.pageSize),page=bind(filters.page);
 const {rows}=await pool.query<{result:Omit<EditorialRequestList,'items'>&{items:Row[]}}>(`${SOURCE},
 filtered AS(SELECT * FROM requests WHERE ${conditions.join(' AND ')||'true'}),
 selected AS(SELECT * FROM filtered WHERE ${bucket}),
 meta AS(SELECT count(*)::int total,greatest(1,ceil(count(*)::numeric/${size}))::int pages FROM selected),
 paged AS(SELECT * FROM selected ORDER BY ${order},id LIMIT ${size} OFFSET ((SELECT least(${page},pages)-1 FROM meta)*${size}))
 SELECT json_build_object('items',coalesce((SELECT json_agg(row_to_json(paged)) FROM paged),'[]'::json),
 'total',m.total,'pages',m.pages,'page',least(${page},m.pages),
 'counts',(SELECT json_build_object('pending',count(*) FILTER(WHERE status='pendiente' AND actionable),'resolved',count(*) FILTER(WHERE status='resuelta'),'returned',count(*) FILTER(WHERE status='devuelta'),'all',count(*)) FROM filtered),
 'pendingTotal',(SELECT count(*) FROM requests WHERE status='pendiente' AND actionable),
 'options',json_build_object('services',(SELECT coalesce(json_agg(x),'[]'::json) FROM (SELECT DISTINCT service_id id,service name FROM requests ORDER BY name,id) x),
 'requesters',(SELECT coalesce(json_agg(x),'[]'::json) FROM (SELECT DISTINCT requested_by_id id,requester name FROM requests WHERE requested_by_id IS NOT NULL ORDER BY name,id) x))) result FROM meta m`,args);
 const result=rows[0]!.result;return {...result,items:result.items.map(summary)};
}

export async function obtenerSolicitudEdicionDetalle(id:string,now=new Date()):Promise<EditorialRequestDetail|null> {
 const {rows}=await pool.query<Row>(`${SOURCE} SELECT * FROM requests WHERE id=$1::uuid`,[id]);
 const r=rows[0];if(!r)return null;
 const s=summary(r);
 const [items,specialists,history,recommendation]=await Promise.all([
  editorialInterventions(diaCaracas(now),r.proyecto_id,undefined,r.work_item_id),specialistsFor([r.proyecto_id]),
  pool.query<{id:string;accion:string;actor:string;created_at:Date;detalles:{motivo?:string}|null}>(
   `SELECT a.id,a.accion,coalesce(u.nombre,'Sistema') actor,a.created_at,a.detalles FROM audit_logs a LEFT JOIN usuarios u ON u.id=a.actor_id
    WHERE a.proyecto_id=$1 AND (a.entity_id=$2 OR a.entity_id=$3 OR a.entity_id=$4) AND a.accion=ANY($5::text[])
    ORDER BY a.created_at,a.id LIMIT 50`,[r.proyecto_id,id,r.work_item_id,r.assignment_id,['EDITOR_SOLICITADO','EDITOR_ASIGNADO','EDITOR_SOLICITUD_DEVUELTA','EDITOR_SOLICITUD_REENVIADA','EDITOR_REQUEST_CREADA','EDITOR_REQUEST_CANCELADA','EDITOR_REQUEST_RESUELTA','EDITOR_REQUEST_DEVUELTA','EDITOR_REQUEST_REENVIADA','EDITOR_REQUEST_EN_REVISION']]),
  s.assignmentReady?getEditorLoadSummary(now).then(recommendEditorsForIntervention):Promise.resolve(null),
 ]);
 const item=items[0],editor=recommendation?.candidates.find(e=>recommendation.recommendedIds.includes(e.id));
 return {summary:s,context:item?{editorialState:item.state,currentEditor:item.editor,specialist:specialists.get(r.proyecto_id)?.nombre??null,deadline:item.dueDate,waitingOn:item.waitingOn??null,blocker:item.block}:null,
  history:history.rows.map(h=>({id:h.id,label:(EDITORIAL_EVENTS[h.accion]??h.accion)+(h.detalles?.motivo?' · '+h.detalles.motivo:''),actor:h.actor,at:h.created_at.toISOString()})),
  files:r.manuscrito_url&&/^https:\/\//i.test(r.manuscrito_url)?[{label:'Manuscrito del proyecto',url:r.manuscrito_url}]:[],
  recommendationSummary:recommendation?{rule:recommendation.rule,observedAt:recommendation.observedAt,explanation:recommendation.explanation,tied:recommendation.recommendedIds.length,
   editor:editor?{id:editor.id,name:editor.name,actionableNow:editor.actionableNow,overdue:editor.overdue,dueThisWeek:editor.dueThisWeek}:null}:null};
}

export async function devolverSolicitudEdicion(id:string,actor:{id:string;rol:string},reason:string,expectedVersion:number) {
 const motivo=reason.trim();if(motivo.length<5||motivo.length>1000)throw Object.assign(new Error('Escribe un motivo de entre 5 y 1000 caracteres'),{statusCode:400});
 if(actor.rol!=='jefe_edicion')throw Object.assign(new Error('Solo Jefatura de Edición puede devolver esta solicitud'),{statusCode:403});
 return db.transaction(async tx=>{
  const [origin]=await tx.select().from(solicitudesArea).where(and(eq(solicitudesArea.id,id),eq(solicitudesArea.tipo,'editor')));
  if(!origin)throw Object.assign(new Error('Solicitud de Edición no encontrada'),{statusCode:404});
  const [project]=await tx.select().from(proyectos).where(eq(proyectos.id,origin.proyectoId)).for('update');
  const [r]=await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id,id)).for('update');
  if(!project||!r||r.estado!=='pendiente'||r.version!==expectedVersion||project.editorId||['culminado','retirado'].includes(project.estado))throw Object.assign(new Error('La solicitud cambió. Actualiza el detalle antes de decidir.'),{statusCode:409});
  const [chief]=await tx.select({id:users.id}).from(users).where(and(eq(users.id,actor.id),eq(users.rol,'jefe_edicion'),eq(users.activo,true)));
  if(!chief)throw Object.assign(new Error('Jefatura de Edición no autorizada'),{statusCode:403});
  await tx.update(solicitudesArea).set({estado:'requiere_informacion',motivo,version:r.version+1}).where(eq(solicitudesArea.id,id));
  await registrarEvento(tx,{actorId:actor.id,accion:'EDITOR_SOLICITUD_DEVUELTA',entityType:'solicitud',entityId:id,proyectoId:r.proyectoId,detalles:{motivo,workItemId:r.workItemId}});
  if(r.requestedById)await tx.insert(notificaciones).values({proyectoId:r.proyectoId,rolDestino:'especialista',usuarioDestinoId:r.requestedById,mensaje:`Jefatura de Edición devolvió tu solicitud: ${motivo}`});
  return {ok:true};
 });
}
