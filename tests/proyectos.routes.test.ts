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
  crearUsuario,
} from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('rutas de proyectos', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  describe('POST /api/proyectos', () => {
    it('permite a jefe_area crear un proyecto (y su ficha vacía)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server)
        .post('/api/proyectos')
        .set('Cookie', cookie)
        .send({
          autorId: autor.id,
          servicioId: servicio.id,
          unidadId: unidad.id,
          presupuestoId: presupuesto.id,
          fechaProgramadaInicio: '2026-01-01',
        });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.proyecto.autorId).toBe(autor.id);

      await app.close();
    });

    it('rechaza crear un proyecto sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const respuesta = await request(app.server).post('/api/proyectos').send({});

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    // comercial crea proyectos desde su propio CRM (AutoresPage.tsx) —
    // mismo endpoint y validación que jefe_area.
    it('permite a comercial crear un proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server)
        .post('/api/proyectos')
        .set('Cookie', cookie)
        .send({
          autorId: autor.id,
          servicioId: servicio.id,
          unidadId: unidad.id,
          presupuestoId: presupuesto.id,
          fechaProgramadaInicio: '2026-01-01',
        });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.proyecto.autorId).toBe(autor.id);

      await app.close();
    });

    // Cambio de flujo confirmado: jefe_area y comercial crean proyectos,
    // el especialista no (revierte una decisión anterior a propósito).
    it('rechaza crear un proyecto a un rol distinto de jefe_area/comercial (ej. especialista)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .post('/api/proyectos')
        .set('Cookie', cookie)
        .send({
          autorId: autor.id,
          servicioId: servicio.id,
          unidadId: unidad.id,
          presupuestoId: presupuesto.id,
          fechaProgramadaInicio: '2026-01-01',
        });

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('GET /api/proyectos/activos', () => {
    it('permite a comercial listar los proyectos en estados activos, con autor y servicio resueltos', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyectoActivo = await crearProyectoDePrueba({ estado: 'en_proceso' });
      await crearProyectoDePrueba({ estado: 'retirado' });
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server).get('/api/proyectos/activos').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyectos).toHaveLength(1);
      expect(respuesta.body.proyectos[0].id).toBe(proyectoActivo.id);
      expect(respuesta.body.proyectos[0].autor.nombre).toBeTypeOf('string');
      expect(respuesta.body.proyectos[0].servicio.codigo).toBeTypeOf('string');
      await app.close();
    });

    it.each(['rrpp', 'cobranzas', 'jefe_area'] as const)('permite a %s listar los proyectos activos', async (rol) => {
      const app = crearAppDePrueba();
      await app.ready();
      await crearProyectoDePrueba({ estado: 'en_proceso' });
      const cookie = await registrarYLoguear(app, rol);

      const respuesta = await request(app.server).get('/api/proyectos/activos').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyectos).toHaveLength(1);
      await app.close();
    });

    it('rechaza a un rol sin relación con el módulo de pagos (ej. especialista)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server).get('/api/proyectos/activos').set('Cookie', cookie);

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const respuesta = await request(app.server).get('/api/proyectos/activos');

      expect(respuesta.status).toBe(401);
      await app.close();
    });
  });

  describe('PATCH /api/proyectos/:id/reasignar', () => {
    it('permite a comercial reasignar el autor de un proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const nuevoAutor = await crearAutor();
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/reasignar`)
        .set('Cookie', cookie)
        .send({ autorId: nuevoAutor.id });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyecto.autorId).toBe(nuevoAutor.id);

      await app.close();
    });

    it('permite a comercial reasignar el servicio de un proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const nuevoServicio = await crearServicio({ codigo: 'EEC', nombre: 'Edición de estilo por capítulo', pesoComplejidad: 3, plazoDias: 150 });
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/reasignar`)
        .set('Cookie', cookie)
        .send({ servicioId: nuevoServicio.id });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyecto.servicioId).toBe(nuevoServicio.id);

      await app.close();
    });

    it('rechaza un body vacío', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server).patch(`/api/proyectos/${proyecto.id}/reasignar`).set('Cookie', cookie).send({});

      expect(respuesta.status).toBe(400);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();

      const respuesta = await request(app.server).patch(`/api/proyectos/${proyecto.id}/reasignar`).send({ autorId: proyecto.autorId });

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza a un rol sin permiso (ej. especialista)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/reasignar`)
        .set('Cookie', cookie)
        .send({ autorId: proyecto.autorId });

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('PATCH /api/proyectos/:id/equipo', () => {
    it('permite a jefe_area asignar varios roles del equipo a la vez', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const [especialista, corrector, calidad, digital, lanzamiento, distribucion] = await Promise.all([
        crearUsuario('especialista'),
        crearUsuario('soporte_editorial'),
        crearUsuario('soporte_editorial'),
        crearUsuario('soporte_digital'),
        crearUsuario('rrpp'),
        crearUsuario('rrpp'),
      ]);
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/equipo`)
        .set('Cookie', cookie)
        .send({
          especialistaId: especialista.id,
          correctorId: corrector.id,
          calidadId: calidad.id,
          digitalId: digital.id,
          lanzamientoId: lanzamiento.id,
          distribucionId: distribucion.id,
        });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyecto.especialistaId).toBe(especialista.id);
      expect(respuesta.body.proyecto.correctorId).toBe(corrector.id);
      expect(respuesta.body.proyecto.digitalId).toBe(digital.id);
      expect(respuesta.body.proyecto.lanzamientoId).toBe(lanzamiento.id);
      expect(respuesta.body.proyecto.distribucionId).toBe(distribucion.id);
      expect(respuesta.body.proyecto.calidadId).toBe(calidad.id);

      await app.close();
    });

    it('permite dejar un rol sin asignar de nuevo (null)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const especialista = await crearUsuario('especialista');
      const proyecto = await crearProyectoDePrueba({ especialistaId: especialista.id });
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/equipo`)
        .set('Cookie', cookie)
        .send({ especialistaId: null });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyecto.especialistaId).toBeNull();

      await app.close();
    });

    it('rechaza un body vacío', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server).patch(`/api/proyectos/${proyecto.id}/equipo`).set('Cookie', cookie).send({});

      expect(respuesta.status).toBe(400);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();

      const respuesta = await request(app.server).patch(`/api/proyectos/${proyecto.id}/equipo`).send({ especialistaId: null });

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza a un rol distinto de jefe_area (ej. especialista)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/equipo`)
        .set('Cookie', cookie)
        .send({ especialistaId: null });

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('PATCH /api/proyectos/:id/especialista', () => {
    it('permite a jefe_area asignar especialista a un proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const especialista = await crearUsuario('especialista');
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/especialista`)
        .set('Cookie', cookie)
        .send({ especialistaId: especialista.id });

      expect(respuesta.status).toBe(200);

      await app.close();
    });

    it('rechaza asignar especialista sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const especialista = await crearUsuario('especialista');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/especialista`)
        .send({ especialistaId: especialista.id });

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza asignar especialista a un rol distinto de jefe_area', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const especialista = await crearUsuario('especialista');
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/especialista`)
        .set('Cookie', cookie)
        .send({ especialistaId: especialista.id });

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('PATCH /api/proyectos/:id/editor', () => {
    it('permite a jefe_edicion asignar editor a un proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const editor = await crearUsuario('editor');
      const cookie = await registrarYLoguear(app, 'jefe_edicion');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/editor`)
        .set('Cookie', cookie)
        .send({ editorId: editor.id });

      expect(respuesta.status).toBe(200);

      await app.close();
    });

    it('rechaza asignar editor sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const editor = await crearUsuario('editor');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/editor`)
        .send({ editorId: editor.id });

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza asignar editor a un rol distinto de jefe_edicion (ej. jefe_area)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const editor = await crearUsuario('editor');
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/editor`)
        .set('Cookie', cookie)
        .send({ editorId: editor.id });

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('PATCH /api/proyectos/:id/titulo', () => {
    it('permite a rrpp actualizar el título del proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/titulo`)
        .set('Cookie', cookie)
        .send({ titulo: 'El libro que faltaba' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyecto.titulo).toBe('El libro que faltaba');

      await app.close();
    });

    it('rechaza actualizar el título sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();

      const respuesta = await request(app.server).patch(`/api/proyectos/${proyecto.id}/titulo`).send({ titulo: 'x' });

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza actualizar el título a un rol distinto de rrpp (ej. especialista)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/titulo`)
        .set('Cookie', cookie)
        .send({ titulo: 'x' });

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('PATCH /api/proyectos/:id', () => {
    it('permite a un especialista actualizar las especificaciones del proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}`)
        .set('Cookie', cookie)
        .send({ fechaDeseadaAutor: '2026-06-01' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyecto.fechaDeseadaAutor).toBe('2026-06-01');

      await app.close();
    });

    it('rechaza actualizar el proyecto sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();

      const respuesta = await request(app.server).patch(`/api/proyectos/${proyecto.id}`).send({ fechaDeseadaAutor: '2026-06-01' });

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza actualizar el proyecto a un rol distinto de especialista', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}`)
        .set('Cookie', cookie)
        .send({ fechaDeseadaAutor: '2026-06-01' });

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    it('rechaza cambiar el estado a pausado por esta ruta, aunque sea un especialista con permiso', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}`)
        .set('Cookie', cookie)
        .send({ estado: 'pausado' });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toMatch(/esPausadoFormal/);

      await app.close();
    });

    it('permite al mismo especialista cambiar el estado a otro valor sin problema', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}`)
        .set('Cookie', cookie)
        .send({ estado: 'retrasado' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyecto.estado).toBe('retrasado');

      await app.close();
    });
  });

  describe('GET /api/proyectos/riesgo', () => {
    it('permite a jefe_area listar el riesgo de todos los proyectos activos', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server).get('/api/proyectos/riesgo').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(Array.isArray(respuesta.body.proyectos)).toBe(true);
      expect(respuesta.body.proyectos.length).toBeGreaterThanOrEqual(1);

      await app.close();
    });

    it('permite también a dirección listar el riesgo', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'direccion');

      const respuesta = await request(app.server).get('/api/proyectos/riesgo').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const respuesta = await request(app.server).get('/api/proyectos/riesgo');

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza a un especialista (no está en la lista de permisos de este listado)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server).get('/api/proyectos/riesgo').set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('GET /api/proyectos/:id/riesgo', () => {
    it('permite a jefe_area consultar el riesgo de cualquier proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server).get(`/api/proyectos/${proyecto.id}/riesgo`).set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyecto.riesgo).toBeDefined();
      expect(respuesta.body.proyecto.autor).toBeDefined();
      expect(respuesta.body.proyecto.servicio).toBeDefined();

      await app.close();
    });

    it('permite al especialista dueño del proyecto consultar su riesgo', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const cookieEspecialista = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookieEspecialista);
      const especialistaId = me.body.user.id as string;

      const proyecto = await crearProyecto({
        autorId: autor.id,
        servicioId: servicio.id,
        unidadId: unidad.id,
        presupuestoId: presupuesto.id,
        especialistaId,
        fechaProgramadaInicio: '2026-01-01',
      });

      const respuesta = await request(app.server).get(`/api/proyectos/${proyecto.id}/riesgo`).set('Cookie', cookieEspecialista);

      expect(respuesta.status).toBe(200);

      await app.close();
    });

    it('rechaza a un especialista que no es dueño del proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba(); // sin especialista asignado
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server).get(`/api/proyectos/${proyecto.id}/riesgo`).set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();

      const respuesta = await request(app.server).get(`/api/proyectos/${proyecto.id}/riesgo`);

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza a un rol sin ningún permiso sobre riesgo (ej. cobranzas)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'cobranzas');

      const respuesta = await request(app.server).get(`/api/proyectos/${proyecto.id}/riesgo`).set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    // disenador no comparte este .each: a diferencia de esos roles, sí
    // está scoped por verificarAccesoAProyecto (mismo criterio que
    // especialista/editor) — ver los tests dedicados más abajo.
    it.each(['rrpp', 'comercial', 'lider_creativo', 'soporte_editorial', 'soporte_digital'] as const)(
      'permite a %s abrir el detalle del proyecto (necesita editar su sección)',
      async (rol) => {
        const app = crearAppDePrueba();
        await app.ready();

        const proyecto = await crearProyectoDePrueba();
        const cookie = await registrarYLoguear(app, rol);

        const respuesta = await request(app.server).get(`/api/proyectos/${proyecto.id}/riesgo`).set('Cookie', cookie);

        expect(respuesta.status).toBe(200);

        await app.close();
      },
    );

    it('permite a disenador abrir el detalle del proyecto donde está asignado', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const cookie = await registrarYLoguear(app, 'disenador');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);

      const proyecto = await crearProyecto({
        autorId: autor.id,
        servicioId: servicio.id,
        unidadId: unidad.id,
        presupuestoId: presupuesto.id,
        disenadorId: me.body.user.id,
        fechaProgramadaInicio: '2026-01-01',
      });

      const respuesta = await request(app.server).get(`/api/proyectos/${proyecto.id}/riesgo`).set('Cookie', cookie);

      expect(respuesta.status).toBe(200);

      await app.close();
    });

    it('rechaza a un disenador que no es el asignado del proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba(); // sin disenador asignado
      const cookie = await registrarYLoguear(app, 'disenador');

      const respuesta = await request(app.server).get(`/api/proyectos/${proyecto.id}/riesgo`).set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    // editor no comparte el it.each de arriba: a diferencia de esos
    // roles, sí está scoped por verificarAccesoAProyecto (mismo
    // criterio que especialista) — ver el hueco de seguridad cerrado
    // en tests/capitulos.routes.test.ts.
    it('permite a editor abrir el detalle del proyecto donde está asignado', async () => {
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

      const respuesta = await request(app.server).get(`/api/proyectos/${proyecto.id}/riesgo`).set('Cookie', cookie);

      expect(respuesta.status).toBe(200);

      await app.close();
    });

    it('rechaza a un editor que no es el asignado del proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba(); // sin editor asignado
      const cookie = await registrarYLoguear(app, 'editor');

      const respuesta = await request(app.server).get(`/api/proyectos/${proyecto.id}/riesgo`).set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    it('devuelve 404 si el proyecto no existe', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server)
        .get('/api/proyectos/00000000-0000-0000-0000-000000000000/riesgo')
        .set('Cookie', cookie);

      expect(respuesta.status).toBe(404);

      await app.close();
    });
  });

  describe('GET /api/proyectos/mios', () => {
    it('devuelve solo los proyectos del especialista autenticado, con autor/servicio/riesgo', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const especialistaId = me.body.user.id as string;

      const proyecto = await crearProyecto({
        autorId: autor.id,
        servicioId: servicio.id,
        unidadId: unidad.id,
        presupuestoId: presupuesto.id,
        especialistaId,
        fechaProgramadaInicio: '2026-01-01',
      });

      const respuesta = await request(app.server).get('/api/proyectos/mios').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyectos).toHaveLength(1);
      expect(respuesta.body.proyectos[0].id).toBe(proyecto.id);
      expect(respuesta.body.proyectos[0].autor.nombre).toBe(autor.nombre);
      expect(respuesta.body.proyectos[0].servicio.codigo).toBe('EF');
      expect(respuesta.body.proyectos[0].riesgo).toBeDefined();

      await app.close();
    });

    // Mismo endpoint generalizado por rol (ver listarProyectosConRiesgo
    // en server/helpers/alertas.ts): un editor ve los suyos por
    // editorId, no por especialistaId.
    it('devuelve solo los proyectos del editor autenticado, con autor/servicio/riesgo', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const cookie = await registrarYLoguear(app, 'editor');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const editorId = me.body.user.id as string;

      const proyecto = await crearProyecto({
        autorId: autor.id,
        servicioId: servicio.id,
        unidadId: unidad.id,
        presupuestoId: presupuesto.id,
        editorId,
        fechaProgramadaInicio: '2026-01-01',
      });

      const respuesta = await request(app.server).get('/api/proyectos/mios').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyectos).toHaveLength(1);
      expect(respuesta.body.proyectos[0].id).toBe(proyecto.id);

      await app.close();
    });

    it('no mezcla los proyectos de un especialista con los de un editor', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba(); // sin especialista ni editor asignado
      const cookie = await registrarYLoguear(app, 'editor');

      const respuesta = await request(app.server).get('/api/proyectos/mios').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyectos.find((p: { id: string }) => p.id === proyecto.id)).toBeUndefined();

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const respuesta = await request(app.server).get('/api/proyectos/mios');

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza a un rol distinto de especialista/editor (ej. jefe_area, que usa /riesgo en su lugar)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server).get('/api/proyectos/mios').set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('GET /api/proyectos/sin-editor', () => {
    it('permite a jefe_edicion listar solo los proyectos activos sin editor asignado', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyectoSinEditor = await crearProyectoDePrueba();

      const [autor, unidad, presupuesto, editor] = await Promise.all([
        crearAutor(),
        crearUnidad(),
        crearPresupuesto(),
        crearUsuario('editor'),
      ]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const proyectoConEditor = await crearProyecto({
        autorId: autor.id,
        servicioId: servicio.id,
        unidadId: unidad.id,
        presupuestoId: presupuesto.id,
        editorId: editor.id,
        fechaProgramadaInicio: '2026-01-01',
      });
      const proyectoCulminadoSinEditor = await crearProyecto({
        autorId: autor.id,
        servicioId: servicio.id,
        unidadId: unidad.id,
        presupuestoId: presupuesto.id,
        estado: 'culminado',
        fechaProgramadaInicio: '2026-01-01',
      });

      const cookie = await registrarYLoguear(app, 'jefe_edicion');

      const respuesta = await request(app.server).get('/api/proyectos/sin-editor').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      const ids = respuesta.body.proyectos.map((p: { id: string }) => p.id);
      expect(ids).toContain(proyectoSinEditor.id);
      expect(ids).not.toContain(proyectoConEditor.id);
      expect(ids).not.toContain(proyectoCulminadoSinEditor.id);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const respuesta = await request(app.server).get('/api/proyectos/sin-editor');

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza a un rol distinto de jefe_edicion (ej. jefe_area)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server).get('/api/proyectos/sin-editor').set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });
});
