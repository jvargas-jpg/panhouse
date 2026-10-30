import {pool} from '../../db/client.js';
import type {AdminAssignment,AdminAudit,AdminPage,AdminRequest,AdminSession,AdminUser} from '../../../shared/admin.js';
import {ROLES} from '../../db/schema/enums.js';
import {adminAssert,safeAdminData} from './policy.js';
export interface AdminFilters {page:number;pageSize:number;search:string;user?:string;project?:string;role?:string;state?:string;type?:string;action?:string;entity?:string;entityId?:string;from?:string;to?:string;tab?:string;family?:string;id?:string}
export async function pageQuery<T>(source:string,where:string,args:unknown[],f:Pick<AdminFilters,'page'|'pageSize'>,order:string):Promise<AdminPage<T>>{
 const values=[...args,f.pageSize,f.page],size='$'+(args.length+1),page='$'+(args.length+2);
 const {rows:[r]}=await pool.query<{data:AdminPage<T>}>(`WITH source AS(${source}),filtered AS(SELECT * FROM source WHERE ${where||'true'}),meta AS(SELECT count(*)::int total,greatest(1,ceil(count(*)::numeric/${size}))::int pages FROM filtered),
 paged AS(SELECT * FROM filtered ORDER BY ${order} LIMIT ${size} OFFSET ((SELECT least(${page},pages)-1 FROM meta)*${size})) SELECT json_build_object('items',coalesce((SELECT json_agg(paged) FROM paged),'[]'),'total',total,'page',least(${page},pages),'pages',pages) data FROM meta`,values);
 return r!.data;
}
function clauses(f:AdminFilters,searchExpression:string){const args:unknown[]=[],where:string[]=[];const bind=(v:unknown)=>{args.push(v);return '$'+args.length;};
 if(f.search)where.push(`strpos(lower(${searchExpression}),lower(${bind(f.search)}))>0`);
 return {args,where,bind};}
// A legacy pointer is an explicit current reference, never a fabricated
// assignment with an invented start date. Any canonical history takes priority.
const LEGACY_ASSIGNMENTS=`SELECT p.id "projectId",p.codigo||' · '||coalesce(p.titulo_definitivo,p.titulo,'Proyecto editorial') project,
 p.estado::text "projectState",ref.type,ref.user_id "userId",u.nombre name FROM proyectos p
 CROSS JOIN LATERAL(VALUES('especialista'::text,p.especialista_id),('editor',p.editor_id),('disenador',p.disenador_id))ref(type,user_id)
 JOIN usuarios u ON u.id=ref.user_id WHERE NOT EXISTS(SELECT 1 FROM project_assignments a WHERE a.proyecto_id=p.id AND a.tipo::text=ref.type AND a.work_item_id IS NULL)`;
const USER_SOURCE=`SELECT u.id,u.nombre name,u.email,u.rol::text role,u.activo active,u.account_type "accountType",u.updated_at version,u.autor_id "authorId",author_record.nombre "authorName",
 s.last_login "lastLogin",s.last_activity "lastActivity",coalesce(s.active,0)::int sessions,coalesce(a.active,0)::int assignments
 FROM usuarios u LEFT JOIN autores author_record ON author_record.id=u.autor_id LEFT JOIN(SELECT user_id,max(created_at) last_login,max(last_activity_at) last_activity,count(*) FILTER(WHERE revoked_at IS NULL AND expires_at>now()) active FROM sesiones GROUP BY user_id)s ON s.user_id=u.id
 LEFT JOIN(SELECT actual.usuario_id,count(*) active FROM(
 SELECT a.usuario_id FROM project_assignments a JOIN proyectos p ON p.id=a.proyecto_id LEFT JOIN work_items w ON w.id=a.work_item_id WHERE a.finalizado_en IS NULL AND p.estado NOT IN ('culminado','retirado') AND (w.id IS NULL OR w.estado IN ('pendiente','en_progreso','bloqueado'))
 UNION ALL SELECT ref."userId" FROM(${LEGACY_ASSIGNMENTS})ref WHERE ref."projectState" NOT IN ('culminado','retirado')
 )actual GROUP BY actual.usuario_id)a ON a.usuario_id=u.id`;
export async function adminUsers(f:AdminFilters):Promise<AdminPage<AdminUser>>{const {args,where,bind}=clauses(f,"concat_ws(' ',name,email,role)");
 if(f.role)where.push(`role=${bind(f.role)}`);if(f.state)where.push(f.state==='active'?'active':'NOT active');if(f.tab==='external')where.push(`"accountType"='external'`);if(f.user)where.push(`id=${bind(f.user)}::uuid`);
 return pageQuery(USER_SOURCE,where.join(' AND '),args,f,'name,id');}
