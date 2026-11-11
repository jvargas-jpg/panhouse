import nodemailer from 'nodemailer';
import { and, eq, isNull, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { approvalRequests, authorMailOutbox, notificaciones, pausas, proyectos, users } from '../db/schema/index.js';
import { env } from '../config/env.js';
import { authorNotice, authorProjects, ensure, portalAudit, portalProject } from './authorPortal.js';
import type { AuthenticatedUser } from './session.js';
import { obtenerEspecialistaActual } from './carga.js';
import { diaCaracas } from './atencionEspecialista.js';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function authorMailTemplate(message:string,url:string){return `<div style="font-family:Arial,sans-serif;color:#182c45;max-width:600px;margin:auto"><div style="background:#14263e;color:white;padding:24px;font-weight:bold">PanHouse · Casa Editorial</div><div style="padding:28px"><h2>Tu proyecto editorial</h2><p>${escape(message)}</p><p><a style="display:inline-block;background:#b18d45;color:white;padding:14px 20px;text-decoration:none;border-radius:6px" href="${escape(url)}">Abrir PanHouse</a></p><p>Las decisiones se registran dentro de tu portal.</p></div></div>`;}
export async function deliverAuthorMail(){
  if(!process.env.SMTP_URL||!process.env.MAIL_FROM)return {configured:false};
  const transport=nodemailer.createTransport(process.env.SMTP_URL);
  // Claim one row with SKIP LOCKED; other workers cannot duplicate it. SMTP
  // lacks exactly-once delivery: stable Message-ID assists provider deduplication.
  let sent=0;
  for(let i=0;i<20;i++)await db.transaction(async tx=>{
    const [mail]=await tx.select().from(authorMailOutbox).where(and(isNull(authorMailOutbox.sentAt),lte(authorMailOutbox.nextAttemptAt,new Date()))).orderBy(authorMailOutbox.createdAt).limit(1).for('update',{skipLocked:true});if(!mail)return;
    const [u]=await tx.select().from(users).where(eq(users.id,mail.userId));if(!u)return;
    if(!u.activo&&!mail.key.startsWith('credential:')){await tx.update(authorMailOutbox).set({nextAttemptAt:new Date(Date.now()+3600000)}).where(eq(authorMailOutbox.id,mail.id));return;}
    try{
      const url=new URL(mail.path,env.APP_FRONTEND_URL).href;
      await transport.sendMail({from:process.env.MAIL_FROM,to:u.email,subject:mail.subject,text:mail.message+'\n\n'+url,html:authorMailTemplate(mail.message,url),messageId:`<${mail.id}@panhouse.local>`});
      await tx.update(authorMailOutbox).set({sentAt:new Date(),path:mail.key.startsWith('credential:')?'/login':mail.path}).where(eq(authorMailOutbox.id,mail.id));
      await portalAudit(tx,null,mail.projectId,'AUTOR_CORREO_ENVIADO',mail.id);sent++;
    }catch{await tx.update(authorMailOutbox).set({nextAttemptAt:new Date(Date.now()+15*60000)}).where(eq(authorMailOutbox.id,mail.id));}
  });return {configured:true,sent};
}
export async function processAuthorReminders(now=new Date()){
  const beforeHours=Math.min(72,Math.max(1,Number(process.env.AUTHOR_REMINDER_BEFORE_HOURS)||12));
  const rows=await db.select().from(approvalRequests).where(and(eq(approvalRequests.status,'pending'),lte(approvalRequests.dueAt,new Date(now.getTime()+beforeHours*3600000))));
  for(const r of rows)await db.transaction(async tx=>{
    const [p]=await tx.select().from(proyectos).where(eq(proyectos.id,r.projectId)).for('update');if(!p)return;
    if(p.estado==='pausado'||(await tx.select({id:pausas.id}).from(pausas).where(and(eq(pausas.proyectoId,p.id),isNull(pausas.fechaFin),lte(pausas.fechaInicio,now))))[0])return;
    const [current]=await tx.select().from(approvalRequests).where(eq(approvalRequests.id,r.id));if(current?.status!=='pending')return;
    const late=r.dueAt!<=now,key=`reminder:${r.id}:${late?'due':'before'}`;
    const [existing]=await tx.select({id:authorMailOutbox.id}).from(authorMailOutbox).where(eq(authorMailOutbox.key,key));if(existing)return;
    await authorNotice(tx,r.authorId,r.projectId,late?'Tu aprobación sigue pendiente. Puedes responder aunque haya vencido el plazo.':'Recuerda revisar tu aprobación pendiente.',`/autor/aprobaciones/${r.id}`,key);
    if(late){const specialist=await obtenerEspecialistaActual(p.id,p.especialistaId,tx);if(specialist)await tx.insert(notificaciones).values({proyectoId:p.id,rolDestino:'especialista',usuarioDestinoId:specialist,mensaje:`Esperando al Autor: venció el plazo de ${r.title}.`,targetPath:`/proyectos/${p.id}/operacion`});}
    await portalAudit(tx,null,p.id,'AUTOR_RECORDATORIO_GENERADO',r.id,{late});
  });
}
export async function manualAuthorReminder(id:string,actor:AuthenticatedUser){
 return db.transaction(async tx=>{
  const [r]=await tx.select().from(approvalRequests).where(eq(approvalRequests.id,id));ensure(r,'Aprobación no encontrada',404);await portalProject(r.projectId,actor,tx,true);
  const [current]=await tx.select({status:approvalRequests.status}).from(approvalRequests).where(eq(approvalRequests.id,id));ensure(current?.status==='pending','La decisión ya fue recibida');
  const key=`manual-reminder:${r.id}:${diaCaracas(new Date())}`;
  const [existing]=await tx.select({id:authorMailOutbox.id}).from(authorMailOutbox).where(eq(authorMailOutbox.key,key));ensure(!existing,'Ya se envió un recordatorio hoy');
  await authorNotice(tx,r.authorId,r.projectId,`Tu equipo te recuerda revisar: ${r.title}.`,`/autor/aprobaciones/${r.id}`,key);
  await portalAudit(tx,actor.id,r.projectId,'AUTOR_RECORDATORIO_MANUAL',r.id);return {ok:true};
 });
}
export async function processAuthorMilestones(){
 const accounts=await db.select().from(users).where(and(eq(users.rol,'autor'),eq(users.activo,true)));
 for(const u of accounts){if(!u.autorId)continue;for(const p of await authorProjects(u)){
  if(![3,5,6].includes(p.stage))continue;
  await db.transaction(async tx=>{
   await portalProject(p.id,u,tx,true);const key=`milestone:${u.id}:${p.id}:${p.stage}`;
   if((await tx.select({id:authorMailOutbox.id}).from(authorMailOutbox).where(eq(authorMailOutbox.key,key)))[0])return;
   await authorNotice(tx,u.autorId!,p.id,p.status==='Publicado'?'Tu proyecto ha sido publicado.':`Tu libro está en ${(p.stageLabel??'tu recorrido editorial').toLowerCase()}.`,`/autor/proyectos/${p.id}`,key);
  });
 }}
}
