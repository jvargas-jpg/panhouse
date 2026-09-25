import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import { fichasTrazabilidad, proyectosAutores } from '../server/db/schema/index.js';
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

let contadorServicioAutor = 0;

// Portal del Autor: crea autor + proyecto + cuenta de login con rol
// 'autor' ya vinculada (users.autorId) — setup repetido por todos los
// tests de /mis-libros y /:id/manuscrito. También inserta la ficha de
// trazabilidad: en producción POST /api/proyectos siempre crea una en
// la misma transacción (ver crearProyecto en server/helpers/proyectos.ts),
// e innerJoin la da por garantizada — sin esto, listarMisLibros
// (server/helpers/portalAutor.ts) no encontraría el proyecto.
async function crearLibroYCuentaAutor(app: Awaited<ReturnType<typeof crearAppDePrueba>>) {
  contadorServicioAutor += 1;
  const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
  const servicio = await crearServicio({
    codigo: `EF-${contadorServicioAutor}`,
    nombre: 'Escritura fantasma',
    pesoComplejidad: 4,
    plazoDias: 180,
  });
  const proyecto = await crearProyecto({
    autorId: autor.id,
    servicioId: servicio.id,
    unidadId: unidad.id,
    presupuestoId: presupuesto.id,
    fechaProgramadaInicio: '2026-01-01',
  });
  await db.insert(fichasTrazabilidad).values({ proyectoId: proyecto.id });
  const cookie = await registrarYLoguear(app, 'autor', autor.id);
  return { autor, proyecto, servicio, cookie };
}

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
          autorIds: [autor.id],
          servicioId: servicio.id,
          unidadId: unidad.id,
          presupuestoId: presupuesto.id,
          fechaProgramadaInicio: '2026-01-01',
        });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.proyecto.autorId).toBe(autor.id);
      // Ya no hay título manual — el nombre visual del proyecto sale de
      // autores + codigo (ver generarCodigoCorto en helpers/proyectos.ts),
      // generado solo, sin que nadie lo escriba en el alta.
      expect(respuesta.body.proyecto.codigo).toMatch(/^[0-9A-F]{6}$/);

      await app.close();
    });

    it('genera un codigo distinto para cada proyecto (columna UNIQUE)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const datos = { autorIds: [autor.id], servicioId: servicio.id, unidadId: unidad.id, presupuestoId: presupuesto.id, fechaProgramadaInicio: '2026-01-01' };
      const [primero, segundo] = await Promise.all([
        request(app.server).post('/api/proyectos').set('Cookie', cookie).send(datos),
        request(app.server).post('/api/proyectos').set('Cookie', cookie).send(datos),
      ]);

      expect(primero.status).toBe(201);
      expect(segundo.status).toBe(201);
      expect(primero.body.proyecto.codigo).not.toBe(segundo.body.proyecto.codigo);

      await app.close();
    });

    it('permite crear un proyecto con servicio Crudo (categoría general, subtipo lo define RRPP después)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'CR', nombre: 'Crudo', pesoComplejidad: 3, plazoDias: 150 });
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server)
        .post('/api/proyectos')
        .set('Cookie', cookie)
        .send({
          autorIds: [autor.id],
          servicioId: servicio.id,
          unidadId: unidad.id,
          presupuestoId: presupuesto.id,
          fechaProgramadaInicio: '2026-01-01',
        });

      expect(respuesta.status).toBe(201);

      await app.close();
    });

    it('rechaza crear un proyecto con un servicio fuera de Sello editorial/Escritura fantasma/Crudo (ej. un código legacy EEC)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({
        codigo: 'EEC',
        nombre: 'Edición de estilo por capítulo',
        pesoComplejidad: 3,
        plazoDias: 150,
      });
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server)
        .post('/api/proyectos')
        .set('Cookie', cookie)
        .send({
          autorIds: [autor.id],
          servicioId: servicio.id,
          unidadId: unidad.id,
          presupuestoId: presupuesto.id,
          fechaProgramadaInicio: '2026-01-01',
        });

      expect(respuesta.status).toBe(400);

      await app.close();
    });

    it('con varios autorIds, inserta una fila de coautoría por cada uno en proyectos_autores (y el primero queda como autorId legacy)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [autor, coautor, unidad, presupuesto] = await Promise.all([
        crearAutor(),
        crearAutor(),
        crearUnidad(),
        crearPresupuesto(),
      ]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server)
        .post('/api/proyectos')
        .set('Cookie', cookie)
        .send({
          autorIds: [autor.id, coautor.id],
          servicioId: servicio.id,
          unidadId: unidad.id,
          presupuestoId: presupuesto.id,
          fechaProgramadaInicio: '2026-01-01',
        });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.proyecto.autorId).toBe(autor.id);
      const filas = await db.select().from(proyectosAutores).where(eq(proyectosAutores.proyectoId, respuesta.body.proyecto.id));
      expect(filas.map((f) => f.autorId)).toEqual(expect.arrayContaining([autor.id, coautor.id]));
      expect(filas).toHaveLength(2);

      await app.close();
    });

    it('rechaza crear un proyecto con autorIds vacío', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [unidad, presupuesto] = await Promise.all([crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server)
        .post('/api/proyectos')
        .set('Cookie', cookie)
        .send({
          autorIds: [],
          servicioId: servicio.id,
          unidadId: unidad.id,
          presupuestoId: presupuesto.id,
          fechaProgramadaInicio: '2026-01-01',
        });

      expect(respuesta.status).toBe(400);

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
          autorIds: [autor.id],
          servicioId: servicio.id,
          unidadId: unidad.id,
          presupuestoId: presupuesto.id,
          fechaProgramadaInicio: '2026-01-01',
        });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.proyecto.autorId).toBe(autor.id);

      await app.close();
    });

    // Revertido a propósito (ronda anterior): un proyecto recién creado
    // es solo un cascarón, sin contenido en la ficha todavía — alertar a
    // jefe_area en este punto los mandaría a revisar algo vacío. Ver
    // POST /:id/notificar-jefatura para el disparador real.
    it('NO dispara ninguna notificación al crear un proyecto (ni para comercial ni para jefe_area)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const cookieComercial = await registrarYLoguear(app, 'comercial');

      const respuestaCrear = await request(app.server)
        .post('/api/proyectos')
        .set('Cookie', cookieComercial)
        .send({
          autorIds: [autor.id],
          servicioId: servicio.id,
          unidadId: unidad.id,
          presupuestoId: presupuesto.id,
          fechaProgramadaInicio: '2026-01-01',
        });
      expect(respuestaCrear.status).toBe(201);
      expect(respuestaCrear.body.proyecto.notificadoRrpp).toBe(false);
      expect(respuestaCrear.body.proyecto.notificadoJefatura).toBe(false);

      const cookieJefeArea = await registrarYLoguear(app, 'jefe_area');
      const respuestaNotificaciones = await request(app.server).get('/api/notificaciones').set('Cookie', cookieJefeArea);

      expect(respuestaNotificaciones.status).toBe(200);
      expect(respuestaNotificaciones.body.notificaciones).toHaveLength(0);

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
          autorIds: [autor.id],
          servicioId: servicio.id,
          unidadId: unidad.id,
          presupuestoId: presupuesto.id,
          fechaProgramadaInicio: '2026-01-01',
        });

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('GET /api/proyectos', () => {
    it('devuelve autores: [] (no autor singular), con todos los coautores del proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const coautor = await crearAutor();
      await db.insert(proyectosAutores).values({ proyectoId: proyecto.id, autorId: coautor.id });

      const cookie = await registrarYLoguear(app, 'jefe_area');
      const respuesta = await request(app.server).get('/api/proyectos').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      const fila = respuesta.body.proyectos.find((p: { id: string }) => p.id === proyecto.id);
      expect(fila.autor).toBeUndefined();
      const idsAutores = fila.autores.map((a: { id: string }) => a.id);
      expect(idsAutores).toHaveLength(2);
      expect(idsAutores).toEqual(expect.arrayContaining([proyecto.autorId, coautor.id]));

      await app.close();
    });

    it('rechaza a un rol sin permiso (ej. comercial)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const cookie = await registrarYLoguear(app, 'comercial');
      const respuesta = await request(app.server).get('/api/proyectos').set('Cookie', cookie);

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

  describe('POST /api/proyectos/:id/notificar-rrpp', () => {
    it('permite a comercial notificar a rrpp que el proyecto base está registrado', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const cookieComercial = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server).post(`/api/proyectos/${proyecto.id}/notificar-rrpp`).set('Cookie', cookieComercial);

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.ok).toBe(true);

      const cookieRrpp = await registrarYLoguear(app, 'rrpp');
      const respuestaNotificaciones = await request(app.server).get('/api/notificaciones').set('Cookie', cookieRrpp);

      expect(respuestaNotificaciones.body.notificaciones).toHaveLength(1);
      expect(respuestaNotificaciones.body.notificaciones[0].proyectoId).toBe(proyecto.id);
      expect(respuestaNotificaciones.body.notificaciones[0].mensaje).toContain(
        'Nuevo proyecto base registrado, pendiente de Ficha de Trazabilidad',
      );

      await app.close();
    });

    it('devuelve 409 (no un duplicado silencioso) si ya se notificó antes — confirma que notificadoRrpp quedó persistido', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'comercial');

      const primera = await request(app.server).post(`/api/proyectos/${proyecto.id}/notificar-rrpp`).set('Cookie', cookie);
      expect(primera.status).toBe(201);

      const segunda = await request(app.server).post(`/api/proyectos/${proyecto.id}/notificar-rrpp`).set('Cookie', cookie);
      expect(segunda.status).toBe(409);

      const cookieRrpp = await registrarYLoguear(app, 'rrpp');
      const respuestaNotificaciones = await request(app.server).get('/api/notificaciones').set('Cookie', cookieRrpp);
      expect(respuestaNotificaciones.body.notificaciones).toHaveLength(1); // no dos

      await app.close();
    });

    it('devuelve 404 si el proyecto no existe', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server)
        .post('/api/proyectos/00000000-0000-0000-0000-000000000000/notificar-rrpp')
        .set('Cookie', cookie);

      expect(respuesta.status).toBe(404);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();

      const respuesta = await request(app.server).post(`/api/proyectos/${proyecto.id}/notificar-rrpp`);

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it.each(['rrpp', 'jefe_area', 'especialista'] as const)('rechaza a un rol distinto de comercial (ej. %s)', async (rol) => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, rol);

      const respuesta = await request(app.server).post(`/api/proyectos/${proyecto.id}/notificar-rrpp`).set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('POST /api/proyectos/:id/notificar-jefatura', () => {
    it('permite a rrpp notificar a jefatura que la ficha de Fase 1 está completa', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const cookieRrpp = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server).post(`/api/proyectos/${proyecto.id}/notificar-jefatura`).set('Cookie', cookieRrpp);

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.ok).toBe(true);

      const cookieJefeArea = await registrarYLoguear(app, 'jefe_area');
      const respuestaNotificaciones = await request(app.server).get('/api/notificaciones').set('Cookie', cookieJefeArea);

      expect(respuestaNotificaciones.body.notificaciones).toHaveLength(1);
      expect(respuestaNotificaciones.body.notificaciones[0].proyectoId).toBe(proyecto.id);
      expect(respuestaNotificaciones.body.notificaciones[0].mensaje).toContain(
        'RRPP ha completado la Ficha Editorial del proyecto',
      );
      expect(respuestaNotificaciones.body.notificaciones[0].mensaje).toContain('Listo para asignación al escuadrón');

      await app.close();
    });

    it('devuelve 409 (no un duplicado silencioso) si ya se notificó antes — confirma que notificadoJefatura quedó persistido', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'rrpp');

      const primera = await request(app.server).post(`/api/proyectos/${proyecto.id}/notificar-jefatura`).set('Cookie', cookie);
      expect(primera.status).toBe(201);

      const segunda = await request(app.server).post(`/api/proyectos/${proyecto.id}/notificar-jefatura`).set('Cookie', cookie);
      expect(segunda.status).toBe(409);

      const cookieJefeArea = await registrarYLoguear(app, 'jefe_area');
      const respuestaNotificaciones = await request(app.server).get('/api/notificaciones').set('Cookie', cookieJefeArea);
      expect(respuestaNotificaciones.body.notificaciones).toHaveLength(1); // no dos

      await app.close();
    });

    it('devuelve 404 si el proyecto no existe', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .post('/api/proyectos/00000000-0000-0000-0000-000000000000/notificar-jefatura')
        .set('Cookie', cookie);

      expect(respuesta.status).toBe(404);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();

      const respuesta = await request(app.server).post(`/api/proyectos/${proyecto.id}/notificar-jefatura`);

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    // comercial y jefe_area ya no disparan este paso (antes compartían la
    // ruta con rrpp cuando era un solo tramo) — ahora es exclusivo de
    // rrpp, dueño real de este segundo tramo de la cascada.
    it.each(['comercial', 'jefe_area', 'especialista'] as const)('rechaza a un rol distinto de rrpp (ej. %s)', async (rol) => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, rol);

      const respuesta = await request(app.server).post(`/api/proyectos/${proyecto.id}/notificar-jefatura`).set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('DELETE /api/proyectos/:id', () => {
    it.each(['jefe_area', 'direccion', 'comercial'] as const)('permite a %s eliminar un proyecto', async (rol) => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, rol);

      const respuesta = await request(app.server).delete(`/api/proyectos/${proyecto.id}`).set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ok).toBe(true);

      await app.close();
    });

    it('elimina en cascada la ficha de trazabilidad asociada', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'jefe_area');

      await request(app.server).delete(`/api/proyectos/${proyecto.id}`).set('Cookie', cookie);

      // GET /fichas-trazabilidad/:proyectoId devuelve 404 si el proyecto
      // ya no existe (verificarAccesoAProyecto lo resuelve así).
      const verificacion = await request(app.server).get(`/api/fichas-trazabilidad/${proyecto.id}`).set('Cookie', cookie);
      expect(verificacion.status).toBe(404);

      await app.close();
    });

    it('devuelve 404 si el proyecto no existe', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server)
        .delete('/api/proyectos/00000000-0000-0000-0000-000000000000')
        .set('Cookie', cookie);

      expect(respuesta.status).toBe(404);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();

      const respuesta = await request(app.server).delete(`/api/proyectos/${proyecto.id}`);

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza a un rol sin permiso (ej. especialista)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server).delete(`/api/proyectos/${proyecto.id}`).set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

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

    it('permite a comercial reemplazar la coautoría completa vía autorIds (proyectos_autores)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const [nuevoAutor, coautor] = await Promise.all([crearAutor(), crearAutor()]);
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/reasignar`)
        .set('Cookie', cookie)
        .send({ autorIds: [nuevoAutor.id, coautor.id] });

      expect(respuesta.status).toBe(200);
      // El primer autorId queda sincronizado como autorId legacy.
      expect(respuesta.body.proyecto.autorId).toBe(nuevoAutor.id);

      const filas = await db.select().from(proyectosAutores).where(eq(proyectosAutores.proyectoId, proyecto.id));
      expect(filas.map((f) => f.autorId)).toEqual(expect.arrayContaining([nuevoAutor.id, coautor.id]));
      expect(filas).toHaveLength(2);
      // El autor original (de crearProyectoDePrueba) ya no debe seguir
      // en la tabla de unión — autorIds reemplaza, no agrega.
      expect(filas.map((f) => f.autorId)).not.toContain(proyecto.autorId);

      await app.close();
    });

    it('rechaza un autorIds vacío', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/reasignar`)
        .set('Cookie', cookie)
        .send({ autorIds: [] });

      expect(respuesta.status).toBe(400);

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

    it('permite a comercial reasignar unidad, presupuesto y fecha programada (parámetros comerciales completos)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const [nuevaUnidad, nuevoPresupuesto] = await Promise.all([crearUnidad(), crearPresupuesto()]);
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/reasignar`)
        .set('Cookie', cookie)
        .send({ unidadId: nuevaUnidad.id, presupuestoId: nuevoPresupuesto.id, fechaProgramadaInicio: '2026-03-01' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyecto.unidadId).toBe(nuevaUnidad.id);
      expect(respuesta.body.proyecto.presupuestoId).toBe(nuevoPresupuesto.id);
      expect(respuesta.body.proyecto.fechaProgramadaInicio).toBe('2026-03-01');

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
      const [especialista, corrector, jefeArea] = await Promise.all([
        crearUsuario('especialista'),
        crearUsuario('soporte_editorial'),
        crearUsuario('jefe_area'),
      ]);
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/equipo`)
        .set('Cookie', cookie)
        .send({
          especialistaId: especialista.id,
          correctorId: corrector.id,
          jefeAreaId: jefeArea.id,
        });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyecto.especialistaId).toBe(especialista.id);
      expect(respuesta.body.proyecto.correctorId).toBe(corrector.id);
      expect(respuesta.body.proyecto.jefeAreaId).toBe(jefeArea.id);

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
      expect(respuesta.body.proyecto.autor).toBeUndefined();
      // Perfil completo (no solo id/nombre): la ficha de trazabilidad ya
      // no pide nombre artístico/nacionalidad/etc. como inputs propios,
      // así que ProyectoDetallePage.tsx los muestra de solo lectura
      // desde acá (ver TarjetaPerfilAutores en SeccionProyectoPerfil.tsx).
      expect(respuesta.body.proyecto.autores).toEqual([
        {
          id: proyecto.autorId,
          nombre: expect.any(String),
          nombreArtistico: null,
          nacionalidad: null,
          fechaNacimiento: null,
          redesSociales: null,
          personalidad: null,
          ocupacion: null,
          categoria: 'Estándar',
          pais: null,
        },
      ]);
      expect(respuesta.body.proyecto.servicio).toBeDefined();

      await app.close();
    });

    it('devuelve el perfil completo del autor (nombre artístico, nacionalidad, etc.), no solo id/nombre', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [unidad, presupuesto] = await Promise.all([crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const autor = await crearAutor({
        nombreArtistico: 'Pluma de Oro',
        nacionalidad: ['Venezolana'],
        fechaNacimiento: '1985-04-12',
        redesSociales: { instagram: '@plumadeoro' },
        personalidad: ['Extrovertida', 'Directa'],
        ocupacion: 'Consultora financiera',
      });
      const proyecto = await crearProyecto({
        autorId: autor.id,
        servicioId: servicio.id,
        unidadId: unidad.id,
        presupuestoId: presupuesto.id,
        fechaProgramadaInicio: '2026-01-01',
      });

      const cookie = await registrarYLoguear(app, 'jefe_area');
      const respuesta = await request(app.server).get(`/api/proyectos/${proyecto.id}/riesgo`).set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyecto.autores).toEqual([
        {
          id: autor.id,
          nombre: autor.nombre,
          nombreArtistico: 'Pluma de Oro',
          nacionalidad: ['Venezolana'],
          fechaNacimiento: '1985-04-12',
          redesSociales: { instagram: '@plumadeoro' },
          personalidad: ['Extrovertida', 'Directa'],
          ocupacion: 'Consultora financiera',
          categoria: 'Estándar',
          pais: null,
        },
      ]);

      await app.close();
    });

    it('devuelve todos los coautores de un proyecto (Muchos-a-Muchos vía proyectos_autores)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const coautor = await crearAutor();
      await db.insert(proyectosAutores).values({ proyectoId: proyecto.id, autorId: coautor.id });

      const cookie = await registrarYLoguear(app, 'jefe_area');
      const respuesta = await request(app.server).get(`/api/proyectos/${proyecto.id}/riesgo`).set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      const idsAutores = respuesta.body.proyecto.autores.map((a: { id: string }) => a.id);
      expect(idsAutores).toHaveLength(2);
      expect(idsAutores).toEqual(expect.arrayContaining([proyecto.autorId, coautor.id]));

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

  describe('GET /api/proyectos/mis-libros', () => {
    it('permite a autor listar sus propios libros', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const { proyecto, servicio, cookie } = await crearLibroYCuentaAutor(app);

      const respuesta = await request(app.server).get('/api/proyectos/mis-libros').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyectos).toHaveLength(1);
      expect(respuesta.body.proyectos[0].id).toBe(proyecto.id);
      expect(respuesta.body.proyectos[0].servicio.codigo).toBe(servicio.codigo);

      await app.close();
    });

    // Filtro explícito por SELECT (COLUMNAS_LIBRO_AUTOR en
    // server/helpers/portalAutor.ts): confirma que la respuesta no trae
    // control de tiempos macro ni ids del escuadrón de producción.
    it('no expone fechas/días de fase ni ids de asignación interna', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const { cookie } = await crearLibroYCuentaAutor(app);

      const respuesta = await request(app.server).get('/api/proyectos/mis-libros').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      const libro = respuesta.body.proyectos[0];
      expect(libro.especialistaId).toBeUndefined();
      expect(libro.editorId).toBeUndefined();
      expect(libro.disenadorId).toBeUndefined();
      expect(libro.fechaProgramadaInicio).toBeUndefined();
      expect(libro.fechaRealInicio).toBeUndefined();
      expect(libro.riesgo).toBeUndefined();

      await app.close();
    });

    it('no mezcla los libros de un autor con los de otro', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      await crearLibroYCuentaAutor(app); // otro autor, otro libro
      const { cookie } = await crearLibroYCuentaAutor(app);

      const respuesta = await request(app.server).get('/api/proyectos/mis-libros').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyectos).toHaveLength(1);

      await app.close();
    });

    it('rechaza (403) si la cuenta autor no está vinculada a ningún autor', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const cookie = await registrarYLoguear(app, 'autor');

      const respuesta = await request(app.server).get('/api/proyectos/mis-libros').set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const respuesta = await request(app.server).get('/api/proyectos/mis-libros');

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza a un rol distinto de autor (ej. especialista)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server).get('/api/proyectos/mis-libros').set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('PATCH /api/proyectos/:id/manuscrito', () => {
    it('permite al autor guardar el enlace de su manuscrito', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const { proyecto, cookie } = await crearLibroYCuentaAutor(app);

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/manuscrito`)
        .set('Cookie', cookie)
        .send({ manuscritoUrl: 'https://docs.google.com/document/d/abc123' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyecto.manuscritoUrl).toBe('https://docs.google.com/document/d/abc123');

      await app.close();
    });

    it('permite borrar el enlace (null)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const { proyecto, cookie } = await crearLibroYCuentaAutor(app);
      await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/manuscrito`)
        .set('Cookie', cookie)
        .send({ manuscritoUrl: 'https://docs.google.com/document/d/abc123' });

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/manuscrito`)
        .set('Cookie', cookie)
        .send({ manuscritoUrl: null });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyecto.manuscritoUrl).toBeNull();

      await app.close();
    });

    it('dispara una notificación a especialista al entregar el enlace', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const { proyecto, cookie } = await crearLibroYCuentaAutor(app);

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/manuscrito`)
        .set('Cookie', cookie)
        .send({ manuscritoUrl: 'https://docs.google.com/document/d/abc123' });
      expect(respuesta.status).toBe(200);

      const cookieEspecialista = await registrarYLoguear(app, 'especialista');
      const notificaciones = await request(app.server).get('/api/notificaciones').set('Cookie', cookieEspecialista);

      expect(notificaciones.body.notificaciones).toHaveLength(1);
      expect(notificaciones.body.notificaciones[0].proyectoId).toBe(proyecto.id);
      expect(notificaciones.body.notificaciones[0].mensaje).toBe('El autor ha entregado el enlace a su manuscrito original.');

      await app.close();
    });

    it('no dispara ninguna notificación al borrar el enlace (null no es una entrega)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const { proyecto, cookie } = await crearLibroYCuentaAutor(app);

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/manuscrito`)
        .set('Cookie', cookie)
        .send({ manuscritoUrl: null });
      expect(respuesta.status).toBe(200);

      const cookieEspecialista = await registrarYLoguear(app, 'especialista');
      const notificaciones = await request(app.server).get('/api/notificaciones').set('Cookie', cookieEspecialista);

      expect(notificaciones.body.notificaciones).toHaveLength(0);

      await app.close();
    });

    // Protección contra spam: si el autor corrige el enlace varias veces
    // seguidas antes de que el especialista revise la primera alerta, no
    // debe apilar una notificación por cada corrección.
    it('no duplica la notificación si el autor corrige el enlace varias veces seguidas sin que se haya leído', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const { proyecto, cookie } = await crearLibroYCuentaAutor(app);

      await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/manuscrito`)
        .set('Cookie', cookie)
        .send({ manuscritoUrl: 'https://docs.google.com/document/d/version-1' });
      await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/manuscrito`)
        .set('Cookie', cookie)
        .send({ manuscritoUrl: 'https://docs.google.com/document/d/version-2' });
      const tercera = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/manuscrito`)
        .set('Cookie', cookie)
        .send({ manuscritoUrl: 'https://docs.google.com/document/d/version-3' });
      expect(tercera.status).toBe(200);

      const cookieEspecialista = await registrarYLoguear(app, 'especialista');
      const notificaciones = await request(app.server).get('/api/notificaciones').set('Cookie', cookieEspecialista);

      expect(notificaciones.body.notificaciones).toHaveLength(1);

      await app.close();
    });

    it('dispara una nueva notificación si la anterior ya fue marcada como leída', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const { proyecto, cookie } = await crearLibroYCuentaAutor(app);

      await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/manuscrito`)
        .set('Cookie', cookie)
        .send({ manuscritoUrl: 'https://docs.google.com/document/d/version-1' });

      const cookieEspecialista = await registrarYLoguear(app, 'especialista');
      const primeraLista = await request(app.server).get('/api/notificaciones').set('Cookie', cookieEspecialista);
      const idNotificacion = primeraLista.body.notificaciones[0].id;
      await request(app.server).patch(`/api/notificaciones/${idNotificacion}/leer`).set('Cookie', cookieEspecialista);

      await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/manuscrito`)
        .set('Cookie', cookie)
        .send({ manuscritoUrl: 'https://docs.google.com/document/d/version-2' });

      const segundaLista = await request(app.server).get('/api/notificaciones').set('Cookie', cookieEspecialista);
      expect(segundaLista.body.notificaciones).toHaveLength(2);

      await app.close();
    });

    it('rechaza (403) intentar actualizar el manuscrito de OTRO autor', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const { proyecto } = await crearLibroYCuentaAutor(app); // dueño real
      const otraCuenta = await crearLibroYCuentaAutor(app); // otro autor con su propio libro

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/manuscrito`)
        .set('Cookie', otraCuenta.cookie)
        .send({ manuscritoUrl: 'https://docs.google.com/document/d/intruso' });

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    it('devuelve 404 si el proyecto no existe', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const { cookie } = await crearLibroYCuentaAutor(app);

      const respuesta = await request(app.server)
        .patch('/api/proyectos/00000000-0000-0000-0000-000000000000/manuscrito')
        .set('Cookie', cookie)
        .send({ manuscritoUrl: 'https://docs.google.com/document/d/abc123' });

      expect(respuesta.status).toBe(404);

      await app.close();
    });

    it('rechaza (403) si la cuenta autor no está vinculada a ningún autor', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const { proyecto } = await crearLibroYCuentaAutor(app);
      const cookieSinVincular = await registrarYLoguear(app, 'autor');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/manuscrito`)
        .set('Cookie', cookieSinVincular)
        .send({ manuscritoUrl: 'https://docs.google.com/document/d/abc123' });

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const { proyecto } = await crearLibroYCuentaAutor(app);

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/manuscrito`)
        .send({ manuscritoUrl: 'https://docs.google.com/document/d/abc123' });

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza a un rol distinto de autor (ej. especialista)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/manuscrito`)
        .set('Cookie', cookie)
        .send({ manuscritoUrl: 'https://docs.google.com/document/d/abc123' });

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });
});
