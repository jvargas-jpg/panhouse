import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import { proyectos } from '../server/db/schema/index.js';
import { obtenerCargaEspecialista } from '../server/helpers/carga.js';
import {
  actualizarProyecto,
  asignarEspecialista,
  listarProyectosEditor,
  listarProyectosEspecialista,
  validarCambioEstadoProyecto,
} from '../server/helpers/proyectos.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAutor, crearPresupuesto, crearProyecto, crearServicio, crearUnidad, crearUsuario } from './helpers/fixtures.js';

describe('asignarEspecialista (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('un proyecto creado sin especialista no cuenta en la carga de nadie', async () => {
    const [autor, unidad, presupuesto, especialista] = await Promise.all([
      crearAutor(),
      crearUnidad(),
      crearPresupuesto(),
      crearUsuario('especialista'),
    ]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });

    // Se crea sin especialistaId: nada asume que el creador queda
    // autoasignado.
    await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    expect(await obtenerCargaEspecialista(especialista.id)).toBe(0);
  });

  it('asignarEspecialista es el paso explícito que hace que el proyecto cuente en la carga del especialista', async () => {
    const [autor, unidad, presupuesto, especialista] = await Promise.all([
      crearAutor(),
      crearUnidad(),
      crearPresupuesto(),
      crearUsuario('especialista'),
    ]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });

    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    await asignarEspecialista(proyecto.id, especialista.id);

    expect(await obtenerCargaEspecialista(especialista.id)).toBe(4);
  });

  it('reasignar a otro especialista mueve la carga del anterior al nuevo', async () => {
    const [autor, unidad, presupuesto, especialistaA, especialistaB] = await Promise.all([
      crearAutor(),
      crearUnidad(),
      crearPresupuesto(),
      crearUsuario('especialista'),
      crearUsuario('especialista'),
    ]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });

    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    await asignarEspecialista(proyecto.id, especialistaA.id);
    await asignarEspecialista(proyecto.id, especialistaB.id);

    expect(await obtenerCargaEspecialista(especialistaA.id)).toBe(0);
    expect(await obtenerCargaEspecialista(especialistaB.id)).toBe(4);
  });

  it('lanza un error si el proyecto no existe', async () => {
    const especialista = await crearUsuario('especialista');

    await expect(asignarEspecialista('00000000-0000-0000-0000-000000000000', especialista.id)).rejects.toThrow();
  });

  it('actualiza updatedAt automáticamente al asignar especialista, sin fijarlo a mano', async () => {
    const [autor, unidad, presupuesto, especialista] = await Promise.all([
      crearAutor(),
      crearUnidad(),
      crearPresupuesto(),
      crearUsuario('especialista'),
    ]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });

    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    // Se compara contra el reloj de Node (el mismo que usa $onUpdate),
    // no contra proyecto.updatedAt: ese vino de defaultNow() en el
    // reloj del servidor de Postgres, y comparar relojes distintos es
    // una fuente real de flakiness si llegan a desincronizarse.
    const antesDeActualizar = Date.now();
    await asignarEspecialista(proyecto.id, especialista.id);

    const [actualizado] = await db.select().from(proyectos).where(eq(proyectos.id, proyecto.id));
    expect(actualizado?.updatedAt.getTime()).toBeGreaterThanOrEqual(antesDeActualizar);
  });
});

describe('validarCambioEstadoProyecto', () => {
  it('rechaza específicamente el estado pausado', () => {
    expect(() => validarCambioEstadoProyecto('pausado')).toThrow();
  });

  it('no rechaza los otros cinco estados', () => {
    for (const estado of ['en_proceso', 'retrasado', 'stand_by', 'culminado', 'retirado'] as const) {
      expect(() => validarCambioEstadoProyecto(estado)).not.toThrow();
    }
  });

  it('no rechaza cuando no se envía estado', () => {
    expect(() => validarCambioEstadoProyecto(undefined)).not.toThrow();
  });
});

