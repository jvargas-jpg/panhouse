import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearUsuario } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('Autenticación', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  // Crear cuentas es una acción administrativa, no un formulario
  // público — ver server/db/createUser.ts. Este test deja fijado que
  // la ruta no vuelva a existir por accidente.
  it('POST /api/auth/register no existe (registro público cerrado)', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const respuesta = await request(app.server).post('/api/auth/register').send({
      email: 'quien-sea@panhouse.test',
      password: 'password123',
      nombre: 'Quien Sea',
      rol: 'direccion',
    });

    expect(respuesta.status).toBe(404);

    await app.close();
  });

  it('permite iniciar sesión con credenciales válidas y devuelve cookie httpOnly', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const usuario = await crearUsuario('direccion');

    const respuesta = await request(app.server).post('/api/auth/login').send({
      email: usuario.email,
      password: 'password123',
    });

    expect(respuesta.status).toBe(200);
    const cookie = respuesta.headers['set-cookie']?.[0];
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);

    await app.close();
  });

  it('rechaza el login con contraseña incorrecta', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const usuario = await crearUsuario('comercial');

    const respuesta = await request(app.server).post('/api/auth/login').send({
      email: usuario.email,
      password: 'incorrecta',
    });

    expect(respuesta.status).toBe(401);

    await app.close();
  });

  it('rechaza el login de un correo que no existe', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const respuesta = await request(app.server).post('/api/auth/login').send({
      email: 'no-existe@panhouse.test',
      password: 'password123',
    });

    expect(respuesta.status).toBe(401);

    await app.close();
  });

  it('GET /api/auth/me devuelve el usuario autenticado usando la cookie de sesión', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const usuario = await crearUsuario('direccion');

    const login = await request(app.server).post('/api/auth/login').send({
      email: usuario.email,
      password: 'password123',
    });
    const cookie = login.headers['set-cookie'];
    if (!cookie) throw new Error('El login no devolvió cookie de sesión');

    const respuesta = await request(app.server).get('/api/auth/me').set('Cookie', cookie);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.user.email).toBe(usuario.email);

    await app.close();
  });
});
