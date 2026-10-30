import {pool} from '../../db/client.js';
import {ADMIN_PROCESS_LABELS,type AdminProject,type AdminProjectList,type AdminWork} from '../../../shared/admin.js';
import {DIAS_HABILES_EDICION_CAPITULO} from '../../helpers/edicionSla.js';
import {PLAZOS_CRUDO} from '../../../shared/planificacion.js';
import {adminAssert} from './policy.js';
export interface ProjectFilters{page:number;pageSize:number;search:string;service?:string;state?:string;specialist?:string;area?:string;express?:boolean;blocked?:boolean;overdue?:boolean;unassigned?:boolean;waiting?:boolean;inconsistent?:boolean;attention?:boolean;active?:boolean;id?:string}
const TODAY="(now() AT TIME ZONE 'America/Caracas')::date";
const STANDARD_END=`(coalesce(f.ingreso_fecha_ingreso,p.fecha_programada_inicio)+CASE WHEN s.codigo='CR' THEN CASE f.ingreso_servicio_subtipo_crudo WHEN 'Tripa' THEN ${PLAZOS_CRUDO.Tripa} WHEN 'Capítulo' THEN ${PLAZOS_CRUDO['Capítulo']} END ELSE coalesce(s.plazo_comercial_dias,s.plazo_dias) END)`;
// One shared projection drives Home, Pipeline and Project 360. Work-level
// assignments win; project-level canonical history wins over legacy pointers.
export const PROJECT_FACTS=`WITH assignments AS(
 SELECT proyecto_id,tipo,work_item_id,bool_or(finalizado_en IS NULL) active,
 (array_agg(usuario_id ORDER BY asignado_en DESC,id) FILTER(WHERE finalizado_en IS NULL))[1] user_id,
 (array_agg(id ORDER BY asignado_en DESC,id) FILTER(WHERE finalizado_en IS NULL))[1] assignment_id
 FROM project_assignments GROUP BY proyecto_id,tipo,work_item_id
), base AS(
 SELECT p.id,p.codigo code,coalesce(nullif(trim(p.titulo_definitivo),''),nullif(trim(p.titulo),''),'Proyecto editorial') title,
 coalesce(au.names,a.nombre) authors,s.id service_id,s.nombre service,s.codigo service_code,p.estado::text state,
 CASE WHEN sp.proyecto_id IS NOT NULL THEN sp.user_id ELSE p.especialista_id END specialist_id,
 p.especialista_id legacy_specialist,p.editor_id legacy_editor,p.disenador_id legacy_designer,
 ((sp.proyecto_id IS NOT NULL AND sp.user_id IS DISTINCT FROM p.especialista_id) OR (ep.proyecto_id IS NOT NULL AND ep.user_id IS DISTINCT FROM p.editor_id) OR (dp.proyecto_id IS NOT NULL AND dp.user_id IS DISTINCT FROM p.disenador_id)) inconsistent,
 p.notificado_jefatura,p.notificado_rrpp,p.fecha_fin_proyectada::text target,p.updated_at,
 coalesce(p.express_decision='confirmado' AND p.express_fecha_estandar=${STANDARD_END} AND p.express_fecha_deseada=coalesce(f.fecha_deseada_culminacion,p.fecha_deseada_autor) AND coalesce(f.fecha_deseada_culminacion,p.fecha_deseada_autor)<${STANDARD_END},false) express,coalesce(w.status,wr.status,'NOT_CONFIGURED') workspace_status,
 coalesce(w.last_error_code,wr.last_error_code) workspace_error,
 (p.estado='pausado' OR EXISTS(SELECT 1 FROM pausas pause WHERE pause.proyecto_id=p.id AND pause.fecha_inicio<=now() AND (pause.fecha_fin IS NULL OR pause.fecha_fin>now()))) paused
 FROM proyectos p JOIN autores a ON a.id=p.autor_id JOIN servicios s ON s.id=p.servicio_id
 LEFT JOIN(SELECT pa.proyecto_id,string_agg(a.nombre,', ' ORDER BY a.nombre) names FROM proyectos_autores pa JOIN autores a ON a.id=pa.autor_id GROUP BY pa.proyecto_id) au ON au.proyecto_id=p.id
 LEFT JOIN assignments sp ON sp.proyecto_id=p.id AND sp.tipo='especialista' AND sp.work_item_id IS NULL
 LEFT JOIN assignments ep ON ep.proyecto_id=p.id AND ep.tipo='editor' AND ep.work_item_id IS NULL
 LEFT JOIN assignments dp ON dp.proyecto_id=p.id AND dp.tipo='disenador' AND dp.work_item_id IS NULL
 LEFT JOIN fichas_trazabilidad f ON f.proyecto_id=p.id
 LEFT JOIN project_drive_workspaces w ON w.project_id=p.id LEFT JOIN project_workspace_requests wr ON wr.project_id=p.id
), work_raw AS(
 SELECT w.id,w.proyecto_id project_id,w.tipo type,w.estado::text state,w.updated_at,w.fecha_inicio_real,w.fecha_fin_real,w.gate_bloqueante gate,w.business_key,
 coalesce(step.nombre,w.tipo) label,phase.nombre phase,
 CASE WHEN wa.proyecto_id IS NOT NULL THEN wa.user_id WHEN pa.proyecto_id IS NOT NULL THEN pa.user_id ELSE CASE w.tipo WHEN 'edicion' THEN p.legacy_editor WHEN 'diseno' THEN p.legacy_designer WHEN 'correccion' THEN corr.corrector_id WHEN 'preparacion_inicial' THEN p.specialist_id END END user_id,
 coalesce(wa.assignment_id,pa.assignment_id) assignment_id,
 CASE WHEN w.tipo='edicion' THEN panhouse_editor_deadline(coalesce(ch.fecha_inicio_editor,w.fecha_inicio_real),coalesce(w.fecha_fin_pautada,CASE WHEN ch.fecha_respuesta_real IS NULL THEN panhouse_add_business_days(ch.fecha_inicio_editor,${DIAS_HABILES_EDICION_CAPITULO}) END),p.id,${TODAY})::timestamp AT TIME ZONE 'America/Caracas'
 ELSE coalesce(corr.due_at,design.due_at,quality.due_at,w.fecha_fin_pautada::timestamp AT TIME ZONE 'America/Caracas') END deadline,
 CASE WHEN p.paused THEN 'Proyecto en pausa'
 WHEN w.tipo='edicion' AND p.state='stand_by' THEN 'Proyecto en stand-by'
 WHEN ch.fecha_envio_autor IS NOT NULL AND ch.fecha_respuesta_real IS NULL THEN 'Autor'
 WHEN ch.fecha_entrega_editor IS NOT NULL AND ch.fecha_respuesta_real IS NULL THEN 'Especialista'
 WHEN w.tipo='calidad' AND quality.revisado_en IS NOT NULL AND quality.aprobado IS NOT TRUE THEN 'Diseño'
 WHEN w.tipo='soporte_digital' AND ficha.soporte_digital_fecha_activacion IS NOT NULL AND coalesce(doc.datos->'paqueteFinalCargado','false'::jsonb)<>'true'::jsonb THEN 'Entrega del paquete final'
 WHEN version.enviada_autor_en IS NOT NULL AND version.aprobada_autor_en IS NULL AND version.feedback_en IS NULL THEN 'Autor'
 ELSE NULL END waiting,
 (w.estado='bloqueado' OR w.gate_bloqueante IS NOT NULL OR EXISTS(SELECT 1 FROM editorial_blockers b WHERE b.work_item_id=w.id AND b.resolved_at IS NULL)
 OR EXISTS(SELECT 1 FROM correccion_blockers b WHERE b.work_item_id=w.id AND b.resolved_at IS NULL)) blocked,
 p.state project_state,p.paused,
 (w.tipo='edicion' AND w.estado='completado' AND p.state NOT IN ('culminado','retirado','pausado','stand_by') AND NOT p.paused
 AND p.legacy_editor IS NOT NULL AND NOT EXISTS(SELECT 1 FROM editorial_deliveries e WHERE e.work_item_id=w.id)
 AND NOT EXISTS(SELECT 1 FROM capitulos c WHERE c.proyecto_id=p.id) AND NOT EXISTS(SELECT 1 FROM work_items later WHERE later.proyecto_id=p.id AND later.tipo IN ('correccion','diseno','calidad') AND later.estado IN ('en_progreso','completado')) AND w.gate_bloqueante IS NULL) reopen_allowed
 FROM work_items w JOIN base p ON p.id=w.proyecto_id LEFT JOIN pasos step ON step.id=w.paso_id LEFT JOIN fases phase ON phase.id=step.fase_id
 LEFT JOIN assignments wa ON wa.work_item_id=w.id AND wa.tipo::text=CASE w.tipo WHEN 'direccion_creativa' THEN 'lider_creativo' WHEN 'calidad' THEN 'validador' WHEN 'correccion' THEN 'corrector' WHEN 'edicion' THEN 'editor' WHEN 'diseno' THEN 'disenador' ELSE w.tipo END
 LEFT JOIN assignments pa ON pa.proyecto_id=p.id AND pa.work_item_id IS NULL AND pa.tipo::text=CASE w.tipo WHEN 'preparacion_inicial' THEN 'especialista' WHEN 'diseno' THEN 'disenador' WHEN 'edicion' THEN 'editor' ELSE w.tipo END
 LEFT JOIN correcciones corr ON corr.work_item_id=w.id LEFT JOIN disenos design ON design.work_item_id=w.id LEFT JOIN ficha_calidad_fases quality ON quality.work_item_id=w.id
 LEFT JOIN capitulos ch ON w.tipo='edicion' AND w.business_key='capitulo:'||ch.id::text
 LEFT JOIN fichas_trazabilidad ficha ON ficha.proyecto_id=p.id LEFT JOIN ficha_documental_datos doc ON doc.proyecto_id=p.id AND doc.seccion='diseno'
 LEFT JOIN LATERAL(SELECT enviada_autor_en,aprobada_autor_en,feedback_en FROM diseno_versiones WHERE diseno_id=design.id ORDER BY numero DESC LIMIT 1) version ON true
), work_facts AS(
 SELECT r.*,u.nombre responsible,(r.user_id IS NOT NULL AND (u.activo IS NOT TRUE OR u.rol::text IS DISTINCT FROM CASE r.type WHEN 'edicion' THEN 'editor' WHEN 'correccion' THEN 'corrector' WHEN 'direccion_creativa' THEN 'lider_creativo' WHEN 'diseno' THEN 'disenador' WHEN 'preparacion_inicial' THEN 'especialista' ELSE u.rol::text END)) owner_invalid,
 (r.project_state NOT IN ('culminado','retirado') AND r.state IN ('pendiente','en_progreso') AND NOT r.blocked AND r.waiting IS NULL AND r.deadline IS NOT NULL
 AND CASE WHEN r.type='edicion' OR r.type NOT IN ('correccion','diseno','calidad') THEN (r.deadline AT TIME ZONE 'America/Caracas')::date<${TODAY} ELSE r.deadline<now() END) overdue
 FROM work_raw r LEFT JOIN usuarios u ON u.id=r.user_id
), project_facts AS(
 SELECT b.*,u.nombre specialist,
 coalesce(w.blocked,false) blocked,coalesce(w.overdue,false) overdue,
 ((b.notificado_jefatura AND (b.specialist_id IS NULL OR u.activo IS NOT TRUE OR u.rol<>'especialista') AND b.state NOT IN ('culminado','retirado')) OR coalesce(w.missing_owner,false)) missing_owner,
 coalesce(w.works,'[]'::jsonb) works,coalesce(w.waiting,false) waiting
 FROM base b LEFT JOIN usuarios u ON u.id=b.specialist_id
 LEFT JOIN(SELECT project_id,bool_or(blocked AND state NOT IN ('completado','cancelado')) blocked,bool_or(overdue) overdue,bool_or(waiting IS NOT NULL AND state<>'cancelado') waiting,
 bool_or(state IN ('pendiente','en_progreso','bloqueado') AND type IN ('edicion','correccion','direccion_creativa','diseno') AND (user_id IS NULL OR owner_invalid)) missing_owner,
 jsonb_agg(to_jsonb(work_facts) ORDER BY blocked DESC,overdue DESC,updated_at DESC,id) works FROM work_facts GROUP BY project_id) w ON w.project_id=b.id
)`;
type RawWork={id:string;project_id:string;type:string;label:string;phase:string|null;state:string;responsible:string|null;assignment_id:string|null;user_id:string|null;deadline:string|null;waiting:string|null;blocked:boolean;overdue:boolean;gate:string|null;updated_at:string;reopen_allowed:boolean;owner_invalid:boolean};
type RawProject={id:string;code:string;title:string;authors:string;service:string;service_id:string;state:string;specialist:string|null;specialist_id:string|null;express:boolean;target:string|null;updated_at:string;blocked:boolean;overdue:boolean;missing_owner:boolean;inconsistent:boolean;workspace_status:string;works:RawWork[]};
export function adminWork(r:RawWork):AdminWork{return {id:r.id,projectId:r.project_id,type:r.type,label:r.label===r.type?ADMIN_PROCESS_LABELS[r.type]??r.type:r.label,phase:r.phase,state:r.state,status:r.waiting?'En espera':r.blocked?'Bloqueada':r.state==='en_progreso'?'En curso':r.state==='completado'?'Completada':r.state==='cancelado'?'Cancelada':'Pendiente',responsible:r.responsible??(r.type==='soporte_digital'?'Equipo de Soporte Digital':r.type==='calidad'?'Equipo de Calidad':r.type==='intake_rrpp'||r.type==='lanzamiento'?'RRPP':r.type==='asignacion_especialista'?'Jefatura':null),assignmentId:r.assignment_id,userId:r.user_id,deadline:r.deadline,waiting:r.waiting,blocked:r.blocked,overdue:r.overdue,gate:r.gate,updatedAt:r.updated_at,version:new Date(r.updated_at).toISOString(),canReopen:r.reopen_allowed&&!r.owner_invalid,reopenReason:r.reopen_allowed&&!r.owner_invalid?'Reparar cierre editorial sin entregas registradas':'Este trabajo requiere una operación específica de su proceso para reabrirse'};}
export function adminProject(r:RawProject):AdminProject{return {id:r.id,code:r.code,title:r.title,authors:r.authors,service:r.service,serviceId:r.service_id,state:r.state,specialist:r.specialist,specialistId:r.specialist_id,express:r.express,target:r.target,updatedAt:r.updated_at,blocked:r.blocked,overdue:r.overdue,missingOwner:r.missing_owner,inconsistent:r.inconsistent,workspaceStatus:r.workspace_status,works:r.works.map(adminWork)};}
export function projectWhere(f:ProjectFilters,args:unknown[]){const conditions:string[]=[];const b=(v:unknown)=>{args.push(v);return '$'+args.length;};
 if(f.search)conditions.push(`strpos(lower(concat_ws(' ',title,code,authors,specialist,service)),lower(${b(f.search)}))>0`);
 if(f.service)conditions.push(`service_id=${b(f.service)}::uuid`);if(f.state)conditions.push(`state=${b(f.state)}`);if(f.specialist)conditions.push(`specialist_id=${b(f.specialist)}::uuid`);
 if(f.area)conditions.push(`EXISTS(SELECT 1 FROM work_facts w WHERE w.project_id=project_facts.id AND w.type=${b(f.area)})`);
 if(f.id)conditions.push(`id=${b(f.id)}::uuid`);
 if(f.attention!==undefined)conditions.push(`(blocked OR overdue OR missing_owner OR inconsistent OR workspace_status='ERROR')=${b(f.attention)}`);
 if(f.active!==undefined)conditions.push(`(state NOT IN ('culminado','retirado'))=${b(f.active)}`);
 for(const [key,col]of [['express','express'],['blocked','blocked'],['overdue','overdue'],['unassigned','missing_owner'],['waiting','waiting'],['inconsistent','inconsistent']] as const)if(f[key]!==undefined)conditions.push(`${col}=${b(f[key])}`);
 return conditions.join(' AND ')||'true';}
