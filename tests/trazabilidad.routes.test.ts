import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import { proyectosAutores } from '../server/db/schema/index.js';
import {
  actualizarBriefDiseno,
  actualizarSeccionProyectoContrato,
  actualizarSeccionProyectoPerfil,
  actualizarSeccionSoporteDigital,
  agregarFaseCalidad,
  agregarPaisDistribucion,
  agregarPropuestaDiseno,
  agregarReunionLanzamiento,
  crearFichaTrazabilidad,
} from '../server/helpers/trazabilidad.js';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import {
  crearAutor,
  crearPresupuesto,
  crearProyecto,
  crearProyectoDePrueba,
  crearServicio,
  crearUnidad,
} from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

async function crearProyectoConFicha() {
  const proyecto = await crearProyectoDePrueba();
  await crearFichaTrazabilidad(proyecto.id);
  return proyecto;
}

// Para las rutas de Diseño, que desde verificarAccesoAProyecto exigen
// que el disenador esté asignado en la columna disenadorId (mismo
// patrón que especialistaId/editorId) — crearProyectoConFicha() a
// propósito no asigna a nadie.
// Para PATCH /:proyectoId/diseno-control, que además del disenador
// también autoriza al especialista dueño del proyecto.
async function crearProyectoConFichaYEspecialista(especialistaId: string) {
  const proyecto = await crearProyectoDePrueba({ especialistaId });
  await crearFichaTrazabilidad(proyecto.id);
  return proyecto;
}

async function crearProyectoConFichaYDisenador(disenadorId: string) {
  const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
  const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
  const proyecto = await crearProyecto({
    autorId: autor.id,
    servicioId: servicio.id,
    unidadId: unidad.id,
    presupuestoId: presupuesto.id,
    disenadorId,
    fechaProgramadaInicio: '2026-01-01',
  });
  await crearFichaTrazabilidad(proyecto.id);
  return proyecto;
}

