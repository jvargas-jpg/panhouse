import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearPagoDePrueba, crearProyectoDePrueba } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('rutas de pagos (módulo financiero de Comercial)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  describe('POST /api/pagos', () => {
    it('permite a comercial registrar un pago para un proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server).post('/api/pagos').set('Cookie', cookie).send({
        proyectoId: proyecto.id,
        monto: '500.00',
        fechaPago: '2026-01-15',
        metodoPago: 'Transferencia',
        referencia: 'TRX-001',
      });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.pago.proyectoId).toBe(proyecto.id);
      expect(respuesta.body.pago.monto).toBe('500.00');
      expect(respuesta.body.pago.moneda).toBe('USD');
      expect(respuesta.body.pago.metodoPago).toBe('Transferencia');
      expect(respuesta.body.pago.referencia).toBe('TRX-001');
      await app.close();
    });

    it('nace siempre con estatus "Pendiente de verificación", sin importar lo que mande el cliente', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server)
        .post('/api/pagos')
        .set('Cookie', cookie)
        .send({
          proyectoId: proyecto.id,
          monto: '500.00',
          fechaPago: '2026-01-15',
          metodoPago: 'Zelle',
          estatus: 'Verificado', // no está en el schema — se ignora
        });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.pago.estatus).toBe('Pendiente de verificación');
      await app.close();
    });

    it.each(['rrpp', 'cobranzas', 'jefe_area'] as const)('permite a %s registrar un pago', async (rol) => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, rol);

      const respuesta = await request(app.server)
        .post('/api/pagos')
        .set('Cookie', cookie)
        .send({ proyectoId: proyecto.id, monto: '100.00', fechaPago: '2026-01-15', metodoPago: 'Tarjeta' });

      expect(respuesta.status).toBe(201);
      await app.close();
    });

    it('devuelve 400 (no 500) si falta un campo requerido', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server)
        .post('/api/pagos')
        .set('Cookie', cookie)
        .send({ proyectoId: proyecto.id, fechaPago: '2026-01-15', metodoPago: 'Transferencia' });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toBe('Datos inválidos');
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();

      const respuesta = await request(app.server)
        .post('/api/pagos')
        .send({ proyectoId: proyecto.id, monto: '100.00', fechaPago: '2026-01-15', metodoPago: 'Transferencia' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin relación con el módulo de pagos (ej. especialista)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .post('/api/pagos')
        .set('Cookie', cookie)
        .send({ proyectoId: proyecto.id, monto: '100.00', fechaPago: '2026-01-15', metodoPago: 'Transferencia' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('GET /api/pagos', () => {
    it('lista los pagos con el proyecto (autor y servicio) resuelto, más recientes primero', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'comercial');

      await request(app.server)
        .post('/api/pagos')
        .set('Cookie', cookie)
        .send({ proyectoId: proyecto.id, monto: '100.00', fechaPago: '2026-01-10', metodoPago: 'Zelle' });
      await request(app.server)
        .post('/api/pagos')
        .set('Cookie', cookie)
        .send({ proyectoId: proyecto.id, monto: '200.00', fechaPago: '2026-01-20', metodoPago: 'Transferencia' });

      const respuesta = await request(app.server).get('/api/pagos').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.pagos).toHaveLength(2);
      expect(respuesta.body.pagos[0].fechaPago).toBe('2026-01-20'); // más reciente primero
      expect(respuesta.body.pagos[0].proyecto.autorNombre).toBeTypeOf('string');
      expect(respuesta.body.pagos[0].proyecto.servicioCodigo).toBeTypeOf('string');
      await app.close();
    });

    it('filtra por proyectoId cuando se pasa como query param', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyectoA = await crearProyectoDePrueba();
      const proyectoB = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'comercial');

      await request(app.server)
        .post('/api/pagos')
        .set('Cookie', cookie)
        .send({ proyectoId: proyectoA.id, monto: '100.00', fechaPago: '2026-01-10', metodoPago: 'Zelle' });
      await request(app.server)
        .post('/api/pagos')
        .set('Cookie', cookie)
        .send({ proyectoId: proyectoB.id, monto: '200.00', fechaPago: '2026-01-10', metodoPago: 'Zelle' });

      const respuesta = await request(app.server).get(`/api/pagos?proyectoId=${proyectoA.id}`).set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.pagos).toHaveLength(1);
      expect(respuesta.body.pagos[0].proyectoId).toBe(proyectoA.id);
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const respuesta = await request(app.server).get('/api/pagos');

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin relación con el módulo de pagos (ej. especialista)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server).get('/api/pagos').set('Cookie', cookie);

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('PATCH /api/pagos/:id/verificar', () => {
    it('permite a cobranzas aprobar un pago pendiente', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const pago = await crearPagoDePrueba({ proyectoId: proyecto.id });
      const cookie = await registrarYLoguear(app, 'cobranzas');

      const respuesta = await request(app.server).patch(`/api/pagos/${pago.id}/verificar`).set('Cookie', cookie).send({
        estatus: 'Verificado',
      });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.pago.estatus).toBe('Verificado');
      expect(respuesta.body.pago.motivoRechazo).toBeNull();
      await app.close();
    });

    it('permite a cobranzas rechazar un pago con motivoRechazo', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const pago = await crearPagoDePrueba({ proyectoId: proyecto.id });
      const cookie = await registrarYLoguear(app, 'cobranzas');

      const respuesta = await request(app.server)
        .patch(`/api/pagos/${pago.id}/verificar`)
        .set('Cookie', cookie)
        .send({ estatus: 'Rechazado', motivoRechazo: 'Comprobante ilegible' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.pago.estatus).toBe('Rechazado');
      expect(respuesta.body.pago.motivoRechazo).toBe('Comprobante ilegible');
      await app.close();
    });

    it('devuelve 400 si se rechaza sin motivoRechazo', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const pago = await crearPagoDePrueba({ proyectoId: proyecto.id });
      const cookie = await registrarYLoguear(app, 'cobranzas');

      const respuesta = await request(app.server).patch(`/api/pagos/${pago.id}/verificar`).set('Cookie', cookie).send({
        estatus: 'Rechazado',
      });

      expect(respuesta.status).toBe(400);
      await app.close();
    });

    it.each(['jefe_area', 'direccion'] as const)('permite a %s verificar un pago', async (rol) => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const pago = await crearPagoDePrueba({ proyectoId: proyecto.id });
      const cookie = await registrarYLoguear(app, rol);

      const respuesta = await request(app.server).patch(`/api/pagos/${pago.id}/verificar`).set('Cookie', cookie).send({
        estatus: 'Verificado',
      });

      expect(respuesta.status).toBe(200);
      await app.close();
    });

    it('rechaza a comercial (quien registra el pago no puede autoverificarlo)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const pago = await crearPagoDePrueba({ proyectoId: proyecto.id });
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server).patch(`/api/pagos/${pago.id}/verificar`).set('Cookie', cookie).send({
        estatus: 'Verificado',
      });

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const pago = await crearPagoDePrueba({ proyectoId: proyecto.id });

      const respuesta = await request(app.server).patch(`/api/pagos/${pago.id}/verificar`).send({ estatus: 'Verificado' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('devuelve 404 si el pago no existe', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'cobranzas');

      const respuesta = await request(app.server)
        .patch('/api/pagos/00000000-0000-0000-0000-000000000000/verificar')
        .set('Cookie', cookie)
        .send({ estatus: 'Verificado' });

      expect(respuesta.status).toBe(404);
      await app.close();
    });
  });
});