export async function adminUserById(id:string){const r=await adminUsers({page:1,pageSize:10,search:'',user:id});adminAssert(r.items[0],'Usuario no encontrado',404);return r.items[0];}
const SESSION_SOURCE=`SELECT s.public_id id,'…'||right(s.public_id::text,8) "maskedId",s.user_id "userId",u.nombre name,u.rol::text role,s.created_at "loginAt",s.last_activity_at "lastActivity",s.ip,s.user_agent "userAgent",s.expires_at "expiresAt",s.revoked_at "revokedAt",s.revoke_reason "revokeReason",v.nombre "viewAs",
 CASE WHEN s.revoked_at IS NOT NULL THEN 'revoked' WHEN s.expires_at<=now() THEN 'expired' ELSE 'valid' END state FROM sesiones s JOIN usuarios u ON u.id=s.user_id LEFT JOIN usuarios v ON v.id=s.view_as_user_id`;
export async function adminSessions(f:AdminFilters):Promise<AdminPage<AdminSession>>{const {args,where,bind}=clauses(f,"concat_ws(' ',name,role,ip)");if(f.user)where.push(`"userId"=${bind(f.user)}::uuid`);if(f.state)where.push(`state=${bind(f.state)}`);return pageQuery(SESSION_SOURCE,where.join(' AND '),args,f,'"loginAt" DESC,id');}
export async function adminAssignments(f:AdminFilters){const {args,where,bind}=clauses(f,"concat_ws(' ',name,project,type)");if(f.user)where.push(`"userId"=${bind(f.user)}::uuid`);if(f.project)where.push(`"projectId"=${bind(f.project)}::uuid`);
 const source=`SELECT a.id::text,a.proyecto_id "projectId",p.codigo||' · '||coalesce(p.titulo_definitivo,p.titulo,'Proyecto editorial') project,
 a.work_item_id "workItemId",a.usuario_id "userId",u.nombre name,a.tipo::text type,a.asignado_en "from",a.finalizado_en "to",a.motivo_fin reason,false legacy,
 (a.finalizado_en IS NULL AND p.estado NOT IN ('culminado','retirado') AND(
  (a.work_item_id IS NULL AND a.tipo IN ('especialista','editor','disenador')) OR
  (w.estado IN ('pendiente','en_progreso','bloqueado') AND(
   (a.tipo='lider_creativo' AND w.tipo='direccion_creativa') OR
   (a.tipo='corrector' AND w.tipo='correccion' AND c.id IS NOT NULL AND c.freelance IS NOT TRUE AND c.fecha_entrega IS NULL AND c.entregado_en IS NULL AND(NOT c.requiere_revision_previa OR c.revision_previa_confirmada))
  )))) "canReassign",
 (a.work_item_id IS NULL AND a.tipo IN ('especialista','editor','disenador') AND a.finalizado_en IS NULL AND a.usuario_id IS DISTINCT FROM CASE a.tipo WHEN 'especialista' THEN p.especialista_id WHEN 'editor' THEN p.editor_id WHEN 'disenador' THEN p.disenador_id END) "referenceInconsistent"
 FROM project_assignments a JOIN usuarios u ON u.id=a.usuario_id JOIN proyectos p ON p.id=a.proyecto_id
 LEFT JOIN work_items w ON w.id=a.work_item_id AND w.proyecto_id=p.id LEFT JOIN correcciones c ON c.work_item_id=w.id
 UNION ALL SELECT 'legacy:'||ref."projectId"::text||':'||ref.type,ref."projectId",ref.project,NULL::uuid,ref."userId",ref.name,ref.type,NULL::timestamptz,NULL::timestamptz,NULL::text,true,
 ref."projectState" NOT IN ('culminado','retirado'),false FROM(${LEGACY_ASSIGNMENTS})ref`;
 return pageQuery<AdminAssignment>(source,where.join(' AND '),args,f,'("to" IS NULL) DESC,legacy,"from" DESC NULLS LAST,id');}
