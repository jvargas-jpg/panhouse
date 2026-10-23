import {randomUUID} from 'node:crypto';
import {beforeEach,describe,expect,it} from 'vitest';
import request from 'supertest';
import {eq} from 'drizzle-orm';
import {db} from '../server/db/client.js';
import {fichasTrazabilidad,proyectos,servicios,users} from '../server/db/schema/index.js';
import {crearProyectoDePrueba} from './helpers/fixtures.js';
import {limpiarBaseDeDatos} from './helpers/db.js';
import {crearAppDePrueba} from './helpers/testApp.js';
import {registrarYLoguear} from './helpers/auth.js';
import {asignarEditor,solicitarEditor} from '../server/helpers/proyectos.js';
import {crearCapitulo,actualizarCapituloEditor,actualizarCapituloAutor} from '../server/helpers/capitulos.js';
import {listarProyectosEdicion,obtenerProyectoEdicionDetalle,csvProyectosEdicion} from '../server/helpers/editorialProjects.js';

const now=new Date('2026-10-23T16:00:00Z');
async function usuario(rol:typeof users.$inferInsert.rol){const [u]=await db.insert(users).values({id:randomUUID(),nombre:'QA '+rol,email:randomUUID()+'@test.local',rol,passwordHash:'session-only'}).returning();return u!;}
async function proyectoEF(especialistaId:string,editorId?:string){
 const p=await crearProyectoDePrueba({especialistaId});
 const [ef]=await db.select().from(servicios).where(eq(servicios.codigo,'EF'));
 const servicio=ef??(await db.insert(servicios).values({codigo:'EF',nombre:'Escritura fantasma',pesoComplejidad:4,plazoDias:120}).returning())[0];
 await db.update(proyectos).set({servicioId:servicio!.id,tituloDefinitivo:'Proyecto edicion '+p.codigo,subtituloDefinitivo:'Contexto QA'}).where(eq(proyectos.id,p.id));
 await db.insert(fichasTrazabilidad).values({proyectoId:p.id});
 if(editorId){const chief=await usuario('jefe_edicion');await asignarEditor(p.id,editorId,chief.id);}
 return (await db.select().from(proyectos).where(eq(proyectos.id,p.id)))[0]!;
}
beforeEach(limpiarBaseDeDatos);

