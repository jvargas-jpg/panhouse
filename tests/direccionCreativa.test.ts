import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import { auditLogs, direccionesCreativas, fichaDisenoPropuestas, notificaciones, proyectos, workItems } from '../server/db/schema/index.js';
import { crearFichaTrazabilidad } from '../server/helpers/trazabilidad.js';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearProyectoDePrueba, crearServicio, crearUsuario } from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

function obtenerCookie(respuestaLogin: request.Response): string {
  const cookie = respuestaLogin.headers['set-cookie'];
  if (!cookie) throw new Error('El login no devolvió cookie de sesión');
  return cookie;
}

async function fijarTitulo(proyectoId: string, titulo = 'Título definitivo', subtitulo = 'Subtítulo definitivo') {
  await db.update(proyectos).set({ tituloDefinitivo: titulo, subtituloDefinitivo: subtitulo }).where(eq(proyectos.id, proyectoId));
}

async function crearProyectoConServicio(codigoServicio: string, especialistaId: string) {
  const servicio = await crearServicio({ codigo: codigoServicio, nombre: `Servicio ${codigoServicio}`, pesoComplejidad: 3, plazoDias: 150 });
  const proyecto = await crearProyectoDePrueba({ especialistaId });
  await db.update(proyectos).set({ servicioId: servicio.id }).where(eq(proyectos.id, proyecto.id));
  // Los conceptos de portada reutilizan ficha_diseno_propuestas (master
  // prompt 5C §10), que cuelga de fichas_trazabilidad — crearProyectoDePrueba
  // (fixture de inserción directa) no la crea, a diferencia de POST
  // /api/proyectos real.
  await crearFichaTrazabilidad(proyecto.id);
  return proyecto;
}

async function solicitarDireccionCreativaDePrueba(app: ReturnType<typeof crearAppDePrueba>, cookieEspecialista: string, proyectoId: string) {
  const respuesta = await request(app.server).post(`/api/proyectos/${proyectoId}/direccion-creativa`).set('Cookie', cookieEspecialista);
  return respuesta.body.id as string;
}