export async function adminAudit(f:AdminFilters):Promise<AdminPage<AdminAudit>>{
 const security=f.tab==='security';const {args,where,bind}=clauses(f,"concat_ws(' ',actor,action,entity,project)");
 if(f.user){const id=bind(f.user);where.push(`("actorId"=${id}::uuid OR ${security?`lower(details->>'targetUserId')=lower(${id}::text)`:`(entity='usuario' AND "entityId"=${id}::uuid) OR lower(details->'before'->>'userId')=lower(${id}::text) OR lower(details->'before'->>'legacyUserId')=lower(${id}::text) OR lower(details->'after'->>'userId')=lower(${id}::text)`})`);}
 if(f.project)where.push(`"projectId"=${bind(f.project)}::uuid`);if(f.role)where.push(`role=${bind(f.role)}`);if(f.action)where.push(`action=${bind(f.action)}`);if(f.entity)where.push(`entity=${bind(f.entity)}`);
 if(f.id)where.push(`id=${bind(f.id)}::uuid`);if(f.entityId)where.push(`"entityId"=${bind(f.entityId)}::uuid`);
 if(f.from)where.push(`(at AT TIME ZONE 'America/Caracas')::date>=${bind(f.from)}::date`);if(f.to)where.push(`(at AT TIME ZONE 'America/Caracas')::date<=${bind(f.to)}::date`);
 if(f.tab==='overrides')where.push("action LIKE 'ADMIN\\_%' ESCAPE '\\'");
 const source=security?`SELECT e.id,coalesce(u.nombre,'Acceso no identificado') actor,e.actor_id "actorId",u.rol::text role,e.action,'seguridad' entity,coalesce(e.session_public_id,e.target_user_id,e.id) "entityId",NULL::uuid "projectId",NULL::text project,e.created_at at,jsonb_build_object('ip',e.ip,'userAgent',e.user_agent,'targetUserId',e.target_user_id) details FROM security_events e LEFT JOIN usuarios u ON u.id=e.actor_id`
 :`SELECT a.id,coalesce(u.nombre,'Sistema') actor,a.actor_id "actorId",u.rol::text role,a.accion action,a.entity_type entity,a.entity_id "entityId",a.proyecto_id "projectId",p.codigo project,a.created_at at,a.detalles details FROM audit_logs a LEFT JOIN usuarios u ON u.id=a.actor_id LEFT JOIN proyectos p ON p.id=a.proyecto_id`;
 const page=await pageQuery<AdminAudit>(source,where.join(' AND '),args,f,'at DESC,id');return {...page,items:page.items.map(r=>({...r,details:safeAdminData(r.details)}))};
}
const REQUEST_SOURCE=`SELECT r.id,'area' family,r.proyecto_id "projectId",p.codigo||' · '||coalesce(p.titulo_definitivo,p.titulo,'Proyecto editorial') project,r.asunto subject,r.descripcion description,r.tipo type,r.estado state,u.nombre requester,r.requested_by_id "requesterId",u.rol::text role,
 coalesce(t.nombre,CASE WHEN r.tipo='editor' THEN 'Jefatura de Edición' WHEN r.tipo IN ('lanzamiento','impresion') THEN 'RRPP' WHEN r.tipo='creativa' THEN 'Dirección creativa' ELSE 'Especialista coordinador' END) target,r.target_user_id "targetId",r.work_item_id "workItemId",
 (b.id IS NOT NULL AND b.resolved_at IS NULL) blocked,r.version,r.requested_at "createdAt",greatest(r.requested_at,coalesce(a.created_at,r.requested_at)) "updatedAt",r.outcome,
 (r.tipo LIKE 'digital_%' OR r.tipo LIKE 'calidad_%' OR r.tipo LIKE 'corrector_%') AND (t.id IS NULL OR NOT t.activo OR t.rol<>'especialista' OR t.id IS DISTINCT FROM p.especialista_id) AND r.estado IN ('pendiente','requiere_informacion') "canRepairTarget"
 FROM solicitudes_area r JOIN proyectos p ON p.id=r.proyecto_id LEFT JOIN usuarios u ON u.id=r.requested_by_id LEFT JOIN usuarios t ON t.id=r.target_user_id LEFT JOIN editorial_blockers b ON b.id=r.blocker_id
 LEFT JOIN LATERAL(SELECT created_at FROM audit_logs WHERE entity_id=r.id AND entity_type='solicitud' ORDER BY created_at DESC LIMIT 1)a ON true
 UNION ALL SELECT d.id,'decision',d.proyecto_id,p.codigo||' · '||coalesce(p.titulo_definitivo,p.titulo,'Proyecto editorial'),d.subject,coalesce(d.request_message,''),d.tipo,d.status,u.nombre,d.requested_by_user_id,u.rol::text,coalesce(t.nombre,d.target_role),d.assigned_decision_maker_id,d.origin_work_item_id,
 (w.estado='bloqueado' AND d.status<>'resuelta'),d.version,d.requested_at,d.updated_at,d.resolution_message,false
 FROM decisiones d JOIN proyectos p ON p.id=d.proyecto_id JOIN usuarios u ON u.id=d.requested_by_user_id LEFT JOIN usuarios t ON t.id=d.assigned_decision_maker_id LEFT JOIN work_items w ON w.id=d.origin_work_item_id
 UNION ALL SELECT c.id,'contract',corr.proyecto_id,p.codigo||' · '||coalesce(p.titulo_definitivo,p.titulo,'Proyecto editorial'),'Contrato de corrección · '||c.corrector_nombre,coalesce(c.motivo,''),'contrato_correccion',c.estado,u.nombre,c.requested_by_id,u.rol::text,'Talento Humano',NULL::uuid,corr.work_item_id,
 false,c.ronda,c.requested_at,greatest(c.requested_at,coalesce(c.reviewed_at,c.requested_at),coalesce(c.resolved_at,c.requested_at)),c.motivo,false
 FROM contratos_correccion c JOIN correcciones corr ON corr.id=c.correccion_id JOIN proyectos p ON p.id=corr.proyecto_id JOIN usuarios u ON u.id=c.requested_by_id`;
