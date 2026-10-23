import {beforeEach,describe,expect,it,vi} from 'vitest';
import request from 'supertest';
import {Client} from 'pg';
import {and,eq} from 'drizzle-orm';
import {db} from '../server/db/client.js';
import {auditLogs,notificaciones,pausas,projectAssignments,proyectos,users,workItems} from '../server/db/schema/index.js';
import {crearUsuario,crearProyectoDePrueba} from './helpers/fixtures.js';
import {limpiarBaseDeDatos} from './helpers/db.js';
import {crearAppDePrueba} from './helpers/testApp.js';
import {registrarYLoguear} from './helpers/auth.js';
import {asignarEditor,solicitarEditor} from '../server/helpers/proyectos.js';
import {crearCapitulo,actualizarCapituloEditor,actualizarCapituloAutor} from '../server/helpers/capitulos.js';
import {editorialInterventions} from '../server/helpers/editorialChief.js';
import {getEditorLoadSummary,listarAsignacionesEdicion,recommendEditorsForIntervention} from '../server/helpers/editorialAssignments.js';
import {ajustarPlazoEdicionPorPausas} from '../server/helpers/edicionSla.js';
import {listarNotificacionesPorRol} from '../server/helpers/notificaciones.js';
import type {EditorialAssignmentFilters,EditorialLoadSummary} from '../shared/editorialChief.js';
const now=new Date('2026-10-23T16:00:00Z');
const filters:EditorialAssignmentFilters={tab:'unassigned',search:'',page:1,pageSize:10,sort:'due'};
async function pending(){const specialist=await crearUsuario('especialista'),project=await crearProyectoDePrueba({especialistaId:specialist.id});await solicitarEditor(project.id,specialist.id);return {specialist,project,item:(await editorialInterventions()).find(i=>i.projectId===project.id)!};}
describe('Asignaciones y carga · decisiones y lectura',()=>{
 beforeEach(limpiarBaseDeDatos);
 it('no inventa requests: deduplica origen y muestra solicitante real, notas, servicio y fecha exigible',async()=>{
  await crearProyectoDePrueba();const {specialist,project,item}=await pending();await solicitarEditor(project.id,specialist.id);
  await db.update(workItems).set({observaciones:'Material recibido por el Especialista',fechaFinPautada:'2026-10-26'}).where(eq(workItems.id,item.id));
  const result=await listarAsignacionesEdicion(filters,now);expect(result.total).toBe(1);expect(result.items[0]).toMatchObject({requestedById:specialist.id,requestedBy:specialist.nombre,requestedByRole:'especialista',notes:'Material recibido por el Especialista',dueDate:'2026-10-26',serviceId:project.servicioId,volume:null,needsAssignment:true});
  expect(await db.select().from(auditLogs).where(eq(auditLogs.accion,'EDITOR_SOLICITADO'))).toHaveLength(1);
 });
 it('notificaciones enlazan cada solicitud con su propio proyecto, sin mezclar IDs',async()=>{
  const one=await pending(),two=await pending();
  const notifications=await listarNotificacionesPorRol('jefe_edicion');
  expect(notifications.find(n=>n.proyectoId===one.project.id)).toMatchObject({editorialRequestId:one.item.id});
  expect(notifications.find(n=>n.proyectoId===two.project.id)).toMatchObject({editorialRequestId:two.item.id});
 });
 it('tabs/counts corresponden al conjunto filtrado completo, no a la página',async()=>{
  const specialist=await crearUsuario('especialista');
  for(let i=0;i<12;i++){const p=await crearProyectoDePrueba({especialistaId:specialist.id});await solicitarEditor(p.id,specialist.id);}
  const first=await listarAsignacionesEdicion(filters,now),second=await listarAsignacionesEdicion({...filters,page:2},now);
  expect(first).toMatchObject({total:12,pages:2,page:1,counts:{unassigned:12,editing:0,waiting:0,overdue:0,all:12}});expect(first.items).toHaveLength(10);expect(second.items).toHaveLength(2);expect(second.counts).toEqual(first.counts);expect(new Set([...first.items,...second.items].map(i=>i.id)).size).toBe(12);
 });
 it('filtra servicio, intervención, solicitante, fecha, estado, Editor y busca proyecto, autor o capítulo en servidor',async()=>{
  const {specialist,project,item}=await pending();const other=await pending();await db.update(proyectos).set({titulo:'Proyecto Aurora'}).where(eq(proyectos.id,project.id));await db.update(workItems).set({fechaFinPautada:'2026-10-26'}).where(eq(workItems.id,item.id));
  for(const patch of [{service:project.servicioId},{specialist:specialist.id},{date:'2026-10-26'},{search:'Aurora'},{search:item.authors},{interventionType:'default',status:'Pendiente',service:project.servicioId}])expect((await listarAsignacionesEdicion({...filters,...patch},now)).items.map(i=>i.projectId)).toEqual([project.id]);
  expect((await listarAsignacionesEdicion({...filters,date:'2026-10-27'},now)).total).toBe(0);
  const chief=await crearUsuario('jefe_edicion'),editor=await crearUsuario('editor');await asignarEditor(project.id,editor.id,chief.id);await crearCapitulo(project.id,3);await actualizarCapituloEditor(project.id,3,{fechaInicioEditor:'2026-10-01'},editor.id);
  expect((await listarAsignacionesEdicion({...filters,tab:'editing',editor:editor.id,search:'Capítulo 3'},now)).items).toHaveLength(1);
  expect((await listarAsignacionesEdicion({...filters,tab:'all',search:editor.nombre},now)).items).toHaveLength(1);
  expect((await listarAsignacionesEdicion({...filters,tab:'all',service:other.project.servicioId},now)).items).toHaveLength(1);
 });
 it('gates, pausa y stand-by excluyen solicitudes no listas; pausas y esperas no son vencidas accionables',async()=>{
  const {project,item}=await pending();await db.update(workItems).set({estado:'bloqueado',gateBloqueante:'Revisión pendiente'}).where(eq(workItems.id,item.id));expect((await listarAsignacionesEdicion(filters,now)).total).toBe(0);
  await db.update(workItems).set({estado:'pendiente',gateBloqueante:null}).where(eq(workItems.id,item.id));await db.update(proyectos).set({estado:'stand_by'}).where(eq(proyectos.id,project.id));expect((await listarAsignacionesEdicion(filters,now)).total).toBe(0);
  await db.update(proyectos).set({estado:'en_proceso'}).where(eq(proyectos.id,project.id));const chief=await crearUsuario('jefe_edicion'),editor=await crearUsuario('editor');await asignarEditor(project.id,editor.id,chief.id);await crearCapitulo(project.id,1);await actualizarCapituloEditor(project.id,1,{fechaInicioEditor:'2026-10-01'},editor.id);
  await db.insert(pausas).values({proyectoId:project.id,causa:'autor',fechaInicio:new Date('2026-10-02T12:00:00Z')});
  const load=await getEditorLoadSummary(now);expect(load.editors[0]).toMatchObject({activeAssigned:1,actionableNow:0,waitingThirdParty:1,overdue:0});expect((await listarAsignacionesEdicion({...filters,tab:'waiting'},now)).total).toBe(1);
 });
 it('ajusta plazo con pausas cerradas sin duplicar solapamientos ni borrar un atraso previo',()=>{
  const ranges=[{start:'2026-10-20',end:'2026-10-22'},{start:'2026-10-21',end:'2026-10-22'}];
  expect(ajustarPlazoEdicionPorPausas('2026-10-19','2026-10-22',ranges,'2026-10-26')).toBe('2026-10-26');
  expect(ajustarPlazoEdicionPorPausas('2026-10-19','2026-10-22',[{start:'2026-10-23',end:'2026-10-26'}],'2026-10-26')).toBe('2026-10-22');
 });
 it('carga coincide con intervenciones, excluye completadas y distingue autor/Especialista; sin N+1',async()=>{
  const {specialist,project}=await pending(),chief=await crearUsuario('jefe_edicion'),editor=await crearUsuario('editor');await asignarEditor(project.id,editor.id,chief.id);
  for(const n of [1,2,3]){await crearCapitulo(project.id,n);await actualizarCapituloEditor(project.id,n,{fechaInicioEditor:'2026-10-01'},editor.id);}
  await actualizarCapituloEditor(project.id,1,{fechaEntregaEditor:'2026-10-08'},editor.id);await actualizarCapituloEditor(project.id,2,{fechaEntregaEditor:'2026-10-08'},editor.id);await actualizarCapituloAutor(project.id,2,{fechaEnvioAutor:'2026-10-09'},specialist.id);
  const spy=vi.spyOn(Client.prototype,'query');try{const summary=await getEditorLoadSummary(now);expect(spy.mock.calls).toHaveLength(2);expect(summary.editors[0]).toMatchObject({activeAssigned:3,actionableNow:1,waitingThirdParty:2,overdue:1});expect(summary.editors[0]?.nextDeliveries).toHaveLength(0);}finally{spy.mockRestore();}
 });
 it('recomendación determinista ordena varios factores, conserva empates y no emite score',()=>{
  const base={activeAssigned:7,waitingThirdParty:0,nextDeliveries:[],dueThisWeek:1};
  const load:EditorialLoadSummary={today:'2026-10-23',updatedAt:now.toISOString(),editors:[{...base,id:'A',name:'A',actionableNow:7,overdue:1},{...base,id:'B',name:'B',actionableNow:4,overdue:0},{...base,id:'C',name:'C',actionableNow:4,overdue:0}]};
  const r=recommendEditorsForIntervention(load);expect(r.recommendedIds).toEqual(['B','C']);expect(r.candidates.map(e=>e.rank)).toEqual([1,1,3]);expect(r.candidates[0]?.reasons.join(' ')).toContain('4 intervenciones accionables');expect(JSON.stringify(r)).not.toMatch(/score|puntos|Disponible/);expect(recommendEditorsForIntervention({...load,editors:[]})).toMatchObject({recommendedIds:[],candidates:[]});
 });
 it('Editor inactivo desaparece de candidatos y confirmarlo falla sin efectos parciales',async()=>{
  const {project,item}=await pending(),chief=await crearUsuario('jefe_edicion'),editor=await crearUsuario('editor');await db.update(users).set({activo:false}).where(eq(users.id,editor.id));
  expect((await getEditorLoadSummary(now)).editors).toEqual([]);await expect(asignarEditor(project.id,editor.id,chief.id,undefined,null,{interventionId:item.id,workItemId:item.workItemId})).rejects.toThrow('activo');expect(await db.select().from(projectAssignments)).toHaveLength(0);
 });
 it('conflicto de dos decisiones iniciales: sólo una gana; el retry ganador es idempotente',async()=>{
  const {project,item}=await pending(),chief=await crearUsuario('jefe_edicion'),a=await crearUsuario('editor'),b=await crearUsuario('editor');const decision={interventionId:item.id,workItemId:item.workItemId,expectedAssignmentId:null};
  const results=await Promise.allSettled([asignarEditor(project.id,a.id,chief.id,undefined,null,decision),asignarEditor(project.id,b.id,chief.id,undefined,null,decision)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.statusCode).toBe(409);
  const assignments=await db.select().from(projectAssignments);expect(assignments).toHaveLength(1);const winner=assignments[0]!.usuarioId;await asignarEditor(project.id,winner,chief.id,undefined,null,decision);expect(await db.select().from(projectAssignments)).toHaveLength(1);expect(await db.select().from(notificaciones).where(and(eq(notificaciones.proyectoId,project.id),eq(notificaciones.usuarioDestinoId,winner)))).toHaveLength(1);expect((await listarAsignacionesEdicion(filters,now)).total).toBe(0);
 });
 it('revalida gate y scope de work item dentro de la transacción',async()=>{
  const {project,item}=await pending(),other=await pending(),chief=await crearUsuario('jefe_edicion'),editor=await crearUsuario('editor');
  await expect(asignarEditor(project.id,editor.id,chief.id,undefined,null,{interventionId:other.item.id,workItemId:other.item.workItemId})).rejects.toMatchObject({statusCode:404});
  await db.update(workItems).set({gateBloqueante:'Material no recibido'}).where(eq(workItems.id,item.id));await expect(asignarEditor(project.id,editor.id,chief.id,undefined,null,{interventionId:item.id,workItemId:item.workItemId})).rejects.toMatchObject({statusCode:409});expect(await db.select().from(projectAssignments)).toHaveLength(0);
 });
 it('HTTP permite ignorar sugerencia, audita hechos/actor y conserva motivo/history en reasignación',async()=>{
  const app=crearAppDePrueba();await app.ready();try{
   const chiefCookie=await registrarYLoguear(app,'jefe_edicion'),{project,item}=await pending(),a=await crearUsuario('editor'),b=await crearUsuario('editor');
   // A has another actionable project; B is the descriptive suggestion.
   const busy=await crearProyectoDePrueba({editorId:a.id});await db.insert(workItems).values({proyectoId:busy.id,tipo:'edicion',estado:'en_progreso'});
   const candidates=await request(app.server).get(`/api/editores/intervenciones/${item.id}/candidatos`).set('Cookie',chiefCookie);expect(candidates.body.recommendedIds).toEqual([b.id]);
   expect((await request(app.server).patch(`/api/editores/asignaciones/${item.id}`).set('Cookie',chiefCookie).send({editorId:a.id,expectedEditorId:null,expectedAssignmentId:null})).status).toBe(200);
   const event=(await db.select().from(auditLogs).where(eq(auditLogs.accion,'EDITOR_ASIGNADO')))[0]!;expect(event.actorId).toBeTruthy();expect(event.detalles).toMatchObject({nuevo:a.id,recommendation:{rule:'editorial-descriptive-v1',manualOverride:true,selectedFacts:{actionableNow:1}}});
   const assignment=(await db.select().from(projectAssignments))[0]!;
   expect((await request(app.server).patch(`/api/editores/asignaciones/${item.id}`).set('Cookie',chiefCookie).send({editorId:b.id,expectedEditorId:a.id,expectedAssignmentId:assignment.id,reason:'Redistribución revisada por jefatura'})).status).toBe(200);
   const history=await db.select().from(projectAssignments);expect(history).toHaveLength(2);expect(history.find(h=>h.usuarioId===a.id)?.motivoFin).toBe('Redistribución revisada por jefatura');expect(history.filter(h=>!h.finalizadoEn).map(h=>h.usuarioId)).toEqual([b.id]);
  }finally{await app.close();}
 });
 it('RBAC/IDOR y validación de filtros en todas las nuevas lecturas',async()=>{
  const app=crearAppDePrueba();await app.ready();try{const chief=await registrarYLoguear(app,'jefe_edicion'),editor=await registrarYLoguear(app,'editor');
   for(const path of ['/api/editores/asignaciones','/api/editores/equipo','/api/editores/intervenciones/11111111-1111-4111-8111-111111111111/candidatos']){expect((await request(app.server).get(path)).status).toBe(401);expect((await request(app.server).get(path).set('Cookie',editor)).status).toBe(403);}
   expect((await request(app.server).get('/api/editores/asignaciones?service=wrong').set('Cookie',chief)).status).toBe(400);expect((await request(app.server).get('/api/editores/asignaciones?pageSize=10000').set('Cookie',chief)).status).toBe(400);
   const p=await crearProyectoDePrueba();const [foreign]=await db.insert(workItems).values({proyectoId:p.id,tipo:'diseno'}).returning();expect((await request(app.server).get(`/api/editores/intervenciones/${foreign!.id}/candidatos`).set('Cookie',chief)).status).toBe(404);
  }finally{await app.close();}
 });
});