describe('Fase 5C — Dirección Creativa', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  describe('GATE-07 — momento de activación según servicio', () => {
    it('rechaza sin título definido, sin importar el servicio', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConServicio('SE', me.body.user.id);

      const respuesta = await request(app.server).post(`/api/proyectos/${proyecto.id}/direccion-creativa`).set('Cookie', cookie);
      expect(respuesta.status).toBe(400);
      await app.close();
    });

    it('Crudo (CR): rechaza con título pero sin feedback de tripa completa', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConServicio('CR', me.body.user.id);
      await fijarTitulo(proyecto.id);

      const respuesta = await request(app.server).post(`/api/proyectos/${proyecto.id}/direccion-creativa`).set('Cookie', cookie);
      expect(respuesta.status).toBe(400);
      await app.close();
    });

    it('Crudo (CR): permite una vez registrado el feedback de tripa completa', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConServicio('CR', me.body.user.id);
      await fijarTitulo(proyecto.id);
      await db.update(proyectos).set({ fechaFeedbackTripa: '2026-02-01' }).where(eq(proyectos.id, proyecto.id));

      const respuesta = await request(app.server).post(`/api/proyectos/${proyecto.id}/direccion-creativa`).set('Cookie', cookie);
      expect(respuesta.status).toBe(201);
      await app.close();
    });

    it('Sello (SE): permite con solo el título, sin depender de feedback de tripa', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConServicio('SE', me.body.user.id);
      await fijarTitulo(proyecto.id);

      const respuesta = await request(app.server).post(`/api/proyectos/${proyecto.id}/direccion-creativa`).set('Cookie', cookie);
      expect(respuesta.status).toBe(201);
      await app.close();
    });
  });

  describe('POST /api/proyectos/:id/direccion-creativa', () => {
    it('crea work item pendiente y notifica a lider_creativo', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConServicio('SE', me.body.user.id);
      await fijarTitulo(proyecto.id);

      await request(app.server).post(`/api/proyectos/${proyecto.id}/direccion-creativa`).set('Cookie', cookie);

      const [direccion] = await db.select().from(direccionesCreativas).where(eq(direccionesCreativas.proyectoId, proyecto.id));
      expect(direccion?.tipo).toBe('concepto_portada');

      const [wi] = await db.select().from(workItems).where(eq(workItems.id, direccion!.workItemId));
      expect(wi?.estado).toBe('pendiente');

      const notifs = await db.select().from(notificaciones).where(eq(notificaciones.rolDestino, 'lider_creativo'));
      expect(notifs).toHaveLength(1);

      await app.close();
    });

    it('idempotente: pedir dos veces no duplica la fila mientras el ciclo esté abierto', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConServicio('SE', me.body.user.id);
      await fijarTitulo(proyecto.id);

      const r1 = await request(app.server).post(`/api/proyectos/${proyecto.id}/direccion-creativa`).set('Cookie', cookie);
      const r2 = await request(app.server).post(`/api/proyectos/${proyecto.id}/direccion-creativa`).set('Cookie', cookie);
      expect(r1.body.id).toBe(r2.body.id);

      const filas = await db.select().from(direccionesCreativas).where(eq(direccionesCreativas.proyectoId, proyecto.id));
      expect(filas).toHaveLength(1);
      await app.close();
    });

    it('rechaza (403) a un especialista no asignado al proyecto (IDOR)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConServicio('SE', (await crearUsuario('especialista')).id);
      await fijarTitulo(proyecto.id);
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server).post(`/api/proyectos/${proyecto.id}/direccion-creativa`).set('Cookie', cookie);
      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('PATCH /api/direccion-creativa/:id/asignar', () => {
    async function prepararSolicitud(app: ReturnType<typeof crearAppDePrueba>) {
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConServicio('SE', me.body.user.id);
      await fijarTitulo(proyecto.id);
      const direccionId = await solicitarDireccionCreativaDePrueba(app, cookie, proyecto.id);
      return { cookie, proyecto, direccionId };
    }

    it('jefe_area puede asignar cualquier líder creativo', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const { direccionId, proyecto } = await prepararSolicitud(app);
      const lider = await crearUsuario('lider_creativo');
      const cookieJefeArea = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server)
        .patch(`/api/direccion-creativa/${direccionId}/asignar`)
        .set('Cookie', cookieJefeArea)
        .send({ liderCreativoId: lider.id });
      expect(respuesta.status).toBe(200);

      const [direccion] = await db.select().from(direccionesCreativas).where(eq(direccionesCreativas.id, direccionId));
      const [wi] = await db.select().from(workItems).where(eq(workItems.id, direccion!.workItemId));
      expect(wi?.estado).toBe('en_progreso');

      const eventos = await db.select().from(auditLogs).where(eq(auditLogs.proyectoId, proyecto.id));
      expect(eventos.map((e) => e.accion)).toContain('LIDER_CREATIVO_ASIGNADO');

      await app.close();
    });

    it('un líder creativo puede auto-asignarse (reclamar)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const { direccionId } = await prepararSolicitud(app);
      const cookieLider = await registrarYLoguear(app, 'lider_creativo');
      const meLider = await request(app.server).get('/api/auth/me').set('Cookie', cookieLider);

      const respuesta = await request(app.server)
        .patch(`/api/direccion-creativa/${direccionId}/asignar`)
        .set('Cookie', cookieLider)
        .send({ liderCreativoId: meLider.body.user.id });
      expect(respuesta.status).toBe(200);
      await app.close();
    });

    it('un líder creativo NO puede asignar a otro líder creativo', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const { direccionId } = await prepararSolicitud(app);
      const otroLider = await crearUsuario('lider_creativo');
      const cookieLider = await registrarYLoguear(app, 'lider_creativo');

      const respuesta = await request(app.server)
        .patch(`/api/direccion-creativa/${direccionId}/asignar`)
        .set('Cookie', cookieLider)
        .send({ liderCreativoId: otroLider.id });
      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('rechaza a un disenador — Dirección Creativa no comparte permisos con Diseñador', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const { direccionId } = await prepararSolicitud(app);
      const disenador = await crearUsuario('disenador');
      const cookieDisenador = await registrarYLoguear(app, 'disenador');

      const respuesta = await request(app.server)
        .patch(`/api/direccion-creativa/${direccionId}/asignar`)
        .set('Cookie', cookieDisenador)
        .send({ liderCreativoId: disenador.id });
      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('Ciclo completo: reunión -> brief -> brief-autor -> conceptos -> RRPP -> autor -> recursos -> cierre', () => {
    it('recorre el ciclo completo respetando GATE-08 y GATE-05 reusado', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookieEspecialista = await registrarYLoguear(app, 'especialista');
      const meEspecialista = await request(app.server).get('/api/auth/me').set('Cookie', cookieEspecialista);
      const proyecto = await crearProyectoConServicio('SE', meEspecialista.body.user.id);
      await fijarTitulo(proyecto.id);
      const direccionId = await solicitarDireccionCreativaDePrueba(app, cookieEspecialista, proyecto.id);

      const lider = await crearUsuario('lider_creativo');
      const loginLider = await request(app.server).post('/api/auth/login').send({ email: lider.email, password: 'password123' });
      const cookieLider = obtenerCookie(loginLider);

      // Auto-asignación (master prompt 5C §6: solo jefe_area o el propio
      // líder creativo pueden asignar — el especialista NO).
      await request(app.server).patch(`/api/direccion-creativa/${direccionId}/asignar`).set('Cookie', cookieLider).send({ liderCreativoId: lider.id });
      await request(app.server)
        .patch(`/api/direccion-creativa/${direccionId}/reunion`)
        .set('Cookie', cookieLider)
        .send({ fecha: '2026-02-01', realizada: true, enlaceGrabacion: 'https://drive.example/grabacion' });

      await request(app.server)
        .patch(`/api/direccion-creativa/${direccionId}/brief`)
        .set('Cookie', cookieLider)
        .send({ briefEnlace: 'https://drive.example/brief', fechaBriefEnviadoEspecialista: '2026-02-02' });

      // GATE-08: sin brief aprobado por el autor todavía, no se puede agregar concepto.
      const conceptoBloqueado = await request(app.server)
        .post(`/api/direccion-creativa/${direccionId}/propuestas`)
        .set('Cookie', cookieLider)
        .send({ descripcion: 'Concepto 1' });
      expect(conceptoBloqueado.status).toBe(400);

      await request(app.server)
        .patch(`/api/direccion-creativa/${direccionId}/brief-autor`)
        .set('Cookie', cookieEspecialista)
        .send({ fechaBriefEnviadoAutor: '2026-02-02', fechaBriefAprobadoAutor: '2026-02-03' });

      const notifLiderBrief = await db
        .select()
        .from(notificaciones)
        .where(eq(notificaciones.usuarioDestinoId, lider.id));
      expect(notifLiderBrief.some((n) => n.mensaje.includes('aprobó el brief'))).toBe(true);

      const conceptoOk = await request(app.server)
        .post(`/api/direccion-creativa/${direccionId}/propuestas`)
        .set('Cookie', cookieLider)
        .send({ descripcion: 'Concepto 1', enlace: 'https://drive.example/concepto1' });
      expect(conceptoOk.status).toBe(201);
      const propuestaId = conceptoOk.body.id as string;

      // GATE-05 reusado: sin aprobación RRPP, no se puede marcar enviada al autor.
      const cookieRrpp = await registrarYLoguear(app, 'rrpp');
      const envioBloqueado = await request(app.server)
        .patch(`/api/direccion-creativa/propuestas/${propuestaId}/autor`)
        .set('Cookie', cookieEspecialista)
        .send({ fechaEnviadaAutor: '2026-02-04' });
      expect(envioBloqueado.status).toBe(400);

      await request(app.server).patch(`/api/direccion-creativa/propuestas/${propuestaId}/rrpp`).set('Cookie', cookieRrpp).send({ aprobar: true });

      const envioOk = await request(app.server)
        .patch(`/api/direccion-creativa/propuestas/${propuestaId}/autor`)
        .set('Cookie', cookieEspecialista)
        .send({ fechaEnviadaAutor: '2026-02-04', fechaAprobadaAutor: '2026-02-05' });
      expect(envioOk.status).toBe(200);

      const notifLiderRecursos = await db.select().from(notificaciones).where(eq(notificaciones.usuarioDestinoId, lider.id));
      expect(notifLiderRecursos.some((n) => n.mensaje.includes('recursos'))).toBe(true);

      const recursosOk = await request(app.server)
        .patch(`/api/direccion-creativa/${direccionId}/recursos`)
        .set('Cookie', cookieLider)
        .send({ recursoImagenUrl: 'https://drive.example/imagen.jpg', recursoConceptoPdfUrl: 'https://drive.example/concepto.pdf' });
      expect(recursosOk.status).toBe(200);

      const cierre = await request(app.server)
        .patch(`/api/direccion-creativa/${direccionId}/cerrar`)
        .set('Cookie', cookieEspecialista)
        .send({ resultadoFinal: 'aprobado' });
      expect(cierre.status).toBe(200);

      const [direccionFinal] = await db.select().from(direccionesCreativas).where(eq(direccionesCreativas.id, direccionId));
      expect(direccionFinal?.resultadoFinal).toBe('aprobado');
      expect(direccionFinal?.fechaCierre).toBeTruthy();

      const [wiFinal] = await db.select().from(workItems).where(eq(workItems.id, direccionFinal!.workItemId));
      expect(wiFinal?.estado).toBe('completado');

      const eventos = await db.select().from(auditLogs).where(eq(auditLogs.proyectoId, proyecto.id));
      const acciones = eventos.map((e) => e.accion);
      expect(acciones).toEqual(
        expect.arrayContaining([
          'DIRECCION_CREATIVA_SOLICITADA',
          'LIDER_CREATIVO_ASIGNADO',
          'REUNION_CREATIVA_REGISTRADA',
          'BRIEF_CREATIVO_GENERADO',
          'BRIEF_CREATIVO_APROBADO',
          'CONCEPTOS_ENTREGADOS',
          'CONCEPTO_APROBADO_RRPP',
          'CONCEPTO_APROBADO_AUTOR',
          'RECURSOS_CREATIVOS_ENTREGADOS',
          'DIRECCION_CREATIVA_CERRADA',
        ]),
      );

      await app.close();
    });

    it('RRPP puede devolver un concepto — el líder creativo recibe la notificación', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookieEspecialista = await registrarYLoguear(app, 'especialista');
      const meEspecialista = await request(app.server).get('/api/auth/me').set('Cookie', cookieEspecialista);
      const proyecto = await crearProyectoConServicio('SE', meEspecialista.body.user.id);
      await fijarTitulo(proyecto.id);
      const direccionId = await solicitarDireccionCreativaDePrueba(app, cookieEspecialista, proyecto.id);

      const lider = await crearUsuario('lider_creativo');
      const loginLider = await request(app.server).post('/api/auth/login').send({ email: lider.email, password: 'password123' });
      const cookieLider = obtenerCookie(loginLider);
      await request(app.server).patch(`/api/direccion-creativa/${direccionId}/asignar`).set('Cookie', cookieLider).send({ liderCreativoId: lider.id });
      await request(app.server)
        .patch(`/api/direccion-creativa/${direccionId}/brief-autor`)
        .set('Cookie', cookieEspecialista)
        .send({ fechaBriefAprobadoAutor: '2026-02-03' });

      const concepto = await request(app.server).post(`/api/direccion-creativa/${direccionId}/propuestas`).set('Cookie', cookieLider).send({ descripcion: 'Concepto 1' });
      const propuestaId = concepto.body.id as string;

      const cookieRrpp = await registrarYLoguear(app, 'rrpp');
      const devolucion = await request(app.server)
        .patch(`/api/direccion-creativa/propuestas/${propuestaId}/rrpp`)
        .set('Cookie', cookieRrpp)
        .send({ aprobar: false, observaciones: 'Falta ajustar tipografía' });
      expect(devolucion.status).toBe(200);

      const [propuesta] = await db.select().from(fichaDisenoPropuestas).where(eq(fichaDisenoPropuestas.id, propuestaId));
      expect(propuesta?.fechaAprobadaRrpp).toBeNull();

      const notifs = await db.select().from(notificaciones).where(eq(notificaciones.usuarioDestinoId, lider.id));
      expect(notifs.some((n) => n.mensaje.includes('devolvió'))).toBe(true);

      await app.close();
    });

    it('rechaza (403) a un líder creativo no asignado a ESTA dirección creativa (IDOR)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookieEspecialista = await registrarYLoguear(app, 'especialista');
      const meEspecialista = await request(app.server).get('/api/auth/me').set('Cookie', cookieEspecialista);
      const proyecto = await crearProyectoConServicio('SE', meEspecialista.body.user.id);
      await fijarTitulo(proyecto.id);
      const direccionId = await solicitarDireccionCreativaDePrueba(app, cookieEspecialista, proyecto.id);

      const liderAsignado = await crearUsuario('lider_creativo');
      await request(app.server)
        .patch(`/api/direccion-creativa/${direccionId}/asignar`)
        .set('Cookie', cookieEspecialista)
        .send({ liderCreativoId: liderAsignado.id });

      const cookieOtroLider = await registrarYLoguear(app, 'lider_creativo');
      const respuesta = await request(app.server)
        .patch(`/api/direccion-creativa/${direccionId}/brief`)
        .set('Cookie', cookieOtroLider)
        .send({ briefEnlace: 'https://drive.example/brief' });
      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('rechaza (403) a un especialista de otro proyecto intentando cerrar (IDOR)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookieEspecialista = await registrarYLoguear(app, 'especialista');
      const meEspecialista = await request(app.server).get('/api/auth/me').set('Cookie', cookieEspecialista);
      const proyecto = await crearProyectoConServicio('SE', meEspecialista.body.user.id);
      await fijarTitulo(proyecto.id);
      const direccionId = await solicitarDireccionCreativaDePrueba(app, cookieEspecialista, proyecto.id);

      const cookieOtroEspecialista = await registrarYLoguear(app, 'especialista');
      const respuesta = await request(app.server)
        .patch(`/api/direccion-creativa/${direccionId}/cerrar`)
        .set('Cookie', cookieOtroEspecialista)
        .send({ resultadoFinal: 'aprobado' });
      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('GET /api/direccion-creativa/mias y /pendientes-rrpp', () => {
    it('mias devuelve solo las direcciones creativas del líder creativo asignado', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookieEspecialista = await registrarYLoguear(app, 'especialista');
      const meEspecialista = await request(app.server).get('/api/auth/me').set('Cookie', cookieEspecialista);
      const proyecto = await crearProyectoConServicio('SE', meEspecialista.body.user.id);
      await fijarTitulo(proyecto.id);
      const direccionId = await solicitarDireccionCreativaDePrueba(app, cookieEspecialista, proyecto.id);

      const lider = await crearUsuario('lider_creativo');
      const cookieJefeArea = await registrarYLoguear(app, 'jefe_area');
      await request(app.server).patch(`/api/direccion-creativa/${direccionId}/asignar`).set('Cookie', cookieJefeArea).send({ liderCreativoId: lider.id });

      const loginLider = await request(app.server).post('/api/auth/login').send({ email: lider.email, password: 'password123' });
      const respuesta = await request(app.server).get('/api/direccion-creativa/mias').set('Cookie', obtenerCookie(loginLider));
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.trabajos).toHaveLength(1);
      expect(respuesta.body.trabajos[0].id).toBe(direccionId);

      await app.close();
    });

    it('pendientes-rrpp devuelve solo los conceptos sin fechaAprobadaRrpp', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookieEspecialista = await registrarYLoguear(app, 'especialista');
      const meEspecialista = await request(app.server).get('/api/auth/me').set('Cookie', cookieEspecialista);
      const proyecto = await crearProyectoConServicio('SE', meEspecialista.body.user.id);
      await fijarTitulo(proyecto.id);
      const direccionId = await solicitarDireccionCreativaDePrueba(app, cookieEspecialista, proyecto.id);

      const lider = await crearUsuario('lider_creativo');
      const loginLider = await request(app.server).post('/api/auth/login').send({ email: lider.email, password: 'password123' });
      const cookieLider = obtenerCookie(loginLider);
      await request(app.server).patch(`/api/direccion-creativa/${direccionId}/asignar`).set('Cookie', cookieLider).send({ liderCreativoId: lider.id });
      await request(app.server)
        .patch(`/api/direccion-creativa/${direccionId}/brief-autor`)
        .set('Cookie', cookieEspecialista)
        .send({ fechaBriefAprobadoAutor: '2026-02-03' });
      await request(app.server).post(`/api/direccion-creativa/${direccionId}/propuestas`).set('Cookie', cookieLider).send({ descripcion: 'Concepto 1' });

      const cookieRrpp = await registrarYLoguear(app, 'rrpp');
      const respuesta = await request(app.server).get('/api/direccion-creativa/pendientes-rrpp').set('Cookie', cookieRrpp);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.propuestas).toHaveLength(1);
      expect(respuesta.body.propuestas[0].proyectoId).toBe(proyecto.id);

      await app.close();
    });

    it('rechaza a un rol distinto de lider_creativo en /mias', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const respuesta = await request(app.server).get('/api/direccion-creativa/mias').set('Cookie', cookie);
      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('rechaza a un rol distinto de rrpp en /pendientes-rrpp', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'lider_creativo');
      const respuesta = await request(app.server).get('/api/direccion-creativa/pendientes-rrpp').set('Cookie', cookie);
      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });
});
