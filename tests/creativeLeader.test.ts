import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {eq} from 'drizzle-orm';
import {buildApp} from '../server/app.js';
import {db,pool} from '../server/db/client.js';
import {auditLogs,creativeDeliveries,direccionesCreativas,disenos,disenoVersiones,fichaDisenoPropuestas,fichasTrazabilidad,projectAssignments,proyectos,servicios,users,workItems} from '../server/db/schema/index.js';
import {createSession} from '../server/helpers/session.js';
import {getCreativeActivity,getCreativeDashboard} from '../server/helpers/creativeLeader.js';
import {crearProyectoDePrueba} from './helpers/fixtures.js';
import {limpiarBaseDeDatos} from './helpers/db.js';

const app=buildApp(),now=new Date('2026-10-19T16:00:00Z');
let leader:string,other:string,specialist:string,rrpp:string,manager:string,designer:string;
const cookies=new Map<string,string>();
const api=(method:'GET'|'POST'|'PATCH'|'DELETE',url:string,user=leader,payload:unknown={})=>app.inject({method,url:'/api'+url,headers:{cookie:cookies.get(user)??''},...(method!=='GET'&&method!=='DELETE'?{payload:payload as Record<string,unknown>}:{})});
async function person(rol:typeof users.$inferInsert.rol){const [u]=await db.insert(users).values({nombre:rol+' QA',email:randomUUID()+'@test.local',rol,passwordHash:'session-only'}).returning();cookies.set(u!.id,'panhouse_sid='+await createSession(u!.id));return u!.id;}
type Process=typeof direccionesCreativas.$inferSelect;
async function fixture(input:Partial<Process>={},assigned:string|null=leader){
  const p=await crearProyectoDePrueba({especialistaId:specialist,jefeAreaId:manager});
  let [s]=await db.select().from(servicios).where(eq(servicios.codigo,'SE'));if(!s)[s]=await db.insert(servicios).values({codigo:'SE',nombre:'Sello editorial',pesoComplejidad:1,plazoDias:90}).returning();
  await db.update(proyectos).set({servicioId:s!.id,tituloDefinitivo:'Libro QA '+p.codigo,subtituloDefinitivo:'Contexto editorial'}).where(eq(proyectos.id,p.id));
  const [f]=await db.insert(fichasTrazabilidad).values({proyectoId:p.id}).returning();
  const [wi]=await db.insert(workItems).values({proyectoId:p.id,tipo:'direccion_creativa',businessKey:'concepto_portada',estado:assigned?'en_progreso':'pendiente'}).returning();
  const [dc]=await db.insert(direccionesCreativas).values({proyectoId:p.id,workItemId:wi!.id,...input}).returning();
  if(assigned)await db.insert(projectAssignments).values({proyectoId:p.id,workItemId:wi!.id,tipo:'lider_creativo',usuarioId:assigned});
  return {p,f:f!,wi:wi!,dc:dc!};
}
const approvedBrief={briefEnlace:'https://docs.google.com/document/d/qa-brief/edit',fechaBriefEnviadoEspecialista:'2026-10-18',fechaBriefAprobadoAutor:'2026-10-19'};
async function concepts(f:Awaited<ReturnType<typeof fixture>>,overrides:Partial<typeof fichaDisenoPropuestas.$inferInsert>={}){
  return db.insert(fichaDisenoPropuestas).values([1,2].map(i=>({fichaId:f.f.id,direccionCreativaId:f.dc.id,descripcion:'Concepto '+i,enlace:'https://example.test/concepto-'+i,estado:'Pendiente RRPP',...overrides}))).returning();
}
beforeAll(()=>app.ready());afterAll(()=>app.close());
beforeEach(async()=>{await limpiarBaseDeDatos();cookies.clear();leader=await person('lider_creativo');other=await person('lider_creativo');specialist=await person('especialista');rrpp=await person('rrpp');manager=await person('jefe_area');designer=await person('disenador');});

