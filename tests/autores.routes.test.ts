import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import { proyectosAutores } from '../server/db/schema/index.js';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAutor, crearPresupuesto, crearProyecto, crearServicio, crearUnidad } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('GET /api/autores', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('ordena por fecha de creación descendente (el más reciente primero)', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const antiguo = await crearAutor({ createdAt: new Date('2026-01-01T10:00:00Z') });
    const reciente = await crearAutor({ createdAt: new Date('2026-06-01T10:00:00Z') });
    const intermedio = await crearAutor({ createdAt: new Date('2026-03-01T10:00:00Z') });

    const cookie = await registrarYLoguear(app, 'comercial');
    const respuesta = await request(app.server).get('/api/autores').set('Cookie', cookie);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.autores.map((a: { id: string }) => a.id)).toEqual([reciente.id, intermedio.id, antiguo.id]);

    await app.close();
  });
});

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

describe('POST /api/autores', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  // Cobertura del perfil expandido (nombreArtistico/nacionalidad/
  // fechaNacimiento/redesSociales/personalidad/ocupacion): estos campos
  // ya existían como columnas antes de esta ronda, pero nunca habían
  // estado en crearAutorSchema — sin este test, un typo en el schema
  // (ej. omitir un campo) pasaría desapercibido igual que pasó antes.
  it('permite a comercial crear un autor con el perfil completo', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const cookie = await registrarYLoguear(app, 'comercial');

    const respuesta = await request(app.server)
      .post('/api/autores')
      .set('Cookie', cookie)
      .send({
        nombre: 'Autora de prueba',
        nombreArtistico: 'La Cronista',
        nacionalidad: ['Venezuela'],
        fechaNacimiento: '1990-05-12',
        redesSociales: { instagram: '@lacronista', x: '@lacronista_x', youtube: 'LaCronistaOficial' },
        personalidad: ['Extrovertida', 'Directa'],
        ocupacion: 'Periodista freelance',
        pais: 'Venezuela',
      });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.autor.nombreArtistico).toBe('La Cronista');
    expect(respuesta.body.autor.nacionalidad).toEqual(['Venezuela']);
    expect(respuesta.body.autor.fechaNacimiento).toBe('1990-05-12');
    expect(respuesta.body.autor.redesSociales).toEqual({ instagram: '@lacronista', x: '@lacronista_x', youtube: 'LaCronistaOficial' });
    expect(respuesta.body.autor.personalidad).toEqual(['Extrovertida', 'Directa']);
    expect(respuesta.body.autor.ocupacion).toBe('Periodista freelance');

    await app.close();
  });

  it('permite crear un autor sin ninguno de los campos del perfil expandido (todos opcionales)', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const cookie = await registrarYLoguear(app, 'comercial');

    const respuesta = await request(app.server).post('/api/autores').set('Cookie', cookie).send({ nombre: 'Autor mínimo' });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.autor.redesSociales).toBeNull();

    await app.close();
  });

  it('rechaza redesSociales con una plataforma desconocida (forma cerrada)', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const cookie = await registrarYLoguear(app, 'comercial');

    const respuesta = await request(app.server)
      .post('/api/autores')
      .set('Cookie', cookie)
      .send({ nombre: 'Autor', redesSociales: { snapchat: '@algo' } });

    expect(respuesta.status).toBe(400);

    await app.close();
  });

  // personalidad pasó de texto libre a array de etiquetas en esta ronda
  // (CrearAutorForm.tsx: chips en vez de textarea) — sin esto, un string
  // suelto que antes era válido pasaría desapercibido como aceptado.
  it('rechaza personalidad como string suelto (debe ser un array)', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const cookie = await registrarYLoguear(app, 'comercial');

    const respuesta = await request(app.server)
      .post('/api/autores')
      .set('Cookie', cookie)
      .send({ nombre: 'Autor', personalidad: 'Extrovertida, directa' });

    expect(respuesta.status).toBe(400);

    await app.close();
  });

  it('permite crear un autor con personalidad como array vacío', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const cookie = await registrarYLoguear(app, 'comercial');

    const respuesta = await request(app.server).post('/api/autores').set('Cookie', cookie).send({ nombre: 'Autor', personalidad: [] });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.autor.personalidad).toEqual([]);

    await app.close();
  });

  it('rechaza sin sesión', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const respuesta = await request(app.server).post('/api/autores').send({ nombre: 'Autor' });

    expect(respuesta.status).toBe(401);

    await app.close();
  });

  it('rechaza a un rol sin permiso de escritura (ej. rrpp)', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const cookie = await registrarYLoguear(app, 'rrpp');

    const respuesta = await request(app.server).post('/api/autores').set('Cookie', cookie).send({ nombre: 'Autor' });

    expect(respuesta.status).toBe(403);

    await app.close();
  });

  it.each(['+58 412-1234567', '0212-1234567', '04121234567', '+1 8091234567'])(
    'acepta un teléfono válido (%s)',
    async (telefono) => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server).post('/api/autores').set('Cookie', cookie).send({ nombre: 'Autor', telefono });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.autor.telefono).toBe(telefono);

      await app.close();
    },
  );

  it.each(['0412-abcd567', 'llamar a Juan', '0412 123 4567 ext. 2', '04121234567;DROP TABLE'])(
    'rechaza un teléfono con letras u otros símbolos (%s)',
    async (telefono) => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server).post('/api/autores').set('Cookie', cookie).send({ nombre: 'Autor', telefono });

      expect(respuesta.status).toBe(400);

      await app.close();
    },
  );
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
      .send({ email: ['corregido@ejemplo.test'] });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.autor.email).toEqual(['corregido@ejemplo.test']);

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

