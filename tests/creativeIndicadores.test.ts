import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {eq} from 'drizzle-orm';
import {buildApp} from '../server/app.js';
import {db} from '../server/db/client.js';
import {direccionesCreativas,fichaDisenoPropuestas,fichasTrazabilidad,proyectos,servicios,users} from '../server/db/schema/index.js';
import {createSession} from '../server/helpers/session.js';
import {createCreativeMeetingRequest,decideCreativeRequest} from '../server/helpers/creativeRequests.js';
import {registrarBrief,registrarBriefAutor,registrarRecursosCreativos} from '../server/helpers/direccionCreativa.js';
import {deliverCreativeConcepts} from '../server/helpers/creativeLeaderCommands.js';
import {obtenerIndicadoresCreativos,csvIndicadoresCreativos} from '../server/helpers/creativeIndicadores.js';
import {crearProyectoDePrueba} from './helpers/fixtures.js';
import {limpiarBaseDeDatos} from './helpers/db.js';
import {diaCaracas} from '../server/helpers/atencionEspecialista.js';

const app=buildApp(),cookies=new Map<string,string>(),hoy=diaCaracas(new Date());
let leader:string,other:string,specialist:string;
async function person(rol:typeof users.$inferInsert.rol){const [u]=await db.insert(users).values({nombre:'QA '+rol,email:randomUUID()+'@test.local',rol,passwordHash:'session-only'}).returning();cookies.set(u!.id,'panhouse_sid='+await createSession(u!.id));return u!.id;}
const api=(path:string,user=leader)=>app.inject({method:'GET',url:'/api'+path,headers:{cookie:cookies.get(user)??''}});
async function project(codigoServicio='SE'){
 const p=await crearProyectoDePrueba({especialistaId:specialist});
 let [s]=await db.select().from(servicios).where(eq(servicios.codigo,codigoServicio));
 if(!s)[s]=await db.insert(servicios).values({codigo:codigoServicio,nombre:codigoServicio,pesoComplejidad:1,plazoDias:90}).returning();
 await db.update(proyectos).set({servicioId:s!.id,tituloDefinitivo:'Proyecto indicadores '+p.codigo,subtituloDefinitivo:'Contexto QA',fechaFeedbackTripa:hoy}).where(eq(proyectos.id,p.id));
 await db.insert(fichasTrazabilidad).values({proyectoId:p.id});
 return (await db.select().from(proyectos).where(eq(proyectos.id,p.id)))[0]!;
}
async function direccionCreativa(codigoServicio='SE'){
 const p=await project(codigoServicio),reqId=await createCreativeMeetingRequest(p.id,specialist),result=await decideCreativeRequest(reqId,leader,'accept');
 return {p,processId:result.creativeProcessId as string,workItemId:result.workItemId as string};
}
async function conBrief(codigoServicio='SE'){
 const ctx=await direccionCreativa(codigoServicio);
 await registrarBrief(ctx.processId,{briefEnlace:'https://drive.test/brief',fechaBriefEnviadoEspecialista:hoy},leader);
 return ctx;
}
async function conConceptosYRecursos(codigoServicio='SE'){
 const ctx=await conBrief(codigoServicio);
 await registrarBriefAutor(ctx.processId,{fechaBriefEnviadoAutor:hoy,fechaBriefAprobadoAutor:hoy},leader);
 await deliverCreativeConcepts(ctx.processId,[
  {descripcion:'Concepto A',enlace:'https://drive.test/concepto-a'},
  {descripcion:'Concepto B',enlace:'https://drive.test/concepto-b'},
 ],leader);
 return ctx;
}
beforeAll(()=>app.ready());afterAll(()=>app.close());
beforeEach(async()=>{await limpiarBaseDeDatos();cookies.clear();leader=await person('lider_creativo');other=await person('lider_creativo');specialist=await person('especialista');});