describe('Líder Creativo · Inicio y scope canónico',()=>{
  it('requiere sesión y rol; no acepta identidad del cliente ni genera audit al visualizar',async()=>{
    await fixture();const original=(await db.select().from(auditLogs)).length;
    for(const path of ['/direccion-creativa/inicio','/direccion-creativa/inicio/actividad']){
      expect((await api('GET',path,'absent')).statusCode).toBe(401);
      for(const user of [specialist,rrpp,manager,designer])expect((await api('GET',path,user)).statusCode).toBe(403);
    }
    expect((await api('GET','/direccion-creativa/inicio?userId='+other)).json().kpis.briefs).toBe(1);
    expect((await db.select().from(auditLogs)).length).toBe(original);
  });
  it('brief pendiente es acción; brief entregado y esperando autor no son trabajo activo',async()=>{
    const pending=await fixture();await fixture({briefEnlace:approvedBrief.briefEnlace,fechaBriefEnviadoEspecialista:'2026-10-18'});
    await fixture({briefEnlace:approvedBrief.briefEnlace,fechaBriefEnviadoEspecialista:'2026-10-18',fechaBriefEnviadoAutor:'2026-10-19'});
    const d=await getCreativeDashboard(leader,now);expect(d.kpis.briefs).toBe(1);expect(d.tasks.map(t=>t.creativeProcessId)).toEqual([pending.dc.id]);
    expect(d.processes.map(p=>p.state)).toContain('Esperando autor');expect(d.processes.map(p=>p.state)).toContain('Esperando Especialista');
  });
  it('conceptualización y feedback son accionables; waiting RRPP/autor salen de atención',async()=>{
    const creation=await fixture(approvedBrief),waitingRrpp=await fixture(approvedBrief),waitingAuthor=await fixture(approvedBrief),returned=await fixture(approvedBrief),authorFeedback=await fixture(approvedBrief);
    await concepts(waitingRrpp);await concepts(waitingAuthor,{fechaAprobadaRrpp:'2026-10-18',fechaEnviadaAutor:'2026-10-19'});
    const [r]=await concepts(returned);await db.update(fichaDisenoPropuestas).set({estado:'Devuelta por RRPP',feedbackRrpp:'Ajustar tipografía'}).where(eq(fichaDisenoPropuestas.id,r!.id));
    const [a]=await concepts(authorFeedback,{fechaAprobadaRrpp:'2026-10-18',fechaEnviadaAutor:'2026-10-19'});await db.update(fichaDisenoPropuestas).set({estado:'Feedback del autor',feedbackAutor:'Revisar imagen'}).where(eq(fichaDisenoPropuestas.id,a!.id));
    const d=await getCreativeDashboard(leader,now);expect(d.kpis.concepts).toBe(3);
    expect(d.tasks.map(t=>t.creativeProcessId).sort()).toEqual([creation.dc.id,returned.dc.id,authorFeedback.dc.id].sort());
    expect(d.tasks.find(t=>t.creativeProcessId===returned.dc.id)?.context).toBe('Ajustar tipografía');
    expect(d.processes.find(p=>p.id===waitingRrpp.dc.id)?.state).toBe('Esperando RRPP');expect(d.processes.find(p=>p.id===waitingAuthor.dc.id)?.state).toBe('Esperando autor');
  });
  it('recursos aprobados tienen acción específica; entregar ambos completa el work item y metadata',async()=>{
    const f=await fixture(approvedBrief),[c]=await concepts(f,{fechaAprobadaRrpp:'2026-10-18'});
    await db.update(fichaDisenoPropuestas).set({fechaAprobadaAutor:'2026-10-19'}).where(eq(fichaDisenoPropuestas.id,c!.id));
    expect((await getCreativeDashboard(leader,now)).tasks[0]).toMatchObject({type:'RESOURCES',cta:'Entregar recursos',conceptId:c!.id});
    const body={recursoImagenUrl:'https://drive.google.com/file/d/image-qa/view',recursoConceptoPdfUrl:'https://drive.google.com/file/d/pdf-qa/view'};
    expect((await api('PATCH','/direccion-creativa/'+f.dc.id+'/recursos',leader,body)).statusCode).toBe(200);
    expect((await getCreativeDashboard(leader,now)).totalActions).toBe(0);
    expect((await db.select().from(workItems).where(eq(workItems.id,f.wi.id)))[0]?.estado).toBe('completado');
    const deliveries=await db.select().from(creativeDeliveries);expect(deliveries).toHaveLength(2);expect(deliveries.every(d=>d.projectId===f.p.id&&d.creativeProcessId===f.dc.id&&d.conceptId===c!.id&&d.submittedBy===leader&&d.submittedAt)).toBe(true);
    expect(deliveries.map(d=>d.driveFileId).sort()).toEqual(['image-qa','pdf-qa']);
    expect((await api('PATCH','/direccion-creativa/'+f.dc.id+'/recursos',leader,body)).statusCode).toBe(200);expect(await db.select().from(creativeDeliveries)).toHaveLength(2);
  });
  it('usa fecha pautada real, orden central y no inventa SLA',async()=>{
    const noDate=await fixture(),late=await fixture(),today=await fixture(),later=await fixture({briefFeedback:'Ajustar el enfoque'});
    for(const [f,date] of [[late,'2026-10-18'],[today,'2026-10-19'],[later,'2026-10-21']] as const)await db.update(workItems).set({fechaFinPautada:date}).where(eq(workItems.id,f.wi.id));
    const d=await getCreativeDashboard(leader,now);expect(d.tasks.map(t=>t.creativeProcessId)).toEqual([late.dc.id,today.dc.id,later.dc.id,noDate.dc.id]);
    expect(d.tasks[0]?.overdue).toBe(true);expect(d.tasks[1]?.dueToday).toBe(true);expect(d.tasks.at(-1)?.dueAt).toBeNull();expect(d.kpis.nextDueAt).toBe('2026-10-19');
  });
  it('solicitudes no duplican work item; recibir resuelve inbox y genera brief accionable',async()=>{
    const f=await fixture({},null);expect((await getCreativeDashboard(leader)).requests.map(r=>r.id)).toEqual([f.dc.id]);
    expect((await getCreativeDashboard(leader)).tasks).toHaveLength(0);
    expect((await api('PATCH','/direccion-creativa/'+f.dc.id+'/asignar',leader,{liderCreativoId:leader})).statusCode).toBe(200);
    const d=await getCreativeDashboard(leader);expect(d.requests).toHaveLength(0);expect(d.tasks).toHaveLength(1);expect(d.tasks[0]?.workItemId).toBe(f.wi.id);
    expect((await api('PATCH','/direccion-creativa/'+f.dc.id+'/asignar',other,{liderCreativoId:other})).statusCode).toBe(403);
  });
  it('scope por proceso/concepto, proyecto y work item; anterior pierde acceso tras reasignar',async()=>{
    const own=await fixture(approvedBrief),foreign=await fixture(approvedBrief,other),[c]=await concepts(foreign);
    for(const path of ['/proyectos/'+own.p.id+'/riesgo','/fichas-trazabilidad/'+own.p.id+'/resumen'])expect((await api('GET',path)).statusCode).toBe(200);
    expect((await api('GET','/fichas-trazabilidad/pendientes/diseno')).statusCode).toBe(403);
    for(const path of ['/diseno/brief','/diseno/propuestas'])expect((await api(path.endsWith('brief')?'PATCH':'POST','/fichas-trazabilidad/'+own.p.id+path,leader,{})).statusCode).toBe(403);
    expect((await api('GET','/direccion-creativa/'+foreign.dc.id+'/operacion')).statusCode).toBe(403);
    expect((await api('PATCH','/direccion-creativa/'+own.dc.id+'/conceptos/'+c!.id,leader,{descripcion:'Ajeno',enlace:'https://example.test/ajeno'})).statusCode).toBe(404);
    for(const path of ['/proyectos/'+foreign.p.id+'/riesgo','/fichas-trazabilidad/'+foreign.p.id+'/resumen'])expect((await api('GET',path)).statusCode).toBe(403);
    expect((await api('GET','/direccion-creativa/no-uuid/operacion')).statusCode).toBe(400);
    expect((await api('PATCH','/direccion-creativa/'+own.dc.id+'/asignar',manager,{liderCreativoId:other})).statusCode).toBe(200);
    expect((await api('GET','/direccion-creativa/'+own.dc.id+'/operacion')).statusCode).toBe(403);
    expect((await api('GET','/direccion-creativa/'+own.dc.id+'/operacion',other)).statusCode).toBe(200);
  });
  it('activity filtra eventos y alcance exacto, no pagos ni otra intervención del mismo proyecto',async()=>{
    const f=await fixture(),foreign=await fixture({},other);
    await db.insert(auditLogs).values([
      {accion:'BRIEF_CREATIVO_GENERADO',entityType:'work_item',entityId:f.wi.id,proyectoId:f.p.id,actorId:leader},
      {accion:'CONCEPTO_DEVUELTO_RRPP',entityType:'work_item',entityId:foreign.wi.id,proyectoId:foreign.p.id,actorId:rrpp},
      {accion:'SEGUIMIENTO_PAGO_REGISTRADO',entityType:'proyecto',entityId:f.p.id,proyectoId:f.p.id,actorId:manager},
    ]);
    const items=await getCreativeActivity(leader);expect(items).toHaveLength(1);expect(items[0]?.label).toContain('brief');expect(items[0]?.creativeProcessId).toBe(f.dc.id);
  });
  it('lectura en lotes: misma cantidad de SQL con 1 o 16 trabajos; Inicio limita atención a seis',async()=>{
    await fixture();let count=0;const first=vi.spyOn(pool,'query');try{await getCreativeDashboard(leader,now);count=first.mock.calls.length;}finally{first.mockRestore();}
    for(let i=0;i<15;i++)await fixture();const second=vi.spyOn(pool,'query');try{const d=await getCreativeDashboard(leader,now);expect(second.mock.calls.length).toBe(count);expect(count).toBe(2);expect(d.totalActions).toBe(16);expect(d.attention).toHaveLength(6);}finally{second.mockRestore();}
  });
  it('empty real devuelve ceros, sin fechas ni datos demostrativos',async()=>{
    const d=await getCreativeDashboard(leader,now);expect(d.kpis).toEqual({briefs:0,concepts:0,covers:0,nextDueAt:null});expect(d.attention).toEqual([]);expect(d.deadlines).toEqual([]);expect(await getCreativeActivity(leader)).toEqual([]);
  });
});

