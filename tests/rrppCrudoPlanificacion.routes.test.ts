import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../server/app.js';
import { db } from '../server/db/client.js';
import { fichasTrazabilidad, proyectos, servicios, users, workItems, type Rol } from '../server/db/schema/index.js';
import { createSession } from '../server/helpers/session.js';
import { calcularCronogramaProyecto } from '../server/helpers/cronograma.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearFichaComercialCompleta, crearProyectoDePrueba } from './helpers/fixtures.js';

const app = buildApp();
let rrpp: string, jefe: string, comercial: string;
async function sesion(rol: Rol) {
  const id = randomUUID();
  await db.insert(users).values({ id, rol, nombre: rol, email: `${id}@panhouse.test`, passwordHash: 'fixture-session-only' });
  return `panhouse_sid=${await createSession(id)}`;
}
async function call(method: 'GET' | 'PATCH' | 'POST', url: string, cookie: string, payload?: object) {
  return app.inject({ method, url, headers: { cookie }, payload });
}
async function preparado(codigo = 'CR') {
  const p = await crearProyectoDePrueba();
  await crearFichaComercialCompleta(p.id);
  await db.update(proyectos).set({ notificadoRrpp: true, fechaProgramadaInicio: '2026-09-01', fechaDeseadaAutor: '2026-12-01' }).where(eq(proyectos.id, p.id));
  await db.update(servicios).set({ codigo, nombre: codigo === 'CR' ? 'Crudo' : 'Sello editorial', pesoComplejidad: 7, plazoDias: codigo === 'CR' ? 150 : null, plazoInternoDias: codigo === 'SE' ? 60 : null, plazoComercialDias: codigo === 'SE' ? 90 : null }).where(eq(servicios.id, p.servicioId));
  await db.update(fichasTrazabilidad).set({ ingresoFechaIngreso: '2026-01-01', fechaDeseadaCulminacion: '2026-04-15' }).where(eq(fichasTrazabilidad.proyectoId, p.id));
  return p;
}
beforeAll(async () => app.ready());
afterAll(async () => app.close());
beforeEach(async () => {
  await limpiarBaseDeDatos();
  rrpp = await sesion('rrpp'); jefe = await sesion('jefe_area'); comercial = await sesion('comercial');
});