export async function adminRequests(f:AdminFilters):Promise<AdminPage<AdminRequest>>{const {args,where,bind}=clauses(f,"concat_ws(' ',project,subject,description,requester,type,target)");
 if(f.project)where.push(`"projectId"=${bind(f.project)}::uuid`);if(f.user)where.push(`"requesterId"=${bind(f.user)}::uuid`);if(f.state)where.push(`state=${bind(f.state)}`);if(f.type)where.push(`type=${bind(f.type)}`);if(f.family)where.push(`family=${bind(f.family)}`);
 if(f.tab==='pending')where.push("state IN ('pendiente','en_revision')");if(f.tab==='blocking')where.push('blocked');if(f.tab==='returned')where.push("state IN ('requiere_informacion','informacion_solicitada')");if(f.tab==='resolved')where.push("state IN ('resuelta','rechazada','cancelada')");
 if(f.from)where.push(`("createdAt" AT TIME ZONE 'America/Caracas')::date>=${bind(f.from)}::date`);if(f.to)where.push(`("createdAt" AT TIME ZONE 'America/Caracas')::date<=${bind(f.to)}::date`);
 return pageQuery(REQUEST_SOURCE,where.join(' AND '),args,f,'blocked DESC,"updatedAt" DESC,id');}
export async function adminRequestById(id:string,family:string){const {rows:[r]}=await pool.query<AdminRequest>(`WITH source AS(${REQUEST_SOURCE}) SELECT * FROM source WHERE id=$1 AND family=$2`,[id,family]);adminAssert(r,'Solicitud no encontrada',404);
 const [history,attachments,information]=await Promise.all([
 pool.query(`SELECT a.id,a.accion action,u.nombre actor,a.created_at at,a.detalles details FROM audit_logs a LEFT JOIN usuarios u ON u.id=a.actor_id WHERE a.entity_id=$1 ORDER BY a.created_at DESC,a.id LIMIT 100`,[id]),
 pool.query(`SELECT f.id,f.name,f.mime_type "mimeType",f.size,f.created_at at,u.nombre "uploadedBy" FROM solicitud_archivos f JOIN usuarios u ON u.id=f.uploaded_by_id WHERE f.solicitud_id=$1 ORDER BY f.created_at DESC LIMIT 100`,[id]),
 family==='area'?pool.query(`SELECT i.id,i.pregunta question,i.respuesta answer,i.asked_at at,q.nombre "askedBy",a.nombre "answeredBy" FROM informacion_solicitud_area i LEFT JOIN usuarios q ON q.id=i.asked_by_id LEFT JOIN usuarios a ON a.id=i.answered_by_id WHERE i.solicitud_id=$1 ORDER BY i.asked_at LIMIT 100`,[id]):Promise.resolve({rows:[]}),
 ]);return {summary:r,history:history.rows.map(h=>({...h,details:safeAdminData(h.details)})),attachments:attachments.rows,information:information.rows};}
export async function adminExternalCollaborators(f:AdminFilters){const {args,where,bind}=clauses(f,"concat_ws(' ',name)");if(f.project)where.push(`"projectId"=${bind(f.project)}::uuid`);
 return pageQuery(`SELECT c.id,c.corrector_nombre name,c.proyecto_id "projectId",p.codigo project,c.alcance,c.fecha_asignada "assignedAt",w.estado::text state,c.contrato_confirmado "contractConfirmed" FROM correcciones c JOIN proyectos p ON p.id=c.proyecto_id JOIN work_items w ON w.id=c.work_item_id WHERE c.freelance AND c.corrector_id IS NULL`,where.join(' AND '),args,f,'"assignedAt" DESC NULLS LAST,id');}