describe('Workflow creativo real · brief, conceptos y feedback',()=>{
  it('una propuesta legacy sin decisión se completa a dos; una ya aprobada conserva su espera histórica',async()=>{
    const f=await fixture(approvedBrief);
    const [legacy]=await db.insert(fichaDisenoPropuestas).values({fichaId:f.f.id,direccionCreativaId:f.dc.id,descripcion:'Idea anterior',enlace:'https://example.test/legacy'}).returning();
    expect((await getCreativeDashboard(leader)).tasks[0]?.type).toBe('CONCEPTS');
    const delivered=await api('POST','/direccion-creativa/'+f.dc.id+'/conceptos/entregar',leader,{conceptos:[{descripcion:'Idea anterior',enlace:'https://example.test/legacy'},{descripcion:'Segunda idea',enlace:'https://example.test/second'}]});
    expect(delivered.statusCode).toBe(200);expect(delivered.json().ids).toContain(legacy!.id);
    const history=await fixture(approvedBrief);
    await db.insert(fichaDisenoPropuestas).values({fichaId:history.f.id,direccionCreativaId:history.dc.id,descripcion:'Concepto histórico aprobado',enlace:'https://example.test/approved',fechaAprobadaRrpp:'2026-10-18'});
    const d=await getCreativeDashboard(leader);expect(d.tasks).toHaveLength(0);expect(d.processes.find(p=>p.id===history.dc.id)?.state).toBe('Esperando Especialista');
  });
  it('brief deja atención y continúa en Especialista; feedback vuelve al Líder',async()=>{
    const f=await fixture();expect((await api('PATCH','/direccion-creativa/'+f.dc.id+'/brief',leader,{briefEnlace:approvedBrief.briefEnlace,fechaBriefEnviadoEspecialista:'2026-10-19'})).statusCode).toBe(200);
    expect((await getCreativeDashboard(leader)).tasks).toHaveLength(0);
    expect((await api('PATCH','/direccion-creativa/'+f.dc.id+'/brief-autor',specialist,{fechaBriefEnviadoAutor:'2026-10-19',feedback:'Cambiar el tono'})).statusCode).toBe(200);
    expect((await getCreativeDashboard(leader)).tasks[0]).toMatchObject({type:'BRIEF_ADJUSTMENT',context:'Cambiar el tono'});
    expect((await api('PATCH','/direccion-creativa/'+f.dc.id+'/brief',leader,{briefEnlace:'https://docs.google.com/document/d/brief-v2/edit',fechaBriefEnviadoEspecialista:'2026-10-19'})).statusCode).toBe(200);
    expect((await getCreativeDashboard(leader)).totalActions).toBe(0);expect((await db.select().from(creativeDeliveries))[0]?.type).toBe('BRIEF');
  });
  it('entrega 2–3 conceptos, espera RRPP, vuelve por feedback, luego espera autor y entrega ajuste',async()=>{
    const f=await fixture(approvedBrief),body={conceptos:[1,2].map(i=>({descripcion:'Idea '+i,enlace:'https://example.test/concepto'+i}))};
    expect((await api('POST','/direccion-creativa/'+f.dc.id+'/conceptos/entregar',leader,{conceptos:body.conceptos.slice(0,1)})).statusCode).toBe(400);
    const delivered=await api('POST','/direccion-creativa/'+f.dc.id+'/conceptos/entregar',leader,body);expect(delivered.statusCode).toBe(200);const ids=delivered.json().ids as string[];
    expect((await api('POST','/direccion-creativa/'+f.dc.id+'/conceptos/entregar',leader,body)).json().ids).toEqual(ids);
    expect((await getCreativeDashboard(leader)).tasks).toHaveLength(0);expect((await api('GET','/direccion-creativa/pendientes-rrpp',rrpp)).json().propuestas).toHaveLength(2);
    expect((await api('PATCH','/direccion-creativa/propuestas/'+ids[0]+'/autor',specialist,{fechaAprobadaAutor:'2026-10-19'})).statusCode).toBe(400);
    await api('PATCH','/direccion-creativa/propuestas/'+ids[0]+'/rrpp',rrpp,{aprobar:false,observaciones:'Revisar tipografía'});
    expect((await getCreativeDashboard(leader)).tasks[0]).toMatchObject({type:'CONCEPT_ADJUSTMENT',context:'Revisar tipografía'});
    expect((await db.select().from(fichaDisenoPropuestas).where(eq(fichaDisenoPropuestas.id,ids[0]!)))[0]?.descripcion).toBe('Idea 1');
    await api('PATCH','/direccion-creativa/'+f.dc.id+'/conceptos/'+ids[0],leader,{descripcion:'Idea ajustada',enlace:'https://example.test/ajuste'});
    expect((await getCreativeDashboard(leader)).totalActions).toBe(0);
    for(const id of ids)await api('PATCH','/direccion-creativa/propuestas/'+id+'/rrpp',rrpp,{aprobar:true});
    for(const id of ids)await api('PATCH','/direccion-creativa/propuestas/'+id+'/autor',specialist,{fechaEnviadaAutor:'2026-10-19'});
    expect((await getCreativeDashboard(leader)).totalActions).toBe(0);
    await api('PATCH','/direccion-creativa/propuestas/'+ids[0]+'/autor',specialist,{feedback:'Usar otra imagen'});
    expect((await getCreativeDashboard(leader)).tasks[0]).toMatchObject({cta:'Ajustar concepto',context:'Usar otra imagen'});
    await api('PATCH','/direccion-creativa/'+f.dc.id+'/conceptos/'+ids[0],leader,{descripcion:'Imagen ajustada',enlace:'https://example.test/autor-ajuste'});
    const [adjusted]=await db.select().from(fichaDisenoPropuestas).where(eq(fichaDisenoPropuestas.id,ids[0]!));expect(adjusted?.fechaAprobadaRrpp).toBeTruthy();expect(adjusted?.fechaEnviadaAutor).toBeNull();expect((await getCreativeDashboard(leader)).totalActions).toBe(0);
  });
  it('enforce ownership y campos de dominio; Líder no aprueba RRPP, no gestiona autor ni ejecuta Diseño',async()=>{
    const f=await fixture(approvedBrief),[c]=await concepts(f);
    await db.update(proyectos).set({disenadorId:designer}).where(eq(proyectos.id,f.p.id));
    for(const method of ['PATCH','DELETE'] as const)expect((await api(method,'/fichas-trazabilidad/'+f.p.id+'/diseno/propuestas/'+c!.id,designer,{estado:'Aprobada',fechaAprobadaRrpp:'2026-10-19'})).statusCode).toBe(404);
    for(const [url,payload] of [['/direccion-creativa/propuestas/'+c!.id+'/rrpp',{aprobar:true}],['/direccion-creativa/propuestas/'+c!.id+'/autor',{fechaAprobadaAutor:'2026-10-19'}],['/diseno/proyecto/'+f.p.id,{tipo:'cubierta_extendida'}]] as const){expect((await api(url.includes('/diseno/')?'POST':'PATCH',url,leader,payload)).statusCode).toBe(403);}
    expect((await api('POST','/direccion-creativa/'+f.dc.id+'/conceptos/entregar',other,{conceptos:[1,2].map(i=>({descripcion:'Idea '+i,enlace:'https://example.test/idea'+i}))})).statusCode).toBe(403);
    expect((await api('POST','/direccion-creativa/'+f.dc.id+'/conceptos/entregar',leader,{projectId:randomUUID(),conceptos:[]})).statusCode).toBe(400);
  });
});

