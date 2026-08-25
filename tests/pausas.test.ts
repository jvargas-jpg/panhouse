import { beforeEach, describe, expect, it } from 'vitest';
import { calcularDiasEfectivosProyecto, crearPausa, listarPausasProyecto, obtenerPausasProyecto } from '../server/helpers/pausas.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAutor, crearPresupuesto, crearProyecto, crearServicio, crearUnidad, insertarPausa } from './helpers/fixtures.js';

describe('exclusión de esperas por causa autor/departamento (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('excluye del tiempo efectivo las pausas registradas de un proyecto', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EET', nombre: 'Edición tripa completa', pesoComplejidad: 2, plazoDias: 150 });
    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    await insertarPausa({
      proyectoId: proyecto.id,
      causa: 'autor',
      fechaInicio: new Date('2026-01-03T00:00:00Z'),
      fechaFin: new Date('2026-01-06T00:00:00Z'), // 3 días de espera atribuibles al autor
    });

    const dias = await calcularDiasEfectivosProyecto(
      proyecto.id,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-11T00:00:00Z'), // 10 días de calendario
    );

    expect(dias).toBe(7); // 10 - 3 excluidos
  });

  it('excluye pausas de causa autor y de otro departamento por igual', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EEC', nombre: 'Edición por capítulo', pesoComplejidad: 3, plazoDias: 150 });
    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    await insertarPausa({
      proyectoId: proyecto.id,
      causa: 'autor',
      fechaInicio: new Date('2026-01-02T00:00:00Z'),
      fechaFin: new Date('2026-01-04T00:00:00Z'), // 2 días
    });
    await insertarPausa({
      proyectoId: proyecto.id,
      causa: 'otro_departamento',
      fechaInicio: new Date('2026-01-06T00:00:00Z'),
      fechaFin: new Date('2026-01-09T00:00:00Z'), // 3 días
    });

    const dias = await calcularDiasEfectivosProyecto(
      proyecto.id,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-11T00:00:00Z'), // 10 días de calendario
    );

    expect(dias).toBe(5); // 10 - 2 - 3
  });

  it('no descuenta nada si el proyecto no tiene pausas registradas', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    expect(await obtenerPausasProyecto(proyecto.id)).toEqual([]);

    const dias = await calcularDiasEfectivosProyecto(
      proyecto.id,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-06T00:00:00Z'),
    );

    expect(dias).toBe(5);
  });

  it('solo reconoce las causas autor y otro_departamento (ninguna otra)', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    await expect(
      insertarPausa({
        proyectoId: proyecto.id,
        // @ts-expect-error 'tecnico' ya no es una causa válida
        causa: 'tecnico',
        fechaInicio: new Date('2026-01-02T00:00:00Z'),
      }),
    ).rejects.toThrow();
  });
});

describe('crearPausa: PAUSADO exige pago confirmado (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('rechaza crear una pausa formal (PAUSADO) sin pago confirmado', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    await expect(
      crearPausa({
        proyectoId: proyecto.id,
        causa: 'autor',
        fechaInicio: new Date('2026-01-10T00:00:00Z'),
        esPausadoFormal: true,
        fechaLimiteRetoma: '2026-04-10',
        pagoConfirmado: false,
      }),
    ).rejects.toThrow(/pagado en su totalidad/);
  });

  it('permite crear una pausa formal (PAUSADO) cuando el pago sí está confirmado', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    const pausa = await crearPausa({
      proyectoId: proyecto.id,
      causa: 'autor',
      fechaInicio: new Date('2026-01-10T00:00:00Z'),
      esPausadoFormal: true,
      fechaLimiteRetoma: '2026-04-10',
      pagoConfirmado: true,
      origenConfirmacionPago: 'manual',
    });

    expect(pausa.esPausadoFormal).toBe(true);
    expect(pausa.pagoConfirmado).toBe(true);
  });

  it('permite crear una pausa informal (no PAUSADO) sin pago confirmado', async () => {
    // Una espera corta de tipo "retrasado" no exige pago: la exigencia
    // de pago solo aplica cuando esPausadoFormal es true.
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    const pausa = await crearPausa({
      proyectoId: proyecto.id,
      causa: 'otro_departamento',
      fechaInicio: new Date('2026-01-10T00:00:00Z'),
    });

    expect(pausa.esPausadoFormal).toBe(false);
    expect(pausa.pagoConfirmado).toBe(false);
  });
});

describe('listarPausasProyecto (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('devuelve las filas completas (causa, fechas), no solo fechaInicio/fechaFin', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    await insertarPausa({
      proyectoId: proyecto.id,
      causa: 'otro_departamento',
      fechaInicio: new Date('2026-02-01T00:00:00Z'),
      fechaFin: new Date('2026-02-05T00:00:00Z'),
    });

    const lista = await listarPausasProyecto(proyecto.id);

    expect(lista).toHaveLength(1);
    expect(lista[0]?.causa).toBe('otro_departamento');
    expect(lista[0]?.fechaFin).toEqual(new Date('2026-02-05T00:00:00Z'));
  });

  it('devuelve una lista vacía si el proyecto no tiene pausas', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    expect(await listarPausasProyecto(proyecto.id)).toEqual([]);
  });
});
