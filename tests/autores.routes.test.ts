import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAutor, crearPresupuesto, crearProyecto, crearServicio, crearUnidad } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('GET /api/autores/sin-proyecto', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('permite a jefe_area listar solo los autores sin ningún proyecto', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const [autorSinProyecto, autorConProyecto, unidad, presupuesto] = await Promise.all([
      crearAutor(),
      crearAutor(),
      crearUnidad(),
      crearPresupuesto(),
    ]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    await crearProyecto({
      autorId: autorConProyecto.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });

    const cookie = await registrarYLoguear(app, 'jefe_area');

    const respuesta = await request(app.server).get('/api/autores/sin-proyecto').set('Cookie', cookie);

    expect(respuesta.status).toBe(200);
    const ids = respuesta.body.autores.map((a: { id: string }) => a.id);
    expect(ids).toContain(autorSinProyecto.id);
    expect(ids).not.toContain(autorConProyecto.id);

    await app.close();
  });

  it('rechaza sin sesión', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const respuesta = await request(app.server).get('/api/autores/sin-proyecto');

    expect(respuesta.status).toBe(401);

    await app.close();
  });

  it('rechaza a un rol distinto de jefe_area (ej. comercial)', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const cookie = await registrarYLoguear(app, 'comercial');

    const respuesta = await request(app.server).get('/api/autores/sin-proyecto').set('Cookie', cookie);

    expect(respuesta.status).toBe(403);

    await app.close();
  });
});

describe('PATCH /api/autores/:id', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('permite a comercial corregir los datos de un autor', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const autor = await crearAutor();
    const cookie = await registrarYLoguear(app, 'comercial');

    const respuesta = await request(app.server)
      .patch(`/api/autores/${autor.id}`)
      .set('Cookie', cookie)
      .send({ email: 'corregido@ejemplo.test' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.autor.email).toBe('corregido@ejemplo.test');

    await app.close();
  });

  it('permite borrar un campo enviando null', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const autor = await crearAutor();
    const cookie = await registrarYLoguear(app, 'comercial');

    const respuesta = await request(app.server).patch(`/api/autores/${autor.id}`).set('Cookie', cookie).send({ telefono: null });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.autor.telefono).toBeNull();

    await app.close();
  });

  it('rechaza un body vacío', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const autor = await crearAutor();
    const cookie = await registrarYLoguear(app, 'comercial');

    const respuesta = await request(app.server).patch(`/api/autores/${autor.id}`).set('Cookie', cookie).send({});

    expect(respuesta.status).toBe(400);

    await app.close();
  });

  it('devuelve 404 si el autor no existe', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const cookie = await registrarYLoguear(app, 'comercial');

    const respuesta = await request(app.server)
      .patch('/api/autores/00000000-0000-0000-0000-000000000000')
      .set('Cookie', cookie)
      .send({ nombre: 'Nuevo nombre' });

    expect(respuesta.status).toBe(404);

    await app.close();
  });

  it('rechaza sin sesión', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const autor = await crearAutor();

    const respuesta = await request(app.server).patch(`/api/autores/${autor.id}`).send({ nombre: 'Otro nombre' });

    expect(respuesta.status).toBe(401);

    await app.close();
  });

  it('rechaza a un rol sin permiso de escritura (ej. rrpp)', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const autor = await crearAutor();
    const cookie = await registrarYLoguear(app, 'rrpp');

    const respuesta = await request(app.server).patch(`/api/autores/${autor.id}`).set('Cookie', cookie).send({ nombre: 'Otro nombre' });

    expect(respuesta.status).toBe(403);

    await app.close();
  });
});