describe('Cubierta extendida · verificación creativa separada',()=>{
  async function cover(){
    const source=await fixture({...approvedBrief,recursoImagenUrl:'https://example.test/image',recursoConceptoPdfUrl:'https://example.test/pdf',resultadoFinal:'aprobado',fechaCierre:'2026-10-18'});
    await db.update(proyectos).set({disenadorId:designer}).where(eq(proyectos.id,source.p.id));
    const [designWork]=await db.insert(workItems).values({proyectoId:source.p.id,tipo:'diseno',businessKey:'cubierta',estado:'bloqueado'}).returning();
    const [d]=await db.insert(disenos).values({proyectoId:source.p.id,workItemId:designWork!.id,direccionCreativaId:source.dc.id,tipo:'cubierta_extendida',solicitudKey:randomUUID(),fuenteUrl:'https://example.test/fuente'}).returning();
    const [reviewWork]=await db.insert(workItems).values({proyectoId:source.p.id,tipo:'direccion_creativa',businessKey:'revision_cubierta:qa'}).returning();
    const [review]=await db.insert(direccionesCreativas).values({proyectoId:source.p.id,workItemId:reviewWork!.id,tipo:'revision_cubierta'}).returning();
    await db.insert(projectAssignments).values({proyectoId:source.p.id,workItemId:reviewWork!.id,tipo:'lider_creativo',usuarioId:leader});
    const [internal]=await db.insert(workItems).values({proyectoId:source.p.id,tipo:'revision_interna_cubierta',businessKey:'qa'}).returning();
    const [v]=await db.insert(disenoVersiones).values({disenoId:d!.id,numero:1,entregaKey:randomUUID(),enlace:'https://example.test/cubierta',entregadoPorId:designer,revisionCreativaId:review!.id,revisionInternaWorkItemId:internal!.id}).returning();
    return {source,d:d!,review:review!,reviewWork:reviewWork!,internal:internal!,v:v!};
  }
  it('entrega de Diseño genera acción por revisión asignada; aprobar no completa revisión interna',async()=>{
    const f=await cover();const tasks=(await getCreativeDashboard(leader)).tasks;expect(tasks).toHaveLength(1);expect(tasks[0]?.type).toBe('COVER_REVIEW');
    expect((await api('GET','/direccion-creativa/'+f.review.id+'/operacion')).json().cover).toMatchObject({designId:f.d.id,versionId:f.v.id});
    expect((await api('PATCH',`/diseno/${f.d.id}/versiones/${f.v.id}/revision-creativa`,other,{aprobar:true})).statusCode).toBe(403);
    expect((await api('PATCH',`/diseno/${f.d.id}/versiones/${f.v.id}/revision-creativa`,leader,{aprobar:true})).statusCode).toBe(200);
    expect((await getCreativeDashboard(leader)).totalActions).toBe(0);expect((await db.select().from(workItems).where(eq(workItems.id,f.internal.id)))[0]?.estado).toBe('pendiente');
  });
  it('devolver cubierta dirige acción a Diseño y retira la revisión anterior',async()=>{
    const f=await cover();expect((await api('PATCH',`/diseno/${f.d.id}/versiones/${f.v.id}/revision-creativa`,leader,{aprobar:false,feedback:'Ajustar el lomo'})).statusCode).toBe(200);
    expect((await getCreativeDashboard(leader)).totalActions).toBe(0);expect((await db.select().from(workItems).where(eq(workItems.id,f.d.workItemId)))[0]?.estado).toBe('en_progreso');
    expect((await db.select().from(workItems).where(eq(workItems.id,f.internal.id)))[0]?.estado).toBe('cancelado');
  });
});