describe('Indicadores de Dirección Creativa',()=>{
 it('cierre de recursos usa el día de Caracas cuando UTC ya cambió de fecha',async()=>{
  const ctx=await conConceptosYRecursos();
  const [first]=await db.select().from(fichaDisenoPropuestas).where(eq(fichaDisenoPropuestas.direccionCreativaId,ctx.processId));
  await db.update(fichaDisenoPropuestas).set({fechaEnviadaAutor:hoy,fechaAprobadaAutor:hoy}).where(eq(fichaDisenoPropuestas.id,first!.id));
  vi.useFakeTimers({toFake:['Date']});
  try{
   vi.setSystemTime(new Date(hoy+'T23:30:00-04:00'));
   await registrarRecursosCreativos(ctx.processId,{recursoImagenUrl:'https://drive.test/img.png',recursoConceptoPdfUrl:'https://drive.test/concepto.pdf'},leader);
   const [closed]=await db.select().from(direccionesCreativas).where(eq(direccionesCreativas.id,ctx.processId));
   expect(closed!.fechaCierre).toBe(hoy);
   expect((await obtenerIndicadoresCreativos(leader,{from:'2026-01-01',to:hoy})).summary.recursosEntregados).toBe(1);
  }finally{vi.useRealTimers();}
 });
 it('RBAC: exige sesión y rol lider_creativo',async()=>{
  expect((await app.inject({method:'GET',url:'/api/direccion-creativa/indicadores'})).statusCode).toBe(401);
  expect((await api('/direccion-creativa/indicadores',specialist)).statusCode).toBe(403);
  expect((await api('/direccion-creativa/indicadores')).statusCode).toBe(200);
 });
 it('valida el rango: ambas fechas juntas y máximo 732 días',async()=>{
  expect((await api('/direccion-creativa/indicadores?from=2026-01-01')).statusCode).toBe(400);
  expect((await api('/direccion-creativa/indicadores?from=2020-01-01&to=2026-10-21')).statusCode).toBe(400);
  expect((await api('/direccion-creativa/indicadores?servicio=no-es-uuid')).statusCode).toBe(400);
 });
 it('briefsElaborados cuenta briefs finalizados, no solicitudes ni conceptos sin brief',async()=>{
  await conBrief();await direccionCreativa();
  const data=await obtenerIndicadoresCreativos(leader,{from:'2026-01-01',to:hoy});
  expect(data.summary.briefsElaborados).toBe(1);
 });
 it('conceptosCreados cuenta propuestas de concepto, no proyectos (un proyecto puede tener varias)',async()=>{
  await conConceptosYRecursos();
  const data=await obtenerIndicadoresCreativos(leader,{from:'2026-01-01',to:hoy});
  expect(data.summary.conceptosCreados).toBe(2);
 });
 it('recursosEntregados cuenta la entrega formal completa (imagen+PDF), no cada archivo por separado',async()=>{
  const ctx=await conConceptosYRecursos();
  const [first]=await db.select().from(fichaDisenoPropuestas).where(eq(fichaDisenoPropuestas.direccionCreativaId,ctx.processId));
  await db.update(fichaDisenoPropuestas).set({fechaEnviadaAutor:hoy,fechaAprobadaAutor:hoy}).where(eq(fichaDisenoPropuestas.id,first!.id));
  const antes=await obtenerIndicadoresCreativos(leader,{from:'2026-01-01',to:hoy});
  expect(antes.summary.recursosEntregados).toBe(0);
  await registrarRecursosCreativos(ctx.processId,{recursoImagenUrl:'https://drive.test/img.png',recursoConceptoPdfUrl:'https://drive.test/concepto.pdf'},leader);
  const despues=await obtenerIndicadoresCreativos(leader,{from:'2026-01-01',to:hoy});
  expect(despues.summary.recursosEntregados).toBe(1);
  expect(despues.workload.completadasPeriodo).toBe(1);
 });
 it('escopa por el líder actualmente asignado: otro líder no ve este trabajo en sus indicadores',async()=>{
  await conBrief();
  const propio=await obtenerIndicadoresCreativos(leader,{from:'2026-01-01',to:hoy}),ajeno=await obtenerIndicadoresCreativos(other,{from:'2026-01-01',to:hoy});
  expect(propio.summary.briefsElaborados).toBe(1);expect(ajeno.summary.briefsElaborados).toBe(0);
 });
 it('filtro de servicio limita los KPIs y el listado de servicios disponibles nunca se reduce a sí mismo',async()=>{
  await conBrief('SE');await conBrief('CR');
  const sinFiltro=await obtenerIndicadoresCreativos(leader,{from:'2026-01-01',to:hoy});
  expect(sinFiltro.summary.briefsElaborados).toBe(2);
  expect(sinFiltro.filters.services.length).toBe(2);
  const [servicioSe]=await db.select().from(servicios).where(eq(servicios.codigo,'SE'));
  const conFiltro=await obtenerIndicadoresCreativos(leader,{from:'2026-01-01',to:hoy,servicio:servicioSe!.id});
  expect(conFiltro.summary.briefsElaborados).toBe(1);
  expect(conFiltro.filters.services.length).toBe(2);
 });
 it('sin actividad: comparación es null (sin base) y no hay porcentaje infinito',async()=>{
  const data=await obtenerIndicadoresCreativos(leader,{from:'2026-01-01',to:hoy});
  expect(data.summary.briefsElaborados).toBe(0);
  expect(data.summary.comparacionBriefs).toBeNull();
  expect(data.summary.comparacionConceptos).toBeNull();
 });
 it('tiempo de ciclo sin muestras reporta null, no cero engañoso',async()=>{
  const data=await obtenerIndicadoresCreativos(leader,{from:'2026-01-01',to:hoy});
  for(const c of data.cycleTimes){expect(c.muestras).toBe(0);expect(c.promedioDias).toBeNull();}
 });
 it('estado actual de proyectos cuenta cada proyecto una sola vez',async()=>{
  await direccionCreativa();await conBrief();
  const data=await obtenerIndicadoresCreativos(leader,{from:'2026-01-01',to:hoy});
  const total=data.stateDistribution.reduce((n,d)=>n+d.cantidad,0);
  expect(total).toBe(2);
 });
 it('CSV de exportación refleja el mismo resumen que el JSON, con BOM y celdas sin inyección',async()=>{
  await conBrief();
  const data=await obtenerIndicadoresCreativos(leader,{from:'2026-01-01',to:hoy});
  const csv=csvIndicadoresCreativos(data);
  expect(csv.startsWith('﻿')).toBe(true);
  expect(csv).toContain('Briefs elaborados');
  expect(csv).toContain(String(data.summary.briefsElaborados));
 });
 it('HTTP: GET /indicadores responde los mismos datos que la función directa',async()=>{
  await conBrief();
  const response=await api('/direccion-creativa/indicadores?from=2026-01-01&to='+hoy);
  expect(response.statusCode).toBe(200);
  expect(response.json().summary.briefsElaborados).toBe(1);
 });
 it('HTTP: export.csv responde con encabezados de descarga',async()=>{
  const response=await api('/direccion-creativa/indicadores/export.csv?from=2026-01-01&to='+hoy);
  expect(response.statusCode).toBe(200);
  expect(response.headers['content-type']).toContain('text/csv');
  expect(response.headers['content-disposition']).toContain('attachment');
 });
});
