import { randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { authorCredentialTokens, authorMailOutbox, autores, sessions, users } from '../db/schema/index.js';
import { hashPassword } from './password.js';
import { hashToken, type AuthenticatedUser } from './session.js';
import { ensure, portalAudit, portalProject } from './authorPortal.js';
import type { Tx } from './tx.js';
async function issue(tx:Tx,userId:string,purpose:'activate'|'reset'){
  await tx.delete(authorMailOutbox).where(and(eq(authorMailOutbox.userId,userId),isNull(authorMailOutbox.sentAt),sql`${authorMailOutbox.key} LIKE 'credential:%'`));
  await tx.update(authorCredentialTokens).set({consumedAt:new Date()}).where(and(eq(authorCredentialTokens.userId,userId),isNull(authorCredentialTokens.consumedAt)));
  const token=randomBytes(32).toString('hex');
  await tx.insert(authorCredentialTokens).values({hash:hashToken(token),userId,purpose,expiresAt:new Date(Date.now()+(purpose==='activate'?48:1)*3600000)});
  // Token in fragment, never in URL query/access logs. This is credential setup,
  // not an approval link. Outbox payload is erased after successful delivery.
  await tx.insert(authorMailOutbox).values({key:`credential:${hashToken(token)}`,userId,subject:purpose==='activate'?'Tu invitación a PanHouse':'Recupera tu acceso a PanHouse',message:purpose==='activate'?'Tu portal está listo. Establece una contraseña para activar tu cuenta.':'Establece una nueva contraseña. Si no lo solicitaste, ignora este correo.',path:`/autor/activar#${token}`});
}
export async function inviteAuthor(projectId:string,input:{authorId:string;email:string},actor:AuthenticatedUser){
  return db.transaction(async tx=>{
    const p=await portalProject(projectId,actor,tx,true);ensure(actor.rol!=='autor','Acceso no autorizado',403);
    const [a]=await tx.select().from(autores).where(eq(autores.id,input.authorId)).for('update');ensure(a,'Autor no encontrado',404);
    const {authorScope}=await import('./authorPortal.js');const {proyectos}=await import('../db/schema/index.js');
    const [owned]=await tx.select({id:proyectos.id}).from(proyectos).where(and(eq(proyectos.id,p.id),authorScope(a.id)));ensure(owned,'Autor ajeno al proyecto',400);
    const [existing]=await tx.select().from(users).where(eq(users.autorId,a.id)).for('update');
    if(existing){ensure(existing.rol==='autor','El vínculo de usuario requiere revisión administrativa');if(existing.activo)return {alreadyActive:true};
      const [pending]=await tx.select().from(authorCredentialTokens).where(and(eq(authorCredentialTokens.userId,existing.id),eq(authorCredentialTokens.purpose,'activate'),isNull(authorCredentialTokens.consumedAt)));
      ensure(pending,'La cuenta fue desactivada. Administración debe revisar su acceso.');await issue(tx,existing.id,'activate');return {invited:true};}
    const email=input.email.trim().toLowerCase();const [collision]=await tx.select({id:users.id}).from(users).where(eq(users.email,email));ensure(!collision,'El correo ya pertenece a una cuenta. Revisa el vínculo con Administración.',409);
    const [u]=await tx.insert(users).values({email,nombre:a.nombre,rol:'autor',autorId:a.id,accountType:'external',activo:false,passwordHash:await hashPassword(randomBytes(48).toString('hex'))}).returning();
    await issue(tx,u!.id,'activate');await portalAudit(tx,actor.id,p.id,'AUTOR_INVITADO',u!.id,{authorId:a.id});return {invited:true};
  });
}
export async function requestAuthorReset(email:string){
  return db.transaction(async tx=>{const [u]=await tx.select().from(users).where(and(eq(users.email,email.trim().toLowerCase()),eq(users.rol,'autor'),eq(users.activo,true))).for('update');
    if(u){const [recent]=await tx.select().from(authorCredentialTokens).where(and(eq(authorCredentialTokens.userId,u.id),isNull(authorCredentialTokens.consumedAt),gt(authorCredentialTokens.expiresAt,new Date(Date.now()+45*60000))));if(!recent)await issue(tx,u.id,'reset');}return {ok:true};});
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
