import { beforeEach, describe, expect, it } from 'vitest';
import { obtenerMetricasComerciales } from '../server/helpers/metricas.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAutor, crearPresupuesto, crearProyecto, crearServicio, crearUnidad } from './helpers/fixtures.js';

// Ancla fija al mediodía UTC — evita que un test corriendo cerca de la
// medianoche en la zona horaria de la máquina cruce sin querer al día
// (o mes) siguiente/anterior al construir las fechas de prueba.
const AHORA = new Date('2026-06-15T12:00:00Z');

describe('obtenerMetricasComerciales (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('cuenta clientesMesActual y clientesMesAnterior por separado, y calcula el % de crecimiento', async () => {
    // Mes actual (junio 2026): 3 autores.
    await crearAutor({ createdAt: new Date('2026-06-01T10:00:00Z') });
    await crearAutor({ createdAt: new Date('2026-06-10T10:00:00Z') });
    await crearAutor({ createdAt: new Date('2026-06-15T09:00:00Z') });
    // Mes anterior (mayo 2026): 2 autores.
    await crearAutor({ createdAt: new Date('2026-05-05T10:00:00Z') });
    await crearAutor({ createdAt: new Date('2026-05-31T23:00:00Z') });
    // Fuera de ambos meses (no debe contar en ninguno de los dos).
    await crearAutor({ createdAt: new Date('2026-04-15T10:00:00Z') });

    const metricas = await obtenerMetricasComerciales(AHORA);

    expect(metricas.kpis.clientesMesActual).toBe(3);
    expect(metricas.kpis.clientesMesAnterior).toBe(2);
    // (3-2)/2 * 100 = 50%
    expect(metricas.kpis.crecimientoClientesPorcentaje).toBe(50);
  });

  it('devuelve crecimientoClientesPorcentaje null cuando el mes anterior tuvo 0 clientes (no divide por cero)', async () => {
    await crearAutor({ createdAt: new Date('2026-06-01T10:00:00Z') });

    const metricas = await obtenerMetricasComerciales(AHORA);

    expect(metricas.kpis.clientesMesActual).toBe(1);
    expect(metricas.kpis.clientesMesAnterior).toBe(0);
    expect(metricas.kpis.crecimientoClientesPorcentaje).toBeNull();
  });

  it('clientesPorMes trae exactamente 6 meses (Ene a Jun si "ahora" es junio), en orden cronológico', async () => {
    await crearAutor({ createdAt: new Date('2026-01-15T10:00:00Z') });
    await crearAutor({ createdAt: new Date('2026-03-01T10:00:00Z') });
    await crearAutor({ createdAt: new Date('2026-03-20T10:00:00Z') });
    await crearAutor({ createdAt: new Date('2026-06-05T10:00:00Z') });
    // Antes de la ventana de 6 meses (diciembre 2025): no debe aparecer
    // en ningún bucket de clientesPorMes.
    await crearAutor({ createdAt: new Date('2025-12-20T10:00:00Z') });

    const metricas = await obtenerMetricasComerciales(AHORA);

    expect(metricas.clientesPorMes.map((m) => m.mes)).toEqual(['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun']);
    expect(metricas.clientesPorMes.map((m) => m.cantidad)).toEqual([1, 0, 2, 0, 0, 1]);
    expect(metricas.clientesPorMes.reduce((total, m) => total + m.cantidad, 0)).toBe(4); // sin contar el de diciembre 2025
  });

  it('proyectosPorMes trae exactamente 6 meses (Ene a Jun si "ahora" es junio), en orden cronológico', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const datosComunes = { autorId: autor.id, servicioId: servicio.id, unidadId: unidad.id, presupuestoId: presupuesto.id, fechaProgramadaInicio: '2026-01-01' };

    await crearProyecto({ ...datosComunes, createdAt: new Date('2026-01-15T10:00:00Z') });
    await crearProyecto({ ...datosComunes, createdAt: new Date('2026-03-01T10:00:00Z') });
    await crearProyecto({ ...datosComunes, createdAt: new Date('2026-03-20T10:00:00Z') });
    await crearProyecto({ ...datosComunes, createdAt: new Date('2026-06-05T10:00:00Z') });
    // Antes de la ventana de 6 meses (diciembre 2025): no debe aparecer
    // en ningún bucket de proyectosPorMes.
    await crearProyecto({ ...datosComunes, createdAt: new Date('2025-12-20T10:00:00Z') });

    const metricas = await obtenerMetricasComerciales(AHORA);

    expect(metricas.proyectosPorMes.map((m) => m.mes)).toEqual(['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun']);
    expect(metricas.proyectosPorMes.map((m) => m.cantidad)).toEqual([1, 0, 2, 0, 0, 1]);
    expect(metricas.proyectosPorMes.reduce((total, m) => total + m.cantidad, 0)).toBe(4); // sin contar el de diciembre 2025
  });

  it('topPaises agrupa por país, ordena de mayor a menor, no corta el ranking y excluye autores sin país', async () => {
    await crearAutor({ pais: 'Venezuela' });
    await crearAutor({ pais: 'Venezuela' });
    await crearAutor({ pais: 'Venezuela' });
    await crearAutor({ pais: 'Colombia' });
    await crearAutor({ pais: 'Colombia' });
    await crearAutor({ pais: 'México' });
    await crearAutor({ pais: 'España' });
    await crearAutor({ pais: 'Argentina' });
    await crearAutor({ pais: 'Perú' }); // 6to país — ya no se recorta, debe seguir apareciendo
    await crearAutor({}); // sin país — no debe competir por el ranking

    const metricas = await obtenerMetricasComerciales(AHORA);

    expect(metricas.topPaises).toHaveLength(6);
    expect(metricas.topPaises[0]).toEqual({ pais: 'venezuela', cantidad: 3 });
    expect(metricas.topPaises[1]).toEqual({ pais: 'colombia', cantidad: 2 });
    expect(metricas.topPaises.map((p) => p.pais)).toContain('perú');
  });

  it('topPaises agrupa en SQL con lower(pais): "Venezuela" y "venezuela" suman un solo bloque, no dos entradas separadas', async () => {
    await crearAutor({ pais: 'Venezuela' });
    await crearAutor({ pais: 'venezuela' });
    await crearAutor({ pais: 'VENEZUELA' });
    await crearAutor({ pais: 'Colombia' });

    const metricas = await obtenerMetricasComerciales(AHORA);

    expect(metricas.topPaises).toHaveLength(2);
    expect(metricas.topPaises[0]).toEqual({ pais: 'venezuela', cantidad: 3 });
    expect(metricas.topPaises[1]).toEqual({ pais: 'colombia', cantidad: 1 });
  });

  it('topPaises cuenta autores de cualquier fecha (no solo los últimos 6 meses) — es un ranking histórico, no una tendencia', async () => {
    await crearAutor({ pais: 'Venezuela', createdAt: new Date('2020-01-01T10:00:00Z') });
    await crearAutor({ pais: 'Venezuela', createdAt: new Date('2026-06-01T10:00:00Z') });

    const metricas = await obtenerMetricasComerciales(AHORA);

    expect(metricas.topPaises[0]).toEqual({ pais: 'venezuela', cantidad: 2 });
  });

  it('proyectosMesActual solo cuenta proyectos creados en el mes en curso', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });

    await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-06-01',
      createdAt: new Date('2026-06-05T10:00:00Z'),
    });
    await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-06-01',
      createdAt: new Date('2026-06-14T10:00:00Z'),
    });
    // Mes anterior: no debe contar.
    await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-05-01',
      createdAt: new Date('2026-05-20T10:00:00Z'),
    });

    const metricas = await obtenerMetricasComerciales(AHORA);

    expect(metricas.kpis.proyectosMesActual).toBe(2);
  });

  it('proyectosMesActual no cuenta proyectos con createdAt futuro (fuera del mes en curso por arriba)', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });

    await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-06-01',
      createdAt: new Date('2026-06-10T10:00:00Z'),
    });
    // Mes siguiente: no debe contar como "mes en curso".
    await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-07-01',
      createdAt: new Date('2026-07-01T10:00:00Z'),
    });

    const metricas = await obtenerMetricasComerciales(AHORA);

    expect(metricas.kpis.proyectosMesActual).toBe(1);
  });

  it('proyectosPorServicio agrupa por tipo de servicio y cuenta todos los proyectos, ordenado de mayor a menor', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const [servicioEf, servicioSe] = await Promise.all([
      crearServicio({ codigo: 'EF', nombre: 'Escritura Fantasma', pesoComplejidad: 4, plazoDias: 180 }),
      crearServicio({ codigo: 'SE', nombre: 'Servicios Editoriales', pesoComplejidad: 1, plazoInternoDias: 60, plazoComercialDias: 90 }),
    ]);

    for (let i = 0; i < 3; i++) {
      await crearProyecto({
        autorId: autor.id,
        servicioId: servicioEf.id,
        unidadId: unidad.id,
        presupuestoId: presupuesto.id,
        fechaProgramadaInicio: '2026-06-01',
      });
    }
    await crearProyecto({
      autorId: autor.id,
      servicioId: servicioSe.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-06-01',
    });

    const metricas = await obtenerMetricasComerciales(AHORA);

    expect(metricas.proyectosPorServicio).toEqual([
      { servicio: 'Escritura Fantasma', cantidad: 3 },
      { servicio: 'Servicios Editoriales', cantidad: 1 },
    ]);
  });

  it('devuelve todo en cero/vacío cuando no hay autores ni proyectos', async () => {
    const metricas = await obtenerMetricasComerciales(AHORA);

    expect(metricas.kpis).toEqual({
      clientesMesActual: 0,
      clientesMesAnterior: 0,
      crecimientoClientesPorcentaje: null,
      proyectosMesActual: 0,
    });
    expect(metricas.clientesPorMes.every((m) => m.cantidad === 0)).toBe(true);
    expect(metricas.proyectosPorMes.every((m) => m.cantidad === 0)).toBe(true);
    expect(metricas.topPaises).toEqual([]);
    expect(metricas.proyectosPorServicio).toEqual([]);
  });
});
