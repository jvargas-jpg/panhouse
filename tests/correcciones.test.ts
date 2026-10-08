import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import { auditLogs, correcciones, notificaciones, projectAssignments, workItems } from '../server/db/schema/index.js';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

// Mismo guardián que registrarYLoguear (tests/helpers/auth.ts) — login
// directo como una cuenta ya existente (el corrector ya asignado, no
// uno nuevo) no tiene ese helper, pero necesita la misma garantía de
// tipos sobre el header set-cookie.
function obtenerCookie(respuestaLogin: request.Response): string {
  const cookie = respuestaLogin.headers['set-cookie'];
  if (!cookie) throw new Error('El login no devolvió cookie de sesión');
  return cookie;
}

async function solicitarCorreccionDePrueba(
  app: ReturnType<typeof crearAppDePrueba>,
  cookieEspecialista: string,
  proyectoId: string,
  alcance: 'tripa_completa' | 'preliminares' | 'cubierta_extendida' = 'tripa_completa',
  paginas?: number,
) {
  const respuesta = await request(app.server)
    .post(`/api/proyectos/${proyectoId}/correcciones`)
    .set('Cookie', cookieEspecialista)
    .send({ alcance, paginas });
  return respuesta.body.id as string;
}

describe('Fase 5B — Corrección', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  describe('POST /api/proyectos/:id/correcciones', () => {
    it('permite al especialista dueño solicitar una corrección: crea work item pendiente', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoDePrueba({ especialistaId: me.body.user.id });

      const respuesta = await request(app.server)
        .post(`/api/proyectos/${proyecto.id}/correcciones`)
        .set('Cookie', cookie)
        .send({ alcance: 'tripa_completa', paginas: 150 });

      expect(respuesta.status).toBe(201);

      const [correccion] = await db.select().from(correcciones).where(eq(correcciones.proyectoId, proyecto.id));
      expect(correccion?.alcance).toBe('tripa_completa');
      expect(correccion?.requiereRevisionPrevia).toBe(true); // 150 > 120

      const [wi] = await db.select().from(workItems).where(eq(workItems.id, correccion!.workItemId));
      expect(wi?.estado).toBe('pendiente');
      expect(wi?.businessKey).toBe('tripa_completa');

      await app.close();
    });

    it('no marca requiereRevisionPrevia cuando las páginas son menores o iguales a 120', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoDePrueba({ especialistaId: me.body.user.id });

      await request(app.server).post(`/api/proyectos/${proyecto.id}/correcciones`).set('Cookie', cookie).send({ alcance: 'preliminares', paginas: 10 });

      const [correccion] = await db.select().from(correcciones).where(eq(correcciones.proyectoId, proyecto.id));
      expect(correccion?.requiereRevisionPrevia).toBe(false);

      await app.close();
    });

    it('rechaza (403) a un especialista que no está asignado a este proyecto (IDOR)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoDePrueba();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .post(`/api/proyectos/${proyecto.id}/correcciones`)
        .set('Cookie', cookie)
        .send({ alcance: 'tripa_completa' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('idempotente: pedir dos veces el mismo alcance mientras está abierto no duplica work item', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoDePrueba({ especialistaId: me.body.user.id });

      const r1 = await request(app.server).post(`/api/proyectos/${proyecto.id}/correcciones`).set('Cookie', cookie).send({ alcance: 'tripa_completa' });
      const r2 = await request(app.server).post(`/api/proyectos/${proyecto.id}/correcciones`).set('Cookie', cookie).send({ alcance: 'tripa_completa' });

      expect(r1.body.id).toBe(r2.body.id);
      expect(r2.body.nueva).toBe(false);

      const filas = await db.select().from(correcciones).where(eq(correcciones.proyectoId, proyecto.id));
      expect(filas).toHaveLength(1);

      await app.close();
    });

    it('rechaza un alcance inválido', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoDePrueba({ especialistaId: me.body.user.id });

      const respuesta = await request(app.server)
        .post(`/api/proyectos/${proyecto.id}/correcciones`)
        .set('Cookie', cookie)
        .send({ alcance: 'tripa_diagramada' }); // pertenece a Calidad/Revisión Final, no a Corrección

      expect(respuesta.status).toBe(400);
      await app.close();
    });
  });

  describe('PATCH /api/correcciones/:id/asignar', () => {
    it('asigna un corrector interno (con cuenta): crea assignment, work item -> en_progreso, notifica', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoDePrueba({ especialistaId: me.body.user.id });
      const corrector = await crearUsuario('corrector');
      const correccionId = await solicitarCorreccionDePrueba(app, cookie, proyecto.id);

      const respuesta = await request(app.server)
        .patch(`/api/correcciones/${correccionId}/asignar`)
        .set('Cookie', cookie)
        .send({ correctorId: corrector.id, freelance: false, contratoConfirmado: true });

      expect(respuesta.status).toBe(200);

      const [correccion] = await db.select().from(correcciones).where(eq(correcciones.id, correccionId));
      expect(correccion?.correctorId).toBe(corrector.id);
      expect(correccion?.dueAt).toBeTruthy();

      const [wi] = await db.select().from(workItems).where(eq(workItems.id, correccion!.workItemId));
      expect(wi?.estado).toBe('en_progreso');

      const asignaciones = await db
        .select()
        .from(projectAssignments)
        .where(and(eq(projectAssignments.workItemId, correccion!.workItemId), eq(projectAssignments.tipo, 'corrector')));
      expect(asignaciones).toHaveLength(1);
      expect(asignaciones[0]?.usuarioId).toBe(corrector.id);

      const notifs = await db.select().from(notificaciones).where(eq(notificaciones.usuarioDestinoId, corrector.id));
      expect(notifs).toHaveLength(1);

      const eventos = await db.select().from(auditLogs).where(eq(auditLogs.proyectoId, proyecto.id));
      expect(eventos.map((e) => e.accion)).toContain('CORRECTOR_ASIGNADO');

      await app.close();
    });

    it('asigna un corrector freelance (sin cuenta): correctorNombre, sin assignment ni notificación por usuario', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoDePrueba({ especialistaId: me.body.user.id });
      const correccionId = await solicitarCorreccionDePrueba(app, cookie, proyecto.id);

      const respuesta = await request(app.server)
        .patch(`/api/correcciones/${correccionId}/asignar`)
        .set('Cookie', cookie)
        .send({ correctorNombre: 'Genesis Herrera', freelance: true, contratoConfirmado: true });

      expect(respuesta.status).toBe(200);

      const [correccion] = await db.select().from(correcciones).where(eq(correcciones.id, correccionId));
      expect(correccion?.correctorNombre).toBe('Genesis Herrera');
      expect(correccion?.correctorId).toBeNull();
      expect(correccion?.freelance).toBe(true);

      const asignaciones = await db.select().from(projectAssignments).where(eq(projectAssignments.workItemId, correccion!.workItemId));
      expect(asignaciones).toHaveLength(0);

      await app.close();
    });

    it('GATE-06: rechaza asignar sin confirmar revisión previa cuando paginas > 120', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoDePrueba({ especialistaId: me.body.user.id });
      const correccionId = await solicitarCorreccionDePrueba(app, cookie, proyecto.id, 'tripa_completa', 200);

      const respuesta = await request(app.server)
        .patch(`/api/correcciones/${correccionId}/asignar`)
        .set('Cookie', cookie)
        .send({ correctorNombre: 'Genesis Herrera', freelance: true, contratoConfirmado: true });

      expect(respuesta.status).toBe(400);

      const respuestaConfirmada = await request(app.server)
        .patch(`/api/correcciones/${correccionId}/asignar`)
        .set('Cookie', cookie)
        .send({ correctorNombre: 'Genesis Herrera', freelance: true, contratoConfirmado: true, revisionPreviaConfirmada: true });

      expect(respuestaConfirmada.status).toBe(200);

      await app.close();
    });

    it('reasignación: cierra el assignment anterior y conserva el historial', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoDePrueba({ especialistaId: me.body.user.id });
      const correctorA = await crearUsuario('corrector');
      const correctorB = await crearUsuario('corrector');
      const correccionId = await solicitarCorreccionDePrueba(app, cookie, proyecto.id);

      await request(app.server)
        .patch(`/api/correcciones/${correccionId}/asignar`)
        .set('Cookie', cookie)
        .send({ correctorId: correctorA.id, freelance: false, contratoConfirmado: true });

      const respuesta = await request(app.server)
        .patch(`/api/correcciones/${correccionId}/asignar`)
        .set('Cookie', cookie)
        .send({ correctorId: correctorB.id, freelance: false, contratoConfirmado: true });

      expect(respuesta.status).toBe(200);

      const [correccion] = await db.select().from(correcciones).where(eq(correcciones.id, correccionId));
      expect(correccion?.correctorId).toBe(correctorB.id);

      const historial = await db.select().from(projectAssignments).where(eq(projectAssignments.workItemId, correccion!.workItemId));
      expect(historial).toHaveLength(2);
      const anterior = historial.find((a) => a.usuarioId === correctorA.id);
      expect(anterior?.finalizadoEn).not.toBeNull();
      const actual = historial.find((a) => a.usuarioId === correctorB.id);
      expect(actual?.finalizadoEn).toBeNull();

      const eventos = await db.select().from(auditLogs).where(eq(auditLogs.proyectoId, proyecto.id));
      expect(eventos.map((e) => e.accion)).toContain('CORRECTOR_REASIGNADO');

      await app.close();
    });

    it('rechaza a un rol distinto de especialista (ej. corrector)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookieEspecialista = await registrarYLoguear(app, 'especialista');
      const meEspecialista = await request(app.server).get('/api/auth/me').set('Cookie', cookieEspecialista);
      const proyecto = await crearProyectoDePrueba({ especialistaId: meEspecialista.body.user.id });
      const correccionId = await solicitarCorreccionDePrueba(app, cookieEspecialista, proyecto.id);
      const cookieCorrector = await registrarYLoguear(app, 'corrector');

      const respuesta = await request(app.server)
        .patch(`/api/correcciones/${correccionId}/asignar`)
        .set('Cookie', cookieCorrector)
        .send({ correctorNombre: 'X', freelance: true, contratoConfirmado: true });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('PATCH /api/correcciones/:id/inicio y /entrega', () => {
    it('permite al corrector interno asignado marcar su propio inicio y entrega', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookieEspecialista = await registrarYLoguear(app, 'especialista');
      const meEspecialista = await request(app.server).get('/api/auth/me').set('Cookie', cookieEspecialista);
      const proyecto = await crearProyectoDePrueba({ especialistaId: meEspecialista.body.user.id });
      const correccionId = await solicitarCorreccionDePrueba(app, cookieEspecialista, proyecto.id);

      const corrector = await crearUsuario('corrector');
      await request(app.server)
        .patch(`/api/correcciones/${correccionId}/asignar`)
        .set('Cookie', cookieEspecialista)
        .send({ correctorId: corrector.id, freelance: false, contratoConfirmado: true });

      // Login directo como el corrector YA asignado (no registrarYLoguear,
      // que crearía una cuenta nueva sin relación con la asignación).
      const loginCorrector = await request(app.server).post('/api/auth/login').send({ email: corrector.email, password: 'password123' });
      const cookieCorrector = obtenerCookie(loginCorrector);

      const inicio = await request(app.server)
        .patch(`/api/correcciones/${correccionId}/inicio`)
        .set('Cookie', cookieCorrector)
        .send({ fecha: '2026-01-06' });
      expect(inicio.status).toBe(200);

      const entrega = await request(app.server)
        .patch(`/api/correcciones/${correccionId}/entrega`)
        .set('Cookie', cookieCorrector)
        .send({ fecha: '2026-01-10', controlCambiosUrl: 'https://drive.example/control', informeTecnicoUrl: 'https://drive.example/informe' });
      expect(entrega.status).toBe(200);

      const [correccion] = await db.select().from(correcciones).where(eq(correcciones.id, correccionId));
      expect(correccion?.fechaInicio).toBe('2026-01-06');
      expect(correccion?.fechaEntrega).toBe('2026-01-10');

      const [wi] = await db.select().from(workItems).where(eq(workItems.id, correccion!.workItemId));
      expect(wi?.estado).toBe('completado');

      await app.close();
    });

    it('rechaza (403) a un corrector que no es el asignado a esta corrección (IDOR)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookieEspecialista = await registrarYLoguear(app, 'especialista');
      const meEspecialista = await request(app.server).get('/api/auth/me').set('Cookie', cookieEspecialista);
      const proyecto = await crearProyectoDePrueba({ especialistaId: meEspecialista.body.user.id });
      const correccionId = await solicitarCorreccionDePrueba(app, cookieEspecialista, proyecto.id);

      const correctorAsignado = await crearUsuario('corrector');
      await request(app.server)
        .patch(`/api/correcciones/${correccionId}/asignar`)
        .set('Cookie', cookieEspecialista)
        .send({ correctorId: correctorAsignado.id, freelance: false, contratoConfirmado: true });

      const cookieOtroCorrector = await registrarYLoguear(app, 'corrector');

      const respuesta = await request(app.server)
        .patch(`/api/correcciones/${correccionId}/inicio`)
        .set('Cookie', cookieOtroCorrector)
        .send({ fecha: '2026-01-06' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('permite al especialista marcar inicio/entrega cuando el corrector es freelance (sin cuenta)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoDePrueba({ especialistaId: me.body.user.id });
      const correccionId = await solicitarCorreccionDePrueba(app, cookie, proyecto.id);

      await request(app.server)
        .patch(`/api/correcciones/${correccionId}/asignar`)
        .set('Cookie', cookie)
        .send({ correctorNombre: 'Genesis Herrera', freelance: true, contratoConfirmado: true });

      const respuesta = await request(app.server).patch(`/api/correcciones/${correccionId}/entrega`).set('Cookie', cookie).send({ fecha: '2026-01-10' });
      expect(respuesta.status).toBe(200);

      await app.close();
    });

    it('rechaza (403) al especialista marcar inicio/entrega cuando el corrector SÍ es interno (no freelance)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoDePrueba({ especialistaId: me.body.user.id });
      const correccionId = await solicitarCorreccionDePrueba(app, cookie, proyecto.id);
      const corrector = await crearUsuario('corrector');

      await request(app.server)
        .patch(`/api/correcciones/${correccionId}/asignar`)
        .set('Cookie', cookie)
        .send({ correctorId: corrector.id, freelance: false, contratoConfirmado: true });

      const respuesta = await request(app.server).patch(`/api/correcciones/${correccionId}/entrega`).set('Cookie', cookie).send({ fecha: '2026-01-10' });
      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('PATCH /api/correcciones/:id/cierre', () => {
    it('permite al especialista cerrar con un resultado, nunca al corrector', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoDePrueba({ especialistaId: me.body.user.id });
      const correccionId = await solicitarCorreccionDePrueba(app, cookie, proyecto.id);

      await request(app.server)
        .patch(`/api/correcciones/${correccionId}/asignar`)
        .set('Cookie', cookie)
        .send({ correctorNombre: 'Genesis Herrera', freelance: true, contratoConfirmado: true });
      await request(app.server).patch(`/api/correcciones/${correccionId}/entrega`).set('Cookie', cookie).send({ fecha: '2026-01-10' });

      const respuesta = await request(app.server)
        .patch(`/api/correcciones/${correccionId}/cierre`)
        .set('Cookie', cookie)
        .send({ resultado: 'buena', observaciones: 'Todo correcto' });

      expect(respuesta.status).toBe(200);

      const [correccion] = await db.select().from(correcciones).where(eq(correcciones.id, correccionId));
      expect(correccion?.resultado).toBe('buena');

      const eventos = await db.select().from(auditLogs).where(eq(auditLogs.proyectoId, proyecto.id));
      expect(eventos.map((e) => e.accion)).toContain('CORRECCION_CERRADA');

      await app.close();
    });

    it('rechaza (403) a un corrector intentando cerrar', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookieEspecialista = await registrarYLoguear(app, 'especialista');
      const meEspecialista = await request(app.server).get('/api/auth/me').set('Cookie', cookieEspecialista);
      const proyecto = await crearProyectoDePrueba({ especialistaId: meEspecialista.body.user.id });
      const correccionId = await solicitarCorreccionDePrueba(app, cookieEspecialista, proyecto.id);
      const cookieCorrector = await registrarYLoguear(app, 'corrector');

      const respuesta = await request(app.server)
        .patch(`/api/correcciones/${correccionId}/cierre`)
        .set('Cookie', cookieCorrector)
        .send({ resultado: 'buena' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('GET /api/correcciones/mias', () => {
    it('devuelve solo las correcciones asignadas al corrector que inicia sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookieEspecialista = await registrarYLoguear(app, 'especialista');
      const meEspecialista = await request(app.server).get('/api/auth/me').set('Cookie', cookieEspecialista);
      const proyecto = await crearProyectoDePrueba({ especialistaId: meEspecialista.body.user.id });
      const correccionId = await solicitarCorreccionDePrueba(app, cookieEspecialista, proyecto.id);

      const corrector = await crearUsuario('corrector');
      await request(app.server)
        .patch(`/api/correcciones/${correccionId}/asignar`)
        .set('Cookie', cookieEspecialista)
        .send({ correctorId: corrector.id, freelance: false, contratoConfirmado: true });

      // Otra corrección, otro corrector — no debe aparecer.
      const otroProyecto = await crearProyectoDePrueba({ especialistaId: meEspecialista.body.user.id });
      const otraCorreccionId = await solicitarCorreccionDePrueba(app, cookieEspecialista, otroProyecto.id, 'preliminares');
      const otroCorrector = await crearUsuario('corrector');
      await request(app.server)
        .patch(`/api/correcciones/${otraCorreccionId}/asignar`)
        .set('Cookie', cookieEspecialista)
        .send({ correctorId: otroCorrector.id, freelance: false, contratoConfirmado: true });

      const loginCorrector = await request(app.server).post('/api/auth/login').send({ email: corrector.email, password: 'password123' });
      const cookieCorrector = obtenerCookie(loginCorrector);

      const respuesta = await request(app.server).get('/api/correcciones/mias').set('Cookie', cookieCorrector);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.trabajos).toHaveLength(1);
      expect(respuesta.body.trabajos[0].id).toBe(correccionId);

      await app.close();
    });

    it('rechaza a un rol distinto de corrector', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const respuesta = await request(app.server).get('/api/correcciones/mias').set('Cookie', cookie);
      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('GET /api/correcciones/seguimiento', () => {
    it('permite a jefe_area ver todas las correcciones activas', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookieEspecialista = await registrarYLoguear(app, 'especialista');
      const meEspecialista = await request(app.server).get('/api/auth/me').set('Cookie', cookieEspecialista);
      const proyecto = await crearProyectoDePrueba({ especialistaId: meEspecialista.body.user.id });
      await solicitarCorreccionDePrueba(app, cookieEspecialista, proyecto.id);

      const cookieJefeArea = await registrarYLoguear(app, 'jefe_area');
      const respuesta = await request(app.server).get('/api/correcciones/seguimiento').set('Cookie', cookieJefeArea);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.correcciones.length).toBeGreaterThanOrEqual(1);
      await app.close();
    });

    it('rechaza a un rol distinto de jefe_area (ej. especialista)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const respuesta = await request(app.server).get('/api/correcciones/seguimiento').set('Cookie', cookie);
      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });
});
