import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('GET /api/portal/pagos/enlace', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('mantiene el SSO de pagos fuera del portal de esta iteración', async () => {
    const app=crearAppDePrueba();await app.ready();const cookie=await registrarYLoguear(app,'autor');
    const response=await request(app.server).get('/api/portal/pagos/enlace').set('Cookie',cookie);
    expect(response.status).toBe(403);expect(response.body.url).toBeUndefined();await app.close();
  });

  it('rechaza la solicitud sin sesión', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const respuesta = await request(app.server).get('/api/portal/pagos/enlace');

    expect(respuesta.status).toBe(401);

    await app.close();
  });

  it('rechaza la solicitud a un rol distinto de autor', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const cookie = await registrarYLoguear(app, 'especialista');

    const respuesta = await request(app.server).get('/api/portal/pagos/enlace').set('Cookie', cookie);

    expect(respuesta.status).toBe(403);

    await app.close();
  });
});
