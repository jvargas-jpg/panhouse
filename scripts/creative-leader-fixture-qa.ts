/** Explicit synthetic QA projects, existing identities only. Never touches existing projects or Google. */
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {eq} from 'drizzle-orm';
import {db,pool} from '../server/db/client.js';
import {env} from '../server/config/env.js';
import {autores,fichasTrazabilidad,proyectos,proyectosAutores,servicios,unidades,presupuestos,direccionesCreativas,workItems,disenoVersiones} from '../server/db/schema/index.js';
import {solicitarDireccionCreativa,asignarLiderCreativo,registrarReunionCreativa,registrarBrief,registrarBriefAutor,aprobarConceptoRrpp,registrarConceptoAutor,registrarRecursosCreativos} from '../server/helpers/direccionCreativa.js';
import {deliverCreativeConcepts} from '../server/helpers/creativeLeaderCommands.js';
import {solicitarDiseno,entregarDiseno} from '../server/helpers/diseno.js';
import {diaCaracas} from '../server/helpers/atencionEspecialista.js';
const path='secrets/creative-leader-qa.local.json';
try{
 const url=new URL(env.DATABASE_URL);if(env.NODE_ENV!=='development'||!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/panhouse')throw Error('Local QA development only');
 const privateData=JSON.parse(await readFile(path,'utf8'));if(privateData.cases){if(!privateData.fixtureComplete)throw Error('Partial QA fixture: inspect recorded cases before resuming.');console.log(JSON.stringify({existing:true,cases:privateData.cases.length}));}
 else{
  const identities=privateData.identities as {id:string;rol:string}[],leader=identities.find(i=>i.rol==='lider_creativo')!.id,specialist=identities.find(i=>i.rol==='especialista')!.id,rrpp=identities.find(i=>i.rol==='rrpp')!.id,manager=identities.find(i=>i.rol==='jefe_area')!.id,designer=identities.find(i=>i.rol==='disenador')!.id;
  const [s]=await db.select().from(servicios).where(eq(servicios.codigo,'SE')),[unit]=await db.select().from(unidades).limit(1),[budget]=await db.select().from(presupuestos).limit(1);
  if(!s||!unit||!budget)throw Error('Existing catalogs required');
  const today=diaCaracas(new Date()),day=(offset:number)=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
  const cases=[];
  for(const [kind,label,due] of [['brief','Brief por preparar',0],['concepts','Conceptualización',1],['rrpp_feedback','Ajuste solicitado por RRPP',-1],['author_feedback','Feedback creativo del autor',2],['resources','Recursos del concepto aprobado',1],['cover','Verificación de cubierta extendida',3],['waiting_rrpp','Esperando checkpoint RRPP',null],['waiting_author','Esperando respuesta del autor',null]] as const){
    const [author]=await db.insert(autores).values({nombre:'QA CREATIVA · Autor '+kind,categoria:'Estándar'}).returning();
    const [p]=await db.insert(proyectos).values({codigo:'QAC-'+randomUUID().slice(0,6).toUpperCase(),autorId:author!.id,servicioId:s.id,unidadId:unit.id,presupuestoId:budget.id,
      especialistaId:specialist,jefeAreaId:manager,disenadorId:designer,estado:'en_proceso',fechaProgramadaInicio:today,tituloDefinitivo:'QA · '+label,subtituloDefinitivo:'Validación de Dirección Creativa',notificadoRrpp:true,notificadoJefatura:true}).returning();
    await db.insert(proyectosAutores).values({proyectoId:p!.id,autorId:author!.id});await db.insert(fichasTrazabilidad).values({proyectoId:p!.id,temaGeneral:'Escenario ficticio de aceptación, no es un proyecto de autor real.'});
    const created=await solicitarDireccionCreativa(p!.id,specialist);if(!created.ok||!created.id)throw Error('Creative request failed');const id=created.id;
    const assigned=await asignarLiderCreativo(id,leader,manager);if(!assigned.ok)throw Error(assigned.error);
    await registrarReunionCreativa(id,{fecha:today,realizada:true,enlaceGrabacion:'https://example.test/qa/creative-meeting'},leader);
    const [dc]=await db.select().from(direccionesCreativas).where(eq(direccionesCreativas.id,id));
    if(due!==null)await db.update(workItems).set({fechaFinPautada:day(due)}).where(eq(workItems.id,dc!.workItemId));
    let conceptIds:string[]=[],coverData:Record<string,unknown>={};
    if(kind!=='brief'){
      await registrarBrief(id,{briefEnlace:'https://example.test/qa/'+kind+'/brief',fechaBriefEnviadoEspecialista:today},leader);
      await registrarBriefAutor(id,{fechaBriefEnviadoAutor:today,fechaBriefAprobadoAutor:today},specialist);
      if(kind!=='concepts'){
        const delivered=await deliverCreativeConcepts(id,[1,2].map(i=>({descripcion:`Concepto QA ${i} · ${label}`,enlace:`https://example.test/qa/${kind}/concept-${i}`})),leader);conceptIds=delivered.ids;
        if(kind==='rrpp_feedback')await aprobarConceptoRrpp(conceptIds[0]!,{aprobar:false,observaciones:'QA: mejorar el contraste y la jerarquía del título.'},rrpp);
        else if(kind!=='waiting_rrpp'){
          for(const cid of conceptIds)await aprobarConceptoRrpp(cid,{aprobar:true},rrpp);
          for(const cid of conceptIds)await registrarConceptoAutor(cid,{fechaEnviadaAutor:today},specialist);
          if(kind==='author_feedback')await registrarConceptoAutor(conceptIds[0]!,{feedback:'QA: ajustar la imagen y mantener la tipografía aprobada.'},specialist);
          if(kind==='resources'||kind==='cover')await registrarConceptoAutor(conceptIds[0]!,{fechaAprobadaAutor:today},specialist);
          if(kind==='cover'){
            await registrarRecursosCreativos(id,{recursoImagenUrl:'https://example.test/qa/approved-image',recursoConceptoPdfUrl:'https://example.test/qa/approved-concept.pdf'},leader);
            const design=await solicitarDiseno(p!.id,{tipo:'cubierta_extendida',solicitudKey:randomUUID(),fuenteUrl:'https://example.test/qa/cover-sources',preparacionConfirmada:true},{id:specialist,rol:'especialista'});
            const version=await entregarDiseno(design.id,{enlace:'https://example.test/qa/extended-cover.pdf',entregaKey:randomUUID()},{id:designer,rol:'disenador'});
            const [v]=await db.select().from(disenoVersiones).where(eq(disenoVersiones.id,version.id));const [review]=await db.select().from(direccionesCreativas).where(eq(direccionesCreativas.id,v!.revisionCreativaId!));
            await db.update(workItems).set({fechaFinPautada:day(3)}).where(eq(workItems.id,review!.workItemId));coverData={reviewId:review!.id,designId:design.id,versionId:v!.id};
          }
        }
      }
    }
    cases.push({kind,projectId:p!.id,projectCode:p!.codigo,processId:id,workItemId:dc!.workItemId,conceptIds,...coverData});
    await writeFile(path,JSON.stringify({...privateData,cases,fixtureComplete:false},null,2));
  }
  await writeFile(path,JSON.stringify({...privateData,cases,fixtureComplete:true},null,2));
  await writeFile('docs/evidencias/lider-creativo/qa-fixtures.json',JSON.stringify({createdAt:new Date().toISOString(),fictitious:true,existingUsersOnly:true,existingProjectsModified:false,googleCalled:false,cases},null,2));
  console.log(JSON.stringify({cases:cases.length,googleCalled:false,existingUsersOnly:true}));
 }
}finally{await pool.end();}
