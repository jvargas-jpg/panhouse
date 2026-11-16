import { randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { authorCredentialTokens, authorMailOutbox, autores, sessions, users } from '../db/schema/index.js';
import { hashPassword } from './password.js';
import { hashToken, type AuthenticatedUser } from './session.js';
import { ensure, portalAudit, portalProject } from './authorPortal.js';
import type { Tx } from './tx.js';
async function issue(tx:Tx,userId:string,purpose:'activate'|'reset',recipients:string[]){
  await tx.delete(authorMailOutbox).where(and(eq(authorMailOutbox.userId,userId),isNull(authorMailOutbox.sentAt),sql`${authorMailOutbox.key} LIKE 'credential:%'`));
  await tx.update(authorCredentialTokens).set({consumedAt:new Date()}).where(and(eq(authorCredentialTokens.userId,userId),isNull(authorCredentialTokens.consumedAt)));
  const token=randomBytes(32).toString('hex');
  await tx.insert(authorCredentialTokens).values({hash:hashToken(token),userId,purpose,expiresAt:new Date(Date.now()+(purpose==='activate'?48:1)*3600000)});
  // Token in fragment, never in URL query/access logs. This is credential setup,
  // not an approval link. Outbox payload is erased after successful delivery.
  // Una fila por correo registrado (puede tener varios) — el mismo enlace de
  // un solo uso, cada copia con su propio "to" para no depender de users.email.
  const subject=purpose==='activate'?'Tu invitación a PanHouse':'Recupera tu acceso a PanHouse';
  const message=purpose==='activate'?'Tu portal está listo. Establece una contraseña para activar tu cuenta.':'Establece una nueva contraseña. Si no lo solicitaste, ignora este correo.';
  const hash=hashToken(token);
  await tx.insert(authorMailOutbox).values(recipients.map((to,i)=>({key:`credential:${hash}:${i}`,userId,to,subject,message,path:`/autor/activar#${token}`})));
}
// Núcleo compartido: crea (o reactiva) la cuenta del portal para un autor y
// encola el correo de activación a cada correo registrado. Sin projectId —
// invitar al autor no depende de que ya tenga un proyecto asignado
// (Comercial puede invitarlo al darlo de alta, antes de cualquier libro).
// Quien sí necesita un proyecto es inviteAuthor() más abajo, que lo valida
// antes de llamar aquí. forceResend: la acción explícita "reenviar acceso"
// (botón de Comercial) debe mandar algo aunque la cuenta ya esté activa —
// el auto-invite al crear/asignar proyecto, en cambio, nunca toca una
// cuenta ya activa (alreadyActive:true, sin reenviar nada).
async function crearOReactivarCuentaAutor(tx:Tx,autorId:string,emails:string[],actorId:string|null,projectId:string|null,opts:{forceResend?:boolean}={}):Promise<{invited:boolean}|{alreadyActive:true}> {
  const [a]=await tx.select().from(autores).where(eq(autores.id,autorId)).for('update');ensure(a,'Autor no encontrado',404);
  const primario=emails[0]!;
  const [existing]=await tx.select().from(users).where(eq(users.autorId,a.id)).for('update');
  if(existing){
    ensure(existing.rol==='autor','El vínculo de usuario requiere revisión administrativa');
    if(existing.email!==primario){
      const [collision]=await tx.select({id:users.id}).from(users).where(eq(users.email,primario));
      ensure(!collision||collision.id===existing.id,'El correo ya pertenece a otra cuenta. Revisa el vínculo con Administración.',409);
      await tx.update(users).set({email:primario,updatedAt:new Date()}).where(eq(users.id,existing.id));
    }
    if(existing.activo){
      if(!opts.forceResend)return {alreadyActive:true};
      await issue(tx,existing.id,'reset',emails);await portalAudit(tx,actorId,projectId,'AUTOR_REENVIO_RECUPERACION',existing.id,{authorId:a.id});return {invited:true};
    }
    const [pending]=await tx.select().from(authorCredentialTokens).where(and(eq(authorCredentialTokens.userId,existing.id),eq(authorCredentialTokens.purpose,'activate'),isNull(authorCredentialTokens.consumedAt)));
    ensure(pending||opts.forceResend,'La cuenta fue desactivada. Administración debe revisar su acceso.');
    await issue(tx,existing.id,'activate',emails);return {invited:true};
  }
  const [collision]=await tx.select({id:users.id}).from(users).where(eq(users.email,primario));ensure(!collision,'El correo ya pertenece a una cuenta. Revisa el vínculo con Administración.',409);
  const [u]=await tx.insert(users).values({email:primario,nombre:a.nombre,rol:'autor',autorId:a.id,accountType:'external',activo:false,passwordHash:await hashPassword(randomBytes(48).toString('hex'))}).returning();
  await issue(tx,u!.id,'activate',emails);await portalAudit(tx,actorId,projectId,'AUTOR_INVITADO',u!.id,{authorId:a.id});return {invited:true};
}
export async function inviteAuthor(projectId:string,input:{authorId:string;email:string},actor:AuthenticatedUser){
  return db.transaction(async tx=>{
    const p=await portalProject(projectId,actor,tx,true);ensure(actor.rol!=='autor','Acceso no autorizado',403);
    const {authorScope}=await import('./authorPortal.js');const {proyectos}=await import('../db/schema/index.js');
    const [owned]=await tx.select({id:proyectos.id}).from(proyectos).where(and(eq(proyectos.id,p.id),authorScope(input.authorId)));ensure(owned,'Autor ajeno al proyecto',400);
    return crearOReactivarCuentaAutor(tx,input.authorId,[input.email.trim().toLowerCase()],actor.id,p.id);
  });
}
// Acción explícita de Comercial ("¿enviar/reenviar su enlace de acceso?",
// disparada por un popup de confirmación al crear un autor con correo o al
// editar y cambiar su(s) correo(s)) — a diferencia del auto-invite al crear
// proyecto, esta SÍ debe mandar algo aunque la cuenta ya esté activa (el
// autor se puede haber equivocado de correo y querer reenviarlo al
// correcto), y manda el enlace a TODOS los correos que tenga registrados.
export async function reenviarAccesoAutor(autorId:string,actor:AuthenticatedUser){
  return db.transaction(async tx=>{
    const [a]=await tx.select().from(autores).where(eq(autores.id,autorId));ensure(a,'Autor no encontrado',404);
    const emails=[...new Set((a.email??[]).map(e=>e.trim().toLowerCase()).filter(Boolean))];
    ensure(emails.length>0,'El autor no tiene correo registrado',400);
    return crearOReactivarCuentaAutor(tx,autorId,emails,actor.id,null,{forceResend:true});
  });
}
export async function requestAuthorReset(email:string){
  return db.transaction(async tx=>{const [u]=await tx.select().from(users).where(and(eq(users.email,email.trim().toLowerCase()),eq(users.rol,'autor'),eq(users.activo,true))).for('update');
    if(u){const [recent]=await tx.select().from(authorCredentialTokens).where(and(eq(authorCredentialTokens.userId,u.id),isNull(authorCredentialTokens.consumedAt),gt(authorCredentialTokens.expiresAt,new Date(Date.now()+45*60000))));if(!recent)await issue(tx,u.id,'reset',[u.email]);}return {ok:true};});
}
export async function consumeAuthorToken(token:string,password:string){
  return db.transaction(async tx=>{
    const [initial]=await tx.select().from(authorCredentialTokens).where(eq(authorCredentialTokens.hash,hashToken(token)));ensure(initial,'Enlace inválido o expirado',400);
    const [u]=await tx.select().from(users).where(eq(users.id,initial.userId)).for('update');
    const [t]=await tx.select().from(authorCredentialTokens).where(eq(authorCredentialTokens.hash,hashToken(token))).for('update');
    ensure(t&&!t.consumedAt&&t.expiresAt>new Date(),'Enlace inválido o expirado',400);
    ensure(u?.rol==='autor'&&u.autorId&&(t.purpose==='activate'||u.activo),'La cuenta no está disponible',400);
    ensure(password.length>=12&&password.length<=200,'Usa una contraseña de al menos 12 caracteres',400);
    await tx.update(users).set({passwordHash:await hashPassword(password),activo:true,updatedAt:new Date()}).where(eq(users.id,u.id));
    await tx.update(authorCredentialTokens).set({consumedAt:new Date()}).where(and(eq(authorCredentialTokens.userId,u.id),isNull(authorCredentialTokens.consumedAt)));
    await tx.update(sessions).set({revokedAt:new Date(),revokeReason:'Credenciales actualizadas'}).where(eq(sessions.userId,u.id));
    await portalAudit(tx,u.id,null,t.purpose==='activate'?'AUTOR_CUENTA_ACTIVADA':'AUTOR_CREDENCIALES_RECUPERADAS',u.id);return {ok:true};
  });
}