describe('Mi trabajo · consulta SQL, facetas e historial',()=>{
 const list=(query='',user=leader)=>api('GET','/direccion-creativa/mi-trabajo'+query,user);
 it('exige sesión y rol, rechaza filtros inválidos e identidad enviada por cliente',async()=>{
  expect((await list('','absent')).statusCode).toBe(401);
  for(const user of [specialist,rrpp,manager,designer])expect((await list('',user)).statusCode).toBe(403);
  for(const query of ['?tipo=diseno','?estado=inventado','?pagina=0','?pageSize=10000','?servicio=ajeno','?userId='+other])expect((await list(query)).statusCode).toBe(400);
 });
 it('lista solo asignación vigente, separa Solicitudes y retira acceso tras reasignar',async()=>{
  const own=await fixture(),foreign=await fixture({},other);await fixture({},null);
  let data=(await list()).json();expect(data.items.map((i:any)=>i.workItemId)).toEqual([own.wi.id]);expect(data.counts.requests).toBe(1);
  expect(data.items.some((i:any)=>i.creativeProcessId===foreign.dc.id)).toBe(false);
  await api('PATCH','/direccion-creativa/'+own.dc.id+'/asignar',manager,{liderCreativoId:other});
  expect((await list()).json().total).toBe(0);expect((await api('GET','/direccion-creativa/'+own.dc.id+'/operacion')).statusCode).toBe(403);
 });
 it('distingue los seis tipos existentes y no genera URL ni prioridad ficticia',async()=>{
  await fixture();await fixture({briefFeedback:'Revisar el enfoque'});await fixture(approvedBrief);
  const changed=await fixture(approvedBrief);await concepts(changed,{estado:'Devuelta por RRPP',feedbackRrpp:'Revisar contraste'});
  const resource=await fixture(approvedBrief);await concepts(resource,{fechaAprobadaAutor:'2026-10-19',fechaAprobadaRrpp:'2026-10-18'});
  const data=(await list()).json();expect(data.items).toHaveLength(5);
  expect(data.counts.types).toEqual({BRIEF:2,CONCEPT:2,RESOURCES:1,COVER_REVIEW:0});
  expect(data.items.every((i:any)=>!('href' in i)&&!('priority' in i))).toBe(true);
  expect(new Set(data.items.map((i:any)=>i.workItemId)).size).toBe(5); // two returned concepts are one work item
 });
 it('waiting RRPP/autor/Especialista no tienen acción ni vencimiento imputado al Líder',async()=>{
  const waitingRrpp=await fixture(approvedBrief),waitingAuthor=await fixture({...approvedBrief,fechaBriefAprobadoAutor:null,fechaBriefEnviadoAutor:'2026-10-19'}),waitingSpecialist=await fixture({...approvedBrief,fechaBriefAprobadoAutor:null});
  await concepts(waitingRrpp);
  for(const f of [waitingRrpp,waitingAuthor,waitingSpecialist])await db.update(workItems).set({fechaFinPautada:'2020-01-01'}).where(eq(workItems.id,f.wi.id));
  const data=(await list()).json();expect(data.total).toBe(3);expect(data.counts.overdue).toBe(0);expect(data.counts.actionable).toBe(0);
  expect(data.items.every((i:any)=>!i.actionable&&!i.overdue&&i.cta==='Ver proceso')).toBe(true);
  expect(data.items.map((i:any)=>i.waitingOn).sort()).toEqual(['AUTHOR','RRPP','SPECIALIST']);
  expect((await list('?estado=En%20curso')).json().total).toBe(0);
  expect((await list('?estado=Esperando%20RRPP')).json().items[0].creativeProcessId).toBe(waitingRrpp.dc.id);
  expect((await list('?fecha=vencidos')).json().total).toBe(0);
 });
 it('filtros combinados de tipo, estado y servicio operan en servidor y cuentan por faceta',async()=>{
  const brief=await fixture(),concept=await fixture(approvedBrief);await fixture({briefFeedback:'Feedback autor'});
  const [service]=await db.insert(servicios).values({codigo:'QA-'+randomUUID().slice(0,6),nombre:'Servicio QA de catálogo',pesoComplejidad:1,plazoDias:30}).returning();
  await db.update(proyectos).set({servicioId:service!.id}).where(eq(proyectos.id,concept.p.id));
  const data=(await list('?tipo=CONCEPT&estado=En%20curso&servicio='+service!.id)).json();expect(data.total).toBe(1);expect(data.items[0].workItemId).toBe(concept.wi.id);
  expect((await list('?tipo=BRIEF&estado=Requiere%20ajustes')).json().total).toBe(1);
  expect((await list('?servicio='+service!.id+'&tipo=BRIEF')).json().total).toBe(0);
  expect((await list('?tipo=BRIEF')).json().counts.types.CONCEPT).toBe(1);
  expect((await list('?tipo=BRIEF')).json().items.some((i:any)=>i.workItemId===brief.wi.id)).toBe(true);
 });
 it('busca por título, autor y tarea; porcentajes y SQL se tratan como texto',async()=>{
  const f=await fixture();
  for(const search of [f.p.codigo,'Elaborar brief'])expect((await list('?search='+encodeURIComponent(search))).json().total).toBe(1);
  const item=(await list()).json().items[0];expect((await list('?search='+encodeURIComponent(item.project.authors))).json().total).toBe(1);
  for(const search of ['%','_',"' OR 1=1 --"])expect((await list('?search='+encodeURIComponent(search))).json().total).toBe(0);
 });
 it('fecha y orden usan Caracas, no penalizan espera y conservan desempate estable',async()=>{
  const late=await fixture(),today=await fixture(),later=await fixture(),noDate=await fixture(),adjust=await fixture({briefFeedback:'Requiere ajuste'});
  for(const [f,date] of [[late,'2026-10-18'],[today,'2026-10-19'],[later,'2026-10-21'],[adjust,'2026-10-22']] as const)await db.update(workItems).set({fechaFinPautada:date}).where(eq(workItems.id,f.wi.id));
  const {listCreativeWork}=await import('../server/helpers/creativeInbox.js');
  expect((await listCreativeWork(leader,{},now)).items.map(i=>i.workItemId)).toEqual([late.wi.id,today.wi.id,adjust.wi.id,later.wi.id,noDate.wi.id]);
  for(const [fecha,total] of [['hoy',1],['semana',3],['proximos',2],['vencidos',1],['sin-fecha',1]] as const)expect((await listCreativeWork(leader,{fecha},now)).total).toBe(total);
  expect((await listCreativeWork(leader,{orden:'fecha'},now)).items.map(i=>i.workItemId)).toEqual([late.wi.id,today.wi.id,later.wi.id,adjust.wi.id,noDate.wi.id]);
  expect((await listCreativeWork(leader,{fecha:'hoy'},new Date('2026-10-20T02:00:00Z'))).items[0]?.workItemId).toBe(today.wi.id);
 });
 it('completadas solo con filtro explícito y permite consultar su contexto al culminar proyecto',async()=>{
  const complete=await fixture({fechaCierre:'2026-10-19',...approvedBrief,recursoImagenUrl:'https://example.test/image',recursoConceptoPdfUrl:'https://example.test/pdf'});
  await concepts(complete,{fechaAprobadaAutor:'2026-10-19'});await db.update(workItems).set({estado:'completado'}).where(eq(workItems.id,complete.wi.id));
  await db.update(proyectos).set({estado:'culminado'}).where(eq(proyectos.id,complete.p.id));await fixture();
  expect((await list()).json().total).toBe(1);const done=(await list('?estado=Completada')).json();expect(done.total).toBe(1);expect(done.items[0]).toMatchObject({state:'Completada',actionable:false,overdue:false});
  expect((await list('?alcance=todas')).json().total).toBe(2);
  expect((await api('GET','/direccion-creativa/'+complete.dc.id+'/operacion')).statusCode).toBe(200);
 });
 it('paginación SQL devuelve solo la página, counts completos y ajusta páginas fuera de rango',async()=>{
  for(let i=0;i<13;i++)await fixture();
  const first=(await list()).json(),second=(await list('?pagina=2')).json();expect(first.total).toBe(13);expect(first.items).toHaveLength(10);expect(second.items).toHaveLength(3);
  expect(first.counts.all).toBe(13);expect(first.counts.types.BRIEF).toBe(13);expect(first.items.some((i:any)=>second.items.some((j:any)=>j.id===i.id))).toBe(false);
  expect((await list('?pagina=9999')).json().page).toBe(2);expect((await list('?pageSize=25')).json().items).toHaveLength(13);
 });
 it('no hace N+1: una sentencia SQL para filas, total y facetas con 1 o 16 trabajos',async()=>{
  const {listCreativeWork}=await import('../server/helpers/creativeInbox.js');await fixture();
  for(const total of [1,16]){if(total===16)for(let i=0;i<15;i++)await fixture();const spy=vi.spyOn(pool,'query');try{const data=await listCreativeWork(leader,{},now);expect(spy).toHaveBeenCalledTimes(1);expect(data.total).toBe(total);}finally{spy.mockRestore();}}
 });
 it('empty real conserva facetas y no expone solicitudes como tareas',async()=>{
  await fixture({},null);const data=(await list()).json();expect(data.items).toEqual([]);expect(data.total).toBe(0);expect(data.counts.all).toBe(0);expect(data.counts.requests).toBe(1);
 });
});

describe('Mi trabajo · identidad de intervención',()=>{
 it('mantiene dos filas del mismo proyecto y protege otro work item del mismo proyecto',async()=>{
  const own=await fixture();
  const [secondWork]=await db.insert(workItems).values({proyectoId:own.p.id,tipo:'direccion_creativa',businessKey:'concepto_portada:ronda-2',estado:'pendiente'}).returning();
  const [second]=await db.insert(direccionesCreativas).values({proyectoId:own.p.id,workItemId:secondWork!.id}).returning();
  await db.insert(projectAssignments).values({proyectoId:own.p.id,workItemId:secondWork!.id,tipo:'lider_creativo',usuarioId:leader});
  let data=(await api('GET','/direccion-creativa/mi-trabajo')).json();expect(data.total).toBe(2);expect(new Set(data.items.map((i:any)=>i.projectId)).size).toBe(1);expect(new Set(data.items.map((i:any)=>i.workItemId)).size).toBe(2);
  await api('PATCH','/direccion-creativa/'+second!.id+'/asignar',manager,{liderCreativoId:other});
  data=(await api('GET','/direccion-creativa/mi-trabajo')).json();expect(data.total).toBe(1);expect(data.items[0].creativeProcessId).toBe(own.dc.id);
  expect((await api('GET','/direccion-creativa/'+second!.id+'/operacion')).statusCode).toBe(403);
  expect((await api('PATCH','/direccion-creativa/'+second!.id+'/brief',leader,{briefEnlace:'https://example.test/idor',fechaBriefEnviadoEspecialista:'2026-10-21'})).statusCode).toBe(403);
 });
 it('proyecto retirado con intervención no completada no devuelve un detalle operativo inválido',async()=>{
  const f=await fixture();await db.update(proyectos).set({estado:'retirado'}).where(eq(proyectos.id,f.p.id));
  expect((await api('GET','/direccion-creativa/mi-trabajo')).json().total).toBe(0);
  expect((await api('GET','/direccion-creativa/'+f.dc.id+'/operacion')).statusCode).toBe(404);
 });
});

