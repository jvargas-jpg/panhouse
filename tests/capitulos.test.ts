import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import { capitulos } from '../server/db/schema/index.js';
import {
  actualizarCapituloAutor,
  contarCapitulosEntregados,
  crearCapitulo,
  obtenerCapitulosProyecto,
} from '../server/helpers/capitulos.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearProyectoDePrueba } from './helpers/fixtures.js';

// No hay todavía una función de dominio "cara al editor" (pertenece a
// un futuro flujo operativo, fuera de alcance): para simular que un
// capítulo fue entregado en los tests, se actualiza directo con Drizzle.
async function marcarEntregado(capituloId: string, fechaEntregaEditor: string) {
  await db.update(capitulos).set({ fechaEntregaEditor }).where(eq(capitulos.id, capituloId));
}

describe('capítulos (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('nace con los campos de contenido vacíos, tanto los del autor como los del editor', async () => {
    const proyecto = await crearProyectoDePrueba();

    const capitulo = await crearCapitulo(proyecto.id, 1);

    expect(capitulo.numero).toBe(1);
    expect(capitulo.fechaEnvioAutor).toBeNull();
    expect(capitulo.enlaces).toBeNull();
    expect(capitulo.fechaInicioEditor).toBeNull();
    expect(capitulo.paginas).toBeNull();
    expect(capitulo.fechaEntregaEditor).toBeNull();
  });

  it('no permite dos capítulos con el mismo número en el mismo proyecto', async () => {
    const proyecto = await crearProyectoDePrueba();
    await crearCapitulo(proyecto.id, 1);

    await expect(crearCapitulo(proyecto.id, 1)).rejects.toThrow();
  });

  it('actualizarCapituloAutor solo toca las columnas cara al autor, nunca las del editor', async () => {
    const proyecto = await crearProyectoDePrueba();
    await crearCapitulo(proyecto.id, 1);

    const actualizado = await actualizarCapituloAutor(proyecto.id, 1, {
      fechaEnvioAutor: '2026-02-01',
      fechaPautadaFeedback: '2026-02-08',
      enlaces: ['https://drive.example/borrador-cap1'],
    });

    expect(actualizado.fechaEnvioAutor).toBe('2026-02-01');
    expect(actualizado.fechaPautadaFeedback).toBe('2026-02-08');
    expect(actualizado.enlaces).toEqual(['https://drive.example/borrador-cap1']);
    // Las columnas cara al editor no existen todavía en este flujo: siguen null.
    expect(actualizado.fechaInicioEditor).toBeNull();
    expect(actualizado.paginas).toBeNull();
    expect(actualizado.fechaEntregaEditor).toBeNull();
  });

  it('lanza un error si el capítulo no existe todavía', async () => {
    const proyecto = await crearProyectoDePrueba();

    await expect(actualizarCapituloAutor(proyecto.id, 1, { fechaEnvioAutor: '2026-02-01' })).rejects.toThrow();
  });

  it('obtenerCapitulosProyecto los devuelve ordenados por número', async () => {
    const proyecto = await crearProyectoDePrueba();
    await crearCapitulo(proyecto.id, 2);
    await crearCapitulo(proyecto.id, 1);
    await crearCapitulo(proyecto.id, 3);

    const lista = await obtenerCapitulosProyecto(proyecto.id);

    expect(lista.map((c) => c.numero)).toEqual([1, 2, 3]);
  });

  it('contarCapitulosEntregados cuenta desde capitulos, sin ningún contador almacenado', async () => {
    const proyecto = await crearProyectoDePrueba();
    const cap1 = await crearCapitulo(proyecto.id, 1);
    const cap2 = await crearCapitulo(proyecto.id, 2);
    await crearCapitulo(proyecto.id, 3); // nunca entregado

    expect(await contarCapitulosEntregados(proyecto.id)).toBe(0);

    await marcarEntregado(cap1.id, '2026-03-01');
    expect(await contarCapitulosEntregados(proyecto.id)).toBe(1);

    await marcarEntregado(cap2.id, '2026-03-15');
    expect(await contarCapitulosEntregados(proyecto.id)).toBe(2);
  });

  it('contarCapitulosEntregados no cuenta capítulos de otros proyectos', async () => {
    const proyectoA = await crearProyectoDePrueba();
    const proyectoB = await crearProyectoDePrueba();
    const capA = await crearCapitulo(proyectoA.id, 1);
    await crearCapitulo(proyectoB.id, 1);

    await marcarEntregado(capA.id, '2026-03-01');

    expect(await contarCapitulosEntregados(proyectoA.id)).toBe(1);
    expect(await contarCapitulosEntregados(proyectoB.id)).toBe(0);
  });
});
