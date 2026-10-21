/** Explicit local development fixtures for the project-level portfolio. Never mutates earlier projects or calls Google. */
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {and,eq} from 'drizzle-orm';
import {db,pool} from '../server/db/client.js';
import {env} from '../server/config/env.js';
import {autores,direccionesCreativas,disenoVersiones,fichasTrazabilidad,presupuestos,proyectos,proyectosAutores,servicios,unidades,users,workItems} from '../server/db/schema/index.js';
import {solicitarDireccionCreativa,asignarLiderCreativo,registrarReunionCreativa,registrarBrief,registrarBriefAutor,aprobarConceptoRrpp,registrarConceptoAutor,registrarRecursosCreativos} from '../server/helpers/direccionCreativa.js';
import {deliverCreativeConcepts} from '../server/helpers/creativeLeaderCommands.js';
import {solicitarDiseno,entregarDiseno,revisarCubierta} from '../server/helpers/diseno.js';
import {diaCaracas} from '../server/helpers/atencionEspecialista.js';
const path='secrets/creative-portfolio-qa.local.json',out='docs/evidencias/lider-creativo/proyectos-creativos';
try{
 const url=new URL(env.DATABASE_URL);if(env.NODE_ENV!=='development'||!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/panhouse')throw Error('Local development only');
 await mkdir('secrets',{recursive:true});await mkdir(out,{recursive:true});
 const previous=await readFile(path,'utf8').then(JSON.parse,e=>{if(e.code!=='ENOENT')throw e;return null;});
 if(previous){if(!previous.complete)throw Error('Partial fixtures: inspect the recorded cases before resuming.');console.log(JSON.stringify({existing:true,cases:previous.cases.length}));}
 else{
  const identities:Record<string,string>={};for(const rol of ['lider_creativo','especialista','rrpp','jefe_area','disenador'] as const){const [u]=await db.select({id:users.id}).from(users).where(and(eq(users.rol,rol),eq(users.activo,true))).orderBy(users.createdAt).limit(1);if(!u)throw Error('Existing role required: '+rol);identities[rol]=u.id;}
  const leader=identities.lider_creativo!,specialist=identities.especialista!,rrpp=identities.rrpp!,manager=identities.jefe_area!,designer=identities.disenador!;
  const [service]=await db.select().from(servicios).where(eq(servicios.codigo,'SE')),[unit]=await db.select().from(unidades).limit(1),[budget]=await db.select().from(presupuestos).limit(1);if(!service||!unit||!budget)throw Error('Existing catalogs required');
  const today=diaCaracas(new Date()),day=(offset:number)=>{const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);};
  const cases=[];
  for(const [kind,label,offset] of [['brief','Brief en elaboración',0],['concepts','Conceptualización',2],['rrpp_feedback','Ajustes de RRPP',-1],['author_feedback','Feedback del autor',3],['resources','Recursos del concepto aprobado',1],['design_work','Cubierta en Diseño',4],['cover','Cubierta por verificar',2],['completed','Verificación creativa completada',-2],['waiting_rrpp','Conceptos esperando RRPP',-4],['waiting_author','Conceptos esperando autor',-4]] as const){
   const [author]=await db.insert(autores).values({nombre:'QA Portafolio · Autor '+kind,categoria:'Estándar'}).returning();
   const [p]=await db.insert(proyectos).values({codigo:'QAP-'+randomUUID().slice(0,6).toUpperCase(),autorId:author!.id,servicioId:service.id,unidadId:unit.id,presupuestoId:budget.id,especialistaId:specialist,jefeAreaId:manager,disenadorId:designer,estado:'en_proceso',fechaProgramadaInicio:today,tituloDefinitivo:'QA · Portafolio · '+label,subtituloDefinitivo:'Verificación de portafolio creativo',notificadoRrpp:true,notificadoJefatura:true}).returning();
   await db.insert(proyectosAutores).values({proyectoId:p!.id,autorId:author!.id});await db.insert(fichasTrazabilidad).values({proyectoId:p!.id,temaGeneral:'Escenario QA ficticio y explícito de aceptación.'});
   const request=await solicitarDireccionCreativa(p!.id,specialist);if(!request.ok||!request.id)throw Error('Request failed');const id=request.id;
   const assigned=await asignarLiderCreativo(id,leader,manager);if(!assigned.ok)throw Error(assigned.error);
   await registrarReunionCreativa(id,{fecha:today,realizada:true,enlaceGrabacion:'https://example.test/qa/portfolio/meeting'},leader);
   const [dc]=await db.select().from(direccionesCreativas).where(eq(direccionesCreativas.id,id));await db.update(workItems).set({fechaFinPautada:day(offset)}).where(eq(workItems.id,dc!.workItemId));
   let conceptIds:string[]=[],designData:Record<string,string>={};
   if(kind!=='brief'){
    await registrarBrief(id,{briefEnlace:'https://example.test/qa/portfolio/'+kind+'/brief',fechaBriefEnviadoEspecialista:today},leader);await registrarBriefAutor(id,{fechaBriefEnviadoAutor:today,fechaBriefAprobadoAutor:today},specialist);
    if(kind!=='concepts'){
     conceptIds=(await deliverCreativeConcepts(id,[1,2].map(i=>({descripcion:`QA ${label} · concepto ${i}`,enlace:`https://example.test/qa/portfolio/${kind}/concept-${i}.pdf`})),leader)).ids;
     if(kind==='rrpp_feedback')await aprobarConceptoRrpp(conceptIds[0]!,{aprobar:false,observaciones:'QA: revisar jerarquía de título e imagen.'},rrpp);
     else if(kind!=='waiting_rrpp'){
      for(const cid of conceptIds)await aprobarConceptoRrpp(cid,{aprobar:true},rrpp);
      for(const cid of conceptIds)await registrarConceptoAutor(cid,{fechaEnviadaAutor:today},specialist);
      if(kind==='author_feedback')await registrarConceptoAutor(conceptIds[0]!,{feedback:'QA: ajustar el enfoque visual conservando el tono del brief.'},specialist);
      if(['resources','design_work','cover','completed'].includes(kind))await registrarConceptoAutor(conceptIds[0]!,{fechaAprobadaAutor:today},specialist);
      if(['design_work','cover','completed'].includes(kind)){
       await registrarRecursosCreativos(id,{recursoImagenUrl:'https://example.test/qa/portfolio/approved-image',recursoConceptoPdfUrl:'https://example.test/qa/portfolio/approved-concept.pdf'},leader);
       const design=await solicitarDiseno(p!.id,{tipo:'cubierta_extendida',solicitudKey:randomUUID(),fuenteUrl:'https://example.test/qa/portfolio/cover-sources',preparacionConfirmada:true},{id:specialist,rol:'especialista'});designData={designId:design.id};
       if(kind!=='design_work'){
        const delivered=await entregarDiseno(design.id,{enlace:'https://example.test/qa/portfolio/extended-cover.pdf',entregaKey:randomUUID()},{id:designer,rol:'disenador'});const [version]=await db.select().from(disenoVersiones).where(eq(disenoVersiones.id,delivered.id));const [review]=await db.select().from(direccionesCreativas).where(eq(direccionesCreativas.id,version!.revisionCreativaId!));await db.update(workItems).set({fechaFinPautada:day(offset)}).where(eq(workItems.id,review!.workItemId));designData={...designData,reviewId:review!.id,versionId:version!.id};
        if(kind==='completed')await revisarCubierta(design.id,version!.id,{aprobar:true},{id:leader,rol:'lider_creativo'});
       }
      }
     }
    }
   }
   cases.push({kind,projectId:p!.id,processId:id,workItemId:dc!.workItemId,conceptIds,...designData});await writeFile(path,JSON.stringify({identities,cases,complete:false},null,2));
  }
  await writeFile(path,JSON.stringify({identities,cases,complete:true},null,2));await writeFile(out+'/qa-fixtures.json',JSON.stringify({at:new Date().toISOString(),synthetic:true,existingIdentities:true,priorProjectsModified:false,googleCalled:false,cases},null,2));console.log(JSON.stringify({created:true,cases:cases.length}));
 }
}finally{await pool.end();}
