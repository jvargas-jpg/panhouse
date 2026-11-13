import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../server/app.js';
import { db, pool } from '../server/db/client.js';
import { auditLogs, capitulos, externalIntegrations, fases, fichasTrazabilidad, projectAssignments, projectDriveFolders, projectDriveWorkspaces, proyectos, servicios, servicioFases, users, workItems } from '../server/db/schema/index.js';
import { createSession } from '../server/helpers/session.js';
import { crearProyectoDePrueba, completarPreparacionDePrueba } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import type { ProjectCommandCenter } from '../shared/projectCommandCenter.js';
import { projectWorkflowFacts } from '../server/helpers/finalPackage.js';
import { crearCapitulo, actualizarCapituloAutor } from '../server/helpers/capitulos.js';
import { detectWorkflowDeliveries } from '../server/helpers/workflowDrive.js';
import type { CorporateDriveOperation } from '../server/modules/integrations/google-drive/corporate.js';
import type { StorageItem } from '../server/modules/integrations/google-drive/provider.js';
import type { GuidedPortfolio } from '../shared/projectPortfolio.js';
import type { OperationHome } from '../shared/operationHome.js';
import { preparacionesProyecto } from '../server/db/schema/index.js';
import { createCreativeMeetingRequest, decideCreativeRequest } from '../server/helpers/creativeRequests.js';
import { direccionesCreativas, disenos, disenoVersiones, fichaDisenoPropuestas } from '../server/db/schema/index.js';

const app = buildApp();
let specialist: string, chief: string, other: string, chiefEditor: string, editor: string;
const cookies = new Map<string, string>();
async function user(role: typeof users.$inferInsert.rol) {
 const id = randomUUID();
 await db.insert(users).values({ id, rol: role, nombre: role, email: id+'@guide.test', passwordHash: 'session-only' });
 cookies.set(id, 'panhouse_sid='+await createSession(id));
 return id;
}
const call = (id: string, method: 'GET'|'POST'|'PATCH', url: string, payload?: object) => app.inject({ method, url: '/api'+url, headers: { cookie: cookies.get(id)! }, payload });
async function fixture(ready = false) {
 const p = await crearProyectoDePrueba({ especialistaId: specialist, jefeAreaId: chief });
 const [existing]=await db.select().from(servicios).where(eq(servicios.codigo,'EF'));
 if(existing) {await db.update(proyectos).set({servicioId:existing.id}).where(eq(proyectos.id,p.id));p.servicioId=existing.id;}
 else await db.update(servicios).set({ codigo: 'EF', nombre: 'Escritura Fantasma' }).where(eq(servicios.id, p.servicioId));
 await db.update(proyectos).set({ notificadoJefatura: true }).where(eq(proyectos.id, p.id));
 await db.insert(fichasTrazabilidad).values({ proyectoId: p.id });
 if (ready) await completarPreparacionDePrueba(p.id);
 return p;
}
async function center(id: string, actor = specialist) {
 const r = await call(actor, 'GET', `/proyectos/${id}/command-center`);
 expect(r.statusCode, r.body).toBe(200);
 return r.json<ProjectCommandCenter>();
}
beforeAll(()=>app.ready());
afterAll(()=>app.close());
beforeEach(async()=>{
 await limpiarBaseDeDatos(); cookies.clear();
 specialist=await user('especialista'); chief=await user('jefe_area'); other=await user('especialista'); chiefEditor=await user('jefe_edicion'); editor=await user('editor');
});