describe('CR canónico: readiness, handoff, plazos y vistas compartidas', () => {
  it('Crudo con diagnóstico e ingreso completos pero sin subtipo bloquea readiness y request directo de handoff', async () => {
    const p = await preparado();
    const saved = await call('PATCH', `/api/rrpp/ingresos/${p.id}`, rrpp, { matrizDiagnosticoGenerado: true, matrizIngresoGenerado: true, temaGeneral: null, posibleTituloLibro: null });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().preparacion).toMatchObject({ listoParaJefatura: false, progreso: 67 });
    expect(saved.json().preparacion.faltantes).toEqual([expect.objectContaining({ campo: 'ingresoServicioSubtipoCrudo' })]);
    expect(saved.json().estado).toBe('diagnostico');
    expect(saved.json().fechaProyectada).toBeNull();
    expect((await call('POST', `/api/proyectos/${p.id}/notificar-jefatura`, rrpp)).statusCode).toBe(409);
    expect((await db.select().from(proyectos).where(eq(proyectos.id, p.id)))[0]!.notificadoJefatura).toBe(false);
    expect((await call('GET', '/api/jefatura/dashboard', jefe)).json().proyectos.some((x: any) => x.id === p.id)).toBe(false);
  });
  it('un work item cerrado no sustituye el readiness guardado del intake en Inicio RRPP', async () => {
    const p = await preparado();
    await db.insert(workItems).values({ proyectoId: p.id, tipo: 'intake_rrpp', estado: 'completado' });
    const ingreso = (await call('GET', '/api/rrpp/dashboard', rrpp)).json().ingresos.find((x: any) => x.id === p.id);
    expect(ingreso).toMatchObject({ estado: 'diagnostico', enviadoJefatura: false, pendiente: 'CRUDO · pendiente de clasificación' });
    expect((await call('POST', `/api/proyectos/${p.id}/notificar-jefatura`, rrpp)).statusCode).toBe(409);
  });
  it.each([
    ['Tripa', 90, '2026-04-01', 'normal', 0],
    ['Capítulo', 150, '2026-05-31', 'posible', 46],
  ] as const)('%s se guarda una vez; plazo y Express son iguales en RRPP, Inicio, Asignaciones, decisión, Proyecto y Ficha', async (subtipo, dias, estandar, estado, compresion) => {
    const p = await preparado();
    const saved = await call('PATCH', `/api/rrpp/ingresos/${p.id}`, rrpp, { ingresoServicioSubtipoCrudo: subtipo, matrizDiagnosticoGenerado: true, matrizIngresoGenerado: true });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({ estado: 'listo', fechaProyectada: estandar, preparacion: { listoParaJefatura: true, progreso: 100 }, datos: { ingresoServicioSubtipoCrudo: subtipo } });
    expect((await db.select().from(proyectos).where(eq(proyectos.id, p.id)))[0]!.notificadoJefatura).toBe(false);
    expect((await call('POST', `/api/proyectos/${p.id}/notificar-jefatura`, rrpp)).statusCode).toBe(201);
    const ingreso = (await call('GET', `/api/rrpp/ingresos/${p.id}`, rrpp)).json();
    expect(ingreso.estado).toBe('enviado'); expect(ingreso.datos.ingresoServicioSubtipoCrudo).toBe(subtipo);
    const inicio = (await call('GET', '/api/jefatura/dashboard', jefe)).json().proyectos.find((x: any) => x.id === p.id);
    const lista = (await call('GET', '/api/jefatura/asignaciones?tab=porAsignar', jefe)).json().proyectos[0];
    const decision = (await call('GET', `/api/jefatura/proyectos/${p.id}/candidatos`, jefe)).json();
    for (const x of [inicio, lista, decision.proyecto]) {
      expect(x).toMatchObject({ subtipoCrudo: subtipo, datoIncompleto: false, impactoCarga: 7, servicio: { nombre: `Crudo ${subtipo}`, peso: 7 }, express: { fechaEstandar: estandar, plazoBaseDias: dias, estado, compresionDias: compresion } });
    }
    expect(decision.contexto).toMatchObject({ subtipoCrudo: subtipo, cierreProyectado: estandar, rrpp: 'Completo' });
    const proyecto = (await call('GET', `/api/proyectos/${p.id}/riesgo`, jefe)).json().proyecto;
    expect(proyecto).toMatchObject({ subtipoCrudo: subtipo, servicio: { nombre: `Crudo ${subtipo}` }, riesgo: { diasPlazo: dias } });
    const ficha = (await call('GET', `/api/fichas-trazabilidad/${p.id}/resumen`, jefe)).json();
    expect(ficha.project.service).toContain(`Crudo ${subtipo}`);
    expect(ficha.overview.find((x: any) => x.key === 'ingresoFechaCierre')?.value).toBe(estandar);
    expect((await call('GET', `/api/fichas-trazabilidad/${p.id}`, jefe)).json().ficha).toMatchObject({ ingresoServicioSubtipoCrudo: subtipo, ingresoFechaCierre: estandar });
    expect((await calcularCronogramaProyecto(p.id)).fechaFinComprometida.toISOString().slice(0, 10)).toBe(estandar);
    expect((await call('PATCH', `/api/fichas-trazabilidad/${p.id}/proyecto-perfil`, comercial, { ingresoServicioSubtipoCrudo: subtipo })).statusCode).toBe(403);
    expect((await call('PATCH', `/api/fichas-trazabilidad/${p.id}/proyecto-perfil`, jefe, { ingresoServicioSubtipoCrudo: subtipo })).statusCode).toBe(403);
  });
  it('cambiar el subtipo canónico recalcula las lecturas y deja obsoleta una decisión Express anterior sin copiar handoff', async () => {
    const p = await preparado();
    await call('PATCH', `/api/rrpp/ingresos/${p.id}`, rrpp, { ingresoServicioSubtipoCrudo: 'Capítulo', matrizDiagnosticoGenerado: true, matrizIngresoGenerado: true });
    await call('POST', `/api/proyectos/${p.id}/notificar-jefatura`, rrpp);
    expect((await call('PATCH', `/api/jefatura/proyectos/${p.id}/express`, jefe, { decision: 'confirmado', fechaEstandar: '2026-05-31', fechaDeseada: '2026-04-15' })).statusCode).toBe(200);
    expect((await call('PATCH', `/api/fichas-trazabilidad/${p.id}/proyecto-perfil`, rrpp, { ingresoServicioSubtipoCrudo: 'Tripa' })).statusCode).toBe(200);
    const decision = (await call('GET', `/api/jefatura/proyectos/${p.id}/candidatos`, jefe)).json();
    expect(decision.proyecto).toMatchObject({ subtipoCrudo: 'Tripa', impactoCarga: 7, express: { estado: 'normal', fechaEstandar: '2026-04-01', decididoEn: null } });
    const resumenRrpp = await call('GET', `/api/rrpp/proyectos/${p.id}/resumen`, rrpp);
    expect(resumenRrpp.statusCode).toBe(200);
    expect(resumenRrpp.json().subtipoCrudo).toBe('Tripa');
    expect((await call('PATCH', `/api/jefatura/proyectos/${p.id}/express`, jefe, { decision: 'confirmado', fechaEstandar: '2026-05-31', fechaDeseada: '2026-04-15' })).statusCode).toBe(409);
    expect((await db.select().from(proyectos).where(eq(proyectos.id, p.id)))[0]!.notificadoJefatura).toBe(true);
  });
  it('legacy enviado sin clasificación se identifica sin inventar subtipo, fecha estándar ni Express', async () => {
    const p = await preparado();
    await db.update(proyectos).set({ notificadoJefatura: true }).where(eq(proyectos.id, p.id));
    const decision = (await call('GET', `/api/jefatura/proyectos/${p.id}/candidatos`, jefe)).json();
    expect(decision.proyecto).toMatchObject({ subtipoCrudo: null, datoIncompleto: true, servicio: { nombre: 'Crudo · pendiente de clasificación' }, express: { estado: 'pendiente_clasificacion', fechaEstandar: null, plazoBaseDias: null } });
    expect(decision.contexto.rrpp).toBe('LEGACY / DATO INCOMPLETO');
    expect((await call('GET', `/api/fichas-trazabilidad/${p.id}/resumen`, jefe)).json().summary.rrpp).toBe('LEGACY / DATO INCOMPLETO');
    expect((await db.select().from(fichasTrazabilidad).where(eq(fichasTrazabilidad.proyectoId, p.id)))[0]!.ingresoServicioSubtipoCrudo).toBeNull();
  });
  it('Sello proyecta 90 comerciales en RRPP, Jefatura y Ficha; preserva 60 internos para riesgo', async () => {
    const p = await preparado('SE');
    const saved = await call('PATCH', `/api/rrpp/ingresos/${p.id}`, rrpp, { matrizDiagnosticoGenerado: true, matrizIngresoGenerado: true });
    expect(saved.json().fechaProyectada).toBe('2026-04-01');
    expect(saved.json().preparacion.checklist).toHaveLength(2);
    await call('POST', `/api/proyectos/${p.id}/notificar-jefatura`, rrpp);
    const decision = (await call('GET', `/api/jefatura/proyectos/${p.id}/candidatos`, jefe)).json();
    expect(decision.proyecto.express).toMatchObject({ fechaEstandar: '2026-04-01', plazoBaseDias: 90, estado: 'normal' });
    expect((await call('GET', `/api/proyectos/${p.id}/riesgo`, jefe)).json().proyecto.riesgo.diasPlazo).toBe(60);
  });
});
