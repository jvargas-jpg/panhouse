import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('Autorización por rol', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('rechaza el acceso a un endpoint protegido sin sesión', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const respuesta = await request(app.server).get('/api/autores');

    expect(respuesta.status).toBe(401);

    await app.close();
  });

  it('rechaza una cookie de sesión inválida', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const respuesta = await request(app.server).get('/api/autores').set('Cookie', 'panhouse_sid=token-invalido');

    expect(respuesta.status).toBe(401);

    await app.close();
  });

  it('permite a un rol autorizado crear un autor, con país', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const cookie = await registrarYLoguear(app, 'comercial');

    const respuesta = await request(app.server)
      .post('/api/autores')
      .set('Cookie', cookie)
      .send({ nombre: 'Autor de prueba', email: ['autor@panhouse.test'], pais: 'Colombia' });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.autor.pais).toBe('Colombia');

    await app.close();
  });

  it('rechaza a un usuario autenticado fuera de su rol', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const cookie = await registrarYLoguear(app, 'disenador');

    const respuesta = await request(app.server)
      .post('/api/autores')
      .set('Cookie', cookie)
      .send({ nombre: 'Autor de prueba' });

    expect(respuesta.status).toBe(403);

    await app.close();
  });
});
