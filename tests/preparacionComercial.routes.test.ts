import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearProyectoDePrueba } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';
import { actualizarSeccionProyectoContrato, actualizarSeccionProyectoPerfil, crearFichaTrazabilidad, obtenerFichaCompleta } from '../server/helpers/trazabilidad.js';
describe('contrato HTTP de preparación comercial y dueño de Crudo', () => {
  beforeEach(limpiarBaseDeDatos);
  it.each(['comercial', 'jefe_area'] as const)('rechaza subtipo de %s sin aplicar el resto del PATCH', async (rol) => {
    const app = crearAppDePrueba(); await app.ready();
    try {
      const p = await crearProyectoDePrueba(); await crearFichaTrazabilidad(p.id);
      const cookie = await registrarYLoguear(app, rol);
      for (const subtipo of ['Tripa', 'Capítulo', null]) {
        const r = await request(app.server).patch(`/api/fichas-trazabilidad/${p.id}/proyecto-perfil`).set('Cookie', cookie).send({ ingresoServicioSubtipoCrudo: subtipo, ingresoObservaciones: 'No guardar' });
        expect(r.status).toBe(403);
      }
      const ficha = await obtenerFichaCompleta(p.id);
      expect(ficha?.ingresoServicioSubtipoCrudo).toBeNull(); expect(ficha?.ingresoObservaciones).toBeNull();
    } finally { await app.close(); }
  });
  it('RRPP conserva escritura y limpieza del subtipo', async () => {
    const app = crearAppDePrueba(); await app.ready();
    try {
      const p = await crearProyectoDePrueba(); await crearFichaTrazabilidad(p.id);
      const cookie = await registrarYLoguear(app, 'rrpp');
      for (const subtipo of ['Tripa', 'Capítulo', null]) {
        const r = await request(app.server).patch(`/api/fichas-trazabilidad/${p.id}/proyecto-perfil`).set('Cookie', cookie).send({ ingresoServicioSubtipoCrudo: subtipo });
        expect(r.status).toBe(200); expect(r.body.ficha.ingresoServicioSubtipoCrudo).toBe(subtipo);
      }
    } finally { await app.close(); }
  });
  it('detalle, activos y pendientes coinciden antes, durante y después de completar el contrato', async () => {
    const app = crearAppDePrueba(); await app.ready();
    try {
      const p = await crearProyectoDePrueba(); await crearFichaTrazabilidad(p.id);
      await actualizarSeccionProyectoPerfil(p.id, { ingresoFechaIngreso: p.fechaProgramadaInicio, ingresoServicioAlianza: false });
      const cookie = await registrarYLoguear(app, 'comercial');
      for (const contrato of [{ capitulosPactados: null, paginasPactadas: null }, { capitulosPactados: '1 a 5', paginasPactadas: null }, { capitulosPactados: '1 a 5', paginasPactadas: '100' }]) {
        await actualizarSeccionProyectoContrato(p.id, contrato);
        const detalle = await request(app.server).get(`/api/fichas-trazabilidad/${p.id}`).set('Cookie', cookie);
        const activos = await request(app.server).get('/api/proyectos/activos').set('Cookie', cookie);
        const pendientes = await request(app.server).get('/api/fichas-trazabilidad/pendientes/contrato').set('Cookie', cookie);
        expect([detalle.status, activos.status, pendientes.status]).toEqual([200, 200, 200]);
        const fila = activos.body.proyectos.find((fila: { id: string }) => fila.id === p.id);
        const listo = contrato.paginasPactadas !== null;
        expect(detalle.body.ficha.listoParaRrpp).toBe(listo);
        expect(fila.listoParaRrpp).toBe(listo);
        expect(fila.faltantesComercial).toEqual(detalle.body.ficha.faltantesComercial);
        expect(pendientes.body.proyectos.some((fila: { id: string }) => fila.id === p.id)).toBe(!listo);
      }
    } finally { await app.close(); }
  });
});