describe('DELETE /api/autores/:id', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('permite a comercial eliminar un autor sin proyectos asociados', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const autor = await crearAutor();
    const cookie = await registrarYLoguear(app, 'comercial');

    const respuesta = await request(app.server).delete(`/api/autores/${autor.id}`).set('Cookie', cookie);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);

    const verificacion = await request(app.server).patch(`/api/autores/${autor.id}`).set('Cookie', cookie).send({ nombre: 'x' });
    expect(verificacion.status).toBe(404);

    await app.close();
  });

  it('devuelve 400 (no 500) si el autor tiene proyectos asociados, sin borrar nada', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });
    const cookie = await registrarYLoguear(app, 'comercial');

    const respuesta = await request(app.server).delete(`/api/autores/${autor.id}`).set('Cookie', cookie);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toBe('No se puede eliminar un autor con proyectos activos. Elimina sus proyectos primero.');

    const verificacion = await request(app.server).patch(`/api/autores/${autor.id}`).set('Cookie', cookie).send({ nombre: 'x' });
    expect(verificacion.status).toBe(200); // sigue existiendo

    await app.close();
  });

  // Coautoría: un autor puede estar vinculado a un proyecto solo como
  // coautor (proyectos_autores), sin ser el autorId principal de
  // ninguno — antes de este fix, eliminarAutor() solo revisaba
  // proyectos.autorId y dejaba pasar este caso hasta el DELETE real,
  // donde proyectos_autores.autor_id (onDelete: 'restrict') lo hacía
  // fallar con un error crudo de Postgres (500) en vez del 400 legible.
  it('devuelve 400 (no 500) si el autor es coautor de un proyecto, aunque no sea el autorId principal de ninguno', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const [autorPrincipal, coautor, unidad, presupuesto] = await Promise.all([
      crearAutor(),
      crearAutor(),
      crearUnidad(),
      crearPresupuesto(),
    ]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const proyecto = await crearProyecto({
      autorId: autorPrincipal.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-01-01',
    });
    await db.insert(proyectosAutores).values({ proyectoId: proyecto.id, autorId: coautor.id });
    const cookie = await registrarYLoguear(app, 'comercial');

    const respuesta = await request(app.server).delete(`/api/autores/${coautor.id}`).set('Cookie', cookie);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error).toBe('No se puede eliminar un autor con proyectos activos. Elimina sus proyectos primero.');

    const verificacion = await request(app.server).patch(`/api/autores/${coautor.id}`).set('Cookie', cookie).send({ nombre: 'x' });
    expect(verificacion.status).toBe(200); // sigue existiendo

    await app.close();
  });

  it('devuelve 404 si el autor no existe', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const cookie = await registrarYLoguear(app, 'comercial');

    const respuesta = await request(app.server).delete('/api/autores/00000000-0000-0000-0000-000000000000').set('Cookie', cookie);

    expect(respuesta.status).toBe(404);

    await app.close();
  });

  it('rechaza sin sesión', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const autor = await crearAutor();

    const respuesta = await request(app.server).delete(`/api/autores/${autor.id}`);

    expect(respuesta.status).toBe(401);

    await app.close();
  });

  it('rechaza a un rol sin permiso de escritura (ej. rrpp)', async () => {
    const app = crearAppDePrueba();
    await app.ready();
    const autor = await crearAutor();
    const cookie = await registrarYLoguear(app, 'rrpp');

    const respuesta = await request(app.server).delete(`/api/autores/${autor.id}`).set('Cookie', cookie);

    expect(respuesta.status).toBe(403);

    await app.close();
  });
});