describe('rutas de la ficha de trazabilidad', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  describe('PATCH /api/fichas-trazabilidad/:proyectoId/proyecto-perfil', () => {
    it.each(['rrpp', 'comercial', 'jefe_area'] as const)('permite a %s editar el perfil del autor (sección 1)', async (rol) => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, rol);

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/proyecto-perfil`)
        .set('Cookie', cookie)
        .send({ ingresoObservaciones: 'Autor primerizo' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.ingresoObservaciones).toBe('Autor primerizo');
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/proyecto-perfil`)
        .send({ ingresoObservaciones: 'Autor primerizo' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin relación con esta sección (ej. especialista)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/proyecto-perfil`)
        .set('Cookie', cookie)
        .send({ ingresoObservaciones: 'Autor primerizo' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('PATCH /api/fichas-trazabilidad/:proyectoId/proyecto-contrato', () => {
    it('permite a comercial editar capítulos/páginas pactados (sección 1)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/proyecto-contrato`)
        .set('Cookie', cookie)
        .send({ capitulosPactados: '6 a 10', paginasPactadas: '150' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.capitulosPactados).toBe('6 a 10');
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/proyecto-contrato`)
        .send({ capitulosPactados: '6 a 10' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a rrpp (dueño del resto de la sección, pero no del contrato)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/proyecto-contrato`)
        .set('Cookie', cookie)
        .send({ capitulosPactados: '6 a 10' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('PATCH /api/fichas-trazabilidad/:proyectoId/edicion', () => {
    it('permite a un especialista editar la sección de Edición', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/edicion`)
        .set('Cookie', cookie)
        .send({
          edicionEstatus: 'En revisión por editor',
          edicionFechaEnvioEditor: '2026-03-01',
          edicionFechaRecepcionEditor: '2026-03-05',
          edicionFechaEnvioAutor: '2026-03-06',
          edicionFechaAprobacionAutor: null,
          edicionObservaciones: 'A la espera del autor.',
        });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.edicionEstatus).toBe('En revisión por editor');
      expect(respuesta.body.ficha.edicionFechaEnvioEditor).toBe('2026-03-01');
      expect(respuesta.body.ficha.edicionObservaciones).toBe('A la espera del autor.');
      await app.close();
    });

    it('devuelve 400 (no 500) si el body no trae ningún campo reconocido', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/edicion`)
        .set('Cookie', cookie)
        .send({ campoQueNoExiste: 'x' });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toBe('Datos inválidos');
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/edicion`)
        .send({ edicionEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol distinto de especialista (ej. comercial)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/edicion`)
        .set('Cookie', cookie)
        .send({ edicionEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('PATCH /api/fichas-trazabilidad/:proyectoId/correccion', () => {
    it('permite a un especialista editar la sección de Corrección', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/correccion`)
        .set('Cookie', cookie)
        .send({ correccionTripaCompleta: 'Aprobado' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.correccionTripaCompleta).toBe('Aprobado');
      await app.close();
    });

    it('devuelve 400 (no 500) si el body no trae ningún campo reconocido', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/correccion`)
        .set('Cookie', cookie)
        .send({ campoQueNoExiste: 'x' });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toBe('Datos inválidos');
      await app.close();
    });

    it('permite guardar el estatus agregado que conecta con la matriz de tiempos de jefatura', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/correccion`)
        .set('Cookie', cookie)
        .send({
          correccionEstatus: 'En proceso',
          correccionTipoAsignacion: 'Tripa Completa',
          correccionFechaEnvio: '2026-03-01',
          correccionFechaInicio: '2026-03-02',
          correccionFechaEntrega: '2026-03-06',
          correccionTotalDias: '4.00',
          correccionObservaciones: 'Sin novedad.',
        });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.correccionEstatus).toBe('En proceso');
      expect(respuesta.body.ficha.correccionTipoAsignacion).toBe('Tripa Completa');
      expect(respuesta.body.ficha.correccionTotalDias).toBe('4.00');
      await app.close();
    });

    it('permite guardar fecha de entrega y aprobado por cada una de las tres categorías', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/correccion`)
        .set('Cookie', cookie)
        .send({
          correccionTripaCompletaFechaEntrega: '2026-03-01',
          correccionTripaCompletaAprobado: true,
          correccionPreliminaresFechaEntrega: '2026-03-05',
          correccionPreliminaresAprobado: false,
          correccionCubiertaExtendidaFechaEntrega: '2026-03-10',
          correccionCubiertaExtendidaAprobado: null,
        });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.correccionTripaCompletaFechaEntrega).toBe('2026-03-01');
      expect(respuesta.body.ficha.correccionTripaCompletaAprobado).toBe(true);
      expect(respuesta.body.ficha.correccionPreliminaresFechaEntrega).toBe('2026-03-05');
      expect(respuesta.body.ficha.correccionPreliminaresAprobado).toBe(false);
      expect(respuesta.body.ficha.correccionCubiertaExtendidaFechaEntrega).toBe('2026-03-10');
      expect(respuesta.body.ficha.correccionCubiertaExtendidaAprobado).toBeNull();
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/correccion`)
        .send({ correccionTripaCompleta: 'Aprobado' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a soporte_editorial (recibe la validación de textos diagramados, no los resultados de corrección)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'soporte_editorial');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/correccion`)
        .set('Cookie', cookie)
        .send({ correccionTripaCompleta: 'Aprobado' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('PATCH /api/fichas-trazabilidad/:proyectoId/diseno-control', () => {
    it('permite al especialista dueño del proyecto editar el control de diseño', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConFichaYEspecialista(me.body.user.id);

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno-control`)
        .set('Cookie', cookie)
        .send({ disenoEstatus: 'Creando bocetos', disenoTotalDias: '2.50' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.disenoEstatus).toBe('Creando bocetos');
      expect(respuesta.body.ficha.disenoTotalDias).toBe('2.50');
      await app.close();
    });

    it('permite al disenador asignado editar el control de diseño', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'disenador');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConFichaYDisenador(me.body.user.id);

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno-control`)
        .set('Cookie', cookie)
        .send({ disenoEstatus: 'En revisión por autor' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.disenoEstatus).toBe('En revisión por autor');
      await app.close();
    });

    it('rechaza a un especialista que no es dueño del proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha(); // sin especialista asignado
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno-control`)
        .set('Cookie', cookie)
        .send({ disenoEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('rechaza a un disenador que no es el asignado del proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha(); // sin disenador asignado
      const cookie = await registrarYLoguear(app, 'disenador');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno-control`)
        .set('Cookie', cookie)
        .send({ disenoEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('devuelve 400 (no 500) si el body no trae ningún campo reconocido', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConFichaYEspecialista(me.body.user.id);

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno-control`)
        .set('Cookie', cookie)
        .send({ campoQueNoExiste: 'x' });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toBe('Datos inválidos');
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno-control`)
        .send({ disenoEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin relación con esta sección (ej. rrpp)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno-control`)
        .set('Cookie', cookie)
        .send({ disenoEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('PATCH /api/fichas-trazabilidad/:proyectoId/diseno/brief', () => {
    it('permite a un diseñador editar el brief creativo de su propio proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'disenador');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConFichaYDisenador(me.body.user.id);

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno/brief`)
        .set('Cookie', cookie)
        .send({ disenoBriefCreativo: 'Portada minimalista' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.disenoBriefCreativo).toBe('Portada minimalista');
      await app.close();
    });

    it('rechaza a un diseñador editar el brief de un proyecto que no tiene asignado', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha(); // sin disenador asignado
      const cookie = await registrarYLoguear(app, 'disenador');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno/brief`)
        .set('Cookie', cookie)
        .send({ disenoBriefCreativo: 'Portada minimalista' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('permite también a líder creativo editar el brief', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'lider_creativo');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno/brief`)
        .set('Cookie', cookie)
        .send({ disenoBriefCreativo: 'Portada minimalista' });

      expect(respuesta.status).toBe(200);
      await app.close();
    });

    it('permite guardar tipo de portada y las fechas del brief (reunión creativa, entrega y aprobación)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'disenador');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConFichaYDisenador(me.body.user.id);

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno/brief`)
        .set('Cookie', cookie)
        .send({
          disenoTipoPortada: 'ilustrada',
          disenoFechaReunionCreativa: '2026-03-01',
          disenoFechaEntregaBrief: '2026-03-05',
          disenoBriefAprobadoFecha: '2026-03-10',
        });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.disenoTipoPortada).toBe('ilustrada');
      expect(respuesta.body.ficha.disenoFechaReunionCreativa).toBe('2026-03-01');
      expect(respuesta.body.ficha.disenoFechaEntregaBrief).toBe('2026-03-05');
      expect(respuesta.body.ficha.disenoBriefAprobadoFecha).toBe('2026-03-10');
      await app.close();
    });

    it('devuelve 400 (no 500) si el body no trae ningún campo reconocido', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'disenador');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConFichaYDisenador(me.body.user.id);

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno/brief`)
        .set('Cookie', cookie)
        .send({ campoQueNoExiste: 'x' });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toBe('Datos inválidos');
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno/brief`)
        .send({ briefCreativo: 'Portada minimalista' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin permiso sobre Diseño', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno/brief`)
        .set('Cookie', cookie)
        .send({ disenoBriefCreativo: 'Portada minimalista' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('POST /api/fichas-trazabilidad/:proyectoId/diseno/propuestas', () => {
    it('permite a un diseñador agregar una propuesta de portada a su propio proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'disenador');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConFichaYDisenador(me.body.user.id);

      const respuesta = await request(app.server)
        .post(`/api/fichas-trazabilidad/${proyecto.id}/diseno/propuestas`)
        .set('Cookie', cookie)
        .send({ descripcion: 'Propuesta A', fechaEnviadaEspecialista: '2026-03-01' });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.propuesta.descripcion).toBe('Propuesta A');
      expect(respuesta.body.propuesta.fechaEnviadaEspecialista).toBe('2026-03-01');
      await app.close();
    });

    it('rechaza a un diseñador agregar una propuesta a un proyecto que no tiene asignado', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha(); // sin disenador asignado
      const cookie = await registrarYLoguear(app, 'disenador');

      const respuesta = await request(app.server)
        .post(`/api/fichas-trazabilidad/${proyecto.id}/diseno/propuestas`)
        .set('Cookie', cookie)
        .send({ descripcion: 'Propuesta A' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('permite guardar fecha enviada al autor, fecha aprobada por el autor y estado', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'disenador');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConFichaYDisenador(me.body.user.id);

      const respuesta = await request(app.server)
        .post(`/api/fichas-trazabilidad/${proyecto.id}/diseno/propuestas`)
        .set('Cookie', cookie)
        .send({
          descripcion: 'Propuesta B',
          fechaEnviadaAutor: '2026-03-08',
          fechaAprobadaAutor: '2026-03-12',
          estado: 'aprobadas',
        });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.propuesta.fechaEnviadaAutor).toBe('2026-03-08');
      expect(respuesta.body.propuesta.fechaAprobadaAutor).toBe('2026-03-12');
      expect(respuesta.body.propuesta.estado).toBe('aprobadas');
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();

      const respuesta = await request(app.server)
        .post(`/api/fichas-trazabilidad/${proyecto.id}/diseno/propuestas`)
        .send({ descripcion: 'Propuesta A' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin permiso sobre Diseño', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .post(`/api/fichas-trazabilidad/${proyecto.id}/diseno/propuestas`)
        .set('Cookie', cookie)
        .send({ descripcion: 'Propuesta A' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('PATCH /api/fichas-trazabilidad/:proyectoId/diseno/propuestas/:propuestaId', () => {
    it('permite a un diseñador editar una propuesta existente de su propio proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'disenador');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConFichaYDisenador(me.body.user.id);
      const propuesta = await agregarPropuestaDiseno(proyecto.id, { descripcion: 'Propuesta A', fechaEnviadaEspecialista: '2026-03-01' });

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno/propuestas/${propuesta.id}`)
        .set('Cookie', cookie)
        .send({ descripcion: 'Propuesta A corregida' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.propuesta.descripcion).toBe('Propuesta A corregida');
      await app.close();
    });

    it('rechaza a un diseñador editar una propuesta de un proyecto que no tiene asignado', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha(); // sin disenador asignado
      const propuesta = await agregarPropuestaDiseno(proyecto.id, { descripcion: 'Propuesta A' });
      const cookie = await registrarYLoguear(app, 'disenador');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno/propuestas/${propuesta.id}`)
        .set('Cookie', cookie)
        .send({ descripcion: 'intento no autorizado' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('devuelve 404 si la propuesta pertenece a otro proyecto (no solo por rol)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyectoAjeno = await crearProyectoConFicha();
      const propuestaAjena = await agregarPropuestaDiseno(proyectoAjeno.id, { descripcion: 'Propuesta ajena' });
      const cookie = await registrarYLoguear(app, 'disenador');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      // El disenador SÍ es dueño de "proyecto" (pasa verificarAccesoAProyecto),
      // pero la propuesta que intenta tocar pertenece a otra ficha — el 404
      // debe venir del scope por fichaId dentro del helper, no del chequeo de acceso.
      const proyecto = await crearProyectoConFichaYDisenador(me.body.user.id);

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno/propuestas/${propuestaAjena.id}`)
        .set('Cookie', cookie)
        .send({ descripcion: 'intento de edición cruzada' });

      expect(respuesta.status).toBe(404);
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const propuesta = await agregarPropuestaDiseno(proyecto.id, { descripcion: 'Propuesta A' });

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno/propuestas/${propuesta.id}`)
        .send({ descripcion: 'x' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin ningún permiso sobre la ficha (ej. cobranzas)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const propuesta = await agregarPropuestaDiseno(proyecto.id, { descripcion: 'Propuesta A' });
      const cookie = await registrarYLoguear(app, 'cobranzas');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno/propuestas/${propuesta.id}`)
        .set('Cookie', cookie)
        .send({ descripcion: 'x' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('rechaza a un rol dueño de otra sección de la ficha (ej. rrpp, no de Diseño)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const propuesta = await agregarPropuestaDiseno(proyecto.id, { descripcion: 'Propuesta A' });
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/diseno/propuestas/${propuesta.id}`)
        .set('Cookie', cookie)
        .send({ descripcion: 'x' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('DELETE /api/fichas-trazabilidad/:proyectoId/diseno/propuestas/:propuestaId', () => {
    it('permite a un diseñador borrar una propuesta existente de su propio proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'disenador');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConFichaYDisenador(me.body.user.id);
      const propuesta = await agregarPropuestaDiseno(proyecto.id, { descripcion: 'Propuesta A' });

      const respuesta = await request(app.server)
        .delete(`/api/fichas-trazabilidad/${proyecto.id}/diseno/propuestas/${propuesta.id}`)
        .set('Cookie', cookie);

      expect(respuesta.status).toBe(200);

      const ficha = await request(app.server).get(`/api/fichas-trazabilidad/${proyecto.id}`).set('Cookie', cookie);
      expect(ficha.body.ficha.disenoPropuestas).toHaveLength(0);
      await app.close();
    });

    it('rechaza a un diseñador borrar una propuesta de un proyecto que no tiene asignado', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha(); // sin disenador asignado
      const propuesta = await agregarPropuestaDiseno(proyecto.id, { descripcion: 'Propuesta A' });
      const cookie = await registrarYLoguear(app, 'disenador');

      const respuesta = await request(app.server)
        .delete(`/api/fichas-trazabilidad/${proyecto.id}/diseno/propuestas/${propuesta.id}`)
        .set('Cookie', cookie);

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const propuesta = await agregarPropuestaDiseno(proyecto.id, { descripcion: 'Propuesta A' });

      const respuesta = await request(app.server).delete(`/api/fichas-trazabilidad/${proyecto.id}/diseno/propuestas/${propuesta.id}`);

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin ningún permiso sobre la ficha (ej. cobranzas)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const propuesta = await agregarPropuestaDiseno(proyecto.id, { descripcion: 'Propuesta A' });
      const cookie = await registrarYLoguear(app, 'cobranzas');

      const respuesta = await request(app.server)
        .delete(`/api/fichas-trazabilidad/${proyecto.id}/diseno/propuestas/${propuesta.id}`)
        .set('Cookie', cookie);

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('rechaza a un rol dueño de otra sección de la ficha (ej. rrpp, no de Diseño)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const propuesta = await agregarPropuestaDiseno(proyecto.id, { descripcion: 'Propuesta A' });
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .delete(`/api/fichas-trazabilidad/${proyecto.id}/diseno/propuestas/${propuesta.id}`)
        .set('Cookie', cookie);

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('PATCH /api/fichas-trazabilidad/:proyectoId/calidad-control', () => {
    it('permite al especialista dueño del proyecto editar el control de calidad', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConFichaYEspecialista(me.body.user.id);

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/calidad-control`)
        .set('Cookie', cookie)
        .send({ calidadEstatus: 'En revisión', calidadTotalDias: '3.00' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.calidadEstatus).toBe('En revisión');
      expect(respuesta.body.ficha.calidadTotalDias).toBe('3.00');
      await app.close();
    });

    it('permite a cualquier soporte_editorial editar el control de calidad (acceso de grupo, ya no hay dueño individual)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'soporte_editorial');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/calidad-control`)
        .set('Cookie', cookie)
        .send({ calidadEstatus: 'Aprobado' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.calidadEstatus).toBe('Aprobado');
      await app.close();
    });

    it('rechaza a un especialista que no es dueño del proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha(); // sin especialista asignado
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/calidad-control`)
        .set('Cookie', cookie)
        .send({ calidadEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('devuelve 400 (no 500) si el body no trae ningún campo reconocido', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConFichaYEspecialista(me.body.user.id);

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/calidad-control`)
        .set('Cookie', cookie)
        .send({ campoQueNoExiste: 'x' });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toBe('Datos inválidos');
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/calidad-control`)
        .send({ calidadEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin relación con esta sección (ej. rrpp)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/calidad-control`)
        .set('Cookie', cookie)
        .send({ calidadEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('POST /api/fichas-trazabilidad/:proyectoId/calidad/fases', () => {
    it('permite a soporte_editorial registrar una fase de calidad', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'soporte_editorial');

      const respuesta = await request(app.server)
        .post(`/api/fichas-trazabilidad/${proyecto.id}/calidad/fases`)
        .set('Cookie', cookie)
        .send({ numeroFase: 1, pdfUrl: 'https://drive.example/f1' });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.fase.numeroFase).toBe(1);
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();

      const respuesta = await request(app.server)
        .post(`/api/fichas-trazabilidad/${proyecto.id}/calidad/fases`)
        .send({ numeroFase: 1 });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin permiso sobre Calidad', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .post(`/api/fichas-trazabilidad/${proyecto.id}/calidad/fases`)
        .set('Cookie', cookie)
        .send({ numeroFase: 1 });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('PATCH /api/fichas-trazabilidad/:proyectoId/calidad/fases/:faseId', () => {
    it('permite a soporte_editorial editar una fase existente', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const fase = await agregarFaseCalidad(proyecto.id, { numeroFase: 1, pdfVersion: 'v1' });
      const cookie = await registrarYLoguear(app, 'soporte_editorial');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/calidad/fases/${fase.id}`)
        .set('Cookie', cookie)
        .send({ numeroFase: 1, pdfVersion: 'v2', aprobado: true });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.fase.pdfVersion).toBe('v2');
      expect(respuesta.body.fase.aprobado).toBe(true);
      await app.close();
    });

    it('devuelve 404 si la fase pertenece a otro proyecto (no solo por rol)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyectoAjeno = await crearProyectoConFicha();
      const faseAjena = await agregarFaseCalidad(proyectoAjeno.id, { numeroFase: 1 });
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'soporte_editorial');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/calidad/fases/${faseAjena.id}`)
        .set('Cookie', cookie)
        .send({ numeroFase: 1, pdfVersion: 'intento cruzado' });

      expect(respuesta.status).toBe(404);
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const fase = await agregarFaseCalidad(proyecto.id, { numeroFase: 1 });

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/calidad/fases/${fase.id}`)
        .send({ numeroFase: 1 });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin ningún permiso sobre la ficha (ej. cobranzas)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const fase = await agregarFaseCalidad(proyecto.id, { numeroFase: 1 });
      const cookie = await registrarYLoguear(app, 'cobranzas');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/calidad/fases/${fase.id}`)
        .set('Cookie', cookie)
        .send({ numeroFase: 1 });

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('rechaza a un rol dueño de otra sección de la ficha (ej. especialista, no de Calidad)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const fase = await agregarFaseCalidad(proyecto.id, { numeroFase: 1 });
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/calidad/fases/${fase.id}`)
        .set('Cookie', cookie)
        .send({ numeroFase: 1 });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('DELETE /api/fichas-trazabilidad/:proyectoId/calidad/fases/:faseId', () => {
    it('permite a soporte_editorial borrar una fase existente', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const fase = await agregarFaseCalidad(proyecto.id, { numeroFase: 1 });
      const cookie = await registrarYLoguear(app, 'soporte_editorial');

      const respuesta = await request(app.server)
        .delete(`/api/fichas-trazabilidad/${proyecto.id}/calidad/fases/${fase.id}`)
        .set('Cookie', cookie);

      expect(respuesta.status).toBe(200);

      const ficha = await request(app.server).get(`/api/fichas-trazabilidad/${proyecto.id}`).set('Cookie', cookie);
      expect(ficha.body.ficha.calidadFases).toHaveLength(0);
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const fase = await agregarFaseCalidad(proyecto.id, { numeroFase: 1 });

      const respuesta = await request(app.server).delete(`/api/fichas-trazabilidad/${proyecto.id}/calidad/fases/${fase.id}`);

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin ningún permiso sobre la ficha (ej. cobranzas)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const fase = await agregarFaseCalidad(proyecto.id, { numeroFase: 1 });
      const cookie = await registrarYLoguear(app, 'cobranzas');

      const respuesta = await request(app.server)
        .delete(`/api/fichas-trazabilidad/${proyecto.id}/calidad/fases/${fase.id}`)
        .set('Cookie', cookie);

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('rechaza a un rol dueño de otra sección de la ficha (ej. especialista, no de Calidad)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const fase = await agregarFaseCalidad(proyecto.id, { numeroFase: 1 });
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .delete(`/api/fichas-trazabilidad/${proyecto.id}/calidad/fases/${fase.id}`)
        .set('Cookie', cookie);

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('PATCH /api/fichas-trazabilidad/:proyectoId/digital-control', () => {
    it('permite al especialista dueño del proyecto editar el control digital', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConFichaYEspecialista(me.body.user.id);

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/digital-control`)
        .set('Cookie', cookie)
        .send({ digitalEstatus: 'Maquetando ePub', digitalTotalDias: '2.00' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.digitalEstatus).toBe('Maquetando ePub');
      expect(respuesta.body.ficha.digitalTotalDias).toBe('2.00');
      await app.close();
    });

    it('permite a cualquier soporte_digital editar el control digital (acceso de grupo, ya no hay dueño individual)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'soporte_digital');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/digital-control`)
        .set('Cookie', cookie)
        .send({ digitalEstatus: 'Completado' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.digitalEstatus).toBe('Completado');
      await app.close();
    });

    it('rechaza a un especialista que no es dueño del proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha(); // sin especialista asignado
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/digital-control`)
        .set('Cookie', cookie)
        .send({ digitalEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('devuelve 400 (no 500) si el body no trae ningún campo reconocido', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConFichaYEspecialista(me.body.user.id);

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/digital-control`)
        .set('Cookie', cookie)
        .send({ campoQueNoExiste: 'x' });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toBe('Datos inválidos');
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/digital-control`)
        .send({ digitalEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin relación con esta sección (ej. rrpp)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/digital-control`)
        .set('Cookie', cookie)
        .send({ digitalEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('PATCH /api/fichas-trazabilidad/:proyectoId/soporte-digital', () => {
    it('permite a soporte_digital editar la sección', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'soporte_digital');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/soporte-digital`)
        .set('Cookie', cookie)
        .send({ soporteDigitalCuentaAmazon: 'cuenta@panhouse.test' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.soporteDigitalCuentaAmazon).toBe('cuenta@panhouse.test');
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/soporte-digital`)
        .send({ soporteDigitalCuentaAmazon: 'cuenta@panhouse.test' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol distinto de soporte_digital', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'soporte_editorial');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/soporte-digital`)
        .set('Cookie', cookie)
        .send({ soporteDigitalCuentaAmazon: 'cuenta@panhouse.test' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('PATCH /api/fichas-trazabilidad/:proyectoId/lanzamiento-control', () => {
    it('permite al especialista dueño del proyecto editar el control de lanzamiento', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConFichaYEspecialista(me.body.user.id);

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/lanzamiento-control`)
        .set('Cookie', cookie)
        .send({ lanzamientoEstatus: 'Tramitando ISBN', lanzamientoTotalDias: '1.50' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.lanzamientoEstatus).toBe('Tramitando ISBN');
      expect(respuesta.body.ficha.lanzamientoTotalDias).toBe('1.50');
      await app.close();
    });

    it('permite a cualquier rrpp editar el control de lanzamiento (acceso de grupo, ya no hay dueño individual)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/lanzamiento-control`)
        .set('Cookie', cookie)
        .send({ lanzamientoEstatus: 'Publicado' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.lanzamientoEstatus).toBe('Publicado');
      await app.close();
    });

    it('rechaza a un especialista que no es dueño del proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha(); // sin especialista asignado
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/lanzamiento-control`)
        .set('Cookie', cookie)
        .send({ lanzamientoEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('devuelve 400 (no 500) si el body no trae ningún campo reconocido', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConFichaYEspecialista(me.body.user.id);

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/lanzamiento-control`)
        .set('Cookie', cookie)
        .send({ campoQueNoExiste: 'x' });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toBe('Datos inválidos');
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/lanzamiento-control`)
        .send({ lanzamientoEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin relación con esta sección (ej. soporte_digital)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'soporte_digital');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/lanzamiento-control`)
        .set('Cookie', cookie)
        .send({ lanzamientoEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('POST /api/fichas-trazabilidad/:proyectoId/lanzamiento/reuniones', () => {
    it('permite a rrpp registrar una reunión de lanzamiento', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .post(`/api/fichas-trazabilidad/${proyecto.id}/lanzamiento/reuniones`)
        .set('Cookie', cookie)
        .send({ fecha: '2026-05-01', puntosTratados: 'Impresión y ferias' });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.reunion.puntosTratados).toBe('Impresión y ferias');
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();

      const respuesta = await request(app.server)
        .post(`/api/fichas-trazabilidad/${proyecto.id}/lanzamiento/reuniones`)
        .send({ fecha: '2026-05-01' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol distinto de rrpp', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server)
        .post(`/api/fichas-trazabilidad/${proyecto.id}/lanzamiento/reuniones`)
        .set('Cookie', cookie)
        .send({ fecha: '2026-05-01' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('PATCH /api/fichas-trazabilidad/:proyectoId/lanzamiento/reuniones/:reunionId', () => {
    it('permite a rrpp editar una reunión existente', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const reunion = await agregarReunionLanzamiento(proyecto.id, { fecha: '2026-05-01', puntosTratados: 'Borrador' });
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/lanzamiento/reuniones/${reunion.id}`)
        .set('Cookie', cookie)
        .send({ puntosTratados: 'Puntos corregidos' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.reunion.puntosTratados).toBe('Puntos corregidos');
      await app.close();
    });

    it('devuelve 404 si la reunión pertenece a otro proyecto (no solo por rol)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyectoAjeno = await crearProyectoConFicha();
      const reunionAjena = await agregarReunionLanzamiento(proyectoAjeno.id, { fecha: '2026-05-01' });
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/lanzamiento/reuniones/${reunionAjena.id}`)
        .set('Cookie', cookie)
        .send({ puntosTratados: 'intento cruzado' });

      expect(respuesta.status).toBe(404);
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const reunion = await agregarReunionLanzamiento(proyecto.id, { fecha: '2026-05-01' });

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/lanzamiento/reuniones/${reunion.id}`)
        .send({ puntosTratados: 'x' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin ningún permiso sobre la ficha (ej. cobranzas)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const reunion = await agregarReunionLanzamiento(proyecto.id, { fecha: '2026-05-01' });
      const cookie = await registrarYLoguear(app, 'cobranzas');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/lanzamiento/reuniones/${reunion.id}`)
        .set('Cookie', cookie)
        .send({ puntosTratados: 'x' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('rechaza a un rol dueño de otra sección de la ficha (ej. comercial, no de Lanzamiento)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const reunion = await agregarReunionLanzamiento(proyecto.id, { fecha: '2026-05-01' });
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/lanzamiento/reuniones/${reunion.id}`)
        .set('Cookie', cookie)
        .send({ puntosTratados: 'x' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('DELETE /api/fichas-trazabilidad/:proyectoId/lanzamiento/reuniones/:reunionId', () => {
    it('permite a rrpp borrar una reunión existente', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const reunion = await agregarReunionLanzamiento(proyecto.id, { fecha: '2026-05-01' });
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .delete(`/api/fichas-trazabilidad/${proyecto.id}/lanzamiento/reuniones/${reunion.id}`)
        .set('Cookie', cookie);

      expect(respuesta.status).toBe(200);

      const ficha = await request(app.server).get(`/api/fichas-trazabilidad/${proyecto.id}`).set('Cookie', cookie);
      expect(ficha.body.ficha.lanzamientoReuniones).toHaveLength(0);
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const reunion = await agregarReunionLanzamiento(proyecto.id, { fecha: '2026-05-01' });

      const respuesta = await request(app.server).delete(`/api/fichas-trazabilidad/${proyecto.id}/lanzamiento/reuniones/${reunion.id}`);

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin ningún permiso sobre la ficha (ej. cobranzas)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const reunion = await agregarReunionLanzamiento(proyecto.id, { fecha: '2026-05-01' });
      const cookie = await registrarYLoguear(app, 'cobranzas');

      const respuesta = await request(app.server)
        .delete(`/api/fichas-trazabilidad/${proyecto.id}/lanzamiento/reuniones/${reunion.id}`)
        .set('Cookie', cookie);

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('rechaza a un rol dueño de otra sección de la ficha (ej. comercial, no de Lanzamiento)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const reunion = await agregarReunionLanzamiento(proyecto.id, { fecha: '2026-05-01' });
      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server)
        .delete(`/api/fichas-trazabilidad/${proyecto.id}/lanzamiento/reuniones/${reunion.id}`)
        .set('Cookie', cookie);

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('PATCH /api/fichas-trazabilidad/:proyectoId/impresion', () => {
    it('permite a rrpp editar el control agregado (macro) junto a los campos existentes', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/impresion`)
        .set('Cookie', cookie)
        .send({ impresionEstatus: 'En imprenta', impresionTotalDias: '5.00', impresionResponsable: 'Imprenta Central' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.impresionEstatus).toBe('En imprenta');
      expect(respuesta.body.ficha.impresionTotalDias).toBe('5.00');
      expect(respuesta.body.ficha.impresionResponsable).toBe('Imprenta Central');
      await app.close();
    });

    it('rechaza a jefe_area editar el control de impresión (solo puede ver, es sección exclusiva de rrpp)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/impresion`)
        .set('Cookie', cookie)
        .send({ impresionEstatus: 'Completado' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('devuelve 400 (no 500) si el body no trae ningún campo reconocido', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/impresion`)
        .set('Cookie', cookie)
        .send({ campoQueNoExiste: 'x' });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toBe('Datos inválidos');
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/impresion`)
        .send({ impresionEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin relación con esta sección (ej. soporte_digital)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'soporte_digital');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/impresion`)
        .set('Cookie', cookie)
        .send({ impresionEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  // Las 4 secciones de abajo (ficha-editorial, matriz-ingreso,
  // lanzamiento-promocion, matriz-asesorias) son, igual que impresion
  // arriba, propiedad exclusiva de rrpp: jefe_area las ve (GET
  // /:proyectoId, ya cubierto en otro describe) pero no las edita. Solo
  // se prueba el rechazo de jefe_area — no había tests de escritura para
  // estas rutas antes de este cambio.
  describe.each(['ficha-editorial', 'matriz-ingreso', 'lanzamiento-promocion', 'matriz-asesorias'] as const)(
    'PATCH /api/fichas-trazabilidad/:proyectoId/%s',
    (ruta) => {
      it('rechaza a jefe_area (solo puede ver, es sección exclusiva de rrpp)', async () => {
        const app = crearAppDePrueba();
        await app.ready();
        const proyecto = await crearProyectoConFicha();
        const cookie = await registrarYLoguear(app, 'jefe_area');

        const respuesta = await request(app.server).patch(`/api/fichas-trazabilidad/${proyecto.id}/${ruta}`).set('Cookie', cookie).send({});

        expect(respuesta.status).toBe(403);
        await app.close();
      });
    },
  );

  describe('PATCH /api/fichas-trazabilidad/:proyectoId/distribucion-control', () => {
    it('permite al especialista dueño del proyecto editar el control de distribución', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConFichaYEspecialista(me.body.user.id);

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/distribucion-control`)
        .set('Cookie', cookie)
        .send({ distribucionEstatus: 'En tránsito', distribucionTotalDias: '4.00' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.distribucionEstatus).toBe('En tránsito');
      expect(respuesta.body.ficha.distribucionTotalDias).toBe('4.00');
      await app.close();
    });

    it('permite a cualquier rrpp editar el control de distribución (acceso de grupo, ya no hay dueño individual)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/distribucion-control`)
        .set('Cookie', cookie)
        .send({ distribucionEstatus: 'Completado' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.distribucionEstatus).toBe('Completado');
      await app.close();
    });

    it('rechaza a un especialista que no es dueño del proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha(); // sin especialista asignado
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/distribucion-control`)
        .set('Cookie', cookie)
        .send({ distribucionEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('devuelve 400 (no 500) si el body no trae ningún campo reconocido', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConFichaYEspecialista(me.body.user.id);

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/distribucion-control`)
        .set('Cookie', cookie)
        .send({ campoQueNoExiste: 'x' });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error).toBe('Datos inválidos');
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/distribucion-control`)
        .send({ distribucionEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin relación con esta sección (ej. soporte_digital)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'soporte_digital');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/distribucion-control`)
        .set('Cookie', cookie)
        .send({ distribucionEstatus: 'Pendiente' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('POST /api/fichas-trazabilidad/:proyectoId/distribucion/paises', () => {
    it('permite a rrpp agregar un país acordado', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .post(`/api/fichas-trazabilidad/${proyecto.id}/distribucion/paises`)
        .set('Cookie', cookie)
        .send({ pais: 'México', porcentajeRegalias: '12.50' });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.pais.pais).toBe('México');
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();

      const respuesta = await request(app.server)
        .post(`/api/fichas-trazabilidad/${proyecto.id}/distribucion/paises`)
        .send({ pais: 'México' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol distinto de rrpp', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'direccion');

      const respuesta = await request(app.server)
        .post(`/api/fichas-trazabilidad/${proyecto.id}/distribucion/paises`)
        .set('Cookie', cookie)
        .send({ pais: 'México' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('PATCH /api/fichas-trazabilidad/:proyectoId/distribucion/paises/:paisId', () => {
    it('permite a rrpp editar un país existente', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const pais = await agregarPaisDistribucion(proyecto.id, { pais: 'México', porcentajeRegalias: '10.00' });
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/distribucion/paises/${pais.id}`)
        .set('Cookie', cookie)
        .send({ pais: 'México', porcentajeRegalias: '15.00' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.pais.porcentajeRegalias).toBe('15.00');
      await app.close();
    });

    it('devuelve 404 si el país pertenece a otro proyecto (no solo por rol)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyectoAjeno = await crearProyectoConFicha();
      const paisAjeno = await agregarPaisDistribucion(proyectoAjeno.id, { pais: 'México' });
      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/distribucion/paises/${paisAjeno.id}`)
        .set('Cookie', cookie)
        .send({ pais: 'México', porcentajeRegalias: '99.00' });

      expect(respuesta.status).toBe(404);
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const pais = await agregarPaisDistribucion(proyecto.id, { pais: 'México' });

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/distribucion/paises/${pais.id}`)
        .send({ pais: 'México', porcentajeRegalias: '15.00' });

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin ningún permiso sobre la ficha (ej. cobranzas)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const pais = await agregarPaisDistribucion(proyecto.id, { pais: 'México' });
      const cookie = await registrarYLoguear(app, 'cobranzas');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/distribucion/paises/${pais.id}`)
        .set('Cookie', cookie)
        .send({ pais: 'México', porcentajeRegalias: '15.00' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('rechaza a un rol dueño de otra sección de la ficha (ej. disenador, no de Distribución)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const pais = await agregarPaisDistribucion(proyecto.id, { pais: 'México' });
      const cookie = await registrarYLoguear(app, 'disenador');

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/distribucion/paises/${pais.id}`)
        .set('Cookie', cookie)
        .send({ pais: 'México', porcentajeRegalias: '15.00' });

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('DELETE /api/fichas-trazabilidad/:proyectoId/distribucion/paises/:paisId', () => {
    it('permite a rrpp borrar un país existente', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const pais = await agregarPaisDistribucion(proyecto.id, { pais: 'México' });
      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server)
        .delete(`/api/fichas-trazabilidad/${proyecto.id}/distribucion/paises/${pais.id}`)
        .set('Cookie', cookie);

      expect(respuesta.status).toBe(200);

      const ficha = await request(app.server).get(`/api/fichas-trazabilidad/${proyecto.id}`).set('Cookie', cookie);
      expect(ficha.body.ficha.distribucionPaises).toHaveLength(0);
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const pais = await agregarPaisDistribucion(proyecto.id, { pais: 'México' });

      const respuesta = await request(app.server).delete(`/api/fichas-trazabilidad/${proyecto.id}/distribucion/paises/${pais.id}`);

      expect(respuesta.status).toBe(401);
      await app.close();
    });

    it('rechaza a un rol sin ningún permiso sobre la ficha (ej. cobranzas)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const pais = await agregarPaisDistribucion(proyecto.id, { pais: 'México' });
      const cookie = await registrarYLoguear(app, 'cobranzas');

      const respuesta = await request(app.server)
        .delete(`/api/fichas-trazabilidad/${proyecto.id}/distribucion/paises/${pais.id}`)
        .set('Cookie', cookie);

      expect(respuesta.status).toBe(403);
      await app.close();
    });

    it('rechaza a un rol dueño de otra sección de la ficha (ej. disenador, no de Distribución)', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();
      const pais = await agregarPaisDistribucion(proyecto.id, { pais: 'México' });
      const cookie = await registrarYLoguear(app, 'disenador');

      const respuesta = await request(app.server)
        .delete(`/api/fichas-trazabilidad/${proyecto.id}/distribucion/paises/${pais.id}`)
        .set('Cookie', cookie);

      expect(respuesta.status).toBe(403);
      await app.close();
    });
  });

  describe('GET /api/fichas-trazabilidad/:proyectoId', () => {
    it('permite al especialista dueño del proyecto ver la ficha completa', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const cookie = await registrarYLoguear(app, 'especialista');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);

      const proyecto = await crearProyecto({
        autorId: autor.id,
        servicioId: servicio.id,
        unidadId: unidad.id,
        presupuestoId: presupuesto.id,
        especialistaId: me.body.user.id,
        fechaProgramadaInicio: '2026-01-01',
      });
      await crearFichaTrazabilidad(proyecto.id);

      const respuesta = await request(app.server).get(`/api/fichas-trazabilidad/${proyecto.id}`).set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.proyectoId).toBe(proyecto.id);
      expect(respuesta.body.ficha.calidadFases).toEqual([]);

      await app.close();
    });

    it('permite a jefe_area ver la ficha de cualquier proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server).get(`/api/fichas-trazabilidad/${proyecto.id}`).set('Cookie', cookie);

      expect(respuesta.status).toBe(200);

      await app.close();
    });

    it('rechaza a un especialista que no es dueño del proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoConFicha(); // sin especialista asignado
      const cookie = await registrarYLoguear(app, 'especialista');

      const respuesta = await request(app.server).get(`/api/fichas-trazabilidad/${proyecto.id}`).set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoConFicha();

      const respuesta = await request(app.server).get(`/api/fichas-trazabilidad/${proyecto.id}`);

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza a un rol sin ningún permiso sobre el detalle (ej. cobranzas)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoConFicha();
      const cookie = await registrarYLoguear(app, 'cobranzas');

      const respuesta = await request(app.server).get(`/api/fichas-trazabilidad/${proyecto.id}`).set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    // disenador queda fuera de este .each: a diferencia del resto, desde
    // verificarAccesoAProyecto exige pertenencia (disenadorId), no solo rol.
    it.each(['rrpp', 'comercial', 'lider_creativo', 'soporte_editorial', 'soporte_digital'] as const)(
      'permite a %s ver la ficha (dueño de alguna sección)',
      async (rol) => {
        const app = crearAppDePrueba();
        await app.ready();

        const proyecto = await crearProyectoConFicha();
        const cookie = await registrarYLoguear(app, rol);

        const respuesta = await request(app.server).get(`/api/fichas-trazabilidad/${proyecto.id}`).set('Cookie', cookie);

        expect(respuesta.status).toBe(200);

        await app.close();
      },
    );

    it('permite a disenador ver la ficha de su propio proyecto', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const cookie = await registrarYLoguear(app, 'disenador');
      const me = await request(app.server).get('/api/auth/me').set('Cookie', cookie);
      const proyecto = await crearProyectoConFichaYDisenador(me.body.user.id);

      const respuesta = await request(app.server).get(`/api/fichas-trazabilidad/${proyecto.id}`).set('Cookie', cookie);

      expect(respuesta.status).toBe(200);

      await app.close();
    });

    it('rechaza a un disenador ver la ficha de un proyecto que no tiene asignado', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoConFicha(); // sin disenador asignado
      const cookie = await registrarYLoguear(app, 'disenador');

      const respuesta = await request(app.server).get(`/api/fichas-trazabilidad/${proyecto.id}`).set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });

    it('devuelve 404 si el proyecto no existe', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const cookie = await registrarYLoguear(app, 'jefe_area');

      const respuesta = await request(app.server)
        .get('/api/fichas-trazabilidad/00000000-0000-0000-0000-000000000000')
        .set('Cookie', cookie);

      expect(respuesta.status).toBe(404);

      await app.close();
    });
  });

  describe('GET /api/fichas-trazabilidad/pendientes/perfil', () => {
    it('permite a rrpp listar los proyectos con el perfil todavía sin completar', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyectoPendiente = await crearProyectoConFicha();
      const proyectoCompleto = await crearProyectoConFicha();
      await actualizarSeccionProyectoPerfil(proyectoCompleto.id, {
        ingresoServicioPresupuesto: 'Oro',
        ingresoObservaciones: 'Objetivos comerciales',
      });

      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/perfil').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      const ids = respuesta.body.proyectos.map((p: { id: string }) => p.id);
      expect(ids).toContain(proyectoPendiente.id);
      expect(ids).not.toContain(proyectoCompleto.id);

      await app.close();
    });

    it('no cuenta como pendiente un proyecto con solo un campo del perfil lleno (deja de estar "sin completar")', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoConFicha();
      await actualizarSeccionProyectoPerfil(proyecto.id, { ingresoObservaciones: 'Solo este campo' });

      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/perfil').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      const ids = respuesta.body.proyectos.map((p: { id: string }) => p.id);
      expect(ids).not.toContain(proyecto.id);

      await app.close();
    });

    it('no incluye proyectos culminados aunque el perfil esté sin completar', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
      const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
      const proyecto = await crearProyecto({
        autorId: autor.id,
        servicioId: servicio.id,
        unidadId: unidad.id,
        presupuestoId: presupuesto.id,
        estado: 'culminado',
        fechaProgramadaInicio: '2026-01-01',
      });
      await crearFichaTrazabilidad(proyecto.id);

      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/perfil').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      const ids = respuesta.body.proyectos.map((p: { id: string }) => p.id);
      expect(ids).not.toContain(proyecto.id);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/perfil');

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza a un rol distinto de rrpp (ej. comercial)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/perfil').set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('GET /api/fichas-trazabilidad/pendientes/contrato', () => {
    it('ordena por fecha de creación descendente (el más reciente primero)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const antiguo = await crearProyectoDePrueba({ createdAt: new Date('2026-01-01T10:00:00Z') });
      await crearFichaTrazabilidad(antiguo.id);
      const reciente = await crearProyectoDePrueba({ createdAt: new Date('2026-06-01T10:00:00Z') });
      await crearFichaTrazabilidad(reciente.id);

      const cookie = await registrarYLoguear(app, 'comercial');
      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/contrato').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.proyectos.map((p: { id: string }) => p.id)).toEqual([reciente.id, antiguo.id]);

      await app.close();
    });

    it('devuelve autores: [] con todos los coautores del proyecto (no solo el primero)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyecto = await crearProyectoDePrueba();
      await crearFichaTrazabilidad(proyecto.id);
      const coautor = await crearAutor();
      await db.insert(proyectosAutores).values({ proyectoId: proyecto.id, autorId: coautor.id });

      const cookie = await registrarYLoguear(app, 'comercial');
      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/contrato').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      const fila = respuesta.body.proyectos.find((p: { id: string }) => p.id === proyecto.id);
      const idsAutores = fila.autores.map((a: { id: string }) => a.id);
      expect(idsAutores).toHaveLength(2);
      expect(idsAutores).toEqual(expect.arrayContaining([proyecto.autorId, coautor.id]));
      // Compatibilidad: autor (singular) sigue viajando tal cual, para
      // ListaProyectosPendientes.tsx (RrppHomePage, etc.), que no migró.
      expect(fila.autor.id).toBe(proyecto.autorId);

      await app.close();
    });

    it('permite a comercial listar los proyectos con lo contractual todavía sin completar', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyectoPendiente = await crearProyectoConFicha();
      const proyectoCompleto = await crearProyectoConFicha();
      await actualizarSeccionProyectoContrato(proyectoCompleto.id, { capitulosPactados: '6 a 10', paginasPactadas: '200' });

      const cookie = await registrarYLoguear(app, 'comercial');

      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/contrato').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      const ids = respuesta.body.proyectos.map((p: { id: string }) => p.id);
      expect(ids).toContain(proyectoPendiente.id);
      expect(ids).not.toContain(proyectoCompleto.id);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/contrato');

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza a un rol distinto de comercial (ej. rrpp)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const cookie = await registrarYLoguear(app, 'rrpp');

      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/contrato').set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('GET /api/fichas-trazabilidad/pendientes/diseno', () => {
    it('permite a disenador listar los proyectos sin brief ni propuestas todavía', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyectoPendiente = await crearProyectoConFicha();
      const proyectoConBrief = await crearProyectoConFicha();
      await actualizarBriefDiseno(proyectoConBrief.id, { disenoBriefCreativo: 'Brief ya escrito' });
      const proyectoConPropuesta = await crearProyectoConFicha();
      await agregarPropuestaDiseno(proyectoConPropuesta.id, { descripcion: 'Propuesta A' });

      const cookie = await registrarYLoguear(app, 'disenador');

      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/diseno').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      const ids = respuesta.body.proyectos.map((p: { id: string }) => p.id);
      expect(ids).toContain(proyectoPendiente.id);
      expect(ids).not.toContain(proyectoConBrief.id);
      expect(ids).not.toContain(proyectoConPropuesta.id);

      await app.close();
    });

    it('permite también a lider_creativo (mismo dueño de la sección)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const cookie = await registrarYLoguear(app, 'lider_creativo');

      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/diseno').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/diseno');

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza a un rol distinto de disenador/lider_creativo (ej. soporte_editorial)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const cookie = await registrarYLoguear(app, 'soporte_editorial');

      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/diseno').set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('GET /api/fichas-trazabilidad/pendientes/calidad', () => {
    it('permite a soporte_editorial listar los proyectos sin ninguna fase de calidad todavía', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyectoPendiente = await crearProyectoConFicha();
      const proyectoConFase = await crearProyectoConFicha();
      await agregarFaseCalidad(proyectoConFase.id, { numeroFase: 1 });

      const cookie = await registrarYLoguear(app, 'soporte_editorial');

      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/calidad').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      const ids = respuesta.body.proyectos.map((p: { id: string }) => p.id);
      expect(ids).toContain(proyectoPendiente.id);
      expect(ids).not.toContain(proyectoConFase.id);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/calidad');

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza a un rol distinto de soporte_editorial (ej. disenador)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const cookie = await registrarYLoguear(app, 'disenador');

      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/calidad').set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });

  describe('GET /api/fichas-trazabilidad/pendientes/soporte-digital', () => {
    it('permite a soporte_digital listar los proyectos con su sección todavía sin completar', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyectoPendiente = await crearProyectoConFicha();
      const proyectoCompleto = await crearProyectoConFicha();
      await actualizarSeccionSoporteDigital(proyectoCompleto.id, {
        soporteDigitalCuentaAmazon: 'cuenta@panhouse.test',
        soporteDigitalFechaEnvioFormulario: '2026-02-01',
        soporteDigitalFechaActivacion: '2026-02-05',
      });

      const cookie = await registrarYLoguear(app, 'soporte_digital');

      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/soporte-digital').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      const ids = respuesta.body.proyectos.map((p: { id: string }) => p.id);
      expect(ids).toContain(proyectoPendiente.id);
      expect(ids).not.toContain(proyectoCompleto.id);

      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/soporte-digital');

      expect(respuesta.status).toBe(401);

      await app.close();
    });

    it('rechaza a un rol distinto de soporte_digital (ej. soporte_editorial)', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const cookie = await registrarYLoguear(app, 'soporte_editorial');

      const respuesta = await request(app.server).get('/api/fichas-trazabilidad/pendientes/soporte-digital').set('Cookie', cookie);

      expect(respuesta.status).toBe(403);

      await app.close();
    });
  });
});
