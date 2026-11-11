import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { buildApp } from '../server/app.js';
import { db } from '../server/db/client.js';
import { approvalRequests, authorCredentialTokens, authorDocuments, authorMailOutbox, auditLogs, capitulos, direccionesCreativas, disenos, disenoVersiones, fichaCalidadFases, fichaDisenoPropuestas, fichasTrazabilidad, notificaciones, pausas, proyectos, proyectosAutores, solicitudesArea, users, workItems } from '../server/db/schema/index.js';
import { createSession } from '../server/helpers/session.js';
import { consumeAuthorToken } from '../server/helpers/authorAccounts.js';
import { updateAdminUser } from '../server/modules/admin/commands.js';
import { processAuthorReminders, deliverAuthorMail, authorMailTemplate } from '../server/helpers/authorMail.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { completarPreparacionDePrueba, crearAutor, crearPresupuesto, crearProyecto, crearServicio, crearUnidad, crearUsuario } from './helpers/fixtures.js';
const drive=vi.hoisted(()=>({read:vi.fn(async()=>Buffer.from('%PDF-1.4 test')),pin:vi.fn(async()=>({revisionId:'rev-exact-42',mimeType:'application/pdf'}))}));
const smtp=vi.hoisted(()=>({send:vi.fn(async()=>({messageId:'test'}))}));
vi.mock('nodemailer',()=>({default:{createTransport:()=>({sendMail:smtp.send})}}));
vi.mock('../server/modules/integrations/google-drive/corporate.js',()=>({withCorporateDrive:async(fn:Function)=>fn({storage:{getMetadata:async(id:string)=>({providerFileId:id,parents:id.startsWith('foreign')?[]:['fixture-'+(globalThis as any).__authorProject],mimeType:'application/pdf'}),pinAuthorRevision:drive.pin,readAuthorRevision:drive.read},integration:{}})}));
let seq=0;
async function fixture(){
 const specialist=await crearUsuario('especialista'),author=await crearAutor(),other=await crearAutor(),ua=await crearUsuario('autor',author.id),ub=await crearUsuario('autor',other.id),unit=await crearUnidad(),budget=await crearPresupuesto();
 const service=await crearServicio({codigo:'EF',nombre:'Escritura Fantasma',pesoComplejidad:4,plazoDias:180});
 const p=await crearProyecto({autorId:author.id,servicioId:service.id,unidadId:unit.id,presupuestoId:budget.id,especialistaId:specialist.id,fechaProgramadaInicio:'2026-11-01'});
 const p2=await crearProyecto({autorId:other.id,servicioId:service.id,unidadId:unit.id,presupuestoId:budget.id,fechaProgramadaInicio:'2026-11-01'});
 await completarPreparacionDePrueba(p.id);await db.insert(fichasTrazabilidad).values({proyectoId:p.id});
 const [wi]=await db.insert(workItems).values({proyectoId:p.id,tipo:'edicion',estado:'en_progreso'}).returning();
 const app=buildApp();await app.ready();
 const cookie=async(userId:string)=>'panhouse_sid='+await createSession(userId);
 const ca=await cookie(ua.id),cb=await cookie(ub.id),cs=await cookie(specialist.id);
 const req=(method:'GET'|'POST'|'PATCH',url:string,who=ca,payload?:unknown)=>app.inject({method,url,headers:{cookie:who},...(payload?{payload:payload as any}:{})});
 const document=async(version='V1',authorId=author.id,projectId=p.id,file='file_exact_1')=>(await db.insert(authorDocuments).values({projectId,authorId,title:'Entrega editorial',version,driveFileId:file,revisionId:'revision-'+version,mimeType:'application/pdf',sharedBy:specialist.id}).returning())[0]!;
 const approve=async(type='estructura',originId=wi!.id,version='V1',previousId?:string,dueAt?:string)=>{const d=await document(version);const r=await req('POST',`/api/autor/internal/projects/${p.id}/approvals`,cs,{authorId:author.id,type,originId,title:type.replaceAll('_',' '),instructions:'Revisa la versión indicada y comparte tu decisión.',documentIds:[d.id],previousId,dueAt});expect(r.statusCode,r.body).toBe(201);return {id:r.json().id as string,document:d};};
 (globalThis as any).__authorProject=p.id;
 return {app,req,p,p2,wi:wi!,author,other,ua,ub,specialist,ca,cb,cs,document,approve};
}
describe('Portal Autor: seguridad y ciclo real del dominio',()=>{
 beforeEach(limpiarBaseDeDatos);
 it('lista solo proyectos propios y coautoría; bloquea IDOR e información interna en todas las superficies',async()=>{
  const f=await fixture();try{
   expect((await f.req('GET','/api/autor/projects')).json().projects.map((p:any)=>p.id)).toEqual([f.p.id]);
   expect((await f.req('GET','/api/autor/projects/'+f.p2.id)).statusCode).toBe(404);
   for(const path of [`/api/proyectos/${f.p.id}/command-center`,`/api/proyectos/${f.p.id}`,'/api/usuarios','/api/autores','/api/metricas','/api/notificaciones',`/api/proyectos/mis-libros`])expect((await f.req('GET',path)).statusCode,path).toBe(403);
   const dto=(await f.req('GET','/api/autor/projects/'+f.p.id)).json();expect(JSON.stringify(dto)).not.toMatch(/password|Hash|audit|observaciones|monto|especialistaId|driveFileId|edicionEstatus/);
   await db.insert(proyectosAutores).values({proyectoId:f.p2.id,autorId:f.author.id});expect((await f.req('GET','/api/autor/projects')).json().projects).toHaveLength(2);
   expect((await f.req('GET','/api/autor/internal/projects/'+f.p.id)).statusCode).toBe(403);
  }finally{await f.app.close();}
 });
 it('crea notificación, exige feedback, conserva revisión exacta, y permite una decisión vencida e inmutable',async()=>{
  const f=await fixture();try{
   const r=await f.approve('estructura',f.wi.id,'V1',undefined,'2020-01-01T00:00:00Z');
   expect((await f.req('GET','/api/autor/approvals/'+r.id,f.cb)).statusCode).toBe(404);
   expect((await f.req('POST','/api/autor/approvals/'+r.id+'/decision',f.cb,{decision:'approved'})).statusCode).toBe(404);
   expect((await f.req('POST','/api/autor/approvals/'+r.id+'/decision',f.ca,{decision:'changes_requested',feedback:' '})).statusCode).toBe(400);
   await processAuthorReminders();await processAuthorReminders();
   const [before]=await db.select().from(approvalRequests).where(eq(approvalRequests.id,r.id));expect(before!.status).toBe('pending');
   expect((await f.req('GET','/api/autor/approvals/'+r.id)).json().approval.overdueDays).toBeGreaterThan(0);
   expect((await f.req('GET','/api/autor/notifications')).json().notifications.length).toBeGreaterThan(0);
   expect((await f.req('GET','/api/autor/notifications',f.cb)).json().notifications).toHaveLength(0);
   expect((await f.req('POST','/api/autor/approvals/'+r.id+'/decision',f.ca,{decision:'approved'})).statusCode).toBe(200);
   expect((await f.req('POST','/api/autor/approvals/'+r.id+'/decision',f.ca,{decision:'changes_requested',feedback:'cambio tardío'})).statusCode).toBe(409);
   expect((await db.select().from(authorDocuments).where(eq(authorDocuments.id,r.document.id)))[0]!.revisionId).toBe('revision-V1');
   expect((await db.select().from(notificaciones).where(eq(notificaciones.usuarioDestinoId,f.specialist.id))).some(n=>n.mensaje.includes('aprobó'))).toBe(true);
   const reminder=await db.select().from(authorMailOutbox);expect(reminder.filter(m=>m.key.startsWith('reminder:'))).toHaveLength(1);
   expect((await db.select().from(workItems).where(eq(workItems.id,f.wi.id)))[0]!.gateBloqueante).toBeNull();
  }finally{await f.app.close();}
 });
 it('resuelve una sola decisión ante doble clic concurrente',async()=>{const f=await fixture();try{const r=await f.approve();const results=await Promise.all([f.req('POST',`/api/autor/approvals/${r.id}/decision`,f.ca,{decision:'approved'}),f.req('POST',`/api/autor/approvals/${r.id}/decision`,f.ca,{decision:'changes_requested',feedback:'Otra decisión'})]);expect(results.map(r=>r.statusCode).sort()).toEqual([200,409]);}finally{await f.app.close();}});
 it('aplica ownership y RBAC a todos los comandos internos y lectura de notificaciones',async()=>{const f=await fixture();try{
   const outsider=await crearUsuario('especialista'),cookie='panhouse_sid='+await createSession(outsider.id),r=await f.approve();
   const pause=await f.req('POST',`/api/autor/projects/${f.p.id}/pause-requests`,f.ca,{reason:'Necesito unos días',start:'2026-11-15T04:00:00Z',requestKey:randomUUID()});
   for(const [path,body]of [
    [`/internal/projects/${f.p.id}/invite`,{authorId:f.author.id,email:'elisa@test.test'}],
    [`/internal/projects/${f.p.id}/documents`,{authorId:f.author.id,driveFileId:'file_fixture',title:'Documento',version:'V1',category:'compartido'}],
    [`/internal/projects/${f.p.id}/approvals`,{authorId:f.author.id,type:'estructura',originId:f.wi.id,title:'Estructura',instructions:'Revisar',documentIds:[r.document.id]}],
    [`/internal/documents/${r.document.id}/revoke`,{}],
    [`/internal/approvals/${r.id}/remind`,{}],
    [`/internal/approvals/${r.id}/cancel`,{reason:'Retirada sin permiso'}],
    [`/internal/approvals/${r.id}/external-decision`,{decision:'approved',external:{channel:'correo',receivedAt:'2020-01-01T00:00:00Z',evidence:'Correo del autor',reason:'Recibido fuera del portal'}}],
    [`/internal/requests/${pause.json().id}/resolve`,{approve:false,reason:'No autorizado'}],
   ] as const){expect((await f.req('POST','/api/autor'+path,cookie,body)).statusCode,path).toBe(404);expect((await f.req('POST','/api/autor'+path,f.cb,body)).statusCode,path).toBe(403);}
   const [notice]=await db.select().from(notificaciones).where(eq(notificaciones.usuarioDestinoId,f.ua.id));expect((await f.req('POST',`/api/autor/notifications/${notice!.id}/read`,f.cb)).statusCode).toBe(404);
   expect((await f.req('POST',`/api/autor/internal/projects/${f.p.id}/approvals`,f.cs,{authorId:f.other.id,type:'estructura',originId:f.wi.id,title:'Estructura',instructions:'Revisar',documentIds:[r.document.id]})).statusCode).toBe(400);
  }finally{await f.app.close();}});
 it('correo usa outbox con reintento, HTML escapado y enlaces autenticados',async()=>{const f=await fixture();try{
   const r=await f.approve();vi.stubEnv('SMTP_URL','smtp://qa.invalid');vi.stubEnv('MAIL_FROM','qa@panhouse.test');smtp.send.mockRejectedValueOnce(new Error('temporary failure'));
   await deliverAuthorMail();const [failed]=await db.select().from(authorMailOutbox);expect(failed!.sentAt).toBeNull();expect(failed!.nextAttemptAt>new Date()).toBe(true);
   await db.update(authorMailOutbox).set({nextAttemptAt:new Date(0)});await deliverAuthorMail();const [sent]=await db.select().from(authorMailOutbox);expect(sent!.sentAt).toBeTruthy();expect(sent!.path).toBe('/autor/aprobaciones/'+r.id);
   expect(authorMailTemplate('<script>bad</script>','https://example.test/autor')).not.toContain('<script>');
  }finally{vi.unstubAllEnvs();await f.app.close();}});
 it('retirar un documento cancela la solicitud abierta y conserva el historial inmutable',async()=>{const f=await fixture();try{
   const r=await f.approve();expect((await f.req('POST',`/api/autor/internal/documents/${r.document.id}/revoke`,f.cs)).statusCode).toBe(200);
   expect((await f.req('GET',`/api/autor/approvals/${r.id}`)).json().approval.status).toBe('cancelled');
   expect((await f.req('POST',`/api/autor/approvals/${r.id}/decision`,f.ca,{decision:'approved'})).statusCode).toBe(409);
   await expect(db.update(authorDocuments).set({revisionId:'fake-new-version'}).where(eq(authorDocuments.id,r.document.id))).rejects.toThrow('immutable');
   await expect(db.update(approvalRequests).set({feedback:'historia alterada'}).where(eq(approvalRequests.id,r.id))).rejects.toThrow('immutable');
   const fresh=await f.approve('estructura',f.wi.id,'V2',r.id);expect((await f.req('GET',`/api/autor/approvals/${fresh.id}`)).json().history[0].status).toBe('cancelled');
  }finally{await f.app.close();}});
 it('solo expone documentos liberados y sirve la revisión fijada, con revocación e IDOR',async()=>{const f=await fixture();try{
   const own=await f.document(),foreign=await f.document('B',f.other.id,f.p2.id);await db.update(proyectos).set({manuscritoUrl:'https://internal.test/secret'}).where(eq(proyectos.id,f.p.id));
   expect((await f.req('GET','/api/autor/documents')).json().documents.map((d:any)=>d.id)).toEqual([own.id]);
   expect((await f.req('GET',`/api/autor/documents/${foreign.id}/content`)).statusCode).toBe(404);
   expect((await f.req('GET',`/api/autor/documents/${own.id}/content`)).statusCode).toBe(200);expect(drive.read).toHaveBeenCalledWith(own.driveFileId,own.revisionId);
   expect((await f.req('POST',`/api/autor/internal/documents/${own.id}/revoke`,f.cb)).statusCode).toBe(403);
   expect((await f.req('POST',`/api/autor/internal/documents/${own.id}/revoke`,f.cs)).statusCode).toBe(200);
   expect((await f.req('GET',`/api/autor/documents/${own.id}/content`)).statusCode).toBe(404);
   const share=await f.req('POST',`/api/autor/internal/projects/${f.p.id}/documents`,f.cs,{authorId:f.author.id,title:'Documento exacto',version:'V5',driveFileId:'drive_file_test',category:'compartido'});expect(share.statusCode,share.body).toBe(201);expect(drive.pin).toHaveBeenCalled();
   const foreignShare=await f.req('POST',`/api/autor/internal/projects/${f.p.id}/documents`,f.cs,{authorId:f.author.id,title:'Documento ajeno',version:'V5',driveFileId:'foreign_file_test',category:'compartido'});expect(foreignShare.statusCode).toBe(400);
  }finally{await f.app.close();}});
 it('solicita pausa sin pausar unilateralmente; requiere autorización interna y usa pausas canónicas',async()=>{const f=await fixture();try{
   const payload={reason:'Necesito tiempo adicional',start:'2026-11-12T04:00:00Z',requestKey:randomUUID()};
   expect((await f.req('POST',`/api/autor/projects/${f.p2.id}/pause-requests`,f.ca,payload)).statusCode).toBe(404);
   const r=await f.req('POST',`/api/autor/projects/${f.p.id}/pause-requests`,f.ca,payload);expect(r.statusCode,r.body).toBe(201);const id=r.json().id;
   expect(await db.select().from(pausas)).toHaveLength(0);expect((await f.req('POST','/api/pausas',f.ca,{proyectoId:f.p.id,causa:'autor',fechaInicio:payload.start})).statusCode).toBe(403);
   expect((await f.req('POST',`/api/autor/internal/requests/${id}/resolve`,f.ca,{approve:true,reason:'Pausar ahora'})).statusCode).toBe(403);
   expect((await f.req('POST',`/api/autor/internal/requests/${id}/resolve`,f.cs,{approve:true,formal:true,paymentConfirmed:false,reason:'Pausar ahora'})).statusCode).toBe(403);
   expect((await f.req('POST',`/api/autor/internal/requests/${id}/resolve`,f.cs,{approve:true,reason:'Pausa autorizada por el equipo'})).statusCode).toBe(200);
   expect(await db.select().from(pausas)).toHaveLength(1);expect((await f.req('GET','/api/autor/requests')).json().requests[0].pausedAt).toBeTruthy();expect((await f.req('GET','/api/autor/requests',f.cb)).json().requests).toHaveLength(0);
  }finally{await f.app.close();}});
 it('registra una decisión externa con actor real y evidencia, bloqueando el atajo antiguo',async()=>{const f=await fixture();try{
   const [dc]=await db.insert(direccionesCreativas).values({proyectoId:f.p.id,workItemId:f.wi.id,briefEnlace:'https://drive.google.com/file/d/file_exact_1/view',fechaBriefEnviadoEspecialista:'2026-11-01'}).returning();const r=await f.approve('brief_creativo',dc!.id);
   expect((await f.req('PATCH',`/api/direccion-creativa/${dc!.id}/brief-autor`,f.cs,{fechaBriefAprobadoAutor:'2026-11-11'})).statusCode).toBe(409);
   expect((await f.req('POST',`/api/autor/internal/approvals/${r.id}/external-decision`,f.cs,{decision:'approved'})).statusCode).toBe(400);
   expect((await f.req('POST',`/api/autor/internal/approvals/${r.id}/external-decision`,f.cs,{decision:'approved',external:{channel:'whatsapp',receivedAt:'2020-01-01T00:00:00Z',evidence:'Mensaje del autor recibido y archivado',reason:'El Autor respondió fuera del portal'}})).statusCode).toBe(200);
   const [audit]=await db.select().from(auditLogs).where(eq(auditLogs.accion,'DECISION_AUTOR_EXTERNA_REGISTRADA'));expect(audit!.actorId).toBe(f.specialist.id);expect(JSON.stringify(audit!.detalles)).toContain('whatsapp');
   expect((await db.select().from(direccionesCreativas).where(eq(direccionesCreativas.id,dc!.id)))[0]!.fechaBriefAprobadoAutor).toBeTruthy();
  }finally{await f.app.close();}});
 it('EF: estructura con feedback y nueva versión, varios capítulos, Brief, conceptos y muestra',async()=>{const f=await fixture();try{
   const decide=async(id:string,decision='approved',feedback?:string)=>{const r=await f.req('POST',`/api/autor/approvals/${id}/decision`,f.ca,{decision,feedback});expect(r.statusCode,r.body).toBe(200);};
   const first=await f.approve();await decide(first.id,'changes_requested','Reorganizar la introducción');
   const next=await f.approve('estructura',f.wi.id,'V2',first.id);await decide(next.id);expect((await f.req('GET',`/api/autor/approvals/${next.id}`)).json().history[0].feedback).toBe('Reorganizar la introducción');
   for(let n=1;n<=3;n++){const [c]=await db.insert(capitulos).values({proyectoId:f.p.id,numero:n,fechaEntregaEditor:'2026-11-01'}).returning();await db.insert(workItems).values({proyectoId:f.p.id,tipo:'edicion',businessKey:'capitulo:'+c!.id,estado:'completado'});const r=await f.approve('capitulo',c!.id,'Capítulo '+n);await decide(r.id);}
   const [creativeWI]=await db.insert(workItems).values({proyectoId:f.p.id,tipo:'direccion_creativa',estado:'en_progreso'}).returning();const [dc]=await db.insert(direccionesCreativas).values({proyectoId:f.p.id,workItemId:creativeWI!.id,briefEnlace:'https://drive.google.com/file/d/file_exact_1/view',fechaBriefEnviadoEspecialista:'2026-11-01'}).returning();
   const brief=await f.approve('brief_creativo',dc!.id,'Brief V1');await decide(brief.id);
   const [ficha]=await db.select().from(fichasTrazabilidad).where(eq(fichasTrazabilidad.proyectoId,f.p.id));const [proposal]=await db.insert(fichaDisenoPropuestas).values({fichaId:ficha!.id,direccionCreativaId:dc!.id,enlace:'https://drive.google.com/file/d/file_exact_1/view',fechaAprobadaRrpp:'2026-11-01'}).returning();
   const concept=await f.approve('concepto_portada',proposal!.id,'Concepto V1');await decide(concept.id,'changes_requested','Usar colores más cálidos');const concept2=await f.approve('concepto_portada',proposal!.id,'Concepto V2',concept.id);await decide(concept2.id);
   const [dwi]=await db.insert(workItems).values({proyectoId:f.p.id,tipo:'diseno',estado:'en_progreso'}).returning();const [design]=await db.insert(disenos).values({proyectoId:f.p.id,workItemId:dwi!.id,direccionCreativaId:dc!.id,tipo:'muestra_diagramacion',solicitudKey:randomUUID(),fuenteUrl:'https://drive.google.com/file/d/file_exact_1/view'}).returning();const [version]=await db.insert(disenoVersiones).values({disenoId:design!.id,numero:1,entregaKey:randomUUID(),enlace:'https://drive.google.com/file/d/file_exact_1/view',entregadoPorId:f.specialist.id}).returning();const sample=await f.approve('muestra_diagramacion',version!.id,'Muestra V1');await decide(sample.id);
   expect((await db.select().from(disenoVersiones).where(eq(disenoVersiones.id,version!.id)))[0]!.aprobadaAutorEn).toBeTruthy();expect((await db.select().from(workItems).where(eq(workItems.id,dwi!.id)))[0]!.estado).toBe('completado');
   expect((await f.req('GET','/api/autor/approvals')).json().approvals).toHaveLength(9);
  }finally{await f.app.close();}});
 it('la versión validada inicia Revisión Final y el feedback vuelve al diseñador',async()=>{const f=await fixture();try{
   const designer=await crearUsuario('disenador');await db.update(proyectos).set({disenadorId:designer.id}).where(eq(proyectos.id,f.p.id));
   const [dc]=await db.insert(direccionesCreativas).values({proyectoId:f.p.id,workItemId:f.wi.id}).returning();const [dwi]=await db.insert(workItems).values({proyectoId:f.p.id,tipo:'diseno',estado:'completado'}).returning();const [d]=await db.insert(disenos).values({proyectoId:f.p.id,workItemId:dwi!.id,direccionCreativaId:dc!.id,tipo:'diagramacion',solicitudKey:randomUUID(),fuenteUrl:'https://drive.google.com/file/d/file_exact_1/view'}).returning();
   const [v]=await db.insert(disenoVersiones).values({disenoId:d!.id,numero:1,entregaKey:randomUUID(),enlace:'https://drive.google.com/file/d/file_exact_1/view',entregadoPorId:designer.id}).returning();const [ficha]=await db.select().from(fichasTrazabilidad).where(eq(fichasTrazabilidad.proyectoId,f.p.id));
   const [qwi]=await db.insert(workItems).values({proyectoId:f.p.id,tipo:'calidad',estado:'completado'}).returning();const [q]=await db.insert(fichaCalidadFases).values({fichaId:ficha!.id,numeroFase:1,ronda:1,disenoVersionId:v!.id,workItemId:qwi!.id,aprobado:true,revisadoEn:new Date(),pdfUrl:v!.enlace}).returning();await db.update(disenoVersiones).set({calidadFaseId:q!.id}).where(eq(disenoVersiones.id,v!.id));
   const r=await f.approve('version_validada',v!.id,'Calidad V1');expect((await f.req('POST',`/api/autor/approvals/${r.id}/decision`,f.ca,{decision:'changes_requested',feedback:'Ajustar el índice'})).statusCode).toBe(200);
   expect((await db.select().from(workItems).where(eq(workItems.id,dwi!.id)))[0]!.estado).toBe('en_progreso');expect((await db.select().from(notificaciones).where(eq(notificaciones.usuarioDestinoId,designer.id))).length).toBeGreaterThan(0);
   const [v2]=await db.insert(disenoVersiones).values({disenoId:d!.id,numero:2,entregaKey:randomUUID(),enlace:v!.enlace,entregadoPorId:designer.id}).returning();const [qwi2]=await db.insert(workItems).values({proyectoId:f.p.id,tipo:'calidad',businessKey:'ronda2',estado:'completado'}).returning();const [q2]=await db.insert(fichaCalidadFases).values({fichaId:ficha!.id,numeroFase:2,ronda:1,disenoVersionId:v2!.id,workItemId:qwi2!.id,aprobado:true,revisadoEn:new Date(),pdfUrl:v2!.enlace}).returning();await db.update(disenoVersiones).set({calidadFaseId:q2!.id}).where(eq(disenoVersiones.id,v2!.id));
   const r2=await f.approve('version_validada',v2!.id,'Calidad V2',r.id);const answer=await f.req('POST',`/api/autor/approvals/${r2.id}/decision`,f.ca,{decision:'approved'});expect(answer.statusCode,answer.body).toBe(200);
   const finals=await db.select().from(fichaCalidadFases).where(and(eq(fichaCalidadFases.disenoVersionId,v2!.id),eq(fichaCalidadFases.numeroFase,3)));expect(finals).toHaveLength(1);expect(finals[0]!.workItemId).toBeTruthy();
  }finally{await f.app.close();}});
 it('invita una única cuenta vinculada, activa una vez y recupera credenciales sin registro público',async()=>{const f=await fixture();try{
   const a=await crearAutor({nombre:'Autora invitada'});await db.insert(proyectosAutores).values({proyectoId:f.p.id,autorId:a.id});
   const invite=()=>f.req('POST',`/api/autor/internal/projects/${f.p.id}/invite`,f.cs,{authorId:a.id,email:'invitada@panhouse.test'});
   expect((await invite()).statusCode).toBe(200);expect((await invite()).statusCode).toBe(200);
   const accounts=await db.select().from(users).where(eq(users.autorId,a.id));expect(accounts).toHaveLength(1);expect(accounts[0]!.activo).toBe(false);
   const mails=await db.select().from(authorMailOutbox).where(eq(authorMailOutbox.userId,accounts[0]!.id));const token=mails[mails.length-1]!.path.split('#')[1]!;expect(token).toHaveLength(64);
   await consumeAuthorToken(token,'CredencialSegura2026!');await expect(consumeAuthorToken(token,'OtraCredencial2026!')).rejects.toThrow('inválido');
   expect((await db.select().from(users).where(eq(users.id,accounts[0]!.id)))[0]!.activo).toBe(true);
   const admin=await crearUsuario('admin');const active=(await db.select().from(users).where(eq(users.id,accounts[0]!.id)))[0]!;
   await updateAdminUser(admin,active.id,{expectedVersion:active.updatedAt.toISOString(),active:false,reason:'Desactivación de cuenta QA por Administración',requestKey:randomUUID()});
   expect((await db.select().from(users).where(eq(users.id,active.id)))[0]!.activo).toBe(false);
   expect((await invite()).statusCode).toBe(409);
   expect((await f.req('POST','/api/auth/register','',{email:'x@test.test',password:'algo'})).statusCode).toBe(404);
  }finally{await f.app.close();}});
});
