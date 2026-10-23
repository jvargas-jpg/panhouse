import {beforeEach,describe,expect,it} from 'vitest';
import request from 'supertest';
import {eq} from 'drizzle-orm';
import {db} from '../server/db/client.js';
import {auditLogs,proyectos} from '../server/db/schema/index.js';
import {crearUsuario,crearProyectoDePrueba} from './helpers/fixtures.js';
import {limpiarBaseDeDatos} from './helpers/db.js';
import {crearAppDePrueba} from './helpers/testApp.js';
import {registrarYLoguear} from './helpers/auth.js';
import {asignarEditor,solicitarEditor} from '../server/helpers/proyectos.js';
import {crearCapitulo,actualizarCapituloEditor} from '../server/helpers/capitulos.js';
import {editorialInterventions} from '../server/helpers/editorialChief.js';
import {listarSolicitudesEdicion,obtenerSolicitudEdicionDetalle} from '../server/helpers/editorialRequests.js';
import type {EditorialRequestFilters} from '../shared/editorialChief.js';

const now=new Date('2026-10-23T16:00:00Z');
const filters:EditorialRequestFilters={tab:'pending',search:'',page:1,pageSize:10,sort:'oldest'};
async function pending(){const specialist=await crearUsuario('especialista'),project=await crearProyectoDePrueba({especialistaId:specialist.id});await solicitarEditor(project.id,specialist.id);return {specialist,project,item:(await editorialInterventions()).find(i=>i.projectId===project.id)!};}

beforeEach(limpiarBaseDeDatos);

