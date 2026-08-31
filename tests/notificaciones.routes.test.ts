import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearNotificacionDePrueba, crearProyectoDePrueba } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('rutas de notificaciones', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  describe('GET /api/notificaciones', () => {
    it('devuelve solo las notificaciones cuyo rolDestino coincide con el rol de la sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      await crearNotificacionDePrueba({ rolDestino: 'jefe_area', mensaje: 'Para jefe_area' });
      await crearNotificacionDePrueba({ rolDestino: 'rrpp', mensaje: 'Para rrpp' });
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server).get('/api/notificaciones').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.notificaciones).toHaveLength(1);
      expect(respuesta.body.notificaciones[0].mensaje).toBe('Para jefe_area');

      await app.close();
    });

    it('ordena las notificaciones más recientes primero', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      await crearNotificacionDePrueba({ rolDestino: 'jefe_area', mensaje: 'Primera' });
      await crearNotificacionDePrueba({ rolDestino: 'jefe_area', mensaje: 'Segunda' });
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server).get('/api/notificaciones').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.notificaciones).toHaveLength(2);
      expect(respuesta.body.notificaciones[0].mensaje).toBe('Segunda');
      expect(respuesta.body.notificaciones[1].mensaje).toBe('Primera');

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const respuesta = await request(app.server).get('/api/notificaciones');

      expect(respuesta.status).toBe(401);

      await app.close();
    });
  });

  describe('PATCH /api/notificaciones/:id/leer', () => {
    it('marca una notificación propia como leída', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const notificacion = await crearNotificacionDePrueba({ rolDestino: 'jefe_area' });
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server).patch(`/api/notificaciones/${notificacion.id}/leer`).set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.notificacion.leido).toBe(true);

      await app.close();
    });

    it('devuelve 404 (no 200 silencioso) si la notificación es de otro rol', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const notificacion = await crearNotificacionDePrueba({ rolDestino: 'rrpp' });
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server).patch(`/api/notificaciones/${notificacion.id}/leer`).set('Cookie', cookie);

      expect(respuesta.status).toBe(404);

      await app.close();
    });

    it('devuelve 404 si la notificación no existe', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server)
        .patch('/api/notificaciones/00000000-0000-0000-0000-000000000000/leer')
        .set('Cookie', cookie);

      expect(respuesta.status).toBe(404);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const notificacion = await crearNotificacionDePrueba({ rolDestino: 'jefe_area' });

      const respuesta = await request(app.server).patch(`/api/notificaciones/${notificacion.id}/leer`);

      expect(respuesta.status).toBe(401);

      await app.close();
    });
  });

  describe('proyectoId opcional', () => {
    it('acepta una notificación sin proyectoId', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      await crearNotificacionDePrueba({ rolDestino: 'jefe_area', mensaje: 'Sin proyecto asociado' });
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server).get('/api/notificaciones').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.notificaciones[0].proyectoId).toBeNull();

      await app.close();
    });

    it('acepta una notificación con proyectoId', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      await crearNotificacionDePrueba({ rolDestino: 'jefe_area', proyectoId: proyecto.id });
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server).get('/api/notificaciones').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.notificaciones[0].proyectoId).toBe(proyecto.id);

      await app.close();
    });
  });
});
