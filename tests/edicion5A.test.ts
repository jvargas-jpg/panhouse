import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import { auditLogs, notificaciones, proyectos, workItems } from '../server/db/schema/index.js';
import { actualizarCapituloAutor, crearCapitulo } from '../server/helpers/capitulos.js';
import { calcularFechaPautadaFeedbackCapitulo } from '../server/helpers/edicionSla.js';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAutor, crearPresupuesto, crearProyecto, crearProyectoDePrueba, crearServicio, crearUnidad, crearUsuario } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

// Fase 5 — 5A EDICIÓN: flujo vertical completo (solicitar editor →
// asignar → trabajar capítulos → cerrar con feedback de tripa).
describe('Fase 5A — Edición', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  describe('Auto-cálculo de fecha pautada de feedback (capítulo)', () => {
    it('calcula fechaPautadaFeedback (3 días hábiles) cuando solo se envía fechaEnvioAutor', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
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
        .send({ fechaEnvioAutor: '2026-01-05' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.capitulo.fechaPautadaFeedback).toBe(calcularFechaPautadaFeedbackCapitulo('2026-01-05'));
      await app.close();
    });

    it('NO sobreescribe una fechaPautadaFeedback explícita en el mismo request', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
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
        .send({ fechaEnvioAutor: '2026-01-05', fechaPautadaFeedback: '2026-01-20' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.capitulo.fechaPautadaFeedback).toBe('2026-01-20');
      await app.close();
    });
  });

  describe('POST /api/proyectos/:id/solicitar-editor', () => {
    it('permite al especialista asignado solicitar editor: crea work item pendiente y notifica a jefe_edicion', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoDePrueba({ especialistaId: me.body.user.id });

      const respuesta = await request(app.server).post(`/api/proyectos/${proyecto.id}/solicitar-editor`).set('Cookie', cookie);
      expect(respuesta.status).toBe(201);

      const [workItem] = await db.select().from(workItems).where(and(eq(workItems.proyectoId, proyecto.id), eq(workItems.tipo, 'edicion')));
      expect(workItem?.estado).toBe('pendiente');

      const notifs = await db.select().from(notificaciones).where(and(eq(notificaciones.proyectoId, proyecto.id), eq(notificaciones.rolDestino, 'jefe_edicion')));
      expect(notifs).toHaveLength(1);

      const eventos = await db.select().from(auditLogs).where(eq(auditLogs.proyectoId, proyecto.id));
      expect(eventos.map((e) => e.accion)).toEqual(['EDITOR_SOLICITADO']);

      await app.close();
    });

    it('rechaza (403) a un especialista que no está asignado a este proyecto (IDOR)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba(); // sin especialista asignado
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server).post(`/api/proyectos/${proyecto.id}/solicitar-editor`).set('Cookie', cookie);
      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('idempotente: pedir dos veces no duplica el work item ni la notificación', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoDePrueba({ especialistaId: me.body.user.id });

      await request(app.server).post(`/api/proyectos/${proyecto.id}/solicitar-editor`).set('Cookie', cookie);
      await request(app.server).post(`/api/proyectos/${proyecto.id}/solicitar-editor`).set('Cookie', cookie);

      const items = await db.select().from(workItems).where(and(eq(workItems.proyectoId, proyecto.id), eq(workItems.tipo, 'edicion')));
      expect(items).toHaveLength(1);
      const notifs = await db.select().from(notificaciones).where(and(eq(notificaciones.proyectoId, proyecto.id), eq(notificaciones.rolDestino, 'jefe_edicion')));
      expect(notifs).toHaveLength(1);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const respuesta = await request(app.server).post(`/api/proyectos/${proyecto.id}/solicitar-editor`);
      expect(respuesta.status).toBe(401);
      await app.close();
    });
  });

  describe('Ciclo de vida del work item "edicion"', () => {
    it('pendiente (solicitar) -> en_progreso (asignar editor) -> completado (feedback tripa)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookieEspecialista = await registrarYLoguear(app, 'especialista');
      const meEspecialista = await request(app.server).get('/api/auth/me').set('Cookie', cookieEspecialista);
      const proyecto = await crearProyectoDePrueba({ especialistaId: meEspecialista.body.user.id });
      const editor = await crearUsuario('editor');
      const cookieJefeEdicion = await registrarYLoguear(app, 'jefe_edicion');

      await request(app.server).post(`/api/proyectos/${proyecto.id}/solicitar-editor`).set('Cookie', cookieEspecialista);
      let [item] = await db.select().from(workItems).where(and(eq(workItems.proyectoId, proyecto.id), eq(workItems.tipo, 'edicion')));
      expect(item?.estado).toBe('pendiente');

      await request(app.server).patch(`/api/proyectos/${proyecto.id}/editor`).set('Cookie', cookieJefeEdicion).send({ editorId: editor.id });
      [item] = await db.select().from(workItems).where(and(eq(workItems.proyectoId, proyecto.id), eq(workItems.tipo, 'edicion')));
      expect(item?.estado).toBe('en_progreso');

      const respuestaCierre = await request(app.server)
        .patch(`/api/proyectos/${proyecto.id}/feedback-tripa`)
        .set('Cookie', cookieEspecialista)
        .send({ fecha: '2026-03-01' });
      expect(respuestaCierre.status).toBe(200);

      [item] = await db.select().from(workItems).where(and(eq(workItems.proyectoId, proyecto.id), eq(workItems.tipo, 'edicion')));
      expect(item?.estado).toBe('completado');

      const [proyectoActualizado] = await db.select().from(proyectos).where(eq(proyectos.id, proyecto.id));
      expect(proyectoActualizado?.fechaFeedbackTripa).toBe('2026-03-01');

      await app.close();
    });
  });

  describe('PATCH /api/proyectos/:id/feedback-tripa', () => {
    it('rechaza (403) a un especialista no asignado (IDOR)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server).patch(`/api/proyectos/${proyecto.id}/feedback-tripa`).set('Cookie', cookie).send({ fecha: '2026-03-01' });
      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('rechaza a un rol distinto de especialista (ej. editor)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'editor');

      const respuesta = await request(app.server).patch(`/api/proyectos/${proyecto.id}/feedback-tripa`).set('Cookie', cookie).send({ fecha: '2026-03-01' });
      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('GET /api/capitulos/mios', () => {
    it('devuelve solo los trabajos de capítulos de proyectos del editor que inicia sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'editor');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);

      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const miProyecto = await crearProyecto({
        autorId: autor.id,
        servicioId: servicio.id,
        unidadId: unidad.id,
        presupuestoId: presupuesto.id,
        editorId: me.body.user.id,
        fechaProgramadaInicio: '2026-01-01',
      });
      await crearCapitulo(miProyecto.id, 1);

      // Proyecto de OTRO editor — no debe aparecer.
      const otroEditor = await crearUsuario('editor');
      const ajeno = await crearProyecto({
        autorId: autor.id,
        servicioId: servicio.id,
        unidadId: unidad.id,
        presupuestoId: presupuesto.id,
        editorId: otroEditor.id,
        fechaProgramadaInicio: '2026-01-01',
      });
      await crearCapitulo(ajeno.id, 1);

      const respuesta = await request(app.server).get('/api/capitulos/mios').set('Cookie', cookie);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.trabajos).toHaveLength(1);
      expect(respuesta.body.trabajos[0].proyectoId).toBe(miProyecto.id);
      expect(respuesta.body.trabajos[0].estado).toBe('por_iniciar');

      await app.close();
    });

    it('clasifica como feedback_para_aplicar cuando ya hay fechaRespuestaReal sin entrega del editor', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'editor');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const proyecto = await crearProyecto({
        autorId: autor.id,
        servicioId: servicio.id,
        unidadId: unidad.id,
        presupuestoId: presupuesto.id,
        editorId: me.body.user.id,
        fechaProgramadaInicio: '2026-01-01',
      });
      const capitulo = await crearCapitulo(proyecto.id, 1);
      await actualizarCapituloAutor(proyecto.id, capitulo.numero, { fechaEnvioAutor: '2026-01-05', fechaRespuestaReal: '2026-01-08' });

      const respuesta = await request(app.server).get('/api/capitulos/mios').set('Cookie', cookie);
      expect(respuesta.body.trabajos[0].estado).toBe('feedback_para_aplicar');
      await app.close();
    });

    it('rechaza a un rol distinto de editor', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const respuesta = await request(app.server).get('/api/capitulos/mios').set('Cookie', cookie);
      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });
});
