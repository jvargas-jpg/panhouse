import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearProyectoDePrueba, crearRegistroSeguimiento, crearUsuario } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';
import { db } from '../server/db/client.js';
import { proyectos } from '../server/db/schema/index.js';
import { eq } from 'drizzle-orm';

describe('GET /api/seguimiento', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('permite a jefe_area listar los registros con proyecto y analista resueltos', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const proyecto = await crearProyectoDePrueba();
    await db.update(proyectos).set({notificadoJefatura:true}).where(eq(proyectos.id,proyecto.id));
    const analista = await crearUsuario('soporte_editorial');
    await crearRegistroSeguimiento({ proyectoId: proyecto.id, analistaId: analista.id, estatus: 'Entregado' });
    const cookie = await registrarYLoguear(app, 'jefe_area');

    const respuesta = await request(app.server).get('/api/seguimiento').set('Cookie', cookie);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.items).toHaveLength(1);
    expect(respuesta.body.items[0].analista.id).toBe(analista.id);
    expect(respuesta.body.items[0].estado).toBe('entregado');
    expect(respuesta.body.items[0].proyecto.id).toBe(proyecto.id);

    await app.close();
  });

  it('devuelve analista null si el registro todavía no tiene analista asignado', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const proyecto = await crearProyectoDePrueba();
    await db.update(proyectos).set({notificadoJefatura:true}).where(eq(proyectos.id,proyecto.id));
    await crearRegistroSeguimiento({ proyectoId: proyecto.id });
    const cookie = await registrarYLoguear(app, 'jefe_area');

    const respuesta = await request(app.server).get('/api/seguimiento').set('Cookie', cookie);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.items[0].analista).toBeNull();

    await app.close();
  });

  it('rechaza sin sesión', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const respuesta = await request(app.server).get('/api/seguimiento');

    expect(respuesta.status).toBe(401);

    await app.close();
  });

  it('rechaza a un rol distinto de jefe_area (ej. especialista)', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const cookie = await registrarYLoguear(app, 'especialista');

    const respuesta = await request(app.server).get('/api/seguimiento').set('Cookie', cookie);

    expect(respuesta.status).toBe(403);

    await app.close();
  });
});