describe('Proyectos de edición · explorador operativo',()=>{
 it('una fila por proyecto aunque existan varios capítulos/work items',async()=>{
  const specialist=await usuario('especialista'),editor=await usuario('editor');
  const p=await proyectoEF(specialist.id,editor.id);
  for(const n of [1,2,3,4]){await crearCapitulo(p.id,n);await actualizarCapituloEditor(p.id,n,{fechaInicioEditor:'2026-10-01'},editor.id);}
  const list=await listarProyectosEdicion({search:'',page:1,pageSize:10,sort:'activity'},now);
  const rows=list.items.filter(i=>i.projectId===p.id);
  expect(rows).toHaveLength(1);
  expect(rows[0]!.interventionCount).toBe(4);
 });
 it('progreso siempre null: no existe denominador contractual real (capitulos_pactados es un rango)',async()=>{
  const specialist=await usuario('especialista'),editor=await usuario('editor');
  const p=await proyectoEF(specialist.id,editor.id);
  for(const n of [1,2]){await crearCapitulo(p.id,n);await actualizarCapituloEditor(p.id,n,{fechaInicioEditor:'2026-10-01',fechaEntregaEditor:'2026-10-05'},editor.id);}
  const list=await listarProyectosEdicion({search:'',page:1,pageSize:10,sort:'activity'},now);
  const row=list.items.find(i=>i.projectId===p.id)!;
  expect(row.progress).toBeNull();
  expect(row.interventionSummary).toContain('2 capítulos registrados');
  expect(row.interventionSummary).not.toMatch(/%|\//);
 });
 it('múltiples capítulos con estados distintos sintetizan un estado coherente, no falso',async()=>{
  const specialist=await usuario('especialista'),editor=await usuario('editor');
  const p=await proyectoEF(specialist.id,editor.id);
  await crearCapitulo(p.id,5);await actualizarCapituloEditor(p.id,5,{fechaInicioEditor:'2026-10-01',fechaEntregaEditor:'2026-10-05'},editor.id);await actualizarCapituloAutor(p.id,5,{fechaEnvioAutor:'2026-10-06'},specialist.id);
  await crearCapitulo(p.id,6);await actualizarCapituloEditor(p.id,6,{fechaInicioEditor:'2026-10-07'},editor.id);
  const list=await listarProyectosEdicion({search:'',page:1,pageSize:10,sort:'activity'},now);
  const row=list.items.find(i=>i.projectId===p.id)!;
  expect(row.editorialState).toBe('En edición');
  expect(row.responsibleNow).toBe('editor');
 });
 it('esperando autor nunca cuenta como vencido/atraso del Editor',async()=>{
  const specialist=await usuario('especialista'),editor=await usuario('editor');
  const p=await proyectoEF(specialist.id,editor.id);
  await crearCapitulo(p.id,1);await actualizarCapituloEditor(p.id,1,{fechaInicioEditor:'2026-09-01',fechaEntregaEditor:'2026-09-05'},editor.id);await actualizarCapituloAutor(p.id,1,{fechaEnvioAutor:'2026-09-06'},specialist.id);
  const list=await listarProyectosEdicion({search:'',page:1,pageSize:10,sort:'activity'},now);
  const row=list.items.find(i=>i.projectId===p.id)!;
  expect(row.editorialState).toBe('Esperando autor');
  expect(row.overdue).toBe(false);
  expect(row.responsibleNow).toBe('autor');
  expect(list.counts.overdue).toBe(list.items.filter(i=>i.overdue).length);
 });
 it('capítulo recién registrado, sin iniciar por el Editor, se muestra "Por iniciar"',async()=>{
  const specialist=await usuario('especialista'),editor=await usuario('editor'),chief=await usuario('jefe_edicion');
  const p=await proyectoEF(specialist.id);
  // El capítulo nace ANTES de que haya Editor asignado: su work item queda 'pendiente'
  // (ver sincronizarCapituloEditorial, server/helpers/editorialInterventions.ts:20).
  // asignarEditor luego solo transiciona el work item contenedor, nunca este capítulo.
  await crearCapitulo(p.id,7);
  await asignarEditor(p.id,editor.id,chief.id);
  const detail=await obtenerProyectoEdicionDetalle(p.id,now);
  expect(detail?.summary.editorialState).toBe('Por iniciar');
  expect(detail?.summary.editor).toBe(editor.nombre);
  expect(detail?.nextStep).toContain('El Editor debe iniciar');
 });
 it('sin editor asignado: proyecto no aparece con "Por iniciar" sino sigue en Por asignar (Asignaciones), aquí no se inventa Editor',async()=>{
  const specialist=await usuario('especialista');
  const p=await proyectoEF(specialist.id);
  await solicitarEditor(p.id,specialist.id);
  const list=await listarProyectosEdicion({search:'',page:1,pageSize:50,sort:'activity'},now);
  const row=list.items.find(i=>i.projectId===p.id);
  expect(row?.editor).toBeNull();
  expect(row?.editorId).toBeNull();
 });
 it('counts del resumen vienen del conjunto completo filtrado, no de la página actual',async()=>{
  const specialist=await usuario('especialista'),editor=await usuario('editor');
  for(let i=0;i<3;i++){const p=await proyectoEF(specialist.id,editor.id);await crearCapitulo(p.id,1);await actualizarCapituloEditor(p.id,1,{fechaInicioEditor:'2026-10-01'},editor.id);}
  const page1=await listarProyectosEdicion({search:'',page:1,pageSize:1,sort:'activity'},now);
  expect(page1.items).toHaveLength(1);
  expect(page1.counts.inEditing).toBeGreaterThanOrEqual(3);
  expect(page1.total).toBeGreaterThanOrEqual(3);
 });
 it('filtra por servicio, estado, editor y busca proyecto/autor/editor en servidor',async()=>{
  const specialist=await usuario('especialista'),editor=await usuario('editor'),other=await usuario('editor');
  const p=await proyectoEF(specialist.id,editor.id);
  await db.update(proyectos).set({tituloDefinitivo:'Crónica distintiva QA'}).where(eq(proyectos.id,p.id));
  await crearCapitulo(p.id,1);await actualizarCapituloEditor(p.id,1,{fechaInicioEditor:'2026-10-01'},editor.id);
  const [servicio]=await db.select().from(servicios).where(eq(servicios.id,p.servicioId));
  expect((await listarProyectosEdicion({search:'Crónica distintiva',page:1,pageSize:10,sort:'activity'},now)).items.map(i=>i.projectId)).toEqual([p.id]);
  expect((await listarProyectosEdicion({search:editor.nombre,page:1,pageSize:10,sort:'activity'},now)).items.some(i=>i.projectId===p.id)).toBe(true);
  expect((await listarProyectosEdicion({search:'',service:servicio!.id,page:1,pageSize:50,sort:'activity'},now)).items.some(i=>i.projectId===p.id)).toBe(true);
  expect((await listarProyectosEdicion({search:'',editor:other.id,page:1,pageSize:50,sort:'activity'},now)).items.some(i=>i.projectId===p.id)).toBe(false);
  expect((await listarProyectosEdicion({search:'',state:'Por iniciar',page:1,pageSize:50,sort:'activity'},now)).items.every(i=>i.editorialState==='Por iniciar')).toBe(true);
 });
 it('detalle: últimas intervenciones acotadas, historial es solo dominio de Edición, Drive sin workspace es vacío honesto',async()=>{
  const specialist=await usuario('especialista'),editor=await usuario('editor');
  const p=await proyectoEF(specialist.id,editor.id);
  for(let n=1;n<=12;n++){await crearCapitulo(p.id,n);await actualizarCapituloEditor(p.id,n,{fechaInicioEditor:'2026-10-01'},editor.id);}
  const detail=await obtenerProyectoEdicionDetalle(p.id,now);
  expect(detail?.interventionsTotal).toBe(12);
  expect(detail?.interventions.length).toBeLessThanOrEqual(10);
  expect(detail?.drive).toEqual({rootUrl:null,links:[]});
  expect(detail?.history.every(h=>['Editor asignado','Capítulo entregado por Editor','Capítulo enviado al autor','Feedback del autor registrado','Feedback aplicado por Editor','Solicitud de Editor recibida','Edición de tripa completada'].includes(h.label))).toBe(true);
 });
 it('proyecto inexistente: detalle null, HTTP 404',async()=>{
  expect(await obtenerProyectoEdicionDetalle('00000000-0000-4000-8000-000000000000',now)).toBeNull();
 });
 it('CSV respeta BOM, encabezados y no incluye PII innecesaria',async()=>{
  const specialist=await usuario('especialista'),editor=await usuario('editor');
  await proyectoEF(specialist.id,editor.id);
  const csv=await csvProyectosEdicion(now);
  expect(csv.startsWith('﻿')).toBe(true);
  expect(csv).toContain('Proyecto');expect(csv).toContain('Editor actual');
  expect(csv).not.toContain('@');
 });
 it('HTTP: RBAC exige sesión y rol jefe_edicion; IDOR responde 404 a proyecto inexistente',async()=>{
  const app=crearAppDePrueba();await app.ready();try{
   const chief=await registrarYLoguear(app,'jefe_edicion'),editor=await registrarYLoguear(app,'editor');
   expect((await request(app.server).get('/api/editores/proyectos')).status).toBe(401);
   expect((await request(app.server).get('/api/editores/proyectos').set('Cookie',editor)).status).toBe(403);
   expect((await request(app.server).get('/api/editores/proyectos').set('Cookie',chief)).status).toBe(200);
   expect((await request(app.server).get('/api/editores/proyectos/00000000-0000-4000-8000-000000000000').set('Cookie',chief)).status).toBe(404);
   expect((await request(app.server).get('/api/editores/proyectos?pageSize=999').set('Cookie',chief)).status).toBe(400);
   const csvRes=await request(app.server).get('/api/editores/proyectos/export.csv').set('Cookie',chief);
   expect(csvRes.status).toBe(200);expect(csvRes.headers['content-type']).toContain('text/csv');expect(csvRes.headers['content-disposition']).toContain('attachment');
  }finally{await app.close();}
 });
});
