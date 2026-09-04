import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAutor } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('GET /api/metricas/comercial', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('permite a comercial ver las métricas, con la forma esperada', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    await crearAutor({ pais: 'Venezuela' });
    const cookie = await registrarYLoguear(app, 'comercial');

    const respuesta = await request(app.server).get('/api/metricas/comercial').set('Cookie', cookie);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.kpis).toBeDefined();
    expect(typeof respuesta.body.kpis.clientesMesActual).toBe('number');
    expect(Array.isArray(respuesta.body.clientesPorMes)).toBe(true);
    expect(respuesta.body.clientesPorMes).toHaveLength(6);
    expect(Array.isArray(respuesta.body.proyectosPorMes)).toBe(true);
    expect(respuesta.body.proyectosPorMes).toHaveLength(6);
    expect(Array.isArray(respuesta.body.topPaises)).toBe(true);
    expect(Array.isArray(respuesta.body.proyectosPorServicio)).toBe(true);

    await app.close();
  });

  it('permite también a dirección ver las métricas', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const cookie = await registrarYLoguear(app, 'direccion');

    const respuesta = await request(app.server).get('/api/metricas/comercial').set('Cookie', cookie);

    expect(respuesta.status).toBe(200);

    await app.close();
  });

  it('rechaza sin sesión', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const respuesta = await request(app.server).get('/api/metricas/comercial');

    expect(respuesta.status).toBe(401);

    await app.close();
  });

  it('rechaza a un rol sin relación con el módulo comercial (ej. especialista)', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const cookie = await registrarYLoguear(app, 'especialista');

    const respuesta = await request(app.server).get('/api/metricas/comercial').set('Cookie', cookie);

    expect(respuesta.status).toBe(403);

    await app.close();
  });
});
