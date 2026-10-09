import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import { auditLogs, fichasTrazabilidad, proyectos, proyectosAutores } from '../server/db/schema/index.js';
import { obtenerIndicadoresComerciales, ventanaIndicadores } from '../server/helpers/indicadoresComerciales.js';
import { listarProyectosActivosResumen, notificarRrppProyectoBase } from '../server/helpers/proyectos.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAutor, crearPresupuesto, crearProyecto, crearServicio, crearUnidad, crearUsuario } from './helpers/fixtures.js';

const AHORA = new Date('2026-10-09T16:00:00Z');
async function proyecto(fecha: string, completo = false) {
  const autor = await crearAutor({ createdAt: new Date(fecha) });
  const unidad = await crearUnidad();
  const presupuesto = await crearPresupuesto();
  const servicio = await crearServicio({ codigo: `S${autor.id}`, nombre: 'Crudo', pesoComplejidad: 1, plazoDias: 180 });
  const p = await crearProyecto({ autorId: autor.id, unidadId: unidad.id, presupuestoId: presupuesto.id, servicioId: servicio.id, fechaProgramadaInicio: '2026-09-01', createdAt: new Date(fecha) });
  if (completo) await db.insert(fichasTrazabilidad).values({ proyectoId: p.id, ingresoFechaIngreso: '2026-09-01', ingresoServicioEjecucion: 'Normal', ingresoServicioAlianza: false, capitulosPactados: '1 a 5', paginasPactadas: '100' });
  return p;
}
describe('indicadores comerciales: cohorte y agregaciones', () => {
  beforeEach(limpiarBaseDeDatos);
  it.each(['3m', '6m', '12m'] as const)('rellena meses vacíos sin inventar porcentajes (%s)', async (periodo) => {
    const d = await obtenerIndicadoresComerciales(periodo, AHORA);
    expect(d.monthly).toHaveLength(Number.parseInt(periodo));
    expect(d.monthly.every((m) => m.autores === 0 && m.proyectos === 0 && m.listos === 0)).toBe(true);
    expect(d.summary).toEqual({ autores: 0, proyectos: 0, listos: 0, completitud: null, crecimientoAutores: null, crecimientoProyectos: null });
    expect(d.services).toEqual([]); expect(d.countries).toEqual([]);
    expect(d.funnel.entregadosPorcentaje).toBeNull(); expect(d.timings.promedioDias).toBeNull();
  });
  it('fronteras mensuales en Caracas cruzan año sin depender del host', () => {
    const v = ventanaIndicadores(3, new Date('2026-01-01T03:59:59Z'));
    expect(v.desde.toISOString()).toBe('2025-10-01T04:00:00.000Z');
    expect(v.anteriorDesde.toISOString()).toBe('2025-07-01T04:00:00.000Z');
  });
  it('excluye registros futuros y respeta el primer instante del período', async () => {
    for (const fecha of ['2026-05-01T03:59:59Z', '2026-05-01T04:00:00Z', '2026-10-09T16:00:00Z', '2026-11-01T04:00:00Z']) await proyecto(fecha);
    const d = await obtenerIndicadoresComerciales('6m', AHORA);
    expect(d.summary.autores).toBe(1); expect(d.summary.proyectos).toBe(1);
    expect(d.monthly[0]).toMatchObject({ clave: '2026-05', mes: 'May', autores: 1, proyectos: 1 });
  });
  it('el selector cambia coherentemente todos los bloques', async () => {
    await proyecto('2026-02-01T12:00:00Z', true); await proyecto('2026-05-01T12:00:00Z', true); await proyecto('2026-09-01T12:00:00Z', true);
    for (const [periodo, total] of [['3m', 1], ['6m', 2], ['12m', 3]] as const) {
      const d = await obtenerIndicadoresComerciales(periodo, AHORA);
      expect(d.summary.autores).toBe(total); expect(d.summary.proyectos).toBe(total); expect(d.summary.listos).toBe(total);
      expect(d.funnel.completos).toBe(total); expect(d.services[0]?.cantidad).toBe(total); expect(d.countries[0]?.cantidad).toBe(total);
    }
  });
  it('compara altas con los N meses anteriores, incluidos ceros intermedios', async () => {
    await proyecto('2026-02-01T12:00:00Z'); await proyecto('2026-05-01T12:00:00Z'); await proyecto('2026-09-01T12:00:00Z', true);
    const d = await obtenerIndicadoresComerciales('6m', AHORA);
    expect(d.summary.crecimientoAutores).toBe(100); expect(d.summary.crecimientoProyectos).toBe(100);
    expect(d.monthly.map((m) => m.proyectos)).toEqual([1, 0, 0, 0, 1, 0]);
    expect(d.monthly.map((m) => m.listos)).toEqual([0, 0, 0, 0, 1, 0]);
    expect(d.summary.completitud).toBe(50);
  });
  it('preserva crecimiento negativo y comparación indefinida sobre cero', async () => {
    await proyecto('2026-02-01T12:00:00Z'); await proyecto('2026-03-01T12:00:00Z'); await proyecto('2026-09-01T12:00:00Z');
    expect((await obtenerIndicadoresComerciales('6m', AHORA)).summary.crecimientoProyectos).toBe(-50);
    expect((await obtenerIndicadoresComerciales('12m', AHORA)).summary.crecimientoProyectos).toBeNull();
  });
  it('agrupa países con mayúsculas/espacios, conserva desconocidos y sin país', async () => {
    for (const pais of [' Venezuela ', 'venezuela', 'Colombia', 'sdd', '', null]) await crearAutor({ pais, createdAt: new Date('2026-09-01T12:00:00Z') });
    await crearAutor({ pais: 'México', createdAt: new Date('2025-01-01') });
    const d = await obtenerIndicadoresComerciales('6m', AHORA);
    expect(d.countries).toEqual(expect.arrayContaining([{ pais: 'venezuela', cantidad: 2 }, { pais: 'Sin país registrado', cantidad: 2 }, { pais: 'colombia', cantidad: 1 }, { pais: 'sdd', cantidad: 1 }]));
    expect(d.countries).toHaveLength(4); expect(d.countries.reduce((s, p) => s + p.cantidad, 0)).toBe(d.summary.autores);
  });
  it('ordena el catálogo real por cantidad y no duplica coautoría', async () => {
    const p = await proyecto('2026-09-01T12:00:00Z', true); await proyecto('2026-09-02T12:00:00Z');
    const otro = await proyecto('2026-09-03T12:00:00Z');
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 1, plazoDias: 180 });
    await db.update(proyectos).set({ servicioId: servicio.id }).where(eq(proyectos.id, otro.id));
    const coautor = await crearAutor({ createdAt: new Date('2020-01-01') });
    await db.insert(proyectosAutores).values({ proyectoId: p.id, autorId: coautor.id });
    const d = await obtenerIndicadoresComerciales('6m', AHORA);
    expect(d.services).toEqual([{ servicio: 'Crudo', cantidad: 2 }, { servicio: 'Escritura fantasma', cantidad: 1 }]);
    expect(d.summary.proyectos).toBe(3); expect(d.summary.listos).toBe(1);
  });
  it('usa readiness canónica sin confundir listo con entregado; soporta legacy', async () => {
    const p = await proyecto('2026-09-01T12:00:00Z', true);
    await db.delete(proyectosAutores).where(eq(proyectosAutores.proyectoId, p.id));
    let d = await obtenerIndicadoresComerciales('6m', AHORA);
    expect(d.summary.listos).toBe(1); expect(d.funnel.entregados).toBe(0);
    expect((await listarProyectosActivosResumen())[0]?.listoParaRrpp).toBe(true);
    const actor = await crearUsuario('comercial');
    await notificarRrppProyectoBase(p.id, actor.id);
    d = await obtenerIndicadoresComerciales('6m', AHORA);
    expect(d.funnel.entregados).toBe(1); expect(d.funnel.entregadosPorcentaje).toBe(100);
    expect(await db.select().from(auditLogs).where(eq(auditLogs.accion, 'RRPP_NOTIFICADO'))).toHaveLength(1);
    await db.update(fichasTrazabilidad).set({ paginasPactadas: '  ' }).where(eq(fichasTrazabilidad.proyectoId, p.id));
    d = await obtenerIndicadoresComerciales('6m', AHORA);
    expect(d.summary.listos).toBe(0); expect(d.funnel.entregados).toBe(1);
    expect(d.timings.promedioDias).toBeNull();
  });
  it.each(['ingresoFechaIngreso', 'capitulosPactados', 'paginasPactadas'] as const)('mismo evaluador que activos al faltar %s', async (campo) => {
    const p = await proyecto('2026-09-01T12:00:00Z', true);
    await db.update(fichasTrazabilidad).set({ [campo]: null }).where(eq(fichasTrazabilidad.proyectoId, p.id));
    expect((await obtenerIndicadoresComerciales('6m', AHORA)).summary.listos).toBe(0);
    expect((await listarProyectosActivosResumen())[0]?.listoParaRrpp).toBe(false);
  });
  it('una ficha ausente no se considera completa aunque el proyecto tenga sus catálogos', async () => {
    await proyecto('2026-09-01T12:00:00Z');
    const d = await obtenerIndicadoresComerciales('6m', AHORA);
    expect(d.summary.listos).toBe(0); expect(d.summary.completitud).toBe(0);
    expect((await listarProyectosActivosResumen())[0]?.listoParaRrpp).toBe(false);
  });
  it('incluye todos los estados: el denominador es altas, no proyectos activos', async () => {
    const p = await proyecto('2026-09-01T12:00:00Z', true);
    await db.update(proyectos).set({ estado: 'culminado' }).where(eq(proyectos.id, p.id));
    const d = await obtenerIndicadoresComerciales('6m', AHORA);
    expect(d.summary.proyectos).toBe(1); expect(d.summary.listos).toBe(1); expect(d.summary.completitud).toBe(100);
  });
});