describe('Proyectos creativos · portafolio por proyecto',()=>{
 const list=(query='',user=leader)=>api('GET','/direccion-creativa/proyectos'+query,user);
 const detail=(id:string,user=leader,query='')=>api('GET','/direccion-creativa/proyectos/'+id+query,user);
 async function coverProject(deliver=false){
  const f=await fixture({...approvedBrief,reunionRealizada:true,recursoImagenUrl:'https://example.test/image',recursoConceptoPdfUrl:'https://example.test/concept.pdf',resultadoFinal:'aprobado',fechaCierre:'2026-10-19'});
  const [approved]=await concepts(f,{fechaAprobadaRrpp:'2026-10-18'});await db.update(fichaDisenoPropuestas).set({fechaAprobadaAutor:'2026-10-19'}).where(eq(fichaDisenoPropuestas.id,approved!.id));await db.update(workItems).set({estado:'completado'}).where(eq(workItems.id,f.wi.id));
  await db.update(proyectos).set({disenadorId:designer}).where(eq(proyectos.id,f.p.id));
  const {solicitarDiseno,entregarDiseno}=await import('../server/helpers/diseno.js');
  const design=await solicitarDiseno(f.p.id,{tipo:'cubierta_extendida',solicitudKey:randomUUID(),fuenteUrl:'https://example.test/sources',preparacionConfirmada:true},{id:specialist,rol:'especialista'});
  const version=deliver?await entregarDiseno(design.id,{enlace:'https://example.test/cover.pdf',entregaKey:randomUUID()},{id:designer,rol:'disenador'}):null;
  return {...f,design,version};
 }
 it('sesión/rol en lista, detalle y conceptos; valida query y no acepta userId del cliente',async()=>{
  const f=await fixture({reunionRealizada:true});
  for(const path of ['/direccion-creativa/proyectos','/direccion-creativa/proyectos/'+f.p.id,'/direccion-creativa/proyectos/'+f.p.id+'/conceptos/'+randomUUID()]){
   expect((await api('GET',path,'absent')).statusCode).toBe(401);for(const u of [specialist,rrpp,manager,designer])expect((await api('GET',path,u)).statusCode).toBe(403);
  }
  for(const q of ['?creativeState=50percent','?service=bad','?specialist=bad','?page=0','?pageSize=5000','?userId='+other])expect((await list(q)).statusCode).toBe(400);
 });
 it('un proyecto con tres work items históricos aparece una vez, Mi trabajo conserva sus intervenciones',async()=>{
  const f=await fixture({reunionRealizada:true});
  for(let i=0;i<2;i++){const [w]=await db.insert(workItems).values({proyectoId:f.p.id,tipo:'direccion_creativa',businessKey:'historical-'+i,estado:'completado'}).returning();await db.insert(direccionesCreativas).values({proyectoId:f.p.id,workItemId:w!.id,fechaCierre:'2026-10-18'});await db.insert(projectAssignments).values({proyectoId:f.p.id,workItemId:w!.id,tipo:'lider_creativo',usuarioId:leader});}
  const data=(await list('?scope=all')).json();expect(data.total).toBe(1);expect(data.items[0]).toMatchObject({projectId:f.p.id,creativeState:'BRIEF'});expect(data.counts.all).toBe(1);
  expect((await api('GET','/direccion-creativa/mi-trabajo?alcance=todas')).json().total).toBe(3);
 });
 it('reunión real previa y gate de título; no incorpora proyectos arbitrarios ni solicitudes sin recibir',async()=>{
  await fixture({},null);await fixture({},other);const meeting=await fixture();
  const invalid=await fixture();await db.update(proyectos).set({tituloDefinitivo:null,subtituloDefinitivo:null}).where(eq(proyectos.id,invalid.p.id));
  const data=(await list()).json();expect(data.total).toBe(1);expect(data.items[0]).toMatchObject({projectId:meeting.p.id,creativeState:'MEETING'});
  await db.update(direccionesCreativas).set({fechaSolicitud:'2026-10-19'}).where(eq(direccionesCreativas.id,invalid.dc.id));
  const gated=(await list()).json().items.find((i:any)=>i.projectId===invalid.p.id);expect(gated).toMatchObject({creativeState:'BLOCKED',waitingOn:'SPECIALIST',currentWorkItem:null});
  expect((await getCreativeDashboard(leader)).tasks.some(t=>t.creativeProcessId===invalid.dc.id)).toBe(false);
  expect((await api('PATCH','/direccion-creativa/'+invalid.dc.id+'/brief',leader,{briefEnlace:'https://example.test/gate',fechaBriefEnviadoEspecialista:'2026-10-19'})).statusCode).toBe(409);
 });
 it('Brief activo utiliza el mismo work item y estado canónico de Mi trabajo',async()=>{
  const f=await fixture({reunionRealizada:true});const row=(await list()).json().items[0];expect(row).toMatchObject({creativeState:'BRIEF',waitingOn:null,currentWorkItem:{workItemId:f.wi.id,type:'BRIEF'}});expect(row.nextStep).toContain('Finalizar');expect(JSON.stringify(row)).not.toMatch(/progressPercent|percentage|\d de 5/);
 });
 it('conceptos esperan RRPP/autor sin CTA y el feedback vuelve a acción del Líder',async()=>{
  const rr=await fixture(approvedBrief),author=await fixture(approvedBrief),feedback=await fixture(approvedBrief);await concepts(rr);await concepts(author,{fechaAprobadaRrpp:'2026-10-18',fechaEnviadaAutor:'2026-10-19'});await concepts(feedback,{estado:'Feedback del autor',feedbackAutor:'Revisar imagen',fechaAprobadaRrpp:'2026-10-18'});
  const rows=(await list()).json().items;expect(rows.find((i:any)=>i.projectId===rr.p.id)).toMatchObject({creativeState:'CONCEPTS',waitingOn:'RRPP',currentWorkItem:null});expect(rows.find((i:any)=>i.projectId===author.p.id)).toMatchObject({creativeState:'CONCEPTS',waitingOn:'AUTHOR',currentWorkItem:null});expect(rows.find((i:any)=>i.projectId===feedback.p.id)).toMatchObject({creativeState:'CONCEPTS',waitingOn:null,currentWorkItem:{type:'CONCEPT_ADJUSTMENT'}});
 });
 it('recursos solo del concepto aprobado, preview sin descargas de PDF y empty no es error',async()=>{
  const f=await fixture(approvedBrief),[c]=await concepts(f,{fechaAprobadaRrpp:'2026-10-18'});await db.update(fichaDisenoPropuestas).set({fechaAprobadaAutor:'2026-10-19'}).where(eq(fichaDisenoPropuestas.id,c!.id));
  let data=(await detail(f.p.id)).json();expect(data.summary).toMatchObject({creativeState:'RESOURCES',currentWorkItem:{type:'RESOURCES',conceptId:c!.id}});expect(data.resources).toEqual([]);expect(data.concepts.find((concept:any)=>concept.id===c!.id)).toMatchObject({thumbnailUrl:null,statusLabel:'Aprobado por autor'});expect(data.workspace).toEqual({rootUrl:null,designUrl:null});
  await api('PATCH','/direccion-creativa/'+f.dc.id+'/recursos',leader,{recursoImagenUrl:'https://example.test/real.png',recursoConceptoPdfUrl:'https://example.test/real.pdf'});
  data=(await detail(f.p.id)).json();expect(data.resources).toHaveLength(2);expect(data.resources.every((r:any)=>r.conceptId===c!.id)).toBe(true);expect(data.summary.creativeState).toBe('COMPLETED');
  expect((await db.select().from(proyectos).where(eq(proyectos.id,f.p.id)))[0]?.estado).toBe('en_proceso');
 });
 it('Diseño trabajando y cubierta devuelta continúan en Cubierta, sin acción del Líder',async()=>{
  const f=await coverProject();let data=(await detail(f.p.id)).json();expect(data.summary).toMatchObject({creativeState:'COVER',waitingOn:'DESIGN',currentWorkItem:null,creativeProcessId:f.dc.id});expect(data.summary.nextStep).toContain('Diseño');
  const {entregarDiseno,revisarCubierta}=await import('../server/helpers/diseno.js');const version=await entregarDiseno(f.design.id,{enlace:'https://example.test/cover-v1.pdf',entregaKey:randomUUID()},{id:designer,rol:'disenador'});
  data=(await detail(f.p.id)).json();expect(data.summary).toMatchObject({creativeState:'COVER',waitingOn:null,currentWorkItem:{type:'COVER_REVIEW'}});const root=data.summary.creativeProcessId;
  await revisarCubierta(f.design.id,version.id,{aprobar:false,feedback:'Revisar lomo'},{id:leader,rol:'lider_creativo'});
  data=(await detail(f.p.id)).json();expect(data.summary).toMatchObject({creativeState:'COVER',waitingOn:'DESIGN',currentWorkItem:null,creativeProcessId:root});expect(data.summary.nextStep).toContain('aplicar');expect((await list()).json().total).toBe(1);
 });
 it('cubierta V2 vuelve al mismo proyecto, aprobación cierra creativo sin cerrar editorial ni Calidad',async()=>{
  const f=await coverProject(true),{revisarCubierta,entregarDiseno}=await import('../server/helpers/diseno.js');await revisarCubierta(f.design.id,f.version!.id,{aprobar:false,feedback:'Alinear lomo'},{id:leader,rol:'lider_creativo'});
  const next=await entregarDiseno(f.design.id,{enlace:'https://example.test/cover-v2.pdf',entregaKey:randomUUID()},{id:designer,rol:'disenador'});let data=(await detail(f.p.id)).json();expect(data.cover.version).toBe(2);expect(data.summary.currentWorkItem.type).toBe('COVER_REVIEW');
  await revisarCubierta(f.design.id,next.id,{aprobar:true},{id:leader,rol:'lider_creativo'});data=(await detail(f.p.id)).json();expect(data.summary).toMatchObject({creativeState:'COMPLETED',currentWorkItem:null,creativeProcessId:f.dc.id});expect((await list()).json().total).toBe(0);expect((await list('?creativeState=COMPLETED')).json().total).toBe(1);
  expect((await db.select().from(proyectos).where(eq(proyectos.id,f.p.id)))[0]?.estado).toBe('en_proceso');const [version]=await db.select().from(disenoVersiones).where(eq(disenoVersiones.id,next.id));expect((await db.select().from(workItems).where(eq(workItems.id,version!.revisionInternaWorkItemId!)))[0]?.estado).toBe('pendiente');
 });
 it('revisión propia permite contexto del concepto aprobado, sin exponer propuestas de un proceso asignado a otro Líder',async()=>{
  const f=await coverProject(true);await db.update(projectAssignments).set({usuarioId:other}).where(eq(projectAssignments.workItemId,f.wi.id));
  const data=(await detail(f.p.id)).json();expect(data.summary.currentWorkItem.type).toBe('COVER_REVIEW');expect(data.concepts).toHaveLength(1);expect(data.concepts[0].approved).toBe(true);
  const all=await db.select().from(fichaDisenoPropuestas).where(eq(fichaDisenoPropuestas.direccionCreativaId,f.dc.id)),unapproved=all.find(c=>!c.fechaAprobadaAutor)!;
  expect((await api('GET','/direccion-creativa/proyectos/'+f.p.id+'/conceptos/'+unapproved.id)).statusCode).toBe(404);
  expect((await api('GET','/direccion-creativa/'+f.dc.id+'/operacion')).statusCode).toBe(403);
 });
 it('especialista viene de historial vigente y no restaura un FK obsoleto al finalizar asignación',async()=>{
  const f=await fixture({reunionRealizada:true}),current=await person('especialista');await db.insert(projectAssignments).values({proyectoId:f.p.id,tipo:'especialista',usuarioId:current});
  expect((await list('?specialist='+current)).json().items[0].specialist.id).toBe(current);
  await db.update(projectAssignments).set({finalizadoEn:new Date()}).where(eq(projectAssignments.usuarioId,current));expect((await detail(f.p.id)).json().summary.specialist).toBeNull();
 });
 it('search título/autor/Especialista y filtros de catálogo y etapa, con counts reales',async()=>{
  const f=await fixture({reunionRealizada:true}),otherProject=await fixture(approvedBrief);await concepts(otherProject);
  const [service]=await db.insert(servicios).values({codigo:'QAP',nombre:'Catálogo creativo QA',pesoComplejidad:1,plazoDias:90}).returning();await db.update(proyectos).set({servicioId:service!.id}).where(eq(proyectos.id,otherProject.p.id));
  expect((await list('?creativeState=CONCEPTS&service='+service!.id+'&specialist='+specialist)).json().total).toBe(1);
  expect((await list('?creativeState=BRIEF')).json().counts.stages.CONCEPTS).toBe(1);
  for(const text of [f.p.codigo,'especialista QA'])expect((await list('?search='+encodeURIComponent(text))).json().total).toBeGreaterThan(0);
  const row=(await list('?search='+f.p.codigo)).json().items[0];expect((await list('?search='+encodeURIComponent(row.project.authors))).json().total).toBeGreaterThan(0);
  for(const text of ['%','_',"' OR 1=1 --"])expect((await list('?search='+encodeURIComponent(text))).json().total).toBe(0);
 });
 it('última actividad y timeline salen de audit creativo; excluyen pagos y procesos ajenos del mismo proyecto',async()=>{
  const f=await fixture({reunionRealizada:true});await db.insert(auditLogs).values([{accion:'BRIEF_CREATIVO_GENERADO',entityType:'work_item',entityId:f.wi.id,proyectoId:f.p.id,actorId:leader},{accion:'SEGUIMIENTO_PAGO_REGISTRADO',entityType:'proyecto',entityId:f.p.id,proyectoId:f.p.id,actorId:manager}]);
  const [foreignWi]=await db.insert(workItems).values({proyectoId:f.p.id,tipo:'direccion_creativa',businessKey:'foreign-process'}).returning();await db.insert(direccionesCreativas).values({proyectoId:f.p.id,workItemId:foreignWi!.id});await db.insert(projectAssignments).values({proyectoId:f.p.id,workItemId:foreignWi!.id,tipo:'lider_creativo',usuarioId:other});await db.insert(auditLogs).values({accion:'CONCEPTO_DEVUELTO_RRPP',entityType:'work_item',entityId:foreignWi!.id,proyectoId:f.p.id,actorId:rrpp});
  const data=(await detail(f.p.id)).json();expect(data.activity).toHaveLength(1);expect(data.activity[0].label).toContain('brief');expect(data.summary.lastActivity.id).toBe(data.activity[0].id);expect((await list()).json().items[0].lastActivity.id).toBe(data.activity[0].id);
 });
 it('IDOR proyecto/proceso/concepto, incluyendo proceso ajeno dentro de proyecto propio',async()=>{
  const own=await fixture(approvedBrief),foreign=await fixture(approvedBrief,other),[c]=await concepts(foreign);await concepts(own);
  expect((await detail(foreign.p.id)).statusCode).toBe(404);expect((await detail(own.p.id,leader,'?process='+foreign.dc.id)).statusCode).toBe(403);
  expect((await api('GET','/direccion-creativa/proyectos/'+own.p.id+'/conceptos/'+c!.id)).statusCode).toBe(404);
  await api('PATCH','/direccion-creativa/'+own.dc.id+'/asignar',manager,{liderCreativoId:other});expect((await detail(own.p.id)).statusCode).toBe(404);expect((await list()).json().total).toBe(0);
 });
 it('paginación SQL de proyectos, orden estable y empty real',async()=>{
  expect((await list()).json()).toMatchObject({items:[],total:0});for(let i=0;i<12;i++)await fixture({reunionRealizada:true});
  const first=(await list('?sort=title')).json(),next=(await list('?sort=title&page=2')).json();expect(first.items).toHaveLength(10);expect(next.items).toHaveLength(2);expect(first.total).toBe(12);expect(first.counts.all).toBe(12);expect(first.items.some((i:any)=>next.items.some((j:any)=>i.projectId===j.projectId))).toBe(false);expect((await list('?page=999')).json().page).toBe(2);expect((await list('?pageSize=25')).json().items).toHaveLength(12);
 });
 it('una sentencia para lista/counts con 1 o 16 proyectos; detalle carga únicamente el seleccionado',async()=>{
  const {listCreativeProjects,getCreativeProjectDetail}=await import('../server/helpers/creativePortfolio.js');const f=await fixture({reunionRealizada:true});
  for(const total of [1,16]){if(total===16)for(let i=0;i<15;i++)await fixture({reunionRealizada:true});const spy=vi.spyOn(pool,'query');try{expect((await listCreativeProjects(leader)).total).toBe(total);expect(spy).toHaveBeenCalledTimes(1);}finally{spy.mockRestore();}}
  const spy=vi.spyOn(pool,'query');try{const data=await getCreativeProjectDetail(f.p.id,leader);expect(data.summary.projectId).toBe(f.p.id);expect(spy).toHaveBeenCalledTimes(2);expect(data.concepts).toEqual([]);}finally{spy.mockRestore();}
 });
});

