import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from 'pg';
import request from 'supertest';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../server/db/client.js';
import { auditLogs, notificaciones, projectAssignments, proyectos, users, workItems, fichasTrazabilidad } from '../server/db/schema/index.js';
import { obtenerCommandCenter } from '../server/helpers/projectCommandCenter.js';
import { editorialDashboard, editorialInterventions, editorialActivity } from '../server/helpers/editorialChief.js';
import { actualizarCapituloAutor, actualizarCapituloEditor, crearCapitulo } from '../server/helpers/capitulos.js';
import { asignarEditor, solicitarEditor } from '../server/helpers/proyectos.js';
import { evaluarPlazoEdicion, plazoCapituloEditor } from '../server/helpers/edicionSla.js';
import { crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { registrarYLoguear } from './helpers/auth.js';
import { crearAppDePrueba } from './helpers/testApp.js';
const now=new Date('2026-10-23T16:00:00Z');
describe('Centro de decisiones de Edición',()=>{
 beforeEach(limpiarBaseDeDatos);
 it('cuenta solicitudes explícitas; asignación concurrente es atómica e idempotente y llega a cola',async()=>{
   const [chief,specialist,editor]=await Promise.all([crearUsuario('jefe_edicion'),crearUsuario('especialista'),crearUsuario('editor')]);
   const p=await crearProyectoDePrueba({especialistaId:specialist.id});await crearProyectoDePrueba();
   expect((await editorialDashboard(now)).summary.unassigned).toBe(0);
   await solicitarEditor(p.id,specialist.id);
   const before=await editorialDashboard(now);expect(before.summary).toMatchObject({unassigned:1,pendingRequests:1});expect(before.attentionItems).toHaveLength(1);expect(before.attentionItems[0]!.projectId).toBe(p.id);
   await Promise.all([asignarEditor(p.id,editor.id,chief.id),asignarEditor(p.id,editor.id,chief.id)]);
   const after=await editorialDashboard(now);expect(after.summary).toMatchObject({unassigned:0,pendingRequests:0});expect(after.editorLoads.find(e=>e.id===editor.id)?.active).toBe(1);
   const history=await db.select().from(projectAssignments).where(and(eq(projectAssignments.proyectoId,p.id),eq(projectAssignments.tipo,'editor')));expect(history).toHaveLength(1);
   expect((await editorialInterventions()).filter(i=>i.editorId===editor.id)).toHaveLength(1);
   expect((await db.select().from(notificaciones).where(and(eq(notificaciones.proyectoId,p.id),eq(notificaciones.usuarioDestinoId,editor.id))))).toHaveLength(1);
 });
 it('capítulos independientes: entrega → Especialista → autor no vencido → feedback accionable → entrega',async()=>{
   const [chief,specialist,editor]=await Promise.all([crearUsuario('jefe_edicion'),crearUsuario('especialista'),crearUsuario('editor')]);const p=await crearProyectoDePrueba({especialistaId:specialist.id});
   await solicitarEditor(p.id,specialist.id);await asignarEditor(p.id,editor.id,chief.id);
   await crearCapitulo(p.id,1);await crearCapitulo(p.id,2);
   await actualizarCapituloEditor(p.id,1,{fechaInicioEditor:'2026-10-05'},editor.id);
   await actualizarCapituloEditor(p.id,2,{fechaInicioEditor:'2026-10-20'},editor.id);
   let d=await editorialDashboard(now);expect(d.summary).toMatchObject({overdue:1,atRisk:1});expect(d.editorLoads[0]?.active).toBe(2);
   await actualizarCapituloEditor(p.id,1,{fechaEntregaEditor:'2026-10-08'},editor.id);
   d=await editorialDashboard(now);expect(d.summary.overdue).toBe(0);expect(d.interventionDistribution).toContainEqual({state:'Esperando Especialista',count:1});
   await actualizarCapituloAutor(p.id,1,{fechaEnvioAutor:'2026-10-08'},specialist.id);
   d=await editorialDashboard(now);expect(d.summary.overdue).toBe(0);expect(d.interventionDistribution).toContainEqual({state:'Esperando autor',count:1});expect(d.attentionItems.some(i=>i.chapter===1)).toBe(false);
   await actualizarCapituloAutor(p.id,1,{fechaRespuestaReal:'2026-10-22'},specialist.id);
   const feedback=(await editorialInterventions('2026-10-23')).find(i=>i.chapter===1)!;expect(feedback.state).toBe('Requiere ajustes');expect(feedback.dueDate).toBeNull();expect(feedback.overdue).toBe(false);
   await actualizarCapituloEditor(p.id,1,{fechaEntregaEditor:'2026-10-23'},editor.id);
   expect((await editorialInterventions()).find(i=>i.chapter===1)?.actionable).toBe(false);
   expect((await editorialDashboard(now)).interventionDistribution.reduce((n,x)=>n+x.count,0)).toBe(2);
   const actions=(await editorialActivity()).map(a=>a.text);expect(actions).toContain('Feedback del autor registrado');expect(actions).toContain('Feedback aplicado por Editor');
 });
 it('reasignación mantiene historial y mueve la carga sin reactivar esperas',async()=>{
  const [chief,editor,next,specialist]=await Promise.all([crearUsuario('jefe_edicion'),crearUsuario('editor'),crearUsuario('editor'),crearUsuario('especialista')]);const p=await crearProyectoDePrueba({especialistaId:specialist.id});await solicitarEditor(p.id,specialist.id);await asignarEditor(p.id,editor.id,chief.id);await crearCapitulo(p.id,1);await actualizarCapituloEditor(p.id,1,{fechaEntregaEditor:'2026-10-08'},editor.id);await actualizarCapituloAutor(p.id,1,{fechaEnvioAutor:'2026-10-09'},specialist.id);
  await asignarEditor(p.id,next.id,chief.id,'Redistribución acordada');
  const history=await db.select().from(projectAssignments).where(eq(projectAssignments.proyectoId,p.id));expect(history.filter(h=>!h.finalizadoEn)).toHaveLength(1);expect(history.find(h=>h.usuarioId===editor.id)?.motivoFin).toBe('Redistribución acordada');
  const items=await editorialInterventions();expect(items[0]).toMatchObject({editorId:next.id,state:'Esperando autor',overdue:false});
  await db.insert(fichasTrazabilidad).values({proyectoId:p.id});
  const center=await obtenerCommandCenter(p.id,{id:specialist.id,rol:'especialista'});
  const edition=center.procesos.find(process=>process.tipo==='edicion');
  expect(edition?.estado).toBe('Esperando autor');expect(edition?.trabajos[0]).toMatchObject({stateLabel:'Esperando autor',vencido:false,vence:null});
 });
 it('bloqueos accionables y actividad sólo del dominio; carga de editores activos',async()=>{
   const editor=await crearUsuario('editor'),p=await crearProyectoDePrueba({editorId:editor.id});await db.insert(workItems).values({proyectoId:p.id,tipo:'edicion',businessKey:'kit_editorial',estado:'bloqueado',gateBloqueante:'Falta material',fechaFinPautada:'2026-10-26'});
   await db.insert(auditLogs).values({accion:'PAGO_RECIBIDO',entityType:'proyecto',entityId:p.id,proyectoId:p.id});
   const d=await editorialDashboard(now);expect(d.attentionItems[0]).toMatchObject({situation:'Bloqueada',cta:'Ver bloqueo'});expect(d.upcomingDeliveries).toHaveLength(1);expect(await editorialActivity()).toEqual([]);
   await db.update(users).set({activo:false}).where(eq(users.id,editor.id));expect((await editorialDashboard(now)).editorLoads).toEqual([]);
 });
 it('SLA central de días hábiles, riesgo hoy, espera excluida',()=>{
   expect(plazoCapituloEditor('2026-10-23')).toBe('2026-10-28');expect(evaluarPlazoEdicion('2026-10-22',false,'2026-10-23')).toEqual({overdue:false,atRisk:false});expect(evaluarPlazoEdicion('2026-10-23',true,'2026-10-23').atRisk).toBe(true);
 });
 it('feedback en el mismo día queda auditado una vez; un cambio documental no restaura el SLA anterior',async()=>{
   const [chief,specialist,editor]=await Promise.all([crearUsuario('jefe_edicion'),crearUsuario('especialista'),crearUsuario('editor')]);const p=await crearProyectoDePrueba({especialistaId:specialist.id});await solicitarEditor(p.id,specialist.id);await asignarEditor(p.id,editor.id,chief.id);await crearCapitulo(p.id,1);
   await actualizarCapituloEditor(p.id,1,{fechaInicioEditor:'2026-10-01',fechaEntregaEditor:'2026-10-23'},editor.id);
   await actualizarCapituloAutor(p.id,1,{fechaEnvioAutor:'2026-10-23',fechaRespuestaReal:'2026-10-23'},specialist.id);
   await actualizarCapituloAutor(p.id,1,{fechaPautadaFeedback:'2026-10-27'},specialist.id);await actualizarCapituloAutor(p.id,1,{enlaces:['https://drive.test/feedback']},specialist.id);
   expect((await editorialInterventions('2026-10-23'))[0]).toMatchObject({state:'Requiere ajustes',dueDate:null,overdue:false});
   await actualizarCapituloEditor(p.id,1,{fechaEntregaEditor:'2026-10-23'},editor.id);await actualizarCapituloEditor(p.id,1,{fechaEntregaEditor:'2026-10-23'},editor.id);
   expect((await db.select().from(auditLogs).where(and(eq(auditLogs.proyectoId,p.id),eq(auditLogs.accion,'CAPITULO_FEEDBACK_APLICADO'))))).toHaveLength(1);
 });
 it('un fallo de notificación revierte asignación, historial y resolución de solicitud',async()=>{
   const [chief,specialist,editor]=await Promise.all([crearUsuario('jefe_edicion'),crearUsuario('especialista'),crearUsuario('editor')]);const p=await crearProyectoDePrueba({especialistaId:specialist.id});await solicitarEditor(p.id,specialist.id);
   const original=Client.prototype.query,spy=vi.spyOn(Client.prototype,'query');spy.mockImplementation(function(this:Client,...args:unknown[]){const query=typeof args[0]==='string'?args[0]:String((args[0] as {text?:string})?.text);if(query.startsWith('insert into "notificaciones"'))return Promise.reject(new Error('QA notification failed'));return Reflect.apply(original,this,args);} as typeof original);
   try{await expect(asignarEditor(p.id,editor.id,chief.id)).rejects.toThrow('notification failed');}finally{spy.mockRestore();}
   expect((await db.select().from(projectAssignments)).length).toBe(0);expect((await editorialDashboard(now)).summary.pendingRequests).toBe(1);expect((await db.select().from(proyectos).where(eq(proyectos.id,p.id)))[0]?.editorId).toBeNull();
 });
 it('dos consultas con dos o catorce Editores; historial vigente gana sobre FK obsoleta',async()=>{
  const [chief,specialist,editor,other]=await Promise.all([crearUsuario('jefe_edicion'),crearUsuario('especialista'),crearUsuario('editor'),crearUsuario('editor')]);const p=await crearProyectoDePrueba({especialistaId:specialist.id});await solicitarEditor(p.id,specialist.id);await asignarEditor(p.id,editor.id,chief.id);await db.update(proyectos).set({editorId:other.id}).where(eq(proyectos.id,p.id));
  const count=async()=>{const spy=vi.spyOn(Client.prototype,'query');try{const data=await editorialDashboard(now);return {data,count:spy.mock.calls.length};}finally{spy.mockRestore();}};
  const before=await count();expect(before.data.editorLoads.find(e=>e.id===editor.id)?.active).toBe(1);expect(before.data.editorLoads.find(e=>e.id===other.id)?.active).toBe(0);expect(before.count).toBe(2);
  await db.insert(users).values(Array.from({length:12},(_,n)=>({email:`qa-editor-${n}@test.local`,nombre:`Editor ${n}`,rol:'editor' as const,passwordHash:'session-only'})));
  expect((await count()).count).toBe(before.count);
 });
 it('RBAC, IDOR, validación de Editor, reasignación con motivo y lectura paginada',async()=>{
   const app=crearAppDePrueba();await app.ready();
   expect((await request(app.server).get('/api/editores/inicio')).status).toBe(401);
   const chief=await registrarYLoguear(app,'jefe_edicion'),editorCookie=await registrarYLoguear(app,'editor'),spec=await crearUsuario('especialista');
   expect((await request(app.server).get('/api/editores/inicio').set('Cookie',editorCookie)).status).toBe(403);
   expect((await request(app.server).get('/api/editores/intervenciones/11111111-1111-4111-8111-111111111111').set('Cookie',chief)).status).toBe(404);
   expect((await request(app.server).get('/api/editores/intervenciones?editor=oops').set('Cookie',chief)).status).toBe(400);
   const p=await crearProyectoDePrueba({especialistaId:spec.id});await solicitarEditor(p.id,spec.id);
   const dash=await request(app.server).get('/api/editores/inicio').set('Cookie',chief);expect(dash.status,dash.text).toBe(200);const id=dash.body.attentionItems[0].id;
   expect((await request(app.server).patch('/api/editores/asignaciones/'+id).set('Cookie',chief).send({editorId:spec.id})).status).toBe(400);
   expect((await request(app.server).patch('/api/editores/mi-trabajo/'+id+'/entrega').set('Cookie',chief).send({date:'2026-10-23'})).status).toBe(403);
   expect((await request(app.server).patch('/api/editores/mi-trabajo/'+id+'/entrega').set('Cookie',editorCookie).send({date:'2026-10-23'})).status).toBe(404);
   const editor=await crearUsuario('editor');expect((await request(app.server).patch('/api/editores/asignaciones/'+id).set('Cookie',chief).send({editorId:editor.id})).status).toBe(200);
   const other=await crearUsuario('editor');expect((await request(app.server).patch('/api/editores/asignaciones/'+id).set('Cookie',chief).send({editorId:other.id})).status).toBe(400);
   const list=await request(app.server).get('/api/editores/intervenciones?pageSize=1').set('Cookie',chief);expect(list.body.items).toHaveLength(1);
   await app.close();
 });
});
