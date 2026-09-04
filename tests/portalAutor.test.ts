import { beforeEach, describe, expect, it } from 'vitest';
import { listarNotificacionesPorRol, marcarNotificacionLeida } from '../server/helpers/notificaciones.js';
import { actualizarDecisionPortada, actualizarManuscrito, validarDecisionPortada } from '../server/helpers/portalAutor.js';
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

describe('validarDecisionPortada', () => {
  it('rechaza "rechazada" sin feedback', () => {
    expect(() => validarDecisionPortada('rechazada', null)).toThrow(/feedback/i);
    expect(() => validarDecisionPortada('rechazada', '')).toThrow(/feedback/i);
    expect(() => validarDecisionPortada('rechazada', '   ')).toThrow(/feedback/i);
  });

  it('no rechaza "rechazada" con feedback', () => {
    expect(() => validarDecisionPortada('rechazada', 'La tipografía no combina con el género del libro')).not.toThrow();
  });

  it('no exige feedback para "aprobada"', () => {
    expect(() => validarDecisionPortada('aprobada', null)).not.toThrow();
  });
});

// Mismo criterio que el describe de actualizarManuscrito de arriba: llama
// al helper directo, sin pasar por HTTP/auth — la capa de rutas
// (PATCH /:id/decision-portada) ya tiene su propia cobertura en
// tests/proyectos.routes.test.ts.
describe('actualizarDecisionPortada (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('guarda la decisión al aprobar, sin exigir feedback', async () => {
    const proyecto = await crearProyectoBase();

    const actualizado = await actualizarDecisionPortada(proyecto.id, 'aprobada', null);

    expect(actualizado?.portadaDecisionAutor).toBe('aprobada');
    expect(actualizado?.portadaFeedback).toBeNull();
  });

  it('guarda la decisión y el feedback al rechazar', async () => {
    const proyecto = await crearProyectoBase();

    const actualizado = await actualizarDecisionPortada(proyecto.id, 'rechazada', 'El color de fondo no coincide con la propuesta acordada');

    expect(actualizado?.portadaDecisionAutor).toBe('rechazada');
    expect(actualizado?.portadaFeedback).toBe('El color de fondo no coincide con la propuesta acordada');
  });

  it('rechaza (lanza) una decisión "rechazada" sin feedback, sin llegar a tocar la base de datos', async () => {
    const proyecto = await crearProyectoBase();

    await expect(actualizarDecisionPortada(proyecto.id, 'rechazada', null)).rejects.toThrow(/feedback/i);
    // Nada debió cambiar: ni el proyecto ni la notificación.
    expect(await listarNotificacionesPorRol('especialista')).toHaveLength(0);
  });

  it('inserta una notificación para especialista con el mensaje correcto al aprobar', async () => {
    const proyecto = await crearProyectoBase();

    await actualizarDecisionPortada(proyecto.id, 'aprobada', null);

    const notificaciones = await listarNotificacionesPorRol('especialista');
    expect(notificaciones).toHaveLength(1);
    expect(notificaciones[0]?.proyectoId).toBe(proyecto.id);
    expect(notificaciones[0]?.mensaje).toBe('El autor ha aprobada la propuesta de portada.');
  });

  it('inserta una notificación para especialista con el mensaje correcto al rechazar', async () => {
    const proyecto = await crearProyectoBase();

    await actualizarDecisionPortada(proyecto.id, 'rechazada', 'Motivo del rechazo');

    const notificaciones = await listarNotificacionesPorRol('especialista');
    expect(notificaciones).toHaveLength(1);
    expect(notificaciones[0]?.mensaje).toBe('El autor ha rechazada la propuesta de portada.');
  });

  // Paso 2 del pedido, aplicado a este segundo disparador: si el autor
  // cambia de opinión (o corrige el feedback) varias veces seguidas
  // antes de que alguien la lea, no se apila una notificación por cada
  // cambio.
  it('no duplica la notificación si el autor cambia de opinión varias veces seguidas sin que se haya leído', async () => {
    const proyecto = await crearProyectoBase();

    await actualizarDecisionPortada(proyecto.id, 'rechazada', 'Primer motivo');
    await actualizarDecisionPortada(proyecto.id, 'rechazada', 'Motivo corregido');

    // Mismo mensaje ('...ha rechazada...') las dos veces: la guardia
    // contra spam compara por mensaje exacto, no le importa que el
    // feedback interno haya cambiado.
    expect(await listarNotificacionesPorRol('especialista')).toHaveLength(1);
  });

  it('inserta una notificación nueva si la decisión cambia de aprobada a rechazada (mensaje distinto)', async () => {
    const proyecto = await crearProyectoBase();

    await actualizarDecisionPortada(proyecto.id, 'aprobada', null);
    await actualizarDecisionPortada(proyecto.id, 'rechazada', 'Al final sí quiero cambios');

    const notificaciones = await listarNotificacionesPorRol('especialista');
    expect(notificaciones).toHaveLength(2);
    expect(notificaciones.map((n) => n.mensaje).sort()).toEqual(
      ['El autor ha aprobada la propuesta de portada.', 'El autor ha rechazada la propuesta de portada.'].sort(),
    );
  });

  it('inserta una nueva notificación si la anterior ya fue marcada como leída', async () => {
    const proyecto = await crearProyectoBase();

    await actualizarDecisionPortada(proyecto.id, 'aprobada', null);
    const [primera] = await listarNotificacionesPorRol('especialista');
    if (!primera) throw new Error('Esperaba una notificación tras la primera decisión');
    await marcarNotificacionLeida(primera.id, 'especialista');

    await actualizarDecisionPortada(proyecto.id, 'aprobada', null);

    expect(await listarNotificacionesPorRol('especialista')).toHaveLength(2);
  });
});
