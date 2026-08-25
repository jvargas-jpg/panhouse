import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearPresupuesto, crearServicio, crearUnidad } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('GET /api/catalogos', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('permite a jefe_area listar servicios, unidades y presupuestos activos', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    await Promise.all([
      crearUnidad(),
      crearPresupuesto(),
      crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 }),
    ]);
    const cookie = await registrarYLoguear(app, 'jefe_area');

    const respuesta = await request(app.server).get('/api/catalogos').set('Cookie', cookie);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.servicios.length).toBeGreaterThan(0);
    expect(respuesta.body.unidades.length).toBeGreaterThan(0);
    expect(respuesta.body.presupuestos.length).toBeGreaterThan(0);

    await app.close();
  });

  it('rechaza sin sesión', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const respuesta = await request(app.server).get('/api/catalogos');

    expect(respuesta.status).toBe(401);

    await app.close();
  });

  it('rechaza a un rol distinto de jefe_area (ej. especialista)', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const cookie = await registrarYLoguear(app, 'especialista');

    const respuesta = await request(app.server).get('/api/catalogos').set('Cookie', cookie);

    expect(respuesta.status).toBe(403);

    await app.close();
  });
});
