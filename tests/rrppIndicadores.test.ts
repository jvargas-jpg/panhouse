import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import { auditLogs, autores, fichasTrazabilidad, fichaLanzamientoReuniones, proyectosAutores, rrppEventos, rrppPublicaciones, workItems, ROLES } from '../server/db/schema/index.js';
import { normalizarCategoriaRrpp, obtenerIndicadoresRrpp, periodoRrppSchema, ventanaRrpp } from '../server/helpers/rrppIndicadores.js';
import { crearFichaComercialCompleta, crearProyectoDePrueba, crearAutor } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { registrarYLoguear } from './helpers/auth.js';
import { crearAppDePrueba } from './helpers/testApp.js';

const rango = { from: '2026-10-01', to: '2026-10-31' };
const hoy = '2026-10-20';
const consultar = () => obtenerIndicadoresRrpp(rango, hoy);
async function plan(fecha = '2026-10-01T04:00:00Z', campos: Partial<typeof fichasTrazabilidad.$inferInsert> = {}, estado: 'pendiente' | 'cancelado' = 'pendiente') {
  const p = await crearProyectoDePrueba();
  const f = await crearFichaComercialCompleta(p.id);
  if (Object.keys(campos).length) await db.update(fichasTrazabilidad).set(campos).where(eq(fichasTrazabilidad.id, f.id));
  await db.insert(workItems).values({ proyectoId: p.id, tipo: 'lanzamiento', businessKey: 'planificacion', createdAt: new Date(fecha), estado });
  return { p, f };
}
async function evento(proyectoId: string, fecha: string, estado = 'Completada', tipo = 'Lanzamiento') {
  return (await db.insert(rrppEventos).values({ proyectoId, clientKey: randomUUID(), fecha, estado, tipo }).returning())[0]!;
}
async function pieza(proyectoId: string, creada = '2026-10-01T04:00:00Z', publicada?: string, estado = 'Publicado', tipo = 'Futuro Autor') {
  const p = (await db.insert(rrppPublicaciones).values({ proyectoId, clientKey: randomUUID(), tipo, estado, createdAt: new Date(creada) }).returning())[0]!;
  if (publicada) await db.insert(auditLogs).values({ proyectoId, accion: 'PUBLICACION_RRPP_REALIZADA', entityType: 'publicacion_rrpp', entityId: p.id, createdAt: new Date(publicada) });
  return p;
}

