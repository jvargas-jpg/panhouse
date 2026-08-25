import { beforeEach, describe, expect, it } from 'vitest';
import {
  determinarDiasPlazoAlerta,
  evaluarRiesgo,
  evaluarRiesgoProyecto,
  listarRiesgoProyectosActivos,
  obtenerProyectoConRiesgo,
} from '../server/helpers/alertas.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAutor, insertarPausa, crearPresupuesto, crearProyecto, crearServicio, crearUnidad } from './helpers/fixtures.js';

describe('determinarDiasPlazoAlerta', () => {
  it('SE: usa el plazo interno (60 días) para disparar la alerta, no el comercial (90 días)', () => {
    const dias = determinarDiasPlazoAlerta({ plazoDias: null, plazoInternoDias: 60, plazoComercialDias: 90 });
    expect(dias).toBe(60);
  });

  it('servicios de plazo único usan su único plazo', () => {
    const dias = determinarDiasPlazoAlerta({ plazoDias: 150, plazoInternoDias: null, plazoComercialDias: null });
    expect(dias).toBe(150);
  });

  it('lanza un error si el servicio no tiene ningún plazo configurado', () => {
    expect(() => determinarDiasPlazoAlerta({ plazoDias: null, plazoInternoDias: null, plazoComercialDias: null })).toThrow();
  });
});

describe('evaluarRiesgo', () => {
  it('marca vencido cuando los días efectivos superan el plazo', () => {
    const riesgo = evaluarRiesgo(65, 60);
    expect(riesgo.vencido).toBe(true);
    expect(riesgo.enRiesgo).toBe(false); // ya vencido, no "en riesgo de vencer"
    expect(riesgo.diasRestantes).toBe(-5);
  });

  it('marca en riesgo cuando se superó el umbral pero aún no vence', () => {
    const riesgo = evaluarRiesgo(50, 60, 0.8); // 50/60 ≈ 0.83 >= 0.8
    expect(riesgo.vencido).toBe(false);
    expect(riesgo.enRiesgo).toBe(true);
  });

  it('no marca riesgo cuando queda margen cómodo dentro del plazo', () => {
    const riesgo = evaluarRiesgo(10, 60, 0.8);
    expect(riesgo.vencido).toBe(false);
    expect(riesgo.enRiesgo).toBe(false);
  });
});

describe('evaluarRiesgoProyecto (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('un proyecto SE en riesgo por el plazo interno no debe verse en riesgo si se evaluara contra el comercial', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({
      codigo: 'SE',
      nombre: 'Sello editorial',
      pesoComplejidad: 1,
      plazoInternoDias: 60,
      plazoComercialDias: 90,
    });

    const ahora = new Date('2026-01-01T00:00:00Z');
    ahora.setUTCDate(ahora.getUTCDate() + 55); // 55 días desde el inicio: 55/60 ≈ 0.92, 55/90 ≈ 0.61

    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    const riesgo = await evaluarRiesgoProyecto(proyecto.id, ahora);

    expect(riesgo.diasPlazo).toBe(60); // interno, no comercial
    expect(riesgo.enRiesgo).toBe(true);
    expect(riesgo.vencido).toBe(false);
  });

  it('descuenta los días de espera atribuibles al autor antes de evaluar el riesgo', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EET', nombre: 'Edición tripa completa', pesoComplejidad: 2, plazoDias: 150 });

    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    // 20 días de espera por el autor: sin excluirlos, el proyecto parecería
    // vencido a los 155 días de calendario sobre un plazo de 150.
    await insertarPausa({
      proyectoId: proyecto.id,
      causa: 'autor',
      fechaInicio: new Date('2026-01-10T00:00:00Z'),
      fechaFin: new Date('2026-01-30T00:00:00Z'),
    });

    const ahora = new Date('2026-06-05T00:00:00Z'); // 155 días de calendario desde el inicio

    const riesgo = await evaluarRiesgoProyecto(proyecto.id, ahora);

    expect(riesgo.diasEfectivosTranscurridos).toBe(135); // 155 - 20 excluidos
    expect(riesgo.vencido).toBe(false); // 135 < 150: sin la exclusión se vería vencido
  });
});

describe('listarRiesgoProyectosActivos (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('incluye proyectos activos y excluye culminados/retirados', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });

    const activo = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      estado: 'en_proceso',
      fechaProgramadaInicio: '2026-01-01',
    });
    const culminado = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      estado: 'culminado',
      fechaProgramadaInicio: '2026-01-01',
    });

    const lista = await listarRiesgoProyectosActivos();
    const idsListados = lista.map((item) => item.id);

    expect(idsListados).toContain(activo.id);
    expect(idsListados).not.toContain(culminado.id);
  });

  it('trae autor y servicio ya resueltos, no solo el id — mismo join que listarProyectosEspecialista', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });

    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    const lista = await listarRiesgoProyectosActivos();
    const fila = lista.find((item) => item.id === proyecto.id);

    expect(fila?.autor).toEqual({ id: autor.id, nombre: autor.nombre });
    expect(fila?.servicio).toEqual({ id: servicio.id, codigo: 'EF', nombre: servicio.nombre });
    expect(fila?.riesgo).toBeDefined();
  });
});

describe('obtenerProyectoConRiesgo (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('trae autor, servicio y riesgo de un proyecto puntual', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    const resultado = await obtenerProyectoConRiesgo(proyecto.id);

    expect(resultado?.id).toBe(proyecto.id);
    expect(resultado?.autor).toEqual({ id: autor.id, nombre: autor.nombre });
    expect(resultado?.servicio.codigo).toBe('EF');
    expect(resultado?.riesgo).toBeDefined();
  });

  it('a diferencia de las listas, sí incluye proyectos culminados o retirados (vista de detalle, no de listado)', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      estado: 'culminado',
      fechaProgramadaInicio: '2026-01-01',
    });

    const resultado = await obtenerProyectoConRiesgo(proyecto.id);

    expect(resultado?.id).toBe(proyecto.id);
  });

  it('devuelve undefined si el proyecto no existe', async () => {
    const resultado = await obtenerProyectoConRiesgo('00000000-0000-0000-0000-000000000000');
    expect(resultado).toBeUndefined();
  });
});