export async function adminConfiguration(){const [services,phases,steps,links,types,notifications,catalogs]=await Promise.all([
 pool.query(`SELECT id,codigo code,nombre name,activo active,peso_complejidad weight,plazo_dias days,plazo_interno_dias "internalDays",plazo_comercial_dias "commercialDays" FROM servicios ORDER BY nombre,id`),
 pool.query(`SELECT id,codigo code,nombre name,descripcion description,activo active FROM fases ORDER BY codigo,id`),
 pool.query(`SELECT p.id,p.fase_id "phaseId",f.nombre phase,p.codigo code,p.nombre name,p.orden position,p.activo active FROM pasos p JOIN fases f ON f.id=p.fase_id ORDER BY f.codigo,p.orden,p.id`),
 pool.query(`SELECT sf.servicio_id "serviceId",s.nombre service,sf.fase_id "phaseId",f.nombre phase,sf.orden position,sf.activo active FROM servicio_fases sf JOIN servicios s ON s.id=sf.servicio_id JOIN fases f ON f.id=sf.fase_id ORDER BY s.nombre,sf.orden`),
 pool.query<{definition:string}>(`SELECT pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid='solicitudes_area'::regclass AND conname='solicitudes_area_tipo_check'`),
 pool.query(`SELECT accion action,count(*)::int events FROM audit_logs WHERE accion IN ('RRPP_NOTIFICADO','JEFATURA_NOTIFICADA','ESPECIALISTA_ASIGNADO','EDITOR_ASIGNADO','DIGITAL_REQUEST_CREADA') GROUP BY accion ORDER BY accion`),
 pool.query<{data:unknown}>(`SELECT json_build_object('units',(SELECT coalesce(json_agg(x),'[]') FROM(SELECT id,nombre name,activo active FROM unidades ORDER BY nombre)x),'budgets',(SELECT coalesce(json_agg(x),'[]') FROM(SELECT id,nombre name,activo active FROM presupuestos ORDER BY nombre)x),'collections',(SELECT coalesce(json_agg(x),'[]') FROM(SELECT id,nombre name,activo active FROM colecciones ORDER BY nombre)x)) data`),
 ]);return {services:services.rows,phases:phases.rows,steps:steps.rows,links:links.rows,requestTypeConstraint:types.rows[0]?.definition??null,notificationEvidence:notifications.rows,catalogs:catalogs.rows[0]?.data,roles:ROLES,permissionsEditable:false,workflowEditable:false,versioning:'Las definiciones de fases y plazos no tienen snapshot por proyecto. Se consultan sin edición para preservar proyectos activos.',invitations:'El sistema usa alta administrativa; no tiene flujo de invitaciones ni envío de email.'};}
export async function adminSearch(search:string){const term=search.trim();if(term.length<2)return {items:[]};const {rows}=await pool.query<{id:string;kind:string;label:string;detail:string}>(`(SELECT id,'project' kind,codigo||' · '||coalesce(titulo_definitivo,titulo,'Proyecto editorial') label,estado::text detail FROM proyectos WHERE strpos(lower(concat_ws(' ',codigo,titulo_definitivo,titulo)),lower($1))>0 ORDER BY updated_at DESC LIMIT 6)
 UNION ALL(SELECT id,'user',nombre,email FROM usuarios WHERE strpos(lower(concat_ws(' ',nombre,email)),lower($1))>0 ORDER BY nombre LIMIT 6)
 UNION ALL(SELECT a.id,'author',a.nombre,array_to_string(a.email,', ') FROM autores a WHERE strpos(lower(concat_ws(' ',a.nombre,array_to_string(a.email,', '))),lower($1))>0 ORDER BY a.nombre LIMIT 6)
 UNION ALL(SELECT id,'request',asunto,tipo FROM solicitudes_area WHERE strpos(lower(concat_ws(' ',asunto,descripcion)),lower($1))>0 ORDER BY requested_at DESC LIMIT 6)
 UNION ALL(SELECT w.id,'work',coalesce(s.nombre,w.tipo),p.codigo FROM work_items w JOIN proyectos p ON p.id=w.proyecto_id LEFT JOIN pasos s ON s.id=w.paso_id WHERE strpos(lower(concat_ws(' ',w.tipo,s.nombre,p.codigo)),lower($1))>0 ORDER BY w.updated_at DESC LIMIT 6)`,[term]);return {items:rows};}