describe('Solicitudes · bandeja de decisiones de Edición',()=>{
 it('único tipo real respaldado: una solicitud nace de EDITOR_SOLICITADO y cuenta como pendiente',async()=>{
  const {project}=await pending();
  const list=await listarSolicitudesEdicion(filters,now);
  expect(list.counts).toMatchObject({pending:1,resolved:0,all:1});
  expect(list.items[0]).toMatchObject({projectId:project.id,status:'pendiente',resolvedAt:null,resultEditor:null});
 });
 it('pedir Editor dos veces no duplica la solicitud (idempotencia de solicitarEditor)',async()=>{
  const {specialist,project}=await pending();
  await solicitarEditor(project.id,specialist.id);
  expect(await db.select().from(auditLogs).where(eq(auditLogs.accion,'EDITOR_SOLICITADO'))).toHaveLength(1);
  expect((await listarSolicitudesEdicion(filters,now)).counts.pending).toBe(1);
 });
 it('consultar el detalle no cambia el estado de la solicitud (no es una acción, es lectura)',async()=>{
  const {project,item}=await pending();
  await obtenerSolicitudEdicionDetalle(item.id,now);
  await obtenerSolicitudEdicionDetalle(item.id,now);
  const list=await listarSolicitudesEdicion(filters,now);
  expect(list.items.find(r=>r.projectId===project.id)?.status).toBe('pendiente');
 });
 it('al asignar Editor la solicitud pasa a resuelta con el resultado correcto y sale de pendientes',async()=>{
  const {project,item}=await pending(),chief=await crearUsuario('jefe_edicion'),editor=await crearUsuario('editor');
  await asignarEditor(project.id,editor.id,chief.id);
  const pendingList=await listarSolicitudesEdicion(filters,now);
  expect(pendingList.items.some(r=>r.projectId===project.id)).toBe(false);
  const resolvedList=await listarSolicitudesEdicion({...filters,tab:'resolved'},now);
  const row=resolvedList.items.find(r=>r.projectId===project.id);
  expect(row).toMatchObject({status:'resuelta',resultEditor:editor.nombre,resultEditorId:editor.id,resolvedBy:chief.nombre});
  expect(row?.resolvedAt).toBeTruthy();
  const detail=await obtenerSolicitudEdicionDetalle(item.id,now);
  expect(detail?.summary.status).toBe('resuelta');
  expect(detail?.history.some(h=>h.label&&h.at)).toBe(true);
 });
 it('reasignar después de resolver conserva una sola solicitud resuelta, con el Editor de la asignación original (la reasignación es otra decisión, no reabre la solicitud)',async()=>{
  const {project}=await pending(),chief=await crearUsuario('jefe_edicion'),a=await crearUsuario('editor'),b=await crearUsuario('editor');
  await asignarEditor(project.id,a.id,chief.id);
  await asignarEditor(project.id,b.id,chief.id,'Redistribución',a.id);
  const resolvedList=await listarSolicitudesEdicion({...filters,tab:'resolved'},now);
  const rows=resolvedList.items.filter(r=>r.projectId===project.id);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({resultEditor:a.nombre});
 });
 it('contexto operativo es null cuando el proyecto ya avanzó a capítulos (la intervención contenedora original sale de alcance)',async()=>{
  const {project,item}=await pending(),chief=await crearUsuario('jefe_edicion'),editor=await crearUsuario('editor');
  await asignarEditor(project.id,editor.id,chief.id);
  await crearCapitulo(project.id,1);await actualizarCapituloEditor(project.id,1,{fechaInicioEditor:'2026-10-01'},editor.id);
  const detail=await obtenerSolicitudEdicionDetalle(item.id,now);
  expect(detail).not.toBeNull();
  expect(detail?.context).toBeNull();
  expect(detail?.summary.status).toBe('resuelta');
 });
 it('solicitud de un proyecto cerrado no aparece en resueltas (mismo criterio de "proyecto activo" que el resto del dominio)',async()=>{
  const {project}=await pending(),chief=await crearUsuario('jefe_edicion'),editor=await crearUsuario('editor');
  await asignarEditor(project.id,editor.id,chief.id);
  await db.update(proyectos).set({estado:'culminado'}).where(eq(proyectos.id,project.id));
  const resolvedList=await listarSolicitudesEdicion({...filters,tab:'resolved',pageSize:200},now);
  expect(resolvedList.items.some(r=>r.projectId===project.id)).toBe(false);
 });
 it('filtra por servicio, solicitante, rango de fechas y busca proyecto/autor/solicitante en servidor',async()=>{
  const {specialist,project}=await pending();await db.update(proyectos).set({titulo:'Proyecto Aurora'}).where(eq(proyectos.id,project.id));
  const other=await pending();
  expect((await listarSolicitudesEdicion({...filters,service:project.servicioId},now)).items.map(i=>i.projectId)).toEqual([project.id]);
  expect((await listarSolicitudesEdicion({...filters,requester:specialist.id},now)).items.map(i=>i.projectId)).toEqual([project.id]);
  expect((await listarSolicitudesEdicion({...filters,search:'Aurora'},now)).items.map(i=>i.projectId)).toEqual([project.id]);
  expect((await listarSolicitudesEdicion({...filters,search:specialist.nombre},now)).items.map(i=>i.projectId)).toEqual([project.id]);
  expect((await listarSolicitudesEdicion({...filters,from:'2026-10-24'},now)).total).toBe(0);
  expect((await listarSolicitudesEdicion({...filters,tab:'all'},now)).total).toBe(2);
  expect((await listarSolicitudesEdicion({...filters,tab:'all',service:other.project.servicioId},now)).items).toHaveLength(1);
 });
 it('paginación y conteos corresponden al conjunto filtrado completo, no a la página visible',async()=>{
  const specialist=await crearUsuario('especialista');
  for(let i=0;i<12;i++){const p=await crearProyectoDePrueba({especialistaId:specialist.id});await solicitarEditor(p.id,specialist.id);}
  const first=await listarSolicitudesEdicion(filters,now),second=await listarSolicitudesEdicion({...filters,page:2},now);
  expect(first).toMatchObject({total:12,pages:2,page:1,counts:{pending:12,resolved:0,all:12}});
  expect(first.items).toHaveLength(10);expect(second.items).toHaveLength(2);
  expect(new Set([...first.items,...second.items].map(i=>i.id)).size).toBe(12);
 });
 it('HTTP: RBAC exige sesión y rol jefe_edicion; IDOR responde 404',async()=>{
  const app=crearAppDePrueba();await app.ready();try{
   const chief=await registrarYLoguear(app,'jefe_edicion'),editor=await registrarYLoguear(app,'editor');
   expect((await request(app.server).get('/api/editores/solicitudes')).status).toBe(401);
   expect((await request(app.server).get('/api/editores/solicitudes').set('Cookie',editor)).status).toBe(403);
   expect((await request(app.server).get('/api/editores/solicitudes').set('Cookie',chief)).status).toBe(200);
   expect((await request(app.server).get('/api/editores/solicitudes/00000000-0000-4000-8000-000000000000').set('Cookie',chief)).status).toBe(404);
   expect((await request(app.server).get('/api/editores/solicitudes?pageSize=999').set('Cookie',chief)).status).toBe(400);
  }finally{await app.close();}
 });
 it('HTTP: la solicitud listada se resuelve con el mismo endpoint de decisión que usa Asignaciones y carga',async()=>{
  const app=crearAppDePrueba();await app.ready();try{
   const chiefCookie=await registrarYLoguear(app,'jefe_edicion'),{project,item}=await pending(),editor=await crearUsuario('editor');
   const list=await request(app.server).get('/api/editores/solicitudes').set('Cookie',chiefCookie);
   expect(list.body.items[0].id).toBe(item.id);
   const decide=await request(app.server).patch(`/api/editores/asignaciones/${item.id}`).set('Cookie',chiefCookie).send({editorId:editor.id,expectedEditorId:null});
   expect(decide.status).toBe(200);
   const after=await request(app.server).get('/api/editores/solicitudes?tab=resolved').set('Cookie',chiefCookie);
   expect(after.body.items.find((r:{projectId:string})=>r.projectId===project.id)).toMatchObject({resultEditor:editor.nombre});
  }finally{await app.close();}
 });
});
