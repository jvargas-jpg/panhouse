import {randomUUID} from 'node:crypto';
import {beforeEach,describe,expect,it} from 'vitest';
import request from 'supertest';
import {eq} from 'drizzle-orm';
import {db} from '../server/db/client.js';
import {capitulos,fichasTrazabilidad,pausas,proyectos,servicios,users} from '../server/db/schema/index.js';
import {crearProyectoDePrueba} from './helpers/fixtures.js';
import {limpiarBaseDeDatos} from './helpers/db.js';
import {crearAppDePrueba} from './helpers/testApp.js';
import {registrarYLoguear} from './helpers/auth.js';
import {asignarEditor} from '../server/helpers/proyectos.js';
import {crearCapitulo,actualizarCapituloEditor,actualizarCapituloAutor} from '../server/helpers/capitulos.js';
import {listarSeguimientoEdicion,obtenerSeguimientoDetalle,csvSeguimientoEdicion} from '../server/helpers/editorialTracking.js';

const now=new Date('2026-10-23T16:00:00Z');
async function usuario(rol:typeof users.$inferInsert.rol){const [u]=await db.insert(users).values({id:randomUUID(),nombre:'QA '+rol,email:randomUUID()+'@test.local',rol,passwordHash:'session-only'}).returning();return u!;}
async function proyectoEF(especialistaId:string,editorId?:string){
 const p=await crearProyectoDePrueba({especialistaId});
 const [ef]=await db.select().from(servicios).where(eq(servicios.codigo,'EF'));
 const servicio=ef??(await db.insert(servicios).values({codigo:'EF',nombre:'Escritura fantasma',pesoComplejidad:4,plazoDias:120}).returning())[0];
 await db.update(proyectos).set({servicioId:servicio!.id,tituloDefinitivo:'Proyecto seguimiento '+p.codigo,subtituloDefinitivo:'Contexto QA'}).where(eq(proyectos.id,p.id));
 await db.insert(fichasTrazabilidad).values({proyectoId:p.id});
 if(editorId){const chief=await usuario('jefe_edicion');await asignarEditor(p.id,editorId,chief.id);}
 return (await db.select().from(proyectos).where(eq(proyectos.id,p.id)))[0]!;
}
const filters={tab:'all' as const,search:'',page:1,pageSize:10,sort:'due' as const};
beforeEach(limpiarBaseDeDatos);

