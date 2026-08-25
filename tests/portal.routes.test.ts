import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { env } from '../server/config/env.js';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('GET /api/portal/pagos/enlace', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('permite a un autor autenticado obtener el enlace con token al portal de pago', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const cookie = await registrarYLoguear(app, 'autor');

    const respuesta = await request(app.server).get('/api/portal/pagos/enlace').set('Cookie', cookie);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.url).toMatch(new RegExp(`^${env.PAYMENT_PORTAL_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\?token=`));

    const token = new URL(respuesta.body.url).searchParams.get('token');
    expect(token?.split('.')).toHaveLength(3);

    await app.close();
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
