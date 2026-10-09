import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROLES } from '../server/db/schema/index.js';
import { indicadoresComercialesSchema } from '../server/helpers/indicadoresComerciales.js';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAutor } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

const URL = '/api/metricas/comercial/indicadores';
describe('HTTP indicadores comerciales', () => {
  beforeEach(limpiarBaseDeDatos);
  it.each(ROLES)('acceso del rol %s sin filtraciones', async (rol) => {
    const app = crearAppDePrueba(); await app.ready();
    try {
      await crearAutor({ nombre: 'Nombre privado', email: ['privado@example.test'] });
      const cookie = await registrarYLoguear(app, rol);
      const r = await request(app.server).get(URL).set('Cookie', cookie);
      const permitido = rol === 'comercial' || rol === 'direccion';
      expect(r.status).toBe(permitido ? 200 : 403);
      if (permitido) { expect(indicadoresComercialesSchema.safeParse(r.body).success).toBe(true); expect(r.body.monthly).toHaveLength(6); }
      else expect(r.body.summary).toBeUndefined();
      expect(JSON.stringify(r.body)).not.toMatch(/Nombre privado|privado@example|password|autorId|presupuestoId/);
    } finally { await app.close(); }
  });
  it('sin sesión responde 401', async () => {
    const app = crearAppDePrueba(); await app.ready();
    try { expect((await request(app.server).get(URL)).status).toBe(401); } finally { await app.close(); }
  });
  it('valida query Zod y soporta 3, 6, 12 meses con default 6', async () => {
    const app = crearAppDePrueba(); await app.ready();
    try {
      const cookie = await registrarYLoguear(app, 'comercial');
      for (const meses of [3, 6, 12]) {
        const r = await request(app.server).get(`${URL}?periodo=${meses}m`).set('Cookie', cookie);
        expect(r.status).toBe(200); expect(r.body.monthly).toHaveLength(meses); expect(r.body.periodo.meses).toBe(meses);
      }
      for (const query of ['periodo=1m', 'periodo=', 'periodo=6m&autorId=otro', 'periodo=3m&periodo=12m']) expect((await request(app.server).get(`${URL}?${query}`).set('Cookie', cookie)).status).toBe(400);
    } finally { await app.close(); }
  });
});
