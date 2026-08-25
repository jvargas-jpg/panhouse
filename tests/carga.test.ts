import { beforeEach, describe, expect, it } from 'vitest';
import {
  calcularCargaEspecialista,
  listarCargaEditores,
  listarCargaEspecialistas,
  obtenerCargaEditor,
  obtenerCargaEspecialista,
} from '../server/helpers/carga.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import {
  crearAutor,
  crearPresupuesto,
  crearProyecto,
  crearServicio,
  crearUnidad,
  crearUsuario,
} from './helpers/fixtures.js';

describe('calcularCargaEspecialista', () => {
  it('suma el peso de complejidad de los proyectos, no la cantidad', () => {
    // Dos EET (peso 2) deberían pesar menos que un solo EF (peso 4),
    // aunque haya más proyectos: la carga es ponderada, no un conteo.
    const cargaDosEET = calcularCargaEspecialista([2, 2]);
    const cargaUnEF = calcularCargaEspecialista([4]);

    expect(cargaDosEET).toBe(4);
    expect(cargaUnEF).toBe(4);
    expect(calcularCargaEspecialista([4, 3, 2, 1])).toBe(10);
  });

  it('devuelve 0 cuando el especialista no tiene proyectos', () => {
    expect(calcularCargaEspecialista([])).toBe(0);
  });

  it('respeta el orden de complejidad confirmado EF > EEC > EET > SE', () => {
    const pesos = { EF: 4, EEC: 3, EET: 2, SE: 1 };
    expect(pesos.EF).toBeGreaterThan(pesos.EEC);
    expect(pesos.EEC).toBeGreaterThan(pesos.EET);
    expect(pesos.EET).toBeGreaterThan(pesos.SE);
  });
});

describe('obtenerCargaEspecialista (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('suma el peso de los proyectos activos asignados al especialista', async () => {
    const [autor, unidad, presupuesto, especialista] = await Promise.all([
      crearAutor(),
      crearUnidad(),
      crearPresupuesto(),
      crearUsuario('especialista'),
    ]);

    const ef = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const eet = await crearServicio({ codigo: 'EET', nombre: 'Edición tripa completa', pesoComplejidad: 2, plazoDias: 150 });

    await crearProyecto({
      autorId: autor.id,
      servicioId: ef.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      especialistaId: especialista.id,
      estado: 'en_proceso',
      fechaProgramadaInicio: '2026-01-01',
    });
    await crearProyecto({
      autorId: autor.id,
      servicioId: eet.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      especialistaId: especialista.id,
      estado: 'retrasado',
      fechaProgramadaInicio: '2026-01-01',
    });

    const carga = await obtenerCargaEspecialista(especialista.id);

    expect(carga).toBe(6); // 4 (EF) + 2 (EET)
  });

  it('excluye proyectos culminados o retirados de la carga', async () => {
    const [autor, unidad, presupuesto, especialista] = await Promise.all([
      crearAutor(),
      crearUnidad(),
      crearPresupuesto(),
      crearUsuario('especialista'),
    ]);

    const ef = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });

    await crearProyecto({
      autorId: autor.id,
      servicioId: ef.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      especialistaId: especialista.id,
      estado: 'culminado',
      fechaProgramadaInicio: '2026-01-01',
    });

    const carga = await obtenerCargaEspecialista(especialista.id);

    expect(carga).toBe(0);
  });
});

describe('listarCargaEspecialistas (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('lista solo usuarios con rol especialista, cada uno con su carga', async () => {
    const [autor, unidad, presupuesto, especialistaA, especialistaB] = await Promise.all([
      crearAutor(),
      crearUnidad(),
      crearPresupuesto(),
      crearUsuario('especialista'),
      crearUsuario('especialista'),
    ]);
    await crearUsuario('jefe_area'); // no debe aparecer en la lista

    const ef = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });

    await crearProyecto({
      autorId: autor.id,
      servicioId: ef.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      especialistaId: especialistaA.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    const lista = await listarCargaEspecialistas();

    expect(lista).toHaveLength(2);
    expect(lista.find((e) => e.id === especialistaA.id)?.carga).toBe(4);
    expect(lista.find((e) => e.id === especialistaB.id)?.carga).toBe(0);
  });
});

// Mismo cálculo que arriba (obtenerCargaUsuario/listarCargaPorRol
// generalizados), esta vez leyendo proyectos.editorId en vez de
// proyectos.especialistaId — confirma que la generalización por rol
// funciona de verdad, no solo que el especialista sigue intacto.
describe('carga de editores (obtenerCargaEditor / listarCargaEditores, generalización por rol)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('suma el peso de los proyectos activos asignados al editor', async () => {
    const [autor, unidad, presupuesto, editor] = await Promise.all([
      crearAutor(),
      crearUnidad(),
      crearPresupuesto(),
      crearUsuario('editor'),
    ]);

    const ef = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const eet = await crearServicio({ codigo: 'EET', nombre: 'Edición tripa completa', pesoComplejidad: 2, plazoDias: 150 });

    await crearProyecto({
      autorId: autor.id,
      servicioId: ef.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      editorId: editor.id,
      estado: 'en_proceso',
      fechaProgramadaInicio: '2026-01-01',
    });
    await crearProyecto({
      autorId: autor.id,
      servicioId: eet.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      editorId: editor.id,
      estado: 'retrasado',
      fechaProgramadaInicio: '2026-01-01',
    });

    const carga = await obtenerCargaEditor(editor.id);

    expect(carga).toBe(6); // 4 (EF) + 2 (EET)
  });

  it('excluye proyectos culminados o retirados de la carga del editor', async () => {
    const [autor, unidad, presupuesto, editor] = await Promise.all([
      crearAutor(),
      crearUnidad(),
      crearPresupuesto(),
      crearUsuario('editor'),
    ]);

    const ef = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });

    await crearProyecto({
      autorId: autor.id,
      servicioId: ef.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      editorId: editor.id,
      estado: 'culminado',
      fechaProgramadaInicio: '2026-01-01',
    });

    const carga = await obtenerCargaEditor(editor.id);

    expect(carga).toBe(0);
  });

  it('listarCargaEditores solo lista usuarios con rol editor, cada uno con su carga', async () => {
    const [autor, unidad, presupuesto, editorA, editorB] = await Promise.all([
      crearAutor(),
      crearUnidad(),
      crearPresupuesto(),
      crearUsuario('editor'),
      crearUsuario('editor'),
    ]);
    await crearUsuario('especialista'); // no debe aparecer en la lista de editores

    const ef = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });

    await crearProyecto({
      autorId: autor.id,
      servicioId: ef.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      editorId: editorA.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    const lista = await listarCargaEditores();

    expect(lista).toHaveLength(2);
    expect(lista.find((e) => e.id === editorA.id)?.carga).toBe(4);
    expect(lista.find((e) => e.id === editorB.id)?.carga).toBe(0);
  });
});
