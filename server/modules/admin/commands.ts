import {createHash,randomUUID} from 'node:crypto';
import {and,eq,inArray,isNull,sql} from 'drizzle-orm';
import {db} from '../../db/client.js';
import {adminOperations,auditLogs,correcciones,editorialDeliveries,capitulos,editorialBlockers,notificaciones,projectAssignments,projectDriveWorkspaces,projectWorkspaceRequests,proyectos,securityEvents,servicios,sessions,solicitudesArea,users,workItems,type Rol,type TipoAsignacion} from '../../db/schema/index.js';
import {registrarEvento,type AccionAuditoria,type RegistrarEventoInput} from '../../helpers/auditLog.js';
import {asignarConHistorial} from '../../helpers/assignments.js';
import {hashPassword} from '../../helpers/password.js';
import {obtenerEspecialistaActual} from '../../helpers/carga.js';
import {workspaceSummaries,emptyWorkspace} from '../project-workspaces/queries.js';
import {dispatchProjectWorkspace} from '../project-workspaces/dispatch.js';
import {evaluateProjectGoals} from '../../helpers/monthlyGoalEvaluation.js';
import type {Tx} from '../../helpers/tx.js';
import {adminAssert,safeAdminData} from './policy.js';
export interface Command {reason:string;requestKey:string}
export interface AdminActor{id:string;rol:string}
export async function adminCommand(actor:AdminActor,action:string,input:Command & object,work:(tx:Tx)=>Promise<Record<string,unknown>>):Promise<Record<string,unknown>&{reused:boolean}>{
 adminAssert(actor.rol==='admin','Permiso administrativo requerido',403);
 adminAssert(input.reason.trim().length>=10&&input.reason.trim().length<=2000,'Explica el motivo administrativo (10–2000 caracteres)',400);
 // A ledger digest must not become a fast offline password verifier.
 // Replays identify the public intent; they never reset the initial credential.
 const fingerprint=createHash('sha256').update(JSON.stringify(input,(key,value)=>key==='password'?undefined:value)).digest('hex');
 return db.transaction(async tx=>{
  // Shared lock serializes access administration and last-admin protection.
  // No external network operation runs while this lock is held.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('panhouse:admin-commands',0))`);
  const [current]=await tx.select({role:users.rol,active:users.activo}).from(users).where(eq(users.id,actor.id)).for('share');
  adminAssert(current?.active&&current.role==='admin','El permiso administrativo cambió',403);
  const [retry]=await tx.select().from(adminOperations).where(and(eq(adminOperations.actorId,actor.id),eq(adminOperations.requestKey,input.requestKey)));
  if(retry){adminAssert(retry.action===action&&retry.inputHash===fingerprint,'La clave de confirmación ya corresponde a otra operación');return {...retry.result,reused:true};}
  const result=await work(tx);
  await tx.insert(adminOperations).values({actorId:actor.id,action,requestKey:input.requestKey,inputHash:fingerprint,result});
  return {...result,reused:false};
 });
}
async function event(tx:Tx,actor:AdminActor,action:AccionAuditoria,entity:RegistrarEventoInput['entityType'],id:string,reason:string,before:unknown,after:unknown,projectId?:string){
 await registrarEvento(tx,{actorId:actor.id,accion:action,entityType:entity,entityId:id,proyectoId:projectId,detalles:{reason,before:safeAdminData(before),after:safeAdminData(after),result:'completed'}});
}
const sameVersion=(actual:Date,expected:string)=>actual.toISOString()===new Date(expected).toISOString();
async function notify(tx:Tx,userId:string,projectId:string|undefined,message:string){const [u]=await tx.select({role:users.rol}).from(users).where(eq(users.id,userId));if(u)await tx.insert(notificaciones).values({proyectoId:projectId??null,usuarioDestinoId:userId,rolDestino:u.role,mensaje:message});}
export async function createAdminUser(actor:AdminActor,input:Command & {name:string;email:string;role:Rol;accountType:'internal'|'external';password:string;authorId?:string}){
 return adminCommand(actor,'create_user',input,async tx=>{
  adminAssert(input.accountType!=='external'||input.role==='corrector','Las cuentas externas reutilizables solo corresponden a Corrector',400);
  adminAssert(input.role!=='autor'||!!input.authorId,'Una cuenta de Autor necesita su autor vinculado',400);
  const email=input.email.trim().toLowerCase();const [existing]=await tx.select({id:users.id}).from(users).where(eq(users.email,email));adminAssert(!existing,'Ya existe una cuenta con ese correo');
  const [u]=await tx.insert(users).values({nombre:input.name.trim(),email,rol:input.role,accountType:input.accountType,passwordHash:await hashPassword(input.password),autorId:input.role==='autor'?input.authorId:null}).returning({id:users.id,nombre:users.nombre,email:users.email,rol:users.rol,accountType:users.accountType,autorId:users.autorId});
  await event(tx,actor,'ADMIN_USER_CREATED','usuario',u!.id,input.reason,null,u);
  await tx.insert(securityEvents).values({action:'ACCOUNT_CREATED',actorId:actor.id,targetUserId:u!.id});return {ok:true,id:u!.id};
 });
}
export async function updateAdminUser(actor:AdminActor,id:string,input:Command & {expectedVersion:string;active?:boolean;role?:Rol}){
 return adminCommand(actor,'update_user',Object.assign({id},input),async tx=>{
  const [u]=await tx.select({id:users.id,active:users.activo,role:users.rol,version:users.updatedAt,accountType:users.accountType,authorId:users.autorId}).from(users).where(eq(users.id,id)).for('update');
  adminAssert(u,'Usuario no encontrado',404);adminAssert(sameVersion(u.version,input.expectedVersion),'La cuenta cambió; actualiza antes de confirmar');
  const active=input.active??u.active,role=input.role??u.role;
  adminAssert(u.accountType!=='external'||role==='corrector','No se puede conceder un rol interno a una cuenta externa',400);
  adminAssert(role!=='autor'||u.authorId,'La cuenta no tiene un autor vinculado',400);
  if(u.role==='admin'&&(!active||role!=='admin')){
   const remaining=await tx.select({id:users.id}).from(users).where(and(eq(users.rol,'admin'),eq(users.activo,true)));
   adminAssert(remaining.some(a=>a.id!==id),'No se puede retirar el último administrador activo');
  }
  if(u.active===active&&u.role===role)return {ok:true,id,unchanged:true};
  await tx.update(users).set({activo:active,rol:role,updatedAt:new Date()}).where(eq(users.id,id));
  if(!active||u.role!==role)await tx.update(sessions).set({revokedAt:new Date(),revokedById:actor.id,revokeReason:input.reason,viewAsUserId:null}).where(and(eq(sessions.userId,id),isNull(sessions.revokedAt)));
  await event(tx,actor,'ADMIN_USER_UPDATED','usuario',id,input.reason,{active:u.active,role:u.role},{active,role,sessionsRevoked:!active||u.role!==role});
  await tx.insert(securityEvents).values({action:u.role!==role?'ROLE_CHANGED':active?'ACCOUNT_ENABLED':'ACCOUNT_DISABLED',actorId:actor.id,targetUserId:id});
  await notify(tx,id,undefined,'Administración actualizó el acceso a tu cuenta.');return {ok:true,id};
 });
}
export async function revokeAdminSession(actor:AdminActor,id:string,input:Command){return adminCommand(actor,'revoke_session',Object.assign({id},input),async tx=>{
 const [s]=await tx.select({id:sessions.publicId,userId:sessions.userId,revokedAt:sessions.revokedAt}).from(sessions).where(eq(sessions.publicId,id)).for('update');adminAssert(s,'Sesión no encontrada',404);
 if(s.revokedAt)return {ok:true,id,unchanged:true};
 await tx.update(sessions).set({revokedAt:new Date(),revokedById:actor.id,revokeReason:input.reason,viewAsUserId:null}).where(eq(sessions.publicId,id));
 await event(tx,actor,'ADMIN_SESSION_REVOKED','sesion',id,input.reason,{revoked:false},{revoked:true,userId:s.userId});
 await tx.insert(securityEvents).values({action:'SESSION_REVOKED',actorId:actor.id,targetUserId:s.userId,sessionPublicId:id});return {ok:true,id};
});}
const assignmentRoles={especialista:'especialista',editor:'editor',disenador:'disenador',corrector:'corrector',lider_creativo:'lider_creativo'} as const;
export async function adminReassign(actor:AdminActor,projectId:string,input:Command & {type:keyof typeof assignmentRoles;userId:string;workItemId?:string;expectedAssignmentId:string|null;expectedUserId:string|null}){
 return adminCommand(actor,'reassign',Object.assign({projectId},input),async tx=>{
  const [p]=await tx.select().from(proyectos).where(eq(proyectos.id,projectId)).for('update');adminAssert(p,'Proyecto no encontrado',404);adminAssert(!['culminado','retirado'].includes(p.estado),'El proyecto está cerrado');
  const isWork=['corrector','lider_creativo'].includes(input.type);adminAssert(isWork===!!input.workItemId,'El ámbito de asignación no corresponde al proceso',400);
  const condition=and(eq(projectAssignments.proyectoId,projectId),eq(projectAssignments.tipo,input.type),input.workItemId?eq(projectAssignments.workItemId,input.workItemId):isNull(projectAssignments.workItemId),isNull(projectAssignments.finalizadoEn));
  const [current]=await tx.select().from(projectAssignments).where(condition).for('update');
  const legacy=input.type==='especialista'?p.especialistaId:input.type==='editor'?p.editorId:input.type==='disenador'?p.disenadorId:null;
  adminAssert((current?.id??null)===input.expectedAssignmentId&&(current?.usuarioId??legacy)===input.expectedUserId,'La asignación cambió; revisa el contexto actual');
  adminAssert(current||legacy,'La asignación inicial debe pasar por el flujo normal del área');
  const [target]=await tx.select({id:users.id,role:users.rol,active:users.activo,name:users.nombre}).from(users).where(eq(users.id,input.userId)).for('share');adminAssert(target?.active&&target.role===assignmentRoles[input.type],'Selecciona una persona activa del rol correcto',400);
  if(input.workItemId){const [w]=await tx.select().from(workItems).where(and(eq(workItems.id,input.workItemId),eq(workItems.proyectoId,projectId))).for('update');adminAssert(w&&['pendiente','en_progreso','bloqueado'].includes(w.estado)&&w.tipo===(input.type==='corrector'?'correccion':'direccion_creativa'),'La tarea cambió o no pertenece a este proceso');
   if(input.type==='corrector'){const [c]=await tx.select().from(correcciones).where(eq(correcciones.workItemId,w.id)).for('update');adminAssert(c&&!c.freelance&&!c.fechaEntrega&&!c.entregadoEn&&(!c.requiereRevisionPrevia||c.revisionPreviaConfirmada),'La corrección tiene entrega, contrato externo o revisión previa pendiente');await tx.update(correcciones).set({correctorId:input.userId,correctorNombre:null,freelance:false}).where(eq(correcciones.id,c.id));}
  }
  const previousUserId=current?.usuarioId??legacy,legacyUserId=input.workItemId?null:legacy;
  const previousIds=[...new Set([previousUserId,legacyUserId].filter((id):id is string=>!!id))];
  const previousPeople=previousIds.length?await tx.select({id:users.id,name:users.nombre}).from(users).where(inArray(users.id,previousIds)):[];
  const before={assignmentId:current?.id??null,userId:previousUserId,userName:previousPeople.find(u=>u.id===previousUserId)?.name??null,legacyUserId,legacyUserName:previousPeople.find(u=>u.id===legacyUserId)?.name??null};
  const result=await asignarConHistorial(tx,{proyectoId:projectId,workItemId:input.workItemId,tipo:input.type as TipoAsignacion,usuarioId:input.userId,asignadoPorId:actor.id,motivoFin:input.reason});
  if(input.type==='especialista')await tx.update(proyectos).set({especialistaId:input.userId}).where(eq(proyectos.id,projectId));
  if(input.type==='editor')await tx.update(proyectos).set({editorId:input.userId}).where(eq(proyectos.id,projectId));
  if(input.type==='disenador')await tx.update(proyectos).set({disenadorId:input.userId}).where(eq(proyectos.id,projectId));
  if(!result.cambio&&before.userId===input.userId&&legacy===input.userId)return {ok:true,id:result.asignacionId,unchanged:true};
  await event(tx,actor,result.cambio?'ADMIN_REASSIGN':'ADMIN_ASSIGNMENT_REFERENCE_REPAIRED','project_assignment',result.asignacionId,input.reason,before,{assignmentId:result.asignacionId,userId:input.userId,userName:target.name,legacyUserId:input.workItemId?null:input.userId,legacyUserName:input.workItemId?null:target.name,workItemId:input.workItemId??null,type:input.type},projectId);
  await notify(tx,input.userId,projectId,`${result.cambio?'Administración actualizó tu asignación':'Administración corrigió tu referencia de asignación'} en el proyecto #${p.codigo}. Motivo: ${input.reason}`);
  for(const previousId of new Set([before.userId,before.legacyUserId].filter((id):id is string=>!!id&&id!==input.userId)))await notify(tx,previousId,projectId,`Administración reasignó tu intervención en #${p.codigo}. Motivo: ${input.reason}`);
  return {ok:true,id:result.asignacionId};
 });
}
export async function adminReopen(actor:AdminActor,id:string,input:Command & {expectedVersion:string}){return adminCommand(actor,'reopen_work',Object.assign({id},input),async tx=>{
 const [origin]=await tx.select({projectId:workItems.proyectoId}).from(workItems).where(eq(workItems.id,id));adminAssert(origin,'Tarea no encontrada',404);
 const [p]=await tx.select().from(proyectos).where(eq(proyectos.id,origin.projectId)).for('update');
 const [w]=await tx.select().from(workItems).where(eq(workItems.id,id)).for('update');adminAssert(w&&p,'Tarea no encontrada',404);
 adminAssert(sameVersion(w.updatedAt,input.expectedVersion),'La tarea cambió; actualiza antes de reabrir');
 adminAssert(w.tipo==='edicion'&&w.estado==='completado'&&!w.gateBloqueante&&!['culminado','retirado','pausado','stand_by'].includes(p.estado),'Esta tarea requiere la operación específica de su proceso para reabrirse');
 const [checks]=await tx.execute<{eligible:boolean}>(sql`SELECT NOT EXISTS(SELECT 1 FROM editorial_deliveries WHERE work_item_id=${id}::uuid) AND NOT EXISTS(SELECT 1 FROM capitulos WHERE proyecto_id=${p.id}::uuid)
 AND NOT EXISTS(SELECT 1 FROM pausas WHERE proyecto_id=${p.id}::uuid AND fecha_inicio<=now() AND (fecha_fin IS NULL OR fecha_fin>now()))
 AND NOT EXISTS(SELECT 1 FROM work_items WHERE proyecto_id=${p.id}::uuid AND tipo IN ('correccion','diseno','calidad') AND estado IN ('en_progreso','completado')) eligible`).then(r=>r.rows);
 const [editor]=await tx.select({userId:projectAssignments.usuarioId}).from(projectAssignments).where(and(eq(projectAssignments.proyectoId,p.id),eq(projectAssignments.tipo,'editor'),isNull(projectAssignments.workItemId),isNull(projectAssignments.finalizadoEn)));
 const [person]=await tx.select({id:users.id}).from(users).where(and(eq(users.id,editor?.userId??p.editorId??randomUUID()),eq(users.rol,'editor'),eq(users.activo,true))).for('share');
 adminAssert(checks?.eligible&&person,'No se puede reabrir: hay entregas, dependencias posteriores o falta un Editor activo');
 await tx.update(workItems).set({estado:'en_progreso',fechaFinReal:null}).where(eq(workItems.id,id));
 await event(tx,actor,'ADMIN_REOPEN_WORK_ITEM','work_item',id,input.reason,{state:w.estado,completedAt:w.fechaFinReal},{state:'en_progreso',completedAt:null},p.id);
 await evaluateProjectGoals(tx,p.id);await notify(tx,person.id,p.id,'Administración reabrió una tarea editorial sin entrega registrada. Motivo: '+input.reason);return {ok:true,id};
});}
export async function adminRequestAction(actor:AdminActor,id:string,input:Command & {expectedVersion:number;action:'cancel'|'repair_target'}){return adminCommand(actor,'request_'+input.action,Object.assign({id},input),async tx=>{
 const [origin]=await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id,id));adminAssert(origin,'Solicitud no encontrada',404);
 const [p]=await tx.select().from(proyectos).where(eq(proyectos.id,origin.proyectoId)).for('update');adminAssert(p,'Proyecto no encontrado',404);
 const [r]=await tx.select().from(solicitudesArea).where(eq(solicitudesArea.id,id)).for('update');adminAssert(r&&r.version===input.expectedVersion&&['pendiente','en_revision','requiere_informacion'].includes(r.estado),'La solicitud cambió o ya está cerrada');
 const before={state:r.estado,targetId:r.targetUserId,version:r.version};
 if(input.action==='cancel'){
  const [b]=r.blockerId?await tx.select({id:editorialBlockers.id}).from(editorialBlockers).where(and(eq(editorialBlockers.id,r.blockerId),isNull(editorialBlockers.resolvedAt))).for('update'):[];
  adminAssert(!b,'Primero debe resolverse explícitamente el bloqueo de la tarea');
  await tx.update(solicitudesArea).set({estado:'cancelada',version:r.version+1,resolvedAt:new Date(),resolvedById:actor.id,outcome:input.reason}).where(eq(solicitudesArea.id,id));
 }else{
  adminAssert(/^(digital|calidad|corrector)_/.test(r.tipo),'Este destino se determina por su flujo de área',400);
  const [old]=r.targetUserId?await tx.select({role:users.rol,active:users.activo}).from(users).where(eq(users.id,r.targetUserId)):[];
  const target=await obtenerEspecialistaActual(p.id,p.especialistaId,tx);const [u]=target?await tx.select({id:users.id,role:users.rol,active:users.activo}).from(users).where(eq(users.id,target)):[];
  adminAssert((!old?.active||old.role!=='especialista'||r.targetUserId!==target)&&u?.active&&u.role==='especialista'&&u.id!==r.requestedById,'No hay un destino inválido reparable con el Especialista vigente');
  await tx.update(solicitudesArea).set({targetUserId:u.id,version:r.version+1}).where(eq(solicitudesArea.id,id));
  await notify(tx,u.id,p.id,'Administración corrigió el destino de una solicitud: '+r.asunto);
 }
 const [after]=await tx.select({state:solicitudesArea.estado,targetId:solicitudesArea.targetUserId,version:solicitudesArea.version}).from(solicitudesArea).where(eq(solicitudesArea.id,id));
 await event(tx,actor,input.action==='cancel'?'ADMIN_REQUEST_CANCELLED':'ADMIN_REQUEST_TARGET_REPAIRED','solicitud',id,input.reason,before,after,p.id);
 if(r.requestedById)await notify(tx,r.requestedById,p.id,'Administración intervino tu solicitud: '+r.asunto+'. Motivo: '+input.reason);return {ok:true,id};
});}
export async function adminServiceAvailability(actor:AdminActor,id:string,input:Command & {active:boolean;expectedActive:boolean}){return adminCommand(actor,'service_availability',Object.assign({id},input),async tx=>{
 const [s]=await tx.select({id:servicios.id,active:servicios.activo}).from(servicios).where(eq(servicios.id,id)).for('update');adminAssert(s,'Servicio no encontrado',404);adminAssert(s.active===input.expectedActive,'La disponibilidad del servicio cambió');
 if(s.active===input.active)return {ok:true,id,unchanged:true};await tx.update(servicios).set({activo:input.active}).where(eq(servicios.id,id));
 await event(tx,actor,'ADMIN_SERVICE_AVAILABILITY','servicio',id,input.reason,{active:s.active},{active:input.active,effect:'Altas futuras; los proyectos existentes conservan el servicio'});return {ok:true,id};
});}
export async function adminWorkspaceRepair(actor:AdminActor,projectId:string,input:Command & {expectedStatus:string}){
 const result=await adminCommand(actor,'workspace_repair',Object.assign({projectId},input),async tx=>{
  const [p]=await tx.select().from(proyectos).where(eq(proyectos.id,projectId)).for('update');adminAssert(p,'Proyecto no encontrado',404);adminAssert(!['culminado','retirado'].includes(p.estado),'El proyecto está cerrado');
  adminAssert(await obtenerEspecialistaActual(p.id,p.especialistaId,tx),'Falta asignar Especialista');
  const current=(await workspaceSummaries([p.id],tx)).get(p.id)??emptyWorkspace();
  adminAssert(current.status===input.expectedStatus,'El estado documental cambió');adminAssert(!current.contextChanged,'La conexión cambió: no se puede reprovisionar sobre otro contexto');
  if(['READY','PENDING','PROVISIONING'].includes(current.status))return {ok:true,id:projectId,unchanged:true};
  await tx.insert(projectWorkspaceRequests).values({projectId,requestedByUserId:actor.id,source:'RECOVERY'}).onConflictDoUpdate({target:projectWorkspaceRequests.projectId,set:{status:'PENDING',lastErrorCode:null,updatedAt:new Date()}});
  await event(tx,actor,'ADMIN_WORKSPACE_REPAIR','proyecto',projectId,input.reason,{status:current.status},{status:'PENDING',strategy:'Existing reserved folder IDs; no moves, renames or deletion'},projectId);
  return {ok:true,id:projectId,status:'PENDING'};
 });
 dispatchProjectWorkspace(projectId);return result;
}
export async function adminViewAs(actor:AdminActor,sessionId:string,input:Command & {userId:string|null}){return adminCommand(actor,input.userId?'view_as_start':'view_as_stop',Object.assign({sessionId},input),async tx=>{
 const [s]=await tx.select({userId:sessions.userId,viewAs:sessions.viewAsUserId,revoked:sessions.revokedAt,expires:sessions.expiresAt}).from(sessions).where(eq(sessions.publicId,sessionId)).for('update');adminAssert(s&&s.userId===actor.id&&!s.revoked&&s.expires>new Date(),'Sesión administrativa no válida',403);
 if(input.userId){const [u]=await tx.select({active:users.activo,role:users.rol}).from(users).where(eq(users.id,input.userId));adminAssert(u?.active&&u.role!=='admin','Selecciona una cuenta operativa activa',400);adminAssert(!s.viewAs,'Sal del modo actual antes de abrir otra cuenta');}
 await tx.update(sessions).set({viewAsUserId:input.userId}).where(eq(sessions.publicId,sessionId));
 await event(tx,actor,input.userId?'ADMIN_VIEW_AS_STARTED':'ADMIN_VIEW_AS_STOPPED','sesion',sessionId,input.reason,{viewAsUserId:s.viewAs},{viewAsUserId:input.userId,readOnly:true});
 await tx.insert(securityEvents).values({action:input.userId?'VIEW_AS_STARTED':'VIEW_AS_STOPPED',actorId:actor.id,targetUserId:input.userId??s.viewAs,sessionPublicId:sessionId});return {ok:true};
});}
