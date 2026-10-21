/** Explicit synthetic acceptance scenarios; never rewrites existing users or projects. */
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {eq} from 'drizzle-orm';
import {db,pool} from '../server/db/client.js';
import {autores,fichasTrazabilidad,preparacionesProyecto,presupuestos,proyectos,proyectosAutores,servicios,unidades,users} from '../server/db/schema/index.js';
import {env} from '../server/config/env.js';
import {hashPassword} from '../server/helpers/password.js';
import {createCreativeMeetingRequest,decideCreativeRequest} from '../server/helpers/creativeRequests.js';
const path='secrets/creative-requests-qa.local.json',out='docs/evidencias/lider-creativo/solicitudes';
try{
 const url=new URL(env.DATABASE_URL);if(env.NODE_ENV!=='development'||!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/panhouse')throw Error('Local development /panhouse only');
 await mkdir('secrets',{recursive:true});await mkdir(out,{recursive:true});
 const previous=await readFile(path,'utf8').then(JSON.parse,e=>{if(e.code!=='ENOENT')throw e;return null;});
 if(previous?.complete){console.log(JSON.stringify({existing:true,cases:previous.cases.length}));}
 else{
  if(previous?.cases.length)throw Error('Partial cases: inspect recorded projects before resuming.');
  const identities: {id:string;rol:'especialista'|'lider_creativo';email:string;password:string}[]=previous?.identities??[];
  if(!previous)for(const [rol,label] of [['especialista','Especialista'],['lider_creativo','Líder Creativo']] as const){const password=randomBytes(24).toString('base64url'),email='qa-solicitudes-'+rol+'-'+randomUUID().slice(0,8)+'@panhouse.test';const [u]=await db.insert(users).values({rol,nombre:'QA Solicitudes · '+label,email,passwordHash:await hashPassword(password)}).returning();identities.push({id:u!.id,rol,email,password});}
  const leader=identities.find(i=>i.rol==='lider_creativo')!.id,specialist=identities.find(i=>i.rol==='especialista')!.id;
  const record={complete:false,identities,cases:[] as {kind:string;projectId:string;requestId:string|null;title:string}[]};await writeFile(path,JSON.stringify(record,null,2),{mode:0o600});
  const [unit]=await db.select().from(unidades).limit(1),[budget]=await db.select().from(presupuestos).limit(1);if(!unit||!budget)throw Error('Existing catalog required');
  for(const [index,kind] of ['accept_browser','reject_browser','meeting_1','meeting_2','meeting_3','meeting_4','meeting_5','meeting_6','meeting_7','accepted_history','rejected_history','missing_title'].entries()){
   const code=index%3===0?'SE':index%3===1?'CR':'EF',[service]=await db.select().from(servicios).where(eq(servicios.codigo,code));if(!service)throw Error('Missing catalog '+code);
   const [author]=await db.insert(autores).values({nombre:'QA Solicitudes · Autor '+(index+1),categoria:'Estándar'}).returning();
   const title='QA · Solicitudes · '+({accept_browser:'Activación desde Especialista',reject_browser:'Referencias por completar',accepted_history:'Intervención ya aceptada',rejected_history:'Entrada rechazada con motivo',missing_title:'Título pendiente de confirmar'}[kind]??'Reunión creativa '+kind.split('_')[1]);
   const [p]=await db.insert(proyectos).values({codigo:'QAS-'+randomUUID().slice(0,6).toUpperCase(),autorId:author!.id,servicioId:service.id,unidadId:unit.id,presupuestoId:budget.id,especialistaId:specialist,estado:'en_proceso',fechaProgramadaInicio:'2026-10-21',tituloDefinitivo:title,subtituloDefinitivo:'Caso sintético de aceptación de handoff',fechaFeedbackTripa:'2026-10-20',notificadoRrpp:true,notificadoJefatura:true}).returning();
   await db.insert(proyectosAutores).values({proyectoId:p!.id,autorId:author!.id});await db.insert(fichasTrazabilidad).values({proyectoId:p!.id,temaGeneral:'QA explícito: separación entre solicitud y ejecución creativa.'});
   if(index%2===0)await db.insert(preparacionesProyecto).values({proyectoId:p!.id,transcripcionUrl:'https://example.test/qa/solicitudes/'+kind+'/transcripcion.pdf',minutaUrl:'https://example.test/qa/solicitudes/'+kind+'/minuta.pdf'});
   const requestId=kind==='accept_browser'?null:await createCreativeMeetingRequest(p!.id,specialist);
   if(kind==='accepted_history')await decideCreativeRequest(requestId!,leader,'accept');
   if(kind==='rejected_history')await decideCreativeRequest(requestId!,leader,'reject','QA: el encargo no aporta referencias suficientes para iniciar la reunión.');
   if(kind==='missing_title')await db.update(proyectos).set({subtituloDefinitivo:null}).where(eq(proyectos.id,p!.id));
   record.cases.push({kind,projectId:p!.id,requestId,title});await writeFile(path,JSON.stringify(record,null,2),{mode:0o600});
  }
  record.complete=true;await writeFile(path,JSON.stringify(record,null,2),{mode:0o600});await writeFile(out+'/qa-fixtures.json',JSON.stringify({at:new Date().toISOString(),synthetic:true,previousUsersChanged:false,previousProjectsChanged:false,newQaRoles:['especialista','lider_creativo'],googleCalls:false,cases:record.cases},null,2));console.log(JSON.stringify({createdProjects:record.cases.length,qaAccounts:2,credentialsStoredOutsideGit:true}));
 }
}finally{await pool.end();}