describe('Proyectos creativos · documentación, actividad y orden',()=>{
 it('Drive lee root y DESIGN persistidos y oculta una conexión de contexto anterior',async()=>{
  const {externalIntegrations,projectDriveWorkspaces,projectDriveFolders}=await import('../server/db/schema/index.js');const f=await fixture({reunionRealizada:true}),context=randomUUID();
  const [integration]=await db.insert(externalIntegrations).values({provider:'google_drive',storageContextId:context,status:'disconnected'}).returning();
  const [workspace]=await db.insert(projectDriveWorkspaces).values({projectId:f.p.id,integrationId:integration!.id,storageContextId:context,projectsRootFolderId:'persisted-parent',rootFolderId:'persisted-root',rootFolderUrl:'https://drive.google.com/drive/folders/persisted-root',templateKey:'SE',templateVersion:'1',plan:[],status:'READY',readyAt:new Date()}).returning();
  await db.insert(projectDriveFolders).values({workspaceId:workspace!.id,key:'DESIGN',driveFolderId:'persisted-design',driveUrl:'https://drive.google.com/drive/folders/persisted-design',displayName:'Nombre de carpeta real',templatePath:'DESIGN',status:'READY'});
  let data=(await api('GET','/direccion-creativa/proyectos/'+f.p.id)).json();expect(data.workspace).toEqual({rootUrl:'https://drive.google.com/drive/folders/persisted-root',designUrl:'https://drive.google.com/drive/folders/persisted-design'});
  await db.update(externalIntegrations).set({storageContextId:randomUUID()}).where(eq(externalIntegrations.id,integration!.id));data=(await api('GET','/direccion-creativa/proyectos/'+f.p.id)).json();expect(data.workspace).toEqual({rootUrl:null,designUrl:null});
 });
 it('timeline limita seis eventos reales y ordenar por actividad respeta sus fechas',async()=>{
  const older=await fixture({reunionRealizada:true}),recent=await fixture({reunionRealizada:true});
  await db.insert(auditLogs).values(Array.from({length:8},(_,i)=>({accion:'BRIEF_CREATIVO_GENERADO',entityType:'work_item',entityId:older.wi.id,proyectoId:older.p.id,actorId:leader,createdAt:new Date(`2026-10-${String(i+1).padStart(2,'0')}T12:00:00Z`)})));
  await db.insert(auditLogs).values({accion:'REUNION_CREATIVA_REGISTRADA',entityType:'work_item',entityId:recent.wi.id,proyectoId:recent.p.id,actorId:leader,createdAt:new Date('2026-10-19T12:00:00Z')});
  const detail=(await api('GET','/direccion-creativa/proyectos/'+older.p.id)).json();expect(detail.activity).toHaveLength(6);expect(detail.activity[0].at).toContain('2026-10-08');expect(detail.activity.at(-1).at).toContain('2026-10-03');
  const list=(await api('GET','/direccion-creativa/proyectos?sort=activity')).json();expect(list.items.map((i:any)=>i.projectId)).toEqual([recent.p.id,older.p.id]);
 });
 it('orden prioriza acción del Líder, espera con plazo próximo y luego actividad; espera antigua no es deuda del Líder',async()=>{
  const action=await fixture({reunionRealizada:true}),past=await fixture({...approvedBrief,fechaBriefAprobadoAutor:null,fechaBriefEnviadoAutor:'2026-10-19'}),future=await fixture({...approvedBrief,fechaBriefAprobadoAutor:null,fechaBriefEnviadoAutor:'2026-10-19'});
  await db.update(workItems).set({fechaFinPautada:'2026-10-18'}).where(eq(workItems.id,past.wi.id));await db.update(workItems).set({fechaFinPautada:'2026-10-20'}).where(eq(workItems.id,future.wi.id));
  const {listCreativeProjects}=await import('../server/helpers/creativePortfolio.js');const rows=(await listCreativeProjects(leader,{},now)).items;expect(rows.map(i=>i.projectId)).toEqual([action.p.id,future.p.id,past.p.id]);expect(rows[1]?.currentWorkItem).toBeNull();expect(rows[2]?.currentWorkItem).toBeNull();
 });
});
