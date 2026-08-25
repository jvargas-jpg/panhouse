import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAutor, crearPresupuesto, crearProyecto, crearServicio, crearUnidad } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('GET /api/especialistas/carga', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('permite a jefe_area listar la carga de todos los especialistas', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    await registrarYLoguear(app, 'especialista'); // deja un especialista sembrado
    const cookie = await registrarYLoguear(app, 'jefe_area');

    const respuesta = await request(app.server).get('/api/especialistas/carga').set('Cookie', cookie);

    expect(respuesta.status).toBe(200);
    expect(Array.isArray(respuesta.body.especialistas)).toBe(true);
    expect(respuesta.body.especialistas.length).toBeGreaterThanOrEqual(1);

    await app.close();
  });

  it('rechaza sin sesión', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const respuesta = await request(app.server).get('/api/especialistas/carga');

    expect(respuesta.status).toBe(401);

    await app.close();
  });

  it('rechaza a un rol distinto de jefe_area, incluido un especialista', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const cookie = await registrarYLoguear(app, 'especialista');

    const respuesta = await request(app.server).get('/api/especialistas/carga').set('Cookie', cookie);

    expect(respuesta.status).toBe(403);

    await app.close();
  });
});

describe('GET /api/especialistas/:id/carga', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('permite a jefe_area consultar la carga de cualquier especialista', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const especialistaCookie = await registrarYLoguear(app, 'especialista');
    const especialistaLogin = await request(app.server).get('/api/auth/me').set('Cookie', especialistaCookie);
    const especialistaId = especialistaLogin.body.user.id as string;

    await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      especialistaId,
      fechaProgramadaInicio: '2026-01-01',
    });

    const cookieJefe = await registrarYLoguear(app, 'jefe_area');

    const respuesta = await request(app.server).get(`/api/especialistas/${especialistaId}/carga`).set('Cookie', cookieJefe);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.carga).toBe(4);

    await app.close();
  });

  it('permite a un especialista consultar su propia carga', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const cookie = await registrarYLoguear(app, 'especialista');
    const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
    const propioId = me.body.user.id as string;

    const respuesta = await request(app.server).get(`/api/especialistas/${propioId}/carga`).set('Cookie', cookie);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.carga).toBe(0);

    await app.close();
  });

  it('rechaza a un especialista consultando la carga de otro especialista', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const cookieOtro = await registrarYLoguear(app, 'especialista');
    const otro = await request(app.server).get('/api/auth/me').set('Cookie', cookieOtro);
    const otroId = otro.body.user.id as string;

    const cookiePropio = await registrarYLoguear(app, 'especialista');

    const respuesta = await request(app.server).get(`/api/especialistas/${otroId}/carga`).set('Cookie', cookiePropio);

    expect(respuesta.status).toBe(403);

    await app.close();
  });

  it('rechaza sin sesión', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const cookie = await registrarYLoguear(app, 'especialista');
    const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);

    const respuesta = await request(app.server).get(`/api/especialistas/${me.body.user.id}/carga`);

    expect(respuesta.status).toBe(401);

    await app.close();
  });

  it('rechaza a un rol sin ningún permiso sobre carga (ej. diseñador)', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const cookieEspecialista = await registrarYLoguear(app, 'especialista');
    const me = await request(app.server).get('/api/auth/me').set('Cookie', cookieEspecialista);

    const cookieDisenador = await registrarYLoguear(app, 'disenador');

    const respuesta = await request(app.server)
      .get(`/api/especialistas/${me.body.user.id}/carga`)
      .set('Cookie', cookieDisenador);

    expect(respuesta.status).toBe(403);

    await app.close();
  });
});
