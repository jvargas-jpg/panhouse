import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearNotificacionDePrueba, crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
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

  // §16 del master prompt de rearquitectura ("NOTIFICACIONES"): A-D.
  describe('notificaciones dirigidas (usuarioDestinoId)', () => {
    it('A. usuarioDestinoId dirigido: solo ese usuario la ve', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const destinatario = await crearUsuario('especialista');
      await crearNotificacionDePrueba({ rolDestino: 'especialista', usuarioDestinoId: destinatario.id, mensaje: 'Para ti' });
      const login = await request(app.server).post('/api/auth/login').send({ email: destinatario.email, password: 'password123' });
      const cookieDestinatario = login.headers['set-cookie'];
      if (!cookieDestinatario) throw new Error('El login no devolvió cookie de sesión');

      const respuesta = await request(app.server).get('/api/notificaciones').set('Cookie', cookieDestinatario);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.notificaciones).toHaveLength(1);
      expect(respuesta.body.notificaciones[0].mensaje).toBe('Para ti');

      await app.close();
    });

    it('B. otro usuario con el mismo rol NO ve una notificación dirigida a otro', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const destinatario = await crearUsuario('especialista');
      await crearNotificacionDePrueba({ rolDestino: 'especialista', usuarioDestinoId: destinatario.id, mensaje: 'Para otro especialista' });
      // Mismo rol, cuenta DISTINTA.
      const cookieOtro = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server).get('/api/notificaciones').set('Cookie', cookieOtro);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.notificaciones).toHaveLength(0);

      await app.close();
    });

    it('C. usuarioDestinoId=null sigue siendo broadcast — visible a cualquiera del rol', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      await crearNotificacionDePrueba({ rolDestino: 'especialista', mensaje: 'Para todo el equipo' });
      const cookieA = await registrarYLoguear(app, 'especialista');
      const cookieB = await registrarYLoguear(app, 'especialista');

      const respuestaA = await request(app.server).get('/api/notificaciones').set('Cookie', cookieA);
      const respuestaB = await request(app.server).get('/api/notificaciones').set('Cookie', cookieB);

      expect(respuestaA.body.notificaciones).toHaveLength(1);
      expect(respuestaB.body.notificaciones).toHaveLength(1);

      await app.close();
    });

    it('D. un usuario no puede marcar como leída una notificación dirigida a otro', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const destinatario = await crearUsuario('especialista');
      const notificacion = await crearNotificacionDePrueba({ rolDestino: 'especialista', usuarioDestinoId: destinatario.id });
      // Mismo rol, cuenta DISTINTA del destinatario real.
      const cookieOtro = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server).patch(`/api/notificaciones/${notificacion.id}/leer`).set('Cookie', cookieOtro);

      expect(respuesta.status).toBe(404);

      await app.close();
    });
  });
});