describe('Indicadores RRPP: métricas PostgreSQL', () => {
  beforeEach(limpiarBaseDeDatos);
  it('vacío muestra ceros, categorías vacías y comparaciones sin base', async () => {
    const d = await consultar();
    expect(d.summary).toMatchObject({ proyectosConPlan: 0, eventosRealizados: 0, piezasPublicadas: 0, satisfaccionExcelente: null, valoraciones: 0, oportunidades: 0, comparacionPlanes: null });
    expect(d.launches.fases).toEqual([]); expect(d.upcoming).toEqual([]); expect(d.monthly).toHaveLength(1);
  });
  it('solo cuenta activaciones canónicas; no confunde intake ni otros trabajos', async () => {
    await plan(); await plan('2026-11-01T04:00:00Z');
    const p = await crearProyectoDePrueba();
    await db.insert(workItems).values([{ proyectoId: p.id, tipo: 'intake_rrpp' }, { proyectoId: p.id, tipo: 'lanzamiento', businessKey: 'otro' }]);
    const d = await consultar(); expect(d.summary.proyectosConPlan).toBe(1); expect(d.monthly[0]?.planificaciones).toBe(1);
  });
  it('incluye exactamente ambos días en Caracas y excluye límites externos', async () => {
    for (const fecha of ['2026-10-01T03:59:59.999Z', '2026-10-01T04:00:00Z', '2026-11-01T03:59:59.999Z', '2026-11-01T04:00:00Z']) await plan(fecha);
    const d = await consultar(); expect(d.summary.proyectosConPlan).toBe(2); expect(d.monthly[0]?.planificaciones).toBe(2);
  });
  it('eventos requieren Completada y fecha no futura, sin inferir de fase o fecha pasada', async () => {
    const { p } = await plan();
    await evento(p.id, '2026-10-01'); await evento(p.id, '2026-10-20', ' completada ', '  LANZAMIENTO digital ');
    await evento(p.id, '2026-10-05', 'En curso', 'Feria'); await evento(p.id, '2026-10-21'); await evento(p.id, '2026-09-30');
    const d = await consultar(); expect(d.events.total).toBe(4); expect(d.summary.eventosRealizados).toBe(2); expect(d.launches.realizados).toBe(2); expect(d.monthly[0]?.eventos).toBe(2);
  });
  it('lanzamientos realizados solo usan tipos de lanzamiento, conserva otros eventos', async () => {
    const { p } = await plan(); await evento(p.id, '2026-10-04', 'Completada', 'Feria'); await evento(p.id, '2026-10-04', 'Completada', 'Encuentro local');
    const d = await consultar(); expect(d.summary.eventosRealizados).toBe(2); expect(d.launches.realizados).toBe(0); expect(d.events.tipos.map(t => t.nombre)).toContain('encuentro local');
  });
  it('publicaciones cuentan la primera confirmación auditada, no su creación ni updatedAt', async () => {
    const { p } = await plan();
    await pieza(p.id, '2026-08-01T04:00:00Z', '2026-10-05T04:00:00Z');
    await pieza(p.id); await pieza(p.id, '2026-10-01T04:00:00Z', undefined, 'En revisión');
    const repeated = await pieza(p.id, '2026-08-01T04:00:00Z', '2026-09-30T04:00:00Z');
    await db.insert(auditLogs).values({ proyectoId: p.id, entityId: repeated.id, entityType: 'publicacion_rrpp', accion: 'PUBLICACION_RRPP_REALIZADA', createdAt: new Date('2026-10-08T04:00:00Z') });
    const d = await consultar(); expect(d.summary.piezasPublicadas).toBe(1); expect(d.publications.total).toBe(2); expect(d.publications.publicadasSinFecha).toBe(1); expect(d.monthly[0]?.publicaciones).toBe(1);
  });
  it('auditoría de publicación respeta medianoche local en ambos extremos', async () => {
    const { p } = await plan();
    for (const fecha of ['2026-10-01T03:59:59.999Z', '2026-10-01T04:00:00Z', '2026-11-01T03:59:59.999Z', '2026-11-01T04:00:00Z']) await pieza(p.id, '2026-08-01T04:00:00Z', fecha);
    expect((await consultar()).summary.piezasPublicadas).toBe(2);
  });
  it('satisfacción es Excelente / valoraciones cualitativas; null visible sin escala inventada', async () => {
    await plan(undefined, { asesoriaNivelSatisfaccion: 'Excelente' }); await plan(undefined, { asesoriaNivelSatisfaccion: 'Bueno' }); await plan(undefined, { asesoriaNivelSatisfaccion: 'Regular' }); await plan();
    await plan('2026-09-01T04:00:00Z', { asesoriaNivelSatisfaccion: 'Excelente' });
    const d = await consultar(); expect(d.summary.valoraciones).toBe(3); expect(d.summary.satisfaccionExcelente).toBe(33.3); expect(d.satisfaction.find(s => s.nombre === 'Sin registrar')?.cantidad).toBe(1);
  });
  it('oportunidades deduplican proyecto + interés, no texto libre ni contratos especializados', async () => {
    await plan(undefined, { asesoriaVentaCruzada: ['Feria', 'Feria', ' feria ', 'Impresión'], asesoriaCotizacionImpresion: true });
    await plan(undefined, { asesoriaVentaCruzada: ['Feria', 'Interés nuevo'], asesoriaNotaDistribucion: 'Una nota no es un interés tipificado' });
    await plan(); await plan('2026-09-01T04:00:00Z', { asesoriaVentaCruzada: ['Distribución'] });
    const d = await consultar(); expect(d.summary.oportunidades).toBe(4); expect(d.opportunities.proyectos).toBe(2); expect(d.opportunities.tipos.find(t => t.nombre === 'Feria')?.cantidad).toBe(2);
  });
  it('donut conserva null y planes cancelados sin inventar fases; denominador igual al KPI', async () => {
    await plan(undefined, { asesoriaFase: 'En asesoramiento' }); await plan(undefined, {}, 'cancelado');
    const d = await consultar(); expect(d.launches.cancelados).toBe(1); expect(d.launches.fases).toEqual(expect.arrayContaining([{ nombre: 'Sin clasificar', cantidad: 1, porcentaje: 50 }]));
    expect(d.launches.fases.reduce((s, x) => s + x.cantidad, 0)).toBe(d.summary.proyectosConPlan);
  });
  it('los porcentajes de distribución suman 100 incluso con tercios', async () => {
    await plan(undefined, { asesoriaFase: 'En asesoramiento' }); await plan(undefined, { asesoriaFase: 'Esperando fecha' }); await plan();
    expect((await consultar()).launches.fases.reduce((n, x) => n + x.porcentaje, 0)).toBeCloseTo(100, 8);
  });
  it('compara N días inmediatamente anteriores y separa correctamente un mes compartido', async () => {
    await plan('2026-10-10T04:00:00Z'); await plan('2026-10-14T04:00:00Z'); await plan('2026-10-15T04:00:00Z'); await plan('2026-10-20T04:00:00Z'); await plan('2026-10-22T04:00:00Z');
    const d = await obtenerIndicadoresRrpp({ from: '2026-10-15', to: '2026-10-21' }, hoy);
    expect(d.periodo).toMatchObject({ dias: 7, anteriorFrom: '2026-10-08', anteriorTo: '2026-10-14' });
    expect(d.summary.comparacionPlanes).toBe(0); expect(d.monthly[0]?.planificaciones).toBe(2); expect(d.previousMonthly[0]?.planificaciones).toBe(2);
  });
  it('comparaciones de eventos y publicaciones se basan en los mismos N días', async () => {
    const { p } = await plan();
    await evento(p.id, '2026-10-01'); await evento(p.id, '2026-10-02'); await evento(p.id, '2026-09-20');
    await pieza(p.id, undefined, '2026-10-02T04:00:00Z'); await pieza(p.id, undefined, '2026-09-20T04:00:00Z');
    const d = await consultar(); expect(d.summary.comparacionEventos).toBe(100); expect(d.summary.comparacionPublicaciones).toBe(0);
  });
  it('próximos solo pautados futuros, ordenados, sin culminados/cancelados ni solo tentativos', async () => {
    await plan('2026-08-01T04:00:00Z', { asesoriaFechaPautadaAutor: '2026-11-02' });
    await plan(undefined, { asesoriaFechaPautadaAutor: '2026-10-21' });
    await plan(undefined, { asesoriaFechaPautadaAutor: hoy });
    await plan(undefined, { lanzamientoPromocionFechaTentativa: '2026-10-22' });
    await plan(undefined, { asesoriaFechaPautadaAutor: '2026-10-23', asesoriaFase: 'Culminado' });
    await plan(undefined, { asesoriaFechaPautadaAutor: '2026-10-24' }, 'cancelado');
    const d = await consultar(); expect(d.upcoming.map(x => x.fecha)).toEqual(['2026-10-21', '2026-11-02']);
  });
  it('publicaciones recientes: orden de registro, autor/coautor, estado y responsable sin canal inventado', async () => {
    const { p } = await plan(); await db.update(autores).set({ nombre: 'Autora principal' }).where(eq(autores.id, p.autorId));
    const coautor = await crearAutor({ nombre: 'Coautora' }); await db.insert(proyectosAutores).values({ proyectoId: p.id, autorId: coautor.id });
    await pieza(p.id, '2026-10-01T04:00:00Z', undefined, 'Nuevo'); const ultima = await pieza(p.id, '2026-10-12T04:00:00Z', undefined, 'En revisión', 'Novedades');
    const d = await consultar(); expect(d.recent[0]?.id).toBe(ultima.id); expect(d.recent[0]?.nombre).toBe('Autora principal, Coautora'); expect(d.recent[0]?.estado).toBe('En revisión'); expect(d.recent[0]).not.toHaveProperty('canal');
  });
  it('reuniones canónicas no duplican aliases y requieren confirmación, adicionales incluidas', async () => {
    const { f } = await plan(undefined, { lanzamientoPromocionFechaPrimeraReunion: '2026-10-02', lanzamientoPromocionPrimeraRealizada: true, asesoriaFechaPrimeraReunion: '2026-10-02', lanzamientoPromocionFechaSegundaReunion: '2026-10-03' });
    await db.insert(fichaLanzamientoReuniones).values([{ fichaId: f.id, fecha: '2026-10-04', realizada: true }, { fichaId: f.id, fecha: '2026-10-05', realizada: false }, { fichaId: f.id, fecha: '2026-10-21', realizada: true }]);
    const d = await consultar(); expect(d.meetings).toMatchObject({ realizadas: 2, primeras: 1, segundas: 0, adicionales: 1, pendientesSegunda: 1, sinConfirmacion: 1, promedio: 2 }); expect(d.monthly[0]?.reuniones).toBe(2);
  });
  it('normalización SQL conserva tipos/estados desconocidos y errores como Sin clasificar', async () => {
    const { p } = await plan(); await evento(p.id, '2026-10-01', 'Estado heredado', 'Tipo nuevo'); await pieza(p.id, undefined, undefined, '#REF!', 'Tipo histórico');
    const d = await consultar(); expect(d.events.estados[0]?.nombre).toBe('Estado heredado'); expect(d.publications.estados[0]?.nombre).toBe('Sin clasificar'); expect(d.publications.tipos[0]?.nombre).toBe('Tipo histórico');
  });
});
describe('Períodos y normalización RRPP', () => {
  it.each(['from=2026-02-30&to=2026-03-01', 'from=2026-10-01', 'to=2026-10-01', 'from=2026-10-02&to=2026-10-01', 'from=2020-01-01&to=2026-10-01', 'canal=Instagram'])('rechaza %s', query => expect(periodoRrppSchema.safeParse(Object.fromEntries(new URLSearchParams(query))).success).toBe(false));
  it('año hasta hoy y año bisiesto con fronteras inclusivas', () => { expect(ventanaRrpp({}, hoy).from).toBe('2026-01-01'); const v = ventanaRrpp({ from: '2024-02-28', to: '2024-03-01' }, hoy); expect(v.dias).toBe(3); expect(v.desde.toISOString()).toBe('2024-02-28T04:00:00.000Z'); expect(v.hasta.toISOString()).toBe('2024-03-02T04:00:00.000Z'); });
  it('Caracas histórico respeta UTC-4:30 y cuenta días calendario al cambiar de huso', () => {
    const antiguo = ventanaRrpp({ from: '2015-10-01', to: '2015-10-31' }, hoy);
    expect(antiguo.desde.toISOString()).toBe('2015-10-01T04:30:00.000Z'); expect(antiguo.dias).toBe(31);
    const cambio = ventanaRrpp({ from: '2016-05-01', to: '2016-05-02' }, hoy);
    expect(cambio.dias).toBe(2); expect(cambio.desde.toISOString()).toBe('2016-05-01T04:30:00.000Z'); expect(cambio.hasta.toISOString()).toBe('2016-05-03T04:00:00.000Z');
  });
  it.each([[null, 'fase', 'Sin clasificar'], ['En asesoriamiento', 'fase', 'En asesoramiento'], [' EXCELENTE ', 'satisfaccion', 'Excelente'], ['#REF!', 'publicacionEstado', 'Sin clasificar'], ['  REDES   SOCIALES ', 'oportunidad', 'REDES SOCIALES'], ['Nueva categoría', 'publicacionTipo', 'Nueva categoría']])('normaliza %s', (valor, dominio, esperado) => expect(normalizarCategoriaRrpp(valor, dominio!)).toBe(esperado));
});
describe('HTTP Indicadores RRPP', () => {
  let app: ReturnType<typeof crearAppDePrueba>;
  beforeEach(async () => { await limpiarBaseDeDatos(); app = crearAppDePrueba(); await app.ready(); });
  afterEach(async () => { await app.close(); });
  it.each(ROLES)('RBAC %s: solo RRPP y Dirección pueden leer', async rol => {
    const cookie = await registrarYLoguear(app, rol); const r = await request(app.server).get('/api/rrpp/indicadores?from=2026-10-01&to=2026-10-31').set('Cookie', cookie);
    expect(r.status).toBe(rol === 'rrpp' || rol === 'direccion' ? 200 : 403); expect(JSON.stringify(r.body)).not.toMatch(/password|email|detalles|actorId/);
  });
  it('401 sin sesión y 400 en consultas inválidas', async () => {
    expect((await request(app.server).get('/api/rrpp/indicadores')).status).toBe(401);
    const cookie = await registrarYLoguear(app, 'rrpp'); for (const query of ['from=2026-02-30&to=2026-03-01', 'from=2026-10-01', 'tipo=Feria']) expect((await request(app.server).get('/api/rrpp/indicadores?' + query).set('Cookie', cookie)).status).toBe(400);
  });
  it('GET es solo lectura, no crea planes ni notificaciones ni auditoría', async () => {
    const cookie = await registrarYLoguear(app, 'rrpp'); const before = await db.select().from(auditLogs); await request(app.server).get('/api/rrpp/indicadores').set('Cookie', cookie); expect(await db.select().from(auditLogs)).toEqual(before); expect(await db.select().from(workItems)).toEqual([]);
  });
});