describe('actualizarProyecto (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('rechaza cambiar el estado a pausado por esta vía', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    await expect(actualizarProyecto(proyecto.id, { estado: 'pausado' })).rejects.toThrow(/esPausadoFormal/);
  });

  it('permite cambiar el estado a los otros cinco valores libremente', async () => {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    const actualizado = await actualizarProyecto(proyecto.id, { estado: 'retrasado' });

    expect(actualizado.estado).toBe('retrasado');
  });
});

describe('listarProyectosEspecialista (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('trae autor y servicio resueltos, y el riesgo ya calculado por fila', async () => {
    const [autor, unidad, presupuesto, especialista] = await Promise.all([
      crearAutor(),
      crearUnidad(),
      crearPresupuesto(),
      crearUsuario('especialista'),
    ]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });

    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      especialistaId: especialista.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    const lista = await listarProyectosEspecialista(especialista.id);

    expect(lista).toHaveLength(1);
    expect(lista[0]?.id).toBe(proyecto.id);
    expect(lista[0]?.autor).toEqual({ id: autor.id, nombre: autor.nombre });
    expect(lista[0]?.servicio).toEqual({ id: servicio.id, codigo: 'EF', nombre: servicio.nombre });
    expect(lista[0]?.riesgo).toBeDefined();
    expect(typeof lista[0]?.riesgo.enRiesgo).toBe('boolean');
  });

  it('no incluye proyectos de otro especialista ni proyectos culminados/retirados', async () => {
    const [autor, unidad, presupuesto, especialistaA, especialistaB] = await Promise.all([
      crearAutor(),
      crearUnidad(),
      crearPresupuesto(),
      crearUsuario('especialista'),
      crearUsuario('especialista'),
    ]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });

    await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      especialistaId: especialistaB.id,
      fechaProgramadaInicio: '2026-01-01',
    });
    await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      especialistaId: especialistaA.id,
      estado: 'culminado',
      fechaProgramadaInicio: '2026-01-01',
    });

    expect(await listarProyectosEspecialista(especialistaA.id)).toEqual([]);
  });
});

// Mismo cálculo generalizado por rol que listarProyectosEspecialista
// (ver listarProyectosConRiesgo en server/helpers/alertas.ts), esta vez
// leyendo proyectos.editorId.
describe('listarProyectosEditor (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('trae autor y servicio resueltos, y el riesgo ya calculado por fila', async () => {
    const [autor, unidad, presupuesto, editor] = await Promise.all([
      crearAutor(),
      crearUnidad(),
      crearPresupuesto(),
      crearUsuario('editor'),
    ]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });

    const proyecto = await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      editorId: editor.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    const lista = await listarProyectosEditor(editor.id);

    expect(lista).toHaveLength(1);
    expect(lista[0]?.id).toBe(proyecto.id);
    expect(lista[0]?.autor).toEqual({ id: autor.id, nombre: autor.nombre });
    expect(lista[0]?.servicio).toEqual({ id: servicio.id, codigo: 'EF', nombre: servicio.nombre });
    expect(lista[0]?.riesgo).toBeDefined();
  });

  it('no incluye proyectos de otro editor, de un especialista, ni proyectos culminados/retirados', async () => {
    const [autor, unidad, presupuesto, editorA, editorB] = await Promise.all([
      crearAutor(),
      crearUnidad(),
      crearPresupuesto(),
      crearUsuario('editor'),
      crearUsuario('editor'),
    ]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });

    await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      editorId: editorB.id,
      fechaProgramadaInicio: '2026-01-01',
    });
    await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      // editorA queda como especialistaId, no como editorId: no debe
      // contar para su "mis proyectos" de editor (columnas separadas).
      especialistaId: editorA.id,
      fechaProgramadaInicio: '2026-01-01',
    });
    await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      editorId: editorA.id,
      estado: 'culminado',
      fechaProgramadaInicio: '2026-01-01',
    });

    expect(await listarProyectosEditor(editorA.id)).toEqual([]);
  });
});
