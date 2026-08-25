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
} from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';
import { crearCapitulo } from '../server/helpers/capitulos.js';

describe('rutas de capítulos', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  describe('POST /api/capitulos', () => {
    it('permite a un editor crear un capítulo en su propio proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const cookie = await registrarYLoguear(app, 'editor');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);

      const proyecto = await crearProyecto({
        autorId: autor.id,
        servicioId: servicio.id,
        unidadId: unidad.id,
        presupuestoId: presupuesto.id,
        editorId: me.body.user.id,
        fechaProgramadaInicio: '2026-01-01',
      });

      const respuesta = await request(app.server)
        .post('/api/capitulos')
        .set('Cookie', cookie)
        .send({ proyectoId: proyecto.id, numero: 1 });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.capitulo.numero).toBe(1);

      await app.close();
    });

    it('rechaza a un editor que no es el asignado del proyecto crear un capítulo (hueco de seguridad cerrado)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba(); // sin editor asignado
      const cookie = await registrarYLoguear(app, 'editor');

      const respuesta = await request(app.server)
        .post('/api/capitulos')
        .set('Cookie', cookie)
        .send({ proyectoId: proyecto.id, numero: 1 });

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    it('rechaza crear un capítulo sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();

      const respuesta = await request(app.server).post('/api/capitulos').send({ proyectoId: proyecto.id, numero: 1 });

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza crear un capítulo a un rol distinto de editor', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .post('/api/capitulos')
        .set('Cookie', cookie)
        .send({ proyectoId: proyecto.id, numero: 1 });

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('PATCH /api/capitulos/:proyectoId/:numero/autor', () => {
    it('rechaza a un editor actualizar el lado autor del capítulo (solo especialista, ver comentario en la ruta)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      await crearCapitulo(proyecto.id, 1);
      const cookie = await registrarYLoguear(app, 'editor');

      const respuesta = await request(app.server)
        .patch(`/api/capitulos/${proyecto.id}/1/autor`)
        .set('Cookie', cookie)
        .send({ fechaEnvioAutor: '2026-02-01' });

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    it('permite a un especialista actualizar el lado autor del capítulo en su propio proyecto', async () => {
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
      await crearCapitulo(proyecto.id, 1);

      const respuesta = await request(app.server)
        .patch(`/api/capitulos/${proyecto.id}/1/autor`)
        .set('Cookie', cookie)
        .send({ fechaEnvioAutor: '2026-02-01' });

      expect(respuesta.status).toBe(200);

      await app.close();
    });

    // Mismo hueco de seguridad que ya se cerró para editor (ver
    // verificarAccesoAProyecto en server/helpers/proyectos.ts): esta
    // ruta nunca llamaba la función, así que cualquier especialista
    // podía tocar el lado autor de cualquier proyecto.
    it('rechaza a un especialista que no es el asignado del proyecto actualizar el lado autor (hueco de seguridad cerrado)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba(); // sin especialista asignado
      await crearCapitulo(proyecto.id, 1);
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/capitulos/${proyecto.id}/1/autor`)
        .set('Cookie', cookie)
        .send({ fechaEnvioAutor: '2026-02-01' });

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    it('rechaza actualizar el lado autor sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      await crearCapitulo(proyecto.id, 1);

      const respuesta = await request(app.server).patch(`/api/capitulos/${proyecto.id}/1/autor`).send({ fechaEnvioAutor: '2026-02-01' });

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza actualizar el lado autor a un rol sin permiso (ej. diseñador)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      await crearCapitulo(proyecto.id, 1);
      const cookie = await registrarYLoguear(app, 'disenador');

      const respuesta = await request(app.server)
        .patch(`/api/capitulos/${proyecto.id}/1/autor`)
        .set('Cookie', cookie)
        .send({ fechaEnvioAutor: '2026-02-01' });

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('PATCH /api/capitulos/:proyectoId/:numero/editor', () => {
    it('permite a un editor marcar la entrega del capítulo en su propio proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const cookie = await registrarYLoguear(app, 'editor');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);

      const proyecto = await crearProyecto({
        autorId: autor.id,
        servicioId: servicio.id,
        unidadId: unidad.id,
        presupuestoId: presupuesto.id,
        editorId: me.body.user.id,
        fechaProgramadaInicio: '2026-01-01',
      });
      await crearCapitulo(proyecto.id, 1);

      const respuesta = await request(app.server)
        .patch(`/api/capitulos/${proyecto.id}/1/editor`)
        .set('Cookie', cookie)
        .send({ fechaEntregaEditor: '2026-03-01', paginas: 22 });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.capitulo.fechaEntregaEditor).toBe('2026-03-01');
      expect(respuesta.body.capitulo.paginas).toBe(22);

      await app.close();
    });

    // Este es el caso crítico: hoy cualquier editor podía tocar
    // capítulos de cualquier proyecto con solo saber el id — ver
    // verificarAccesoAProyecto en server/helpers/proyectos.ts.
    it('rechaza a un editor que no es el asignado del proyecto marcar la entrega (hueco de seguridad cerrado)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba(); // sin editor asignado
      await crearCapitulo(proyecto.id, 1);
      const cookie = await registrarYLoguear(app, 'editor');

      const respuesta = await request(app.server)
        .patch(`/api/capitulos/${proyecto.id}/1/editor`)
        .set('Cookie', cookie)
        .send({ fechaEntregaEditor: '2026-03-01' });

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    it('rechaza marcar la entrega sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      await crearCapitulo(proyecto.id, 1);

      const respuesta = await request(app.server).patch(`/api/capitulos/${proyecto.id}/1/editor`).send({ fechaEntregaEditor: '2026-03-01' });

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza marcar la entrega a un especialista (a diferencia del lado autor, aquí no tiene permiso)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      await crearCapitulo(proyecto.id, 1);
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/capitulos/${proyecto.id}/1/editor`)
        .set('Cookie', cookie)
        .send({ fechaEntregaEditor: '2026-03-01' });

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('GET /api/capitulos/:proyectoId', () => {
    it('permite al especialista dueño del proyecto listar sus capítulos', async () => {
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
      await crearCapitulo(proyecto.id, 1);
      await crearCapitulo(proyecto.id, 2);

      const respuesta = await request(app.server).get(`/api/capitulos/${proyecto.id}`).set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.capitulos).toHaveLength(2);
      expect(respuesta.body.capitulos[0].numero).toBe(1);

      await app.close();
    });

    it('permite a jefe_area listar los capítulos de cualquier proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server).get(`/api/capitulos/${proyecto.id}`).set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.capitulos).toEqual([]);

      await app.close();
    });

    it('permite a editor listar los capítulos de su propio proyecto (necesita encontrar el suyo para marcarlo)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const cookie = await registrarYLoguear(app, 'editor');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);

      const proyecto = await crearProyecto({
        autorId: autor.id,
        servicioId: servicio.id,
        unidadId: unidad.id,
        presupuestoId: presupuesto.id,
        editorId: me.body.user.id,
        fechaProgramadaInicio: '2026-01-01',
      });

      const respuesta = await request(app.server).get(`/api/capitulos/${proyecto.id}`).set('Cookie', cookie);

      expect(respuesta.status).toBe(200);

      await app.close();
    });

    it('rechaza a un editor que no es el asignado del proyecto listar sus capítulos', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba(); // sin editor asignado
      const cookie = await registrarYLoguear(app, 'editor');

      const respuesta = await request(app.server).get(`/api/capitulos/${proyecto.id}`).set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    it('rechaza a un rol sin ningún permiso sobre capítulos (ej. comercial)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server).get(`/api/capitulos/${proyecto.id}`).set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    it('rechaza a un especialista que no es dueño del proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba(); // sin especialista asignado
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server).get(`/api/capitulos/${proyecto.id}`).set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();

      const respuesta = await request(app.server).get(`/api/capitulos/${proyecto.id}`);

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('devuelve 404 si el proyecto no existe', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server).get('/api/capitulos/00000000-0000-0000-0000-000000000000').set('Cookie', cookie);

      expect(respuesta.status).toBe(404);

      await app.close();
    });
  });
});
