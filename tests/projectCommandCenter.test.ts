import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../server/app.js';
import { db, pool } from '../server/db/client.js';
import { auditLogs, fichasTrazabilidad, projectAssignments, proyectos, servicios, users, workItems, fases, servicioFases, pagos, notificaciones, capitulos } from '../server/db/schema/index.js';
import { createSession } from '../server/helpers/session.js';
import { obtenerCommandCenter } from '../server/helpers/projectCommandCenter.js';
import { habilitarActivacionAmazon } from '../server/helpers/activacionAmazon.js';
import { actualizarSeccionSoporteDigital, listarProyectosPendientesSoporteDigital } from '../server/helpers/trazabilidad.js';
import { historialFicha } from '../server/helpers/fichaViva.js';
import { crearProyectoDePrueba } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';

const app = buildApp();
let jefe: string, spec: string, other: string, jefeCookie: string, specCookie: string;
async function user(rol: typeof users.$inferInsert.rol) {
  const id = randomUUID(); await db.insert(users).values({ id, rol, nombre: rol+' '+id.slice(0, 4), email: id+'@panhouse.test', passwordHash: 'session-only' }); return id;
}
async function fixture(extra: Partial<typeof proyectos.$inferInsert> = {}) {
  const p = await crearProyectoDePrueba({ especialistaId: spec, jefeAreaId: jefe });
  await db.update(proyectos).set({ notificadoJefatura: true, ...extra }).where(eq(proyectos.id, p.id));
  await db.insert(fichasTrazabilidad).values({ proyectoId: p.id });
  return p;
}
const get = (id: string, cookie = specCookie) => app.inject({ method: 'GET', url: '/api/proyectos/'+id+'/command-center', headers: { cookie } });
const post = (id: string, payload: object, cookie = specCookie) => app.inject({ method: 'POST', url: '/api/proyectos/'+id+'/avances', headers: { cookie }, payload });
beforeAll(() => app.ready()); afterAll(() => app.close());
afterEach(() => vi.useRealTimers());
beforeEach(async () => { vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-11T16:00:00Z')); await limpiarBaseDeDatos(); jefe = await user('jefe_area'); spec = await user('especialista'); other = await user('especialista'); jefeCookie = 'panhouse_sid='+await createSession(jefe); specCookie = 'panhouse_sid='+await createSession(spec); });

describe('Project Command Center: verdad compartida y permisos', () => {
  it('401 sin sesión y 403 para roles ajenos', async () => {
    const p = await fixture(); expect((await get(p.id, '')).statusCode).toBe(401);
    const rrpp = await user('comercial'); expect((await get(p.id, 'panhouse_sid='+await createSession(rrpp))).statusCode).toBe(403);
  });
  it('Especialista ajeno no obtiene contexto, pagos ni actividad', async () => {
    const p = await fixture({ especialistaId: other }); const r = await get(p.id);
    expect(r.statusCode).toBe(403); expect(r.body).not.toContain('administracion');
    expect((await post(p.id, { texto: 'No debe registrarse en proyecto ajeno' })).statusCode).toBe(403);
  });
  it('assignment vigente prevalece sobre FK obsoleto para lectura y escritura', async () => {
    const p = await fixture({ especialistaId: other });
    await db.insert(projectAssignments).values({ proyectoId: p.id, usuarioId: spec, tipo: 'especialista', asignadoPorId: jefe });
    expect((await get(p.id)).statusCode).toBe(200);
    expect((await post(p.id, { texto: 'Avance autorizado del responsable vigente' })).statusCode).toBe(200);
    expect((await get(p.id, 'panhouse_sid='+await createSession(other))).statusCode).toBe(403);
  });
  it('Jefatura y Especialista reciben los mismos procesos, equipo, salud y administración', async () => {
    const p = await fixture(); await db.insert(workItems).values([{ proyectoId: p.id, tipo: 'edicion', estado: 'en_progreso' }, { proyectoId: p.id, tipo: 'direccion_creativa', estado: 'en_progreso' }, { proyectoId: p.id, tipo: 'correccion', estado: 'pendiente' }, { proyectoId: p.id, tipo: 'lanzamiento', businessKey: 'planificacion' }]);
    const a = (await get(p.id)).json(), b = (await get(p.id, jefeCookie)).json();
    for (const key of ['salud', 'administracion']) expect(a[key]).toEqual(b[key]);
    expect(a.procesos.map(({action,...p}:Record<string,unknown>)=>p).sort((a:Record<string,string>,b:Record<string,string>)=>(a.tipo ?? '').localeCompare(b.tipo ?? ''))).toEqual(b.procesos.map(({action,...p}:Record<string,unknown>)=>p).sort((a:Record<string,string>,b:Record<string,string>)=>(a.tipo ?? '').localeCompare(b.tipo ?? '')));
    expect(a.ficha.team).toEqual(b.ficha.team); expect(a.ficha.project).toEqual(b.ficha.project);
    expect(a.ficha.summary.active).toBe(2); expect(a.ficha.summary.launchEnabled).toBe(true);
    expect(a.capabilities.registrarAvance).toBe(true); expect(b.capabilities.registrarAvance).toBe(false);
    expect(a).not.toHaveProperty('porcentaje');
  });
  it('cuenta rondas reales, excluye ingreso/asignación y conserva canceladas', async () => {
    const p = await fixture(); await db.insert(workItems).values([{ proyectoId: p.id, tipo: 'intake_rrpp', estado: 'completado' }, { proyectoId: p.id, tipo: 'asignacion_especialista', estado: 'completado' }, { proyectoId: p.id, tipo: 'calidad', businessKey: 'ronda1', estado: 'completado' }, { proyectoId: p.id, tipo: 'calidad', businessKey: 'ronda2', estado: 'en_progreso' }, { proyectoId: p.id, tipo: 'calidad', businessKey: 'ronda0', estado: 'cancelado' }]);
    const data = (await get(p.id)).json(); expect(data.ficha.summary.completed).toBe(1); expect(data.ficha.summary.active).toBe(1);
    expect(data.procesos.find((p: { tipo: string }) => p.tipo === 'calidad').trabajos).toHaveLength(3);
  });
  it('Sello sin Edición muestra No aplica y no pendientes ficticios', async () => {
    const p = await fixture(); await db.update(servicios).set({ codigo: 'SE' }).where(eq(servicios.id, p.servicioId));
    expect((await get(p.id)).json().procesos.find((p: { tipo: string }) => p.tipo === 'edicion').estado).toBe('No aplica');
  });
  it('atención proviene de feedback y solicitudes reales; no enlaces generales', async () => {
    const p=await fixture({tituloDefinitivo:'Título cerrado',subtituloDefinitivo:'Subtítulo cerrado'});
    expect((await get(p.id)).json().atencion.some((a:{titulo:string})=>a.titulo==='Solicitar Editor')).toBe(true);
    await db.insert(capitulos).values([{proyectoId:p.id,numero:1,fechaEntregaEditor:'2026-10-10',fechaEnvioAutor:'2026-10-11',fechaPautadaFeedback:'2026-10-10'},{proyectoId:p.id,numero:2,fechaEntregaEditor:'2026-10-10',fechaEnvioAutor:'2026-10-11',fechaPautadaFeedback:'2026-10-10'}]);
    const a=(await get(p.id)).json().atencion.filter((a:{titulo:string})=>a.titulo.startsWith('Dar seguimiento: Feedback del autor'));expect(a).toHaveLength(2);expect(new Set(a.map((i:{id:string})=>i.id)).size).toBe(2);expect(a.every((i:{proceso:string})=>i.proceso==='edicion')).toBe(true);
    expect((await get(p.id,jefeCookie)).json().atencion).toEqual([]);
  });
  it('historial paginado conserva eventos con la misma fecha sin repetición', async () => {
    const p=await fixture();await db.insert(auditLogs).values(Array.from({length:25},(_,i)=>({actorId:spec,proyectoId:p.id,entityType:'proyecto' as const,entityId:p.id,accion:'PROYECTO_AVANCE_REGISTRADO',detalles:{texto:'Avance persistente '+i},createdAt:new Date('2026-10-11T12:00:00Z')})));
    const first=await historialFicha(p.id),second=await historialFicha(p.id,first.nextCursor!);
    expect(first.items).toHaveLength(20);expect(second.items).toHaveLength(5);expect(new Set([...first.items,...second.items].map(e=>e.id)).size).toBe(25);
  });
  it('conserva procesos históricos aun si cambia aplicabilidad del servicio', async () => {
    const p = await fixture(); await db.update(servicios).set({ codigo: 'SE' }).where(eq(servicios.id, p.servicioId));
    await db.insert(workItems).values({ proyectoId: p.id, tipo: 'edicion', estado: 'completado' });
    expect((await get(p.id)).json().procesos.find((p: { tipo: string }) => p.tipo === 'edicion').trabajos).toHaveLength(1);
  });
  it('respeta configuración activa de servicio sin poblar catálogo inventado', async () => {
    const p = await fixture(); const [f] = await db.insert(fases).values({ codigo: 'prueba_especial', nombre: 'Proceso configurado' }).returning();
    await db.insert(servicioFases).values({ servicioId: p.servicioId, faseId: f!.id, orden: 1 });
    expect((await get(p.id)).json().procesos.find((p: { tipo: string }) => p.tipo === 'prueba_especial').estado).toBe('No iniciado');
  });
  it('avance inmutable conserva eventos anteriores y muestra texto humano escapable', async () => {
    const p = await fixture(); await db.insert(auditLogs).values({ actorId: jefe, proyectoId: p.id, entityId: p.id, entityType: 'proyecto', accion: 'EDITOR_ASIGNADO' });
    expect((await post(p.id, { texto: 'Primera entrega revisada con el autor' })).statusCode).toBe(200);
    expect((await post(p.id, { texto: 'Segunda entrega contiene ajustes de estructura' })).statusCode).toBe(200);
    const history = await historialFicha(p.id); expect(history.items).toHaveLength(3); expect(history.items[0]?.label).toBe('Segunda entrega contiene ajustes de estructura');
  });
  it('títulos pertenecen al Especialista vigente, quedan auditados y no duplican eventos', async () => {
    const p=await fixture(); const req=(cookie:string,payload:object)=>app.inject({method:'PATCH',url:'/api/proyectos/'+p.id+'/datos-editoriales',headers:{cookie},payload});
    const datos={titulo:'Una historia de prueba',subtitulo:'Camino editorial'};
    expect((await req(jefeCookie,datos)).statusCode).toBe(403);
    expect((await req('panhouse_sid='+await createSession(other),datos)).statusCode).toBe(403);
    expect((await req(specCookie,{...datos,contratoFirmado:true})).statusCode).toBe(400);
    expect((await req(specCookie,datos)).statusCode).toBe(200);
    expect((await req(specCookie,datos)).statusCode).toBe(200);
    expect((await get(p.id)).json().ficha.project.title).toBe(datos.titulo);
    expect((await db.select().from(auditLogs)).filter(e=>e.accion==='PROYECTO_TITULOS_REGISTRADOS')).toHaveLength(1);
  });
  it('Jefatura no puede registrar avance del Especialista ni enviar campos financieros', async () => {
    const p = await fixture(); expect((await post(p.id, { texto: 'Jefatura no suplanta al Especialista' }, jefeCookie)).statusCode).toBe(403);
    expect((await post(p.id, { texto: 'Texto adecuado con campo ajeno', pagoCuota1: true })).statusCode).toBe(400);
    expect((await post(p.id, { texto: 'corto' })).statusCode).toBe(400);
  });
  it('proyecto cerrado se consulta sin permitir avance nuevo', async () => {
    const p = await fixture({ estado: 'culminado' }); expect((await get(p.id)).statusCode).toBe(200);
    expect((await post(p.id, { texto: 'No reabrir la historia al registrar un avance' })).statusCode).toBe(409);
  });
  it('pagos se consultan sin inferir solvencia ni seis cuotas obligatorias', async () => {
    const p = await fixture(); await db.insert(pagos).values({ proyectoId: p.id, monto: '100', fechaPago: '2026-10-11', metodoPago: 'Transferencia', estatus: 'Verificado' });
    const data = (await get(p.id)).json(); expect(data.administracion.find((p: { key: string }) => p.key === 'pagosVerificados').value).toBe(1);
    expect(data.administracion.find((p: { key: string }) => p.key === 'solvencia').value).toContain('Sin confirmación');
      await db.update(proyectos).set({ solvenciaEstado:'Solvente' }).where(eq(proyectos.id,p.id));
      const approved = (await get(p.id)).json();
      expect(approved.administracion.find((p: { key: string }) => p.key === 'solvencia').value).toBe('Solvente');
    expect(data.administracion.every((p: { editable: boolean }) => p.editable === false)).toBe(true);
  });
  it('número de consultas constante al crecer las intervenciones; no N+1', async () => {
    const p = await fixture(); const spy = vi.spyOn(pool, 'query');
    try { await obtenerCommandCenter(p.id, { id: spec, rol: 'especialista' }); const n = spy.mock.calls.length;
      await db.insert(workItems).values(Array.from({ length: 40 }, (_, i) => ({ proyectoId: p.id, tipo: 'calidad', businessKey: 'version-'+i, estado: 'pendiente' as const })));
      spy.mockClear(); await obtenerCommandCenter(p.id, { id: spec, rol: 'especialista' }); expect(spy.mock.calls.length).toBe(n); expect(n).toBeLessThan(45);
    } finally { spy.mockRestore(); }
  });
  it('activación Amazon paralela idempotente, notificada y cerrada solo por Digital', async () => {
    const p = await fixture(); const first = await db.transaction(tx => habilitarActivacionAmazon(tx, p.id, spec));
    const second = await db.transaction(tx => habilitarActivacionAmazon(tx, p.id, spec)); expect(first).toBe(second);
    expect((await db.select().from(notificaciones)).filter(n => n.rolDestino === 'soporte_digital')).toHaveLength(1);
    expect((await db.select().from(workItems).where(eq(workItems.id, first)))[0]?.estado).toBe('pendiente');
    const r = await app.inject({ method: 'PATCH', url: '/api/fichas-trazabilidad/'+p.id+'/soporte-digital', headers: { cookie: jefeCookie }, payload: { soporteDigitalFechaActivacion: '2026-10-11' } }); expect(r.statusCode).toBe(403);
    const digital = await user('soporte_digital'); await actualizarSeccionSoporteDigital(p.id, { soporteDigitalFechaActivacion: '2026-10-11' }, digital);
    expect((await db.select().from(workItems).where(eq(workItems.id, first)))[0]?.estado).toBe('completado');
    expect((await db.select().from(proyectos).where(eq(proyectos.id, p.id)))[0]?.estado).toBe('en_proceso');
  });
  it('bandeja Digital conserva la activación pendiente aunque formulario ya esté enviado', async () => {
    const p=await fixture();await db.update(fichasTrazabilidad).set({soporteDigitalFechaEnvioFormulario:'2026-10-10'}).where(eq(fichasTrazabilidad.proyectoId,p.id));
    await db.transaction(tx=>habilitarActivacionAmazon(tx,p.id,spec));
    expect((await listarProyectosPendientesSoporteDigital()).some(x=>x.id===p.id)).toBe(true);
    await actualizarSeccionSoporteDigital(p.id,{soporteDigitalFechaActivacion:'2026-10-11'},spec);
    expect((await listarProyectosPendientesSoporteDigital()).some(x=>x.id===p.id)).toBe(false);
  });
});
