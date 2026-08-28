import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearUsuario } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('GET /api/usuarios', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it.each(['jefe_area', 'especialista', 'rrpp', 'disenador', 'lider_creativo', 'soporte_editorial', 'soporte_digital'] as const)(
    'permite a %s listar el personal activo, sin incluir autores',
    async (rol) => {
      const app = crearAppDePrueba();
      await app.ready();

      const [especialista, autor] = await Promise.all([crearUsuario('especialista'), crearUsuario('autor')]);
      const cookie = await registrarYLoguear(app, rol);

      const respuesta = await request(app.server).get('/api/usuarios').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      const ids = respuesta.body.usuarios.map((u: { id: string }) => u.id);
      expect(ids).toContain(especialista.id);
      expect(ids).not.toContain(autor.id);

      await app.close();
    },
  );

  it('rechaza sin sesión', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const respuesta = await request(app.server).get('/api/usuarios');

    expect(respuesta.status).toBe(401);

    await app.close();
  });

  // comercial explícitamente no ve SeccionEquipo.tsx (Paso 4 del pedido:
  // "solo visible si el rol NO es comercial") — coherente que tampoco
  // pueda leer este listado.
  it('rechaza a comercial (no ve el panel de equipo)', async () => {
    const app = crearAppDePrueba();
    await app.ready();

    const cookie = await registrarYLoguear(app, 'comercial');

    const respuesta = await request(app.server).get('/api/usuarios').set('Cookie', cookie);

    expect(respuesta.status).toBe(403);

    await app.close();
  });
});
