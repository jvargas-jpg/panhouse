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
    for(let i=0;i<15;i++)await fixture();const second=vi.spyOn(pool,'query');try{const d=await getCreativeDashboard(leader,now);expect(second.mock.calls.length).toBe(count);expect(count).toBe(3);expect(d.totalActions).toBe(16);expect(d.attention).toHaveLength(6);}finally{second.mockRestore();}
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
