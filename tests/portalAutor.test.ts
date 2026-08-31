import { beforeEach, describe, expect, it } from 'vitest';
import { listarNotificacionesPorRol, marcarNotificacionLeida } from '../server/helpers/notificaciones.js';
import { actualizarManuscrito } from '../server/helpers/portalAutor.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAutor, crearPresupuesto, crearProyecto, crearServicio, crearUnidad } from './helpers/fixtures.js';

const MENSAJE_ENTREGA_MANUSCRITO = 'El autor ha entregado el enlace a su manuscrito original.';

let contadorServicio = 0;

async function crearProyectoBase() {
  contadorServicio += 1;
  const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
  const servicio = await crearServicio({
    codigo: `EF-${contadorServicio}`,
    nombre: 'Escritura fantasma',
    pesoComplejidad: 4,
    plazoDias: 180,
  });
  return crearProyecto({
    autorId: autor.id,
    servicioId: servicio.id,
    unidadId: unidad.id,
    presupuestoId: presupuesto.id,
    fechaProgramadaInicio: '2026-01-01',
  });
}

// Tests de portalAutor.ts a nivel de helper (llamando actualizarManuscrito
// directo, sin pasar por HTTP/auth) — mismo criterio que proyectos.test.ts
// vs proyectos.routes.test.ts: esto aísla la lógica de notificación
// inyectada (crearNotificacion / existeNotificacionNoLeida, ver
// server/helpers/notificaciones.ts) de la capa de rutas, que ya la cubre
// aparte en tests/proyectos.routes.test.ts (PATCH /:id/manuscrito).
describe('actualizarManuscrito (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('guarda el manuscritoUrl en el proyecto', async () => {
    const proyecto = await crearProyectoBase();

    const actualizado = await actualizarManuscrito(proyecto.id, 'https://docs.google.com/document/d/abc123');

    expect(actualizado?.manuscritoUrl).toBe('https://docs.google.com/document/d/abc123');
  });

  it('inserta una notificación para especialista al entregar un enlace real', async () => {
    const proyecto = await crearProyectoBase();

    await actualizarManuscrito(proyecto.id, 'https://docs.google.com/document/d/abc123');

    const notificaciones = await listarNotificacionesPorRol('especialista');
    expect(notificaciones).toHaveLength(1);
    expect(notificaciones[0]?.proyectoId).toBe(proyecto.id);
    expect(notificaciones[0]?.mensaje).toBe(MENSAJE_ENTREGA_MANUSCRITO);
    expect(notificaciones[0]?.leido).toBe(false);
  });

  it('no inserta ninguna notificación al borrar el enlace (null no es una entrega)', async () => {
    const proyecto = await crearProyectoBase();

    await actualizarManuscrito(proyecto.id, null);

    expect(await listarNotificacionesPorRol('especialista')).toHaveLength(0);
  });

  // Paso 2 del pedido: protección contra spam — mismo proyectoId,
  // rolDestino y mensaje, sin leer todavía. La segunda y tercera llamada
  // no deben insertar una fila nueva.
  it('no duplica la notificación si el autor corrige el enlace varias veces seguidas sin que se haya leído', async () => {
    const proyecto = await crearProyectoBase();

    await actualizarManuscrito(proyecto.id, 'https://docs.google.com/document/d/version-1');
    await actualizarManuscrito(proyecto.id, 'https://docs.google.com/document/d/version-2');
    await actualizarManuscrito(proyecto.id, 'https://docs.google.com/document/d/version-3');

    expect(await listarNotificacionesPorRol('especialista')).toHaveLength(1);
  });

  it('inserta una nueva notificación si la anterior ya fue marcada como leída', async () => {
    const proyecto = await crearProyectoBase();

    await actualizarManuscrito(proyecto.id, 'https://docs.google.com/document/d/version-1');
    const [primera] = await listarNotificacionesPorRol('especialista');
    if (!primera) throw new Error('Esperaba una notificación tras la primera entrega');
    await marcarNotificacionLeida(primera.id, 'especialista');

    await actualizarManuscrito(proyecto.id, 'https://docs.google.com/document/d/version-2');

    expect(await listarNotificacionesPorRol('especialista')).toHaveLength(2);
  });

  it('no confunde la guardia contra spam entre proyectos distintos (mismo mensaje, distinto proyectoId)', async () => {
    const proyectoA = await crearProyectoBase();
    const proyectoB = await crearProyectoBase();

    await actualizarManuscrito(proyectoA.id, 'https://docs.google.com/document/d/a');
    await actualizarManuscrito(proyectoB.id, 'https://docs.google.com/document/d/b');

    const notificaciones = await listarNotificacionesPorRol('especialista');
    expect(notificaciones).toHaveLength(2);
    expect(notificaciones.map((n) => n.proyectoId).sort()).toEqual([proyectoA.id, proyectoB.id].sort());
  });
});