describe('Guía del proyecto: hechos y capacidades',()=>{
 it('comienza en preparación y el servidor bloquea Continuar mientras faltan requisitos',async()=>{
  const p=await fixture();
  const data=await center(p.id);
  expect(data.guide?.currentPath).toBe('preparacion_inicial');
  expect(data.guide?.paths.find(p=>p.id==='preparacion_inicial')?.canContinue).toBe(false);
  expect((await call(specialist,'POST',`/proyectos/${p.id}/workflow/continue`,{path:'preparacion_inicial',canContinue:true})).statusCode).toBe(400);
  expect((await call(specialist,'POST',`/proyectos/${p.id}/workflow/continue`,{path:'preparacion_inicial'})).statusCode).toBe(409);
 });
 it('Jefatura y Especialista comparten posición, caminos, requisitos y responsables',async()=>{
  const p=await fixture(true);
  const a=(await center(p.id)).guide!, b=(await center(p.id,chief)).guide!;
  expect(a.currentPath).toBe(b.currentPath); expect(a.position).toBe(b.position);
  const state=(g:typeof a)=>g.paths.map(({id,state,currentStep,responsible,waitingFor,requirements,requiresAction})=>({id,state,currentStep,responsible,waitingFor,requirements,requiresAction}));
  expect(state(a)).toEqual(state(b));
  expect(b.paths.every(p=>!p.canOperate && !p.canContinue)).toBe(true);
 });
 it('hechos agregados conservan fechas, capítulos y ámbito del proyecto',async()=>{
  const p=await fixture(true);
  await db.insert(capitulos).values({proyectoId:p.id,numero:1,fechaEntregaEditor:'2026-11-12'});
  const facts=await projectWorkflowFacts(p.id);
  expect(facts.serviceCode).toBe('EF'); expect(facts.chapters[0]?.fechaEntregaEditor).toBe('2026-11-12');
  expect(facts.works).toEqual([]);
 });
 it('IDOR y RBAC también protegen Continuar',async()=>{
  const p=await fixture();
  expect((await call(other,'POST',`/proyectos/${p.id}/workflow/continue`,{path:'preparacion_inicial'})).statusCode).toBe(403);
  expect((await call(chief,'POST',`/proyectos/${p.id}/workflow/continue`,{path:'preparacion_inicial'})).statusCode).toBe(403);
 });
 it('solicita Editor desde el proyecto, Jefatura recibe, asigna y ambas guías se actualizan',async()=>{
  const p=await fixture(true);
  expect((await call(specialist,'POST',`/proyectos/${p.id}/solicitar-editor`)).statusCode).toBe(201);
  let data=await center(p.id);
  expect(data.guide?.paths.find(p=>p.id==='edicion')).toMatchObject({waitingFor:'Jefatura de Edición',canContinue:false,canOperate:false});
  expect(data.guide?.paths.some(p=>p.id!=='edicion'&&p.canOperate)).toBe(true);
  const inbox=await call(chiefEditor,'GET','/editores/asignaciones');
  expect(inbox.statusCode,inbox.body).toBe(200); expect(inbox.json().items.some((i:{projectId:string})=>i.projectId===p.id)).toBe(true);
  const request=(await call(specialist,'GET','/especialistas/solicitudes?tab=todas')).json().solicitudes[0];
  expect(request).toMatchObject({tipo:'editor',proceso:'edicion',proyecto:{id:p.id}});
  expect((await call(chiefEditor,'PATCH',`/proyectos/${p.id}/editor`,{editorId:editor})).statusCode).toBe(200);
  data=await center(p.id);
  expect(data.guide?.paths.find(p=>p.id==='edicion')?.waitingFor).toBe('Editor');
  expect((await center(p.id,chief)).guide?.paths.find(p=>p.id==='edicion')?.waitingFor).toBe('Editor');
  expect((await call(specialist,'GET','/especialistas/solicitudes?tab=resueltas')).json().solicitudes[0].outcome).toContain('Editor asignado');
 });
 it('la entrega de Drive reactiva Edición una sola vez y un archivo correlacionado a otro proyecto no sirve',async()=>{
  const p=await fixture(true);
  await call(specialist,'POST',`/proyectos/${p.id}/solicitar-editor`);
  await call(chiefEditor,'PATCH',`/proyectos/${p.id}/editor`,{editorId:editor});
  const chapter=await crearCapitulo(p.id,1,editor);
  const [work]=await db.select().from(workItems).where(eq(workItems.businessKey,'capitulo:'+chapter.id));
  const [ws]=await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId,p.id));
  const [integration]=await db.select().from(externalIntegrations).where(eq(externalIntegrations.id,ws!.integrationId));
  const folder='edited-'+p.id;
  await db.insert(projectDriveFolders).values({workspaceId:ws!.id,key:'EDITING_OUTPUT',driveFolderId:folder,displayName:'Editado',templatePath:'/Editado',status:'READY'});
  const file:StorageItem={providerFileId:'guide-edited-document',name:'cualquier-nombre.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',size:200,modifiedAt:new Date(Date.now()+1000).toISOString(),parents:[folder],appProperties:{panhouseProjectId:other,panhouseWorkItemId:work!.id,panhouseActorId:editor,panhouseDeliverable:'edited'},webViewLink:null};
  const operate:CorporateDriveOperation=async fn=>fn({integration:{...integration!,scope:['https://www.googleapis.com/auth/drive']},storage:{
   listFiles:async()=>({items:[file],nextPageToken:null}),getMetadata:async()=>file,
   validateConnection:async()=>({accountId:null,accountEmail:null}),createFolder:async()=>{throw Error('unexpected');},listFolders:async()=>[],deleteFileOrFolder:async()=>{},allocateFolderIds:async()=>[],shareFolder:async()=>{throw Error('unexpected');},listFolderPermissions:async()=>[],
  }});
  expect(await detectWorkflowDeliveries(operate)).toEqual({editorialReceived:0,correctionReceived:0});
  file.appProperties.panhouseProjectId=p.id;
  expect(await detectWorkflowDeliveries(operate)).toEqual({editorialReceived:1,correctionReceived:0});
  expect(await detectWorkflowDeliveries(operate)).toEqual({editorialReceived:0,correctionReceived:0});
  expect((await center(p.id)).guide?.paths.find(p=>p.id==='edicion')).toMatchObject({waitingFor:null,canOperate:true,currentStep:'Enviar capítulo 1 al Autor para feedback'});
  await actualizarCapituloAutor(p.id,1,{fechaEnvioAutor:new Date().toISOString().slice(0,10)},specialist);
  expect((await center(p.id)).guide?.paths.find(p=>p.id==='edicion')?.waitingFor).toBe('Autor');
  expect(await db.select().from(auditLogs).where(eq(auditLogs.accion,'EDITOR_ENTREGA_REGISTRADA'))).toHaveLength(1);
 });
 it('volver a preparación conserva datos y rechaza cambios peligrosos en el servidor',async()=>{
  const p=await fixture(true);
  await call(specialist,'POST',`/proyectos/${p.id}/solicitar-editor`);
  const path=(await center(p.id)).guide!.paths.find(p=>p.id==='preparacion_inicial')!;
  expect(path.steps.every(s=>s.completed)).toBe(true); expect(path.historicalReadOnly).toBe(true);
  expect(path.editWarning).toContain('afectar procesos posteriores');
  const r=await call(specialist,'PATCH',`/proyectos/${p.id}/preparacion-inicial`,{minutaUrl:'https://example.test/cambio'});
  expect(r.statusCode,r.body).toBe(409);
 });
 it('un paso anterior de preparación se puede corregir antes de iniciar procesos posteriores',async()=>{
  const p=await fixture(true);
  expect((await center(p.id)).guide!.paths.find(p=>p.id==='preparacion_inicial')?.historicalReadOnly).toBe(false);
  const r=await call(specialist,'PATCH',`/proyectos/${p.id}/preparacion-inicial`,{minutaUrl:'https://example.test/minuta-corregida'});
  expect(r.statusCode,r.body).toBe(200);
  expect((await center(p.id)).preparacion.minutaUrl).toBe('https://example.test/minuta-corregida');
 });
 it('el portafolio prioriza acciones antes de paginar, mantiene el mismo estado y consulta en lote',async()=>{
  const waiting=await fixture(true);
  const [edition]=await db.insert(fases).values({codigo:'edicion',nombre:'Edición'}).returning();
  await db.insert(servicioFases).values({servicioId:waiting.servicioId,faseId:edition!.id,orden:1});
  await call(specialist,'POST',`/proyectos/${waiting.id}/solicitar-editor`);
  const p=await fixture();
  const spy=vi.spyOn(pool,'query');
  try {
   const r=await call(specialist,'GET','/proyectos/guia-portafolio');
   expect(r.statusCode,r.body).toBe(200); const count=spy.mock.calls.length;
   const result=r.json<GuidedPortfolio>();
   expect(result.items.find(i=>i.id===p.id)?.mainProcess?.currentStep).toBe((await center(p.id)).guide?.position);
   await crearProyectoDePrueba({especialistaId:other});
   for(let i=0;i<11;i++)await fixture();
   spy.mockClear(); const next=await call(specialist,'GET','/proyectos/guia-portafolio');
   expect(next.statusCode,next.body).toBe(200); expect(spy.mock.calls.length).toBe(count);
   expect(next.json<GuidedPortfolio>().total).toBe(13);
   expect(next.json<GuidedPortfolio>().items).toHaveLength(10);
   expect(next.json<GuidedPortfolio>().items.every(i=>i.actionable)).toBe(true);
   expect(next.json<GuidedPortfolio>().items.some(i=>i.id===waiting.id)).toBe(false);
  } finally {spy.mockRestore();}
 });
 it('separa la espera de la línea principal y la acción paralela en las tres experiencias',async()=>{
  const p=await fixture(true);
  await db.update(proyectos).set({tituloDefinitivo:'Libro paralelo',subtituloDefinitivo:'Subtítulo'}).where(eq(proyectos.id,p.id));
  await call(specialist,'POST',`/proyectos/${p.id}/solicitar-editor`);
  const guide=(await center(p.id)).guide!;
  expect(guide.currentPath).toBe('edicion');expect(guide.priorityAction).toBe('correccion');
  expect(guide.waitingOn).toContainEqual({processId:'edicion',actor:'Jefatura de Edición'});
  expect(guide.availableProcesses).toContain('correccion');expect(guide.requiresUserAction).toBe(true);
  const chiefGuide=(await center(p.id,chief)).guide!;
  expect(chiefGuide.currentPath).toBe(guide.currentPath);expect(chiefGuide.waitingOn).toEqual(guide.waitingOn);expect(chiefGuide.requiresUserAction).toBe(false);
  const home=(await call(specialist,'GET','/proyectos/guia-inicio')).json<OperationHome>();
  expect(home.actions.some(a=>a.process.id==='correccion')).toBe(true);expect(home.actions.some(a=>a.process.id==='edicion')).toBe(false);
  expect(home.waiting.find(w=>w.process.id==='edicion')).toMatchObject({availableElsewhere:1});
  const portfolio=(await call(specialist,'GET','/proyectos/guia-portafolio')).json<GuidedPortfolio>();
  expect(portfolio.items[0]?.mainProcess?.id).toBe('edicion');expect(portfolio.items[0]?.parallelProcesses.find(p=>p.id==='correccion')?.canOperate).toBe(true);
 });
 it('reproduce el caso SE auditado mediante aceptación creativa real: Corrección disponible y Creativa esperando',async()=>{
  const p=await fixture(true),leader=await user('lider_creativo');
  await db.update(servicios).set({codigo:'SE',nombre:'Sello editorial'}).where(eq(servicios.id,p.servicioId));
  await db.update(proyectos).set({tituloDefinitivo:'Libro SE',subtituloDefinitivo:'Contexto aprobado'}).where(eq(proyectos.id,p.id));
  const request=await createCreativeMeetingRequest(p.id,specialist);await decideCreativeRequest(request,leader,'accept');
  const guide=(await center(p.id)).guide!;
  expect(guide.paths.some(p=>p.id==='edicion')).toBe(false);
  expect(guide.paths.find(p=>p.id==='direccion_creativa')).toMatchObject({waitingFor:'Líder Creativo',canOperate:false,assignee:'lider_creativo'});
  expect(guide.paths.find(p=>p.id==='direccion_creativa')?.assignedAt).toBeTruthy();
  expect(guide.paths.find(p=>p.id==='correccion')).toMatchObject({canOperate:true,waitingFor:null});
  const facts=await projectWorkflowFacts(p.id);expect(facts.correction).toHaveLength(0);
 });
 it('una asignación sigue nueva al consultarla y deja de serlo con el inicio efectivo de gestión',async()=>{
  const p=await fixture();
  await db.insert(projectAssignments).values({proyectoId:p.id,tipo:'especialista',usuarioId:specialist,asignadoPorId:chief});
  const read=()=>call(specialist,'GET','/proyectos/guia-inicio');
  const before=(await read()).json<OperationHome>();
  expect(before.newAssignments.some(i=>i.id===p.id)).toBe(true);
  expect((await read()).json<OperationHome>().newAssignments.some(i=>i.id===p.id)).toBe(true);
  const [prep]=await db.select().from(preparacionesProyecto).where(eq(preparacionesProyecto.proyectoId,p.id));
  expect(prep?.recibidoEn??null).toBeNull();
  const started=await call(specialist,'PATCH',`/proyectos/${p.id}/preparacion-inicial`,{recibidoEn:new Date().toISOString()});
  expect(started.statusCode,started.body).toBe(200);
  const after=(await read()).json<OperationHome>();
  expect(after.newAssignments.some(i=>i.id===p.id)).toBe(false);expect(after.actions.some(i=>i.project.id===p.id&&i.process.id==='preparacion_inicial')).toBe(true);
 });
 it('Inicio cuenta toda la cartera sin paginar, respeta ámbito y mantiene consultas constantes',async()=>{
  const firstProject=await fixture();
  await db.insert(projectAssignments).values({proyectoId:firstProject.id,tipo:'especialista',usuarioId:specialist,asignadoPorId:chief});
  const foreign=await crearProyectoDePrueba({especialistaId:other});
  const spy=vi.spyOn(pool,'query');
  try{
   const first=await call(specialist,'GET','/proyectos/guia-inicio');expect(first.statusCode,first.body).toBe(200);const count=spy.mock.calls.length;
   for(let i=0;i<11;i++){const p=await fixture();await db.insert(projectAssignments).values({proyectoId:p.id,tipo:'especialista',usuarioId:specialist,asignadoPorId:chief});}
   spy.mockClear();const second=await call(specialist,'GET','/proyectos/guia-inicio');expect(second.statusCode,second.body).toBe(200);
   expect(spy.mock.calls.length).toBe(count);const home=second.json<OperationHome>();
   expect(home.summary.active).toBe(12);expect(home.newAssignments).toHaveLength(12);expect(home.newAssignments.some(p=>p.id===foreign.id)).toBe(false);
   expect((await call(editor,'GET','/proyectos/guia-inicio')).statusCode).toBe(403);
  }finally{spy.mockRestore();}
 });
 it('un atraso de feedback identifica al Autor y permanece en esperas, no en acciones del Especialista',async()=>{
  const p=await fixture(true);
  await call(specialist,'POST',`/proyectos/${p.id}/solicitar-editor`);await call(chiefEditor,'PATCH',`/proyectos/${p.id}/editor`,{editorId:editor});
  await crearCapitulo(p.id,3,editor);
  await db.update(capitulos).set({fechaEntregaEditor:'2020-01-01',fechaEnvioAutor:'2020-01-02',fechaPautadaFeedback:'2020-01-05'}).where(eq(capitulos.proyectoId,p.id));
  const home=(await call(specialist,'GET','/proyectos/guia-inicio')).json<OperationHome>();
  expect(home.risks.some(r=>r.processId==='edicion'&&r.message.includes('Autor'))).toBe(true);
  expect(home.waiting.find(w=>w.process.id==='edicion')).toMatchObject({overdue:true,process:{waitingFor:'Autor',waitingSince:'2020-01-02',dueAt:'2020-01-05'}});
  expect(home.actions.some(a=>a.process.id==='edicion')).toBe(false);
 });
 it('Diseño ofrece el siguiente entregable y tres archivos recibidos no ocultan la espera de aprobación',async()=>{
  const p=await fixture(true);
  await db.update(servicios).set({codigo:'SE',nombre:'Sello editorial'}).where(eq(servicios.id,p.servicioId));
  await db.update(proyectos).set({tituloDefinitivo:'Diseño QA',subtituloDefinitivo:'Subtítulo aprobado'}).where(eq(proyectos.id,p.id));
  const [cw]=await db.insert(workItems).values({proyectoId:p.id,tipo:'direccion_creativa',estado:'completado'}).returning();
  const [creative]=await db.insert(direccionesCreativas).values({proyectoId:p.id,workItemId:cw!.id,tipo:'concepto_portada',resultadoFinal:'aprobado',briefEnlace:'https://example.test/brief',fechaBriefAprobadoAutor:'2026-01-01',recursoImagenUrl:'https://example.test/image',recursoConceptoPdfUrl:'https://example.test/concept'}).returning();
  const [ficha]=await db.select().from(fichasTrazabilidad).where(eq(fichasTrazabilidad.proyectoId,p.id));
  await db.insert(fichaDisenoPropuestas).values({fichaId:ficha!.id,direccionCreativaId:creative!.id,fechaAprobadaRrpp:'2026-01-01',fechaAprobadaAutor:'2026-01-01'});
  const [sw]=await db.insert(workItems).values({proyectoId:p.id,tipo:'diseno',businessKey:'muestra_diagramacion',estado:'completado'}).returning();
  const [sample]=await db.insert(disenos).values({proyectoId:p.id,workItemId:sw!.id,tipo:'muestra_diagramacion',direccionCreativaId:creative!.id,solicitudKey:randomUUID(),fuenteUrl:'https://example.test/source',externalProviderEmail:'design@example.test',cerradoEn:new Date(),solicitadoEn:new Date(Date.now()+1000)}).returning();
  const [version]=await db.insert(disenoVersiones).values({disenoId:sample!.id,numero:0,entregaKey:randomUUID(),enlace:'https://example.test/sample',enviadaAutorEn:new Date(),aprobadaAutorEn:new Date()}).returning();
  expect((await center(p.id)).guide!.paths.find(p=>p.id==='diseno')).toMatchObject({canOperate:true,action:{designType:'cubierta_extendida'},currentStep:'Solicitar cubierta extendida'});
  for(const type of ['cubierta_extendida','diagramacion']){
   const [w]=await db.insert(workItems).values({proyectoId:p.id,tipo:'diseno',businessKey:type,estado:'en_progreso'}).returning();
   const [d]=await db.insert(disenos).values({proyectoId:p.id,workItemId:w!.id,tipo:type,direccionCreativaId:creative!.id,solicitudKey:randomUUID(),fuenteUrl:'https://example.test/source',externalProviderEmail:'design@example.test'}).returning();
   await db.insert(disenoVersiones).values({disenoId:d!.id,numero:0,entregaKey:randomUUID(),enlace:'https://example.test/'+type});
  }
  await db.update(disenos).set({cerradoEn:null}).where(eq(disenos.id,sample!.id));
  await db.update(disenoVersiones).set({aprobadaAutorEn:null}).where(eq(disenoVersiones.id,version!.id));
  expect((await center(p.id)).guide!.paths.find(p=>p.id==='diseno')).toMatchObject({state:'Esperando tercero',waitingFor:'Autor',canOperate:false});
 });
 it('la respuesta solicitada por Jefatura vuelve al paso de Corrección y al reenviar pasa a espera',async()=>{
  const p=await fixture(true);
  const correction=await call(specialist,'POST',`/proyectos/${p.id}/correcciones`,{alcance:'tripa_completa',paginas:130});
  expect(correction.statusCode,correction.body).toBe(201);
  const facts=await projectWorkflowFacts(p.id),decision=facts.decisions[0]!;
  expect(decision).toBeDefined();
  const ask=await call(chief,'POST',`/decisiones/${decision.id}/solicitar-info`,{mensaje:'Necesito la justificación de la extensión antes de revisar.',expectedVersion:decision.version});
  expect(ask.statusCode,ask.body).toBe(200);
  const guide=(await center(p.id)).guide!;
  expect(guide.paths.find(p=>p.id==='correccion')).toMatchObject({canOperate:true,waitingFor:null,action:{kind:'decision_response',targetId:decision.id}});
  const updated=(await projectWorkflowFacts(p.id)).decisions[0]!;
  const reply=await call(specialist,'POST',`/decisiones/${decision.id}/responder-info`,{mensaje:'La extensión contempla entrevistas documentadas y anexos del Autor.',expectedVersion:updated.version});
  expect(reply.statusCode,reply.body).toBe(200);
  expect((await center(p.id)).guide!.paths.find(p=>p.id==='correccion')).toMatchObject({canOperate:false,waitingFor:'Jefatura'});
  expect((await center(p.id,chief)).guide!.supervisionActions.some(a=>a.id===decision.id)).toBe(true);
 });
 it('la configuración del servicio gobierna la convergencia; solvencia bloquea liberación y permite preparar',async()=>{
  const p=await fixture(true);
  const [phase]=await db.insert(fases).values({codigo:'revision_servicio',nombre:'Revisión especial del servicio'}).returning();
  await db.insert(servicioFases).values({servicioId:p.servicioId,faseId:phase!.id,orden:1});
  await db.update(proyectos).set({gateFinancieroRequerido:true,solvenciaEstado:'Pendiente'}).where(eq(proyectos.id,p.id));
  const url=`/fichas-trazabilidad/${p.id}/documental/diseno`;
  expect((await call(specialist,'PATCH',url,{datos:{paqueteFinalCargado:true}})).statusCode).toBe(409);
  await db.insert(workItems).values({proyectoId:p.id,tipo:'revision_servicio',estado:'completado'});
  let gate=(await center(p.id)).guide!.finalPackage;
  expect(gate.canPrepare).toBe(true); expect(gate.canRelease).toBe(false); expect(gate.requirements.map(r=>r.label)).toEqual(['Revisión especial del servicio']);
  expect((await call(specialist,'PATCH',url,{datos:{paqueteFinalEntrega:'2026-11-13'}})).statusCode).toBe(409);
  const prepared=await call(specialist,'PATCH',url,{datos:{paqueteFinalCargado:true}});
  expect(prepared.statusCode,prepared.body).toBe(200);
  gate=(await center(p.id)).guide!.finalPackage; expect(gate.prepared).toBe(true); expect(gate.canRelease).toBe(false);
  expect((await call(specialist,'PATCH',url,{datos:{paqueteFinalEntrega:'2026-11-13'}})).statusCode).toBe(409);
  await db.update(proyectos).set({solvenciaEstado:'Solvente'}).where(eq(proyectos.id,p.id));
  expect((await center(p.id)).guide!.finalPackage.canRelease).toBe(true);
  expect((await call(specialist,'PATCH',url,{datos:{paqueteFinalEntrega:'2026-11-13'}})).statusCode).toBe(200);
 });
});
