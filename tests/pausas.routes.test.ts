import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import {
  crearAutor,
  crearPresupuesto,
  crearProyecto,
  crearProyectoDePrueba,
  crearServicio,
  crearUnidad,
  insertarPausa,
} from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('rutas de pausas', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  describe('POST /api/pausas (pausa normal)', () => {
    it('permite a un especialista crear una pausa normal', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .post('/api/pausas')
        .set('Cookie', cookie)
        .send({ proyectoId: proyecto.id, causa: 'autor', fechaInicio: '2026-01-10T00:00:00Z' });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.pausa.causa).toBe('autor');

      await app.close();
    });

    it('rechaza crear una pausa sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();

      const respuesta = await request(app.server)
        .post('/api/pausas')
        .send({ proyectoId: proyecto.id, causa: 'autor', fechaInicio: '2026-01-10T00:00:00Z' });

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza crear una pausa a un rol sin ningún permiso sobre pausas', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'disenador');

      const respuesta = await request(app.server)
        .post('/api/pausas')
        .set('Cookie', cookie)
        .send({ proyectoId: proyecto.id, causa: 'autor', fechaInicio: '2026-01-10T00:00:00Z' });

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('POST /api/pausas (pausa formal / PAUSADO)', () => {
    it('permite a jefe_area crear una pausa formal con pago confirmado', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server)
        .post('/api/pausas')
        .set('Cookie', cookie)
        .send({
          proyectoId: proyecto.id,
          causa: 'autor',
          fechaInicio: '2026-01-10T00:00:00Z',
          esPausadoFormal: true,
          pagoConfirmado: true,
          fechaLimiteRetoma: '2026-04-10',
        });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.pausa.esPausadoFormal).toBe(true);
      expect(respuesta.body.pausa.origenConfirmacionPago).toBe('manual');

      await app.close();
    });

    it('rechaza una pausa formal creada por un especialista, aunque pueda crear pausas normales', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .post('/api/pausas')
        .set('Cookie', cookie)
        .send({
          proyectoId: proyecto.id,
          causa: 'autor',
          fechaInicio: '2026-01-10T00:00:00Z',
          esPausadoFormal: true,
          pagoConfirmado: true,
        });

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    it('rechaza una pausa formal sin pago confirmado, incluso creada por jefe_area', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server)
        .post('/api/pausas')
        .set('Cookie', cookie)
        .send({
          proyectoId: proyecto.id,
          causa: 'autor',
          fechaInicio: '2026-01-10T00:00:00Z',
          esPausadoFormal: true,
          pagoConfirmado: false,
        });

      expect(respuesta.status).toBe(400);

      await app.close();
    });
  });

  describe('GET /api/pausas/:proyectoId', () => {
    it('permite al especialista dueño del proyecto listar sus pausas', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);

      const proyecto = await crearProyecto({
        autorId: autor.id,
        servicioId: servicio.id,
        unidadId: unidad.id,
        presupuestoId: presupuesto.id,
        especialistaId: me.body.user.id,
        fechaProgramadaInicio: '2026-01-01',
      });
      await insertarPausa({
        proyectoId: proyecto.id,
        causa: 'autor',
        fechaInicio: new Date('2026-02-01T00:00:00Z'),
      });

      const respuesta = await request(app.server).get(`/api/pausas/${proyecto.id}`).set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.pausas).toHaveLength(1);
      expect(respuesta.body.pausas[0].causa).toBe('autor');

      await app.close();
    });

    it('permite a jefe_area listar las pausas de cualquier proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server).get(`/api/pausas/${proyecto.id}`).set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.pausas).toEqual([]);

      await app.close();
    });

    it('rechaza a un especialista que no es dueño del proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba(); // sin especialista asignado
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server).get(`/api/pausas/${proyecto.id}`).set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();

      const respuesta = await request(app.server).get(`/api/pausas/${proyecto.id}`);

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('devuelve 404 si el proyecto no existe', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server).get('/api/pausas/00000000-0000-0000-0000-000000000000').set('Cookie', cookie);

      expect(respuesta.status).toBe(404);

      await app.close();
    });
  });
});
