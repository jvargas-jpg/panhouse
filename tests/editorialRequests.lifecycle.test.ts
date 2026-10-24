import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { db, pool } from '../server/db/client.js';
import { auditLogs, notificaciones, projectAssignments, proyectos, solicitudesArea, workItems } from '../server/db/schema/index.js';
import { crearUsuario, crearProyectoDePrueba } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAppDePrueba } from './helpers/testApp.js';
import { registrarYLoguear } from './helpers/auth.js';
import { asignarEditor, solicitarEditor } from '../server/helpers/proyectos.js';
import { editorialDashboard } from '../server/helpers/editorialChief.js';
import { devolverSolicitudEdicion, listarSolicitudesEdicion, obtenerSolicitudEdicionDetalle } from '../server/helpers/editorialRequests.js';
import { detalleSolicitud } from '../server/helpers/especialistaSolicitudes.js';
import { getEditorLoadSummary, recommendEditorsForIntervention } from '../server/helpers/editorialAssignments.js';
import type { EditorialRequestFilters } from '../shared/editorialChief.js';
import { readFile } from 'node:fs/promises';

const filters:EditorialRequestFilters={tab:'pending',search:'',page:1,pageSize:10,sort:'oldest'};
async function setup(){
 const specialist=await crearUsuario('especialista'),chief=await crearUsuario('jefe_edicion');
 const project=await crearProyectoDePrueba({especialistaId:specialist.id});await solicitarEditor(project.id,specialist.id);
 const s=(await listarSolicitudesEdicion(filters)).items[0]!;
 return {specialist,chief,project,s,actor:{id:chief.id,rol:chief.rol}};
}
beforeEach(limpiarBaseDeDatos);
describe('Solicitudes · lifecycle independiente y decisión central',()=>{
 it('una pausa o gate no oculta una decisión pendiente: puede devolverse aunque no esté lista para asignar',async()=>{
  const {s,actor,project,chief}=await setup();
  await db.update(proyectos).set({estado:'pausado'}).where(eq(proyectos.id,project.id));
  await db.update(workItems).set({estado:'bloqueado',gateBloqueante:'Material por completar'}).where(eq(workItems.id,s.workItemId));
  expect((await listarSolicitudesEdicion(filters)).items[0]).toMatchObject({id:s.id,actionable:true,assignmentReady:false});
  expect((await editorialDashboard()).summary).toMatchObject({pendingRequests:1,unassigned:0});
  expect((await obtenerSolicitudEdicionDetalle(s.id))?.recommendationSummary).toBeNull();
  const editor=await crearUsuario('editor');
  await expect(asignarEditor(project.id,editor.id,chief.id)).rejects.toMatchObject({statusCode:409});
  await devolverSolicitudEdicion(s.id,actor,'Completar el material antes de asignar.',s.version);
  expect((await editorialDashboard()).summary.pendingRequests).toBe(0);
 });
 it('migra solicitudes legacy sin cambiar ID, solicitante, fecha ni duplicar hechos',async()=>{
  const {s,chief,project}=await setup(),editor=await crearUsuario('editor');
  await db.delete(solicitudesArea).where(eq(solicitudesArea.id,s.id));
  await asignarEditor(project.id,editor.id,chief.id);
  const sql=await readFile('server/db/migrations/0087_editor_request_lifecycle.sql','utf8');
  const backfill=sql.slice(sql.indexOf('INSERT INTO solicitudes_area'));
  await pool.query(backfill);await pool.query(backfill);
  const [r]=await db.select().from(solicitudesArea).where(eq(solicitudesArea.id,s.id));
  expect(r).toMatchObject({id:s.id,workItemId:s.workItemId,requestedById:s.requesterId,estado:'resuelta'});
  expect(r?.requestedAt.toISOString()).toBe(s.requestedAt);
  expect((await obtenerSolicitudEdicionDetalle(s.id))?.summary.resultEditorId).toBe(editor.id);
  expect((await db.select().from(auditLogs).where(eq(auditLogs.accion,'EDITOR_SOLICITADO')))).toHaveLength(1);
 });
 it('separa el estado de decisión del trabajo y deduplica dos pedidos concurrentes',async()=>{
  const specialist=await crearUsuario('especialista'),project=await crearProyectoDePrueba({especialistaId:specialist.id});
  await Promise.all([solicitarEditor(project.id,specialist.id),solicitarEditor(project.id,specialist.id)]);
  const requests=await db.select().from(solicitudesArea).where(eq(solicitudesArea.tipo,'editor'));
  const works=await db.select().from(workItems).where(eq(workItems.tipo,'edicion'));
  expect(requests).toHaveLength(1);expect(works).toHaveLength(1);
  expect(requests[0]).toMatchObject({estado:'pendiente',workItemId:works[0]!.id,requestedById:specialist.id});
  expect((await db.select().from(auditLogs).where(eq(auditLogs.accion,'EDITOR_SOLICITADO')))).toHaveLength(1);
 });
 it('abrir el detalle no escribe; recomendación es un resumen de la fuente central',async()=>{
  const {s}=await setup();await crearUsuario('editor');
  const before=await db.select().from(auditLogs);
  const detail=await obtenerSolicitudEdicionDetalle(s.id),central=recommendEditorsForIntervention(await getEditorLoadSummary());
  expect(await db.select().from(auditLogs)).toHaveLength(before.length);
  expect(detail?.summary.status).toBe('pendiente');
  expect(detail?.recommendationSummary?.editor?.id).toBe(central.recommendedIds[0]);
  expect(detail?.recommendationSummary?.rule).toBe(central.rule);
  expect(detail?.recommendationSummary).not.toHaveProperty('candidates');
 });
 it('asignar resuelve la petición, activa trabajo y devuelve IDs reales e historial correlacionado',async()=>{
  const {s,chief,project,specialist}=await setup(),editor=await crearUsuario('editor');
  await asignarEditor(project.id,editor.id,chief.id);await asignarEditor(project.id,editor.id,chief.id);
  const [r]=await db.select().from(solicitudesArea).where(eq(solicitudesArea.id,s.id));
  const [w]=await db.select().from(workItems).where(eq(workItems.id,s.workItemId));
  const assignments=await db.select().from(projectAssignments).where(eq(projectAssignments.tipo,'editor'));
  const detail=await obtenerSolicitudEdicionDetalle(s.id);
  expect(r).toMatchObject({estado:'resuelta',resolvedById:chief.id,version:2});expect(w?.estado).toBe('en_progreso');
  expect(assignments).toHaveLength(1);expect(detail?.summary.resultAssignmentId).toBe(assignments[0]!.id);
  expect(detail?.summary.resultWorkItemId).toBe(w!.id);
  expect(detail?.history.map(e=>e.label)).toEqual(['Solicitud de Editor recibida','Editor asignado']);
  expect((await db.select().from(notificaciones).where(eq(notificaciones.usuarioDestinoId,editor.id)))).toHaveLength(1);
  expect((await db.select().from(notificaciones).where(eq(notificaciones.usuarioDestinoId,specialist.id)))).toHaveLength(1);
  const nextSpecialist=await crearUsuario('especialista'),nextEditor=await crearUsuario('editor');
  await db.update(proyectos).set({especialistaId:nextSpecialist.id}).where(eq(proyectos.id,project.id));
  await asignarEditor(project.id,nextEditor.id,chief.id,'Redistribución tras cambio de Especialista',editor.id);
  expect((await db.select().from(notificaciones).where(eq(notificaciones.usuarioDestinoId,specialist.id)))).toHaveLength(1);
  expect((await db.select().from(notificaciones).where(eq(notificaciones.usuarioDestinoId,nextSpecialist.id)))).toHaveLength(1);
  expect((await obtenerSolicitudEdicionDetalle(s.id))?.summary.resultEditorId).toBe(editor.id);
  await db.update(workItems).set({estado:'cancelado'}).where(eq(workItems.id,s.workItemId));
  expect((await obtenerSolicitudEdicionDetalle(s.id))?.summary.status).toBe('resuelta');
  expect((await detalleSolicitud(s.id,{id:nextSpecialist.id,rol:'especialista'})).estado).toBe('resuelta');
 });
 it('devolver conserva motivo, avisa al solicitante y reduce Inicio y pendientes a la vez',async()=>{
  const {s,actor,specialist}=await setup();
  await devolverSolicitudEdicion(s.id,actor,'Falta precisar la intervención y el material.',s.version);
  expect((await obtenerSolicitudEdicionDetalle(s.id))?.summary).toMatchObject({status:'devuelta',returnReason:'Falta precisar la intervención y el material.',version:2,actionable:false});
  expect((await listarSolicitudesEdicion(filters)).pendingTotal).toBe(0);
  expect((await editorialDashboard()).summary.pendingRequests).toBe(0);
  const owner=await detalleSolicitud(s.id,{id:specialist.id,rol:'especialista'});
  expect(owner).toMatchObject({estado:'requiere_informacion',requiresUserAction:true,outcome:'Falta precisar la intervención y el material.'});
  expect((await db.select().from(notificaciones).where(eq(notificaciones.usuarioDestinoId,specialist.id)))).toHaveLength(1);
 });
 it('reenviar conserva request, fecha y pedido original y rechaza una decisión anterior a la devolución',async()=>{
  const {s,actor,specialist,project,chief}=await setup();await devolverSolicitudEdicion(s.id,actor,'Completar el contexto del proyecto.',s.version);
  await solicitarEditor(project.id,specialist.id);await solicitarEditor(project.id,specialist.id);
  expect((await obtenerSolicitudEdicionDetalle(s.id))?.summary).toMatchObject({id:s.id,status:'pendiente',version:3,requestedAt:s.requestedAt});
  expect((await db.select().from(auditLogs).where(eq(auditLogs.accion,'EDITOR_SOLICITADO')))).toHaveLength(1);
  const editor=await crearUsuario('editor');
  await expect(asignarEditor(project.id,editor.id,chief.id,undefined,null,{interventionId:s.workItemId,workItemId:s.workItemId,expectedRequestVersion:1})).rejects.toMatchObject({statusCode:409});
  expect((await editorialDashboard()).summary.pendingRequests).toBe(1);
 });
 it('protege la concurrencia entre devolución y asignación con el mismo bloqueo de proyecto',async()=>{
  const {s,actor,project,chief}=await setup(),editor=await crearUsuario('editor');
  const results=await Promise.allSettled([
   devolverSolicitudEdicion(s.id,actor,'Revisar el material antes de continuar.',s.version),
   asignarEditor(project.id,editor.id,chief.id,undefined,null,{interventionId:s.workItemId,workItemId:s.workItemId,expectedRequestVersion:s.version}),
  ]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{statusCode:409}});
  const detail=await obtenerSolicitudEdicionDetalle(s.id),assignments=await db.select().from(projectAssignments).where(eq(projectAssignments.tipo,'editor'));
  expect(['devuelta','resuelta']).toContain(detail?.summary.status);
  expect(assignments).toHaveLength(detail?.summary.status==='resuelta'?1:0);
 });
 it('una devolución repetida o sin motivo no duplica transición ni notificación',async()=>{
  const {s,actor}=await setup();
  await expect(devolverSolicitudEdicion(s.id,actor,'  ',s.version)).rejects.toMatchObject({statusCode:400});
  const results=await Promise.allSettled([devolverSolicitudEdicion(s.id,actor,'Falta el material de edición.',s.version),devolverSolicitudEdicion(s.id,actor,'Falta el material de edición.',s.version)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect((await db.select().from(auditLogs).where(eq(auditLogs.accion,'EDITOR_SOLICITUD_DEVUELTA')))).toHaveLength(1);
 });
 it('filtros por día usan Caracas incluso alrededor de medianoche UTC; búsqueda por intervención y notas',async()=>{
  const {s}=await setup();await db.update(solicitudesArea).set({requestedAt:new Date('2026-10-24T02:00:00Z')}).where(eq(solicitudesArea.id,s.id));
  await db.update(workItems).set({observaciones:'Material transcrito y validado'}).where(eq(workItems.id,s.workItemId));
  expect((await listarSolicitudesEdicion({...filters,from:'2026-10-23',to:'2026-10-23'})).total).toBe(1);
  expect((await listarSolicitudesEdicion({...filters,from:'2026-10-24'})).total).toBe(0);
  expect((await listarSolicitudesEdicion({...filters,search:'Inicio de edicion'})).total).toBe(1);
  expect((await listarSolicitudesEdicion({...filters,search:'transcrito'})).total).toBe(1);
  expect((await listarSolicitudesEdicion({...filters,search:'%'})).total).toBe(0);
 });
 it('KPI global no cambia con filtros y coincide con Inicio; no suma histórico ni devueltas',async()=>{
  const {s,actor}=await setup();const other=await crearProyectoDePrueba({especialistaId:(await crearUsuario('especialista')).id});await solicitarEditor(other.id,other.especialistaId!);
  const filtered=await listarSolicitudesEdicion({...filters,search:'inexistente'});
  expect(filtered).toMatchObject({total:0,pendingTotal:2});
  await devolverSolicitudEdicion(s.id,actor,'Revisar el contexto pendiente.',s.version);
  expect((await listarSolicitudesEdicion(filters)).pendingTotal).toBe((await editorialDashboard()).summary.pendingRequests);
 });
 it('archivos limitados al manuscrito real y sin enlaces ejecutables',async()=>{
  const {s,project}=await setup();await db.update(proyectos).set({manuscritoUrl:'https://docs.google.com/document/d/qa-manuscript'}).where(eq(proyectos.id,project.id));
  expect((await obtenerSolicitudEdicionDetalle(s.id))?.files).toEqual([{label:'Manuscrito del proyecto',url:'https://docs.google.com/document/d/qa-manuscript'}]);
  await db.update(proyectos).set({manuscritoUrl:'javascript:alert(1)'}).where(eq(proyectos.id,project.id));
  expect((await obtenerSolicitudEdicionDetalle(s.id))?.files).toEqual([]);
 });
 it('lista hace una consulta SQL por página, sin consultas por fila',async()=>{
  await setup();const spy=vi.spyOn(pool,'query');try{await listarSolicitudesEdicion({...filters,pageSize:25});expect(spy).toHaveBeenCalledTimes(1);}finally{spy.mockRestore();}
 });
 it('HTTP protege devolución y valida versión, rango y IDs ajenos',async()=>{
  const app=crearAppDePrueba();await app.ready();try{
   const {s}=await setup(),chief=await registrarYLoguear(app,'jefe_edicion'),editor=await registrarYLoguear(app,'editor');
   const path=`/api/editores/solicitudes/${s.id}/devolver`,body={reason:'Completar el contexto requerido.',expectedVersion:1};
   expect((await request(app.server).post(path).send(body)).status).toBe(401);
   expect((await request(app.server).post(path).set('Cookie',editor).send(body)).status).toBe(403);
   expect((await request(app.server).post(path).set('Cookie',chief).send({...body,expectedVersion:4})).status).toBe(409);
   expect((await request(app.server).get('/api/editores/solicitudes?from=2026-10-24&to=2026-10-23').set('Cookie',chief)).status).toBe(400);
   const [foreign]=await db.insert(workItems).values({proyectoId:s.projectId,tipo:'diseno'}).returning();
   expect((await request(app.server).get(`/api/editores/solicitudes/${foreign!.id}`).set('Cookie',chief)).status).toBe(404);
   expect((await request(app.server).post(`/api/editores/solicitudes/${foreign!.id}/devolver`).set('Cookie',chief).send(body)).status).toBe(404);
   expect((await request(app.server).post(path).set('Cookie',chief).send(body)).status).toBe(200);
  }finally{await app.close();}
 });
 it('HTTP cruza Especialista → Solicitudes → decisión central → cola de Editor → resultado del solicitante',async()=>{
  const app=crearAppDePrueba();await app.ready();try{
   const specialistCookie=await registrarYLoguear(app,'especialista'),chiefCookie=await registrarYLoguear(app,'jefe_edicion'),editorCookie=await registrarYLoguear(app,'editor');
   const specialist=(await request(app.server).get('/api/auth/me').set('Cookie',specialistCookie)).body.user;
   const editor=(await request(app.server).get('/api/auth/me').set('Cookie',editorCookie)).body.user;
   const project=await crearProyectoDePrueba({especialistaId:specialist.id});
   expect((await request(app.server).post(`/api/proyectos/${project.id}/solicitar-editor`).set('Cookie',specialistCookie)).status).toBe(201);
   const list=await request(app.server).get('/api/editores/solicitudes').set('Cookie',chiefCookie),s=list.body.items[0];
   expect(list.body.pendingTotal).toBe(1);
   const body={editorId:editor.id,expectedEditorId:null,expectedAssignmentId:null,expectedRequestVersion:s.version};
   expect((await request(app.server).patch(`/api/editores/asignaciones/${s.workItemId}`).set('Cookie',chiefCookie).send(body)).status).toBe(200);
   expect((await request(app.server).patch(`/api/editores/asignaciones/${s.workItemId}`).set('Cookie',chiefCookie).send(body)).status).toBe(200);
   const queue=await request(app.server).get('/api/editores/mi-trabajo').set('Cookie',editorCookie);
   expect(queue.body.items.some((i:{projectId:string})=>i.projectId===project.id)).toBe(true);
   const resolved=await request(app.server).get(`/api/editores/solicitudes/${s.id}`).set('Cookie',chiefCookie);
   expect(resolved.body.summary).toMatchObject({status:'resuelta',resultEditorId:editor.id});
   const outbox=await request(app.server).get(`/api/especialistas/solicitudes/${s.id}`).set('Cookie',specialistCookie);
   expect(outbox.body.estado).toBe('resuelta');expect(outbox.body.outcome).toContain(editor.nombre);
   expect((await request(app.server).get('/api/editores/inicio').set('Cookie',chiefCookie)).body.summary.pendingRequests).toBe(0);
   const alerts=await request(app.server).get('/api/notificaciones').set('Cookie',editorCookie);
   expect(alerts.body.notificaciones).toHaveLength(1);
  }finally{await app.close();}
 });
});
