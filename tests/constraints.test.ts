import { beforeEach, describe, expect, it } from 'vitest';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAutor, crearPresupuesto, crearProyecto, crearServicio, crearUnidad, insertarPausa } from './helpers/fixtures.js';

// Estos CHECK constraints son la segunda barrera a nivel de esquema para
// dos reglas que el código ya hace cumplir (server/helpers/pausas.ts y
// server/helpers/cronograma.ts): se prueban aquí insertando directo con
// Drizzle, sin pasar por ningún guardián de la aplicación, para
// confirmar que la base de datos misma los rechaza.
describe('CHECK constraints de esquema (integración con base de datos)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('rechaza un servicio con plazo único y plazo doble a la vez', async () => {
    await expect(
      crearServicio({
        codigo: 'X1',
        nombre: 'Servicio inválido',
        pesoComplejidad: 1,
        plazoDias: 150,
        plazoInternoDias: 60,
        plazoComercialDias: 90,
      }),
    ).rejects.toThrow();
  });

  it('rechaza un servicio sin ningún plazo configurado', async () => {
    await expect(
      crearServicio({
        codigo: 'X2',
        nombre: 'Servicio inválido',
        pesoComplejidad: 1,
      }),
    ).rejects.toThrow();
  });

  it('rechaza un servicio con plazo doble incompleto (solo el interno, sin el comercial)', async () => {
    await expect(
      crearServicio({
        codigo: 'X3',
        nombre: 'Servicio inválido',
        pesoComplejidad: 1,
        plazoInternoDias: 60,
      }),
    ).rejects.toThrow();
  });

  it('rechaza una pausa con pago confirmado pero sin origen de confirmación, aunque no pase por crearPausa', async () => {
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
        causa: 'autor',
        fechaInicio: new Date('2026-01-10T00:00:00Z'),
        pagoConfirmado: true,
        // origenConfirmacionPago queda sin definir a propósito.
      }),
    ).rejects.toThrow();
  });
});
