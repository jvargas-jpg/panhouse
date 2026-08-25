import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAutor, crearPresupuesto, crearProyecto, crearServicio, crearUnidad } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('GET /api/editores/carga', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('permite a jefe_edicion listar la carga de todos los editores, ponderada por servicio', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const editorCookie = await registrarYLoguear(app, 'editor');
    const editorLogin = await request(app.server).get('/api/auth/me').set('Cookie', editorCookie);
    const editorId = editorLogin.body.user.id as string;

    await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      editorId,
      fechaProgramadaInicio: '2026-01-01',
    });

    const cookie = await registrarYLoguear(app, 'jefe_edicion');

    const respuesta = await request(app.server).get('/api/editores/carga').set('Cookie', cookie);

    expect(respuesta.status).toBe(200);
    expect(Array.isArray(respuesta.body.editores)).toBe(true);
    const editor = respuesta.body.editores.find((e: { id: string }) => e.id === editorId);
    expect(editor).toBeDefined();
    expect(editor.carga).toBe(4);

    await app.close();
  });

  it('no cuenta como carga de editor un proyecto donde ese mismo usuario quedó como especialistaId (columnas separadas)', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const editorCookie = await registrarYLoguear(app, 'editor');
    const editorLogin = await request(app.server).get('/api/auth/me').set('Cookie', editorCookie);
    const editorId = editorLogin.body.user.id as string;

    // A nivel de FK nada impide esto (especialistaId solo referencia
    // users.id, sin mirar el rol) — sirve para confirmar que
    // obtenerCargaUsuario(id, 'editor') lee editorId, no especialistaId.
    await crearProyecto({
      autorId: autor.id,
      servicioId: servicio.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      especialistaId: editorId,
      fechaProgramadaInicio: '2026-01-01',
    });

    const cookie = await registrarYLoguear(app, 'jefe_edicion');
    const respuesta = await request(app.server).get('/api/editores/carga').set('Cookie', cookie);

    expect(respuesta.status).toBe(200);
    const editor = respuesta.body.editores.find((e: { id: string }) => e.id === editorId);
    expect(editor.carga).toBe(0);

    await app.close();
  });

  it('rechaza sin sesión', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const respuesta = await request(app.server).get('/api/editores/carga');

    expect(respuesta.status).toBe(401);

    await app.close();
  });

  it('rechaza a un rol distinto de jefe_edicion, incluido un editor', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const cookie = await registrarYLoguear(app, 'editor');

    const respuesta = await request(app.server).get('/api/editores/carga').set('Cookie', cookie);

    expect(respuesta.status).toBe(403);

    await app.close();
  });
});