export async function adminProjects(f:ProjectFilters):Promise<AdminProjectList>{const args:unknown[]=[];const where=projectWhere(f,args);args.push(f.pageSize,f.page);const size='$'+(args.length-1),page='$'+args.length;
 const {rows:[result]}=await pool.query<{data:{items:RawProject[];total:number;page:number;pages:number;columns:{id:string;label:string}[];options:AdminProjectList['options']}}>(`${PROJECT_FACTS}, filtered AS(SELECT * FROM project_facts WHERE ${where}),meta AS(SELECT count(*)::int total,greatest(1,ceil(count(*)::numeric/${size}))::int pages FROM filtered),
 paged AS(SELECT * FROM filtered ORDER BY (blocked OR overdue OR missing_owner OR inconsistent) DESC,updated_at DESC,id LIMIT ${size} OFFSET ((SELECT least(${page},pages)-1 FROM meta)*${size}))
 SELECT json_build_object('items',coalesce((SELECT json_agg(paged) FROM paged),'[]'),'total',total,'page',least(${page},pages),'pages',pages,
 'columns',coalesce((SELECT json_agg(x ORDER BY id) FROM(SELECT DISTINCT type id,type label FROM work_facts) x),'[]'),
 'options',json_build_object('services',(SELECT coalesce(json_agg(x ORDER BY name),'[]') FROM(SELECT id,nombre name FROM servicios) x),'specialists',(SELECT coalesce(json_agg(x ORDER BY name),'[]') FROM(SELECT id,nombre name FROM usuarios WHERE rol='especialista') x))) data FROM meta`,args);
 return {...result!.data,items:result!.data.items.map(adminProject),columns:result!.data.columns.map(c=>({...c,label:ADMIN_PROCESS_LABELS[c.id]??c.label}))};
}
export async function adminProjectById(id:string){const list=await adminProjects({page:1,pageSize:10,search:'',id});adminAssert(list.items[0],'Proyecto no encontrado',404);return list.items[0];}
export async function adminHome(){const {rows:[r]}=await pool.query<{data:{active:number;attention:number;blocked:number;overdue:number;blockingRequests:number;recentUsers:number;items:RawProject[]}}>(`${PROJECT_FACTS} SELECT json_build_object(
 'active',(SELECT count(*) FROM project_facts WHERE state NOT IN ('culminado','retirado')),
 'attention',(SELECT count(*) FROM project_facts WHERE state NOT IN ('culminado','retirado') AND (blocked OR overdue OR missing_owner OR inconsistent OR workspace_status='ERROR')),
 'blocked',(SELECT count(*) FROM project_facts WHERE blocked),'overdue',(SELECT count(*) FROM project_facts WHERE overdue),
 'blockingRequests',(SELECT count(*) FROM solicitudes_area r JOIN editorial_blockers b ON b.id=r.blocker_id WHERE b.resolved_at IS NULL AND r.estado IN ('pendiente','en_revision','requiere_informacion')),
 'recentUsers',(SELECT count(DISTINCT user_id) FROM sesiones WHERE last_activity_at>now()-interval '15 minutes' AND revoked_at IS NULL AND expires_at>now()),
 'items',(SELECT coalesce(json_agg(x),'[]') FROM(SELECT * FROM project_facts WHERE state NOT IN ('culminado','retirado') AND (blocked OR overdue OR missing_owner OR inconsistent OR workspace_status='ERROR') ORDER BY blocked DESC,overdue DESC,updated_at,id LIMIT 12)x)) data`);
 return {...r!.data,items:r!.data.items.map(adminProject),checkedAt:new Date().toISOString()};
}