describe('Seguimiento · supervisión operativa de intervenciones',()=>{
 it('una fila por intervención: el mismo proyecto puede aparecer varias veces',async()=>{
  const specialist=await usuario('especialista'),editor=await usuario('editor');
  const p=await proyectoEF(specialist.id,editor.id);
  for(const n of [5,6,7]){await crearCapitulo(p.id,n);await actualizarCapituloEditor(p.id,n,{fechaInicioEditor:'2026-10-01'},editor.id);}
  const list=await listarSeguimientoEdicion(filters,now);
  const rows=list.items.filter(i=>i.projectId===p.id);
  expect(rows.length).toBeGreaterThanOrEqual(3);
  expect(new Set(rows.map(r=>r.id)).size).toBe(rows.length);
 });
 it('solicitudes sin Editor (needsAssignment) nunca aparecen en Seguimiento',async()=>{
  const specialist=await usuario('especialista');
  const p=await proyectoEF(specialist.id);
  const {solicitarEditor}=await import('../server/helpers/proyectos.js');
  await solicitarEditor(p.id,specialist.id);
  const list=await listarSeguimientoEdicion({...filters,tab:'all',pageSize:200},now);
  expect(list.items.some(i=>i.projectId===p.id)).toBe(false);
 });
 it('vencida: responsable Editor, cuenta en el KPI de vencidas',async()=>{
  const specialist=await usuario('especialista'),editor=await usuario('editor');
  const p=await proyectoEF(specialist.id,editor.id);
  await crearCapitulo(p.id,1);await actualizarCapituloEditor(p.id,1,{fechaInicioEditor:'2026-10-01'},editor.id);
  await db.execute(`update work_items set fecha_fin_pautada='2026-10-10' where proyecto_id='${p.id}' and tipo='edicion' and business_key='capitulo:'||(select id from capitulos where proyecto_id='${p.id}' and numero=1)::text`);
  const list=await listarSeguimientoEdicion({...filters,tab:'overdue'},now);
  const row=list.items.find(i=>i.projectId===p.id);
  expect(row?.currentResponsible).toBe('editor');
  expect(row?.overdue).toBe(true);
  expect(row?.daysLabel).toContain('Vencida hace');
  expect(list.counts.overdue).toBeGreaterThanOrEqual(1);
 });
 it('esperando autor: no cuenta como vencida del Editor, responsable es autor, SLA en pausa visualmente',async()=>{
  const specialist=await usuario('especialista'),editor=await usuario('editor');
  const p=await proyectoEF(specialist.id,editor.id);
  await crearCapitulo(p.id,1);await actualizarCapituloEditor(p.id,1,{fechaInicioEditor:'2026-09-01',fechaEntregaEditor:'2026-09-05'},editor.id);await actualizarCapituloAutor(p.id,1,{fechaEnvioAutor:'2026-09-06'},specialist.id);
  const list=await listarSeguimientoEdicion({...filters,tab:'all'},now);
  const row=list.items.find(i=>i.projectId===p.id)!;
  expect(row.state).toBe('Esperando autor');
  expect(row.currentResponsible).toBe('autor');
  expect(row.overdue).toBe(false);
  expect(row.daysLabel).toBe('SLA en pausa');
  const overdueTab=await listarSeguimientoEdicion({...filters,tab:'overdue'},now);
  expect(overdueTab.items.some(i=>i.projectId===p.id)).toBe(false);
 });
 it('esperando especialista: responsable especialista, no penaliza Editor',async()=>{
  const specialist=await usuario('especialista'),editor=await usuario('editor');
  const p=await proyectoEF(specialist.id,editor.id);
  await crearCapitulo(p.id,1);await actualizarCapituloEditor(p.id,1,{fechaInicioEditor:'2026-09-01',fechaEntregaEditor:'2026-09-05'},editor.id);
  const list=await listarSeguimientoEdicion({...filters,tab:'all'},now);
  const row=list.items.find(i=>i.projectId===p.id)!;
  expect(row.state).toBe('Esperando Especialista');
  expect(row.currentResponsible).toBe('especialista');
 });
 it('pausa de proyecto: no cuenta vencida, días muestra "Pausado"',async()=>{
  const specialist=await usuario('especialista'),editor=await usuario('editor');
  const p=await proyectoEF(specialist.id,editor.id);
  await crearCapitulo(p.id,1);await actualizarCapituloEditor(p.id,1,{fechaInicioEditor:'2026-10-01'},editor.id);
  await db.insert(pausas).values({proyectoId:p.id,causa:'autor',fechaInicio:new Date('2026-10-02T12:00:00Z')});
  const list=await listarSeguimientoEdicion({...filters,tab:'all'},now);
  const row=list.items.find(i=>i.projectId===p.id)!;
  expect(row.daysLabel).toBe('Pausado');
  expect(row.overdue).toBe(false);
 });
 it('en riesgo usa el helper central (vence hoy, accionable), no un umbral de 3 días en el cliente',async()=>{
  const specialist=await usuario('especialista'),editor=await usuario('editor');
  const p=await proyectoEF(specialist.id,editor.id);
  await crearCapitulo(p.id,1);await actualizarCapituloEditor(p.id,1,{fechaInicioEditor:'2026-10-20'},editor.id);
  await db.execute(`update work_items set fecha_fin_pautada='2026-10-23' where proyecto_id='${p.id}' and tipo='edicion' and business_key like 'capitulo:%'`);
  const list=await listarSeguimientoEdicion({...filters,tab:'risk'},now);
  const row=list.items.find(i=>i.projectId===p.id);
  expect(row?.atRisk).toBe(true);
  expect(row?.daysLabel).toBe('Vence hoy');
  expect(list.counts.risk).toBeGreaterThanOrEqual(1);
 });
 it('bloqueada: solo con blocker explícito, nunca inferido por inactividad',async()=>{
  const specialist=await usuario('especialista'),editor=await usuario('editor');
  const p=await proyectoEF(specialist.id,editor.id);
  await crearCapitulo(p.id,1);
  await db.execute(`update work_items set estado='bloqueado',gate_bloqueante='Falta material del autor' where proyecto_id='${p.id}' and tipo='edicion' and business_key like 'capitulo:%'`);
  const list=await listarSeguimientoEdicion({...filters,tab:'blocked'},now);
  const row=list.items.find(i=>i.projectId===p.id);
  expect(row?.state).toBe('Bloqueadas');
  expect(row?.block).toBe('Falta material del autor');
  const detail=await obtenerSeguimientoDetalle(row!.id,now);
  expect(detail?.blockerReason).toBe('Falta material del autor');
 });
 it('prioritarios combina vencidas+bloqueadas+en riesgo sin crear un estado nuevo',async()=>{
  const specialist=await usuario('especialista'),editor=await usuario('editor');
  const p=await proyectoEF(specialist.id,editor.id);
  await crearCapitulo(p.id,1);
  await db.execute(`update work_items set estado='bloqueado',gate_bloqueante='Archivo incompleto' where proyecto_id='${p.id}' and tipo='edicion' and business_key like 'capitulo:%'`);
  const priority=await listarSeguimientoEdicion({...filters,tab:'priority'},now);
  const blocked=await listarSeguimientoEdicion({...filters,tab:'blocked'},now);
  expect(priority.items.some(i=>i.projectId===p.id)).toBe(true);
  expect(blocked.items.some(i=>i.projectId===p.id)).toBe(true);
 });
 it('detalle se centra en la intervención seleccionada, no en el resumen del proyecto; siblings son secundarios',async()=>{
  const specialist=await usuario('especialista'),editor=await usuario('editor');
  const p=await proyectoEF(specialist.id,editor.id);
  for(const n of [1,2,3]){await crearCapitulo(p.id,n);await actualizarCapituloEditor(p.id,n,{fechaInicioEditor:'2026-10-01'},editor.id);}
  const list=await listarSeguimientoEdicion({...filters,tab:'all'},now);
  const target=list.items.find(i=>i.projectId===p.id)!;
  const detail=await obtenerSeguimientoDetalle(target.id,now);
  expect(detail?.summary.id).toBe(target.id);
  expect(detail?.siblings.length).toBeGreaterThanOrEqual(2);
  expect(detail?.siblings.every(s=>s.id!==target.id)).toBe(true);
 });
 it('CSV respeta filtros (solo vencidas) y no incluye PII',async()=>{
  const specialist=await usuario('especialista'),editor=await usuario('editor');
  const p=await proyectoEF(specialist.id,editor.id);
  await crearCapitulo(p.id,1);await actualizarCapituloEditor(p.id,1,{fechaInicioEditor:'2026-10-01'},editor.id);
  await db.execute(`update work_items set fecha_fin_pautada='2026-10-10' where proyecto_id='${p.id}' and tipo='edicion' and business_key like 'capitulo:%'`);
  const csv=await csvSeguimientoEdicion({tab:'overdue',search:'',sort:'due'},now);
  expect(csv.startsWith('﻿')).toBe(true);
  expect(csv).toContain('Proyecto seguimiento');
  expect(csv).not.toContain('@');
 });
 it('HTTP: RBAC exige sesión y rol jefe_edicion; IDOR responde 404',async()=>{
  const app=crearAppDePrueba();await app.ready();try{
   const chief=await registrarYLoguear(app,'jefe_edicion'),editor=await registrarYLoguear(app,'editor');
   expect((await request(app.server).get('/api/editores/seguimiento')).status).toBe(401);
   expect((await request(app.server).get('/api/editores/seguimiento').set('Cookie',editor)).status).toBe(403);
   expect((await request(app.server).get('/api/editores/seguimiento').set('Cookie',chief)).status).toBe(200);
   expect((await request(app.server).get('/api/editores/seguimiento/00000000-0000-4000-8000-000000000000').set('Cookie',chief)).status).toBe(404);
   expect((await request(app.server).get('/api/editores/seguimiento?pageSize=999').set('Cookie',chief)).status).toBe(400);
   const csvRes=await request(app.server).get('/api/editores/seguimiento/export.csv').set('Cookie',chief);
   expect(csvRes.status).toBe(200);expect(csvRes.headers['content-type']).toContain('text/csv');
  }finally{await app.close();}
 });
});
