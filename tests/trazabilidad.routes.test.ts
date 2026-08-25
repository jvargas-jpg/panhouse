import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
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
        .send({ perfilAutor: 'Autor primerizo' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.perfilAutor).toBe('Autor primerizo');
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/proyecto-perfil`)
        .send({ perfilAutor: 'Autor primerizo' });

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
        .send({ perfilAutor: 'Autor primerizo' });

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
        .send({ capitulosPactados: 8, paginasPactadas: 160 });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.ficha.capitulosPactados).toBe(8);
      await app.close();
    });

    it('rechaza sin sesión', async () => {
      const app = crearAppDePrueba();
      await app.ready();
      const proyecto = await crearProyectoConFicha();

      const respuesta = await request(app.server)
        .patch(`/api/fichas-trazabilidad/${proyecto.id}/proyecto-contrato`)
        .send({ capitulosPactados: 8 });

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
        .send({ capitulosPactados: 8 });

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
        perfilAutor: 'Perfil completo',
        publicoObjetivo: 'Público objetivo',
        objetivosComerciales: 'Objetivos comerciales',
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
      await actualizarSeccionProyectoPerfil(proyecto.id, { perfilAutor: 'Solo este campo' });

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
    it('permite a comercial listar los proyectos con lo contractual todavía sin completar', async () => {
      const app = crearAppDePrueba();
      await app.ready();

      const proyectoPendiente = await crearProyectoConFicha();
      const proyectoCompleto = await crearProyectoConFicha();
      await actualizarSeccionProyectoContrato(proyectoCompleto.id, { capitulosPactados: 10, paginasPactadas: 200 });

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
