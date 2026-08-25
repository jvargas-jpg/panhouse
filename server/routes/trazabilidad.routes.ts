import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ESTADOS_COTIZACION_IMPRESION, TIPOS_PORTADA } from '../db/schema/index.js';
import { verificarAccesoAProyecto } from '../helpers/proyectos.js';
import {
  actualizarBriefDiseno,
  actualizarFaseCalidad,
  actualizarPaisDistribucion,
  actualizarPropuestaDiseno,
  actualizarReunionLanzamiento,
  actualizarSeccionCorreccion,
  actualizarSeccionImpresion,
  actualizarSeccionLanzamientoGeneral,
  actualizarSeccionProyectoContrato,
  actualizarSeccionProyectoPerfil,
  actualizarSeccionSoporteDigital,
  agregarFaseCalidad,
  agregarPaisDistribucion,
  agregarPropuestaDiseno,
  agregarReunionLanzamiento,
  eliminarFaseCalidad,
  eliminarPaisDistribucion,
  eliminarPropuestaDiseno,
  eliminarReunionLanzamiento,
  listarProyectosPendientesCalidad,
  listarProyectosPendientesContrato,
  listarProyectosPendientesDiseno,
  listarProyectosPendientesPerfil,
  listarProyectosPendientesSoporteDigital,
  obtenerFichaCompleta,
} from '../helpers/trazabilidad.js';
import { parseOrReply } from '../helpers/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const proyectoIdParamSchema = z.object({ proyectoId: z.string().uuid() });

// Params de las rutas por fila (editar/borrar una entrada puntual de
// las secciones que son varias filas por naturaleza).
const disenoPropuestaParamsSchema = z.object({ proyectoId: z.string().uuid(), propuestaId: z.string().uuid() });
const calidadFaseParamsSchema = z.object({ proyectoId: z.string().uuid(), faseId: z.string().uuid() });
const lanzamientoReunionParamsSchema = z.object({ proyectoId: z.string().uuid(), reunionId: z.string().uuid() });
const distribucionPaisParamsSchema = z.object({ proyectoId: z.string().uuid(), paisId: z.string().uuid() });

// Sección 1 — Proyecto, partida en dos dueños.
const seccionProyectoPerfilSchema = z
  .object({
    perfilAutor: z.string().nullable().optional(),
    publicoObjetivo: z.string().nullable().optional(),
    objetivosComerciales: z.string().nullable().optional(),
    ingresoNombreArtistico: z.string().nullable().optional(),
    ingresoNacionalidad: z.string().nullable().optional(),
    ingresoFechaNacimiento: z.string().nullable().optional(),
    ingresoTipoProyecto: z.string().nullable().optional(),
    ingresoTipoProyectoDetalle: z.string().nullable().optional(),
    ingresoFechaIngreso: z.string().nullable().optional(),
    ingresoFechaCierre: z.string().nullable().optional(),
    ingresoFechaDeseada: z.string().nullable().optional(),
    ingresoTemaGeneral: z.string().nullable().optional(),
    ingresoServicioPerfil: z.string().nullable().optional(),
    ingresoServicioEjecucion: z.string().nullable().optional(),
    ingresoServicioAlianza: z.string().nullable().optional(),
    ingresoServicioPresupuesto: z.string().nullable().optional(),
    ingresoRedesSociales: z.string().nullable().optional(),
    ingresoPersonalidad: z.string().nullable().optional(),
    ingresoOcupacion: z.string().nullable().optional(),
    ingresoObservaciones: z.string().nullable().optional(),
    ingresoPosibleTitulo: z.string().nullable().optional(),
    ingresoColeccion: z.string().nullable().optional(),
    ingresoPublicoSexo: z.string().nullable().optional(),
    ingresoPublicoEdad: z.string().nullable().optional(),
    ingresoPublicoPerfil: z.string().nullable().optional(),
    ingresoPropositoSocial: z.string().nullable().optional(),
    ingresoObjetivoComercial: z.string().nullable().optional(),
    ingresoTonoEstilo: z.string().nullable().optional(),
    ingresoCriterioExtra: z.string().nullable().optional(),
    ingresoCondicionesEspeciales: z.string().nullable().optional(),
    ingresoObservacionesEquipo: z.string().nullable().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No se recibió ningún campo válido para actualizar',
  });

const seccionProyectoContratoSchema = z.object({
  capitulosPactados: z.number().int().nonnegative().nullable().optional(),
  paginasPactadas: z.number().int().nonnegative().nullable().optional(),
});

// Sección 3 — Corrección.
const seccionCorreccionSchema = z
  .object({
    correccionTripaCompleta: z.string().nullable().optional(),
    correccionTripaCompletaFechaEntrega: z.string().nullable().optional(),
    correccionTripaCompletaAprobado: z.boolean().nullable().optional(),
    correccionPreliminares: z.string().nullable().optional(),
    correccionPreliminaresFechaEntrega: z.string().nullable().optional(),
    correccionPreliminaresAprobado: z.boolean().nullable().optional(),
    correccionCubiertaExtendida: z.string().nullable().optional(),
    correccionCubiertaExtendidaFechaEntrega: z.string().nullable().optional(),
    correccionCubiertaExtendidaAprobado: z.boolean().nullable().optional(),
  })
  // Cualquier campo desconocido llega vacío tras el parseo de Zod. Sin
  // este refine, un body así llega vacío al helper y hace truncar el
  // update en Drizzle ("No values to set") en vez de avisar con un 400
  // claro.
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No se recibió ningún campo válido para actualizar',
  });

// Sección 4 — Diseño. Campos del brief confirmados contra la matriz
// real de Dirección Creativa: disenoBriefAprobadoFecha no tiene un
// booleano/estado aparte — la presencia de fecha ya es la aprobación,
// igual que en el documento real.
const disenoBriefSchema = z
  .object({
    disenoBriefCreativo: z.string().nullable().optional(),
    disenoTipoPortada: z.enum(TIPOS_PORTADA).nullable().optional(),
    disenoFechaReunionCreativa: z.string().nullable().optional(),
    disenoFechaEntregaBrief: z.string().nullable().optional(),
    disenoBriefAprobadoFecha: z.string().nullable().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No se recibió ningún campo válido para actualizar',
  });

// estado queda como texto libre a propósito — el conjunto completo de
// valores posibles todavía no está confirmado, no forzar un enum
// cerrado antes de tiempo (ver server/db/schema/trazabilidad.ts).
const disenoPropuestaSchema = z.object({
  fechaEnviadaEspecialista: z.string().nullable().optional(),
  fechaEnviadaAutor: z.string().nullable().optional(),
  fechaAprobadaAutor: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  enlace: z.string().nullable().optional(),
});

// Sección 5 — Calidad.
const calidadFaseSchema = z.object({
  numeroFase: z.number().int().min(1).max(4),
  pdfUrl: z.string().nullable().optional(),
  pdfVersion: z.string().nullable().optional(),
  fecha: z.string().nullable().optional(),
  aprobado: z.boolean().nullable().optional(),
});

// Sección 6 — Soporte digital.
const soporteDigitalSchema = z.object({
  soporteDigitalCuentaAmazon: z.string().nullable().optional(),
  soporteDigitalFechaEnvioFormulario: z.string().nullable().optional(),
  soporteDigitalFechaActivacion: z.string().nullable().optional(),
});

// Sección 7 — Lanzamiento y promoción. nivelSatisfaccion queda como
// texto libre a propósito — el tipo de dato exacto todavía no está
// confirmado (ver server/db/schema/trazabilidad.ts).
const lanzamientoGeneralSchema = z
  .object({
    nivelSatisfaccion: z.string().nullable().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No se recibió ningún campo válido para actualizar',
  });

const lanzamientoReunionSchema = z.object({
  fecha: z.string().nullable().optional(),
  puntosTratados: z.string().nullable().optional(),
  acuerdos: z.string().nullable().optional(),
});

// Sección 9 — Distribución.
const distribucionPaisSchema = z.object({
  pais: z.string().min(1),
  porcentajeRegalias: z.string().nullable().optional(),
});

// Sección 8 — Impresión.
const seccionImpresionSchema = z
  .object({
    impresionDeseaCotizacion: z.boolean().nullable().optional(),
    impresionResponsable: z.string().nullable().optional(),
    impresionEstadoCotizacion: z.enum(ESTADOS_COTIZACION_IMPRESION).nullable().optional(),
    impresionNotas: z.string().nullable().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No se recibió ningún campo válido para actualizar',
  });

export async function trazabilidadRoutes(app: FastifyInstance) {
  // Ficha completa (las nueve secciones en una sola llamada): el
  // especialista dueño del proyecto, jefe_area, y todos los roles
  // dueños de alguna sección — necesitan leerla antes de editar la
  // suya y confirmar que quedó guardada.
  app.get(
    '/:proyectoId',
    {
      preHandler: [
        requireAuth,
        requireRole(
          'jefe_area',
          'especialista',
          'rrpp',
          'comercial',
          'disenador',
          'lider_creativo',
          'soporte_editorial',
          'soporte_digital',
        ),
      ],
    },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }

      const acceso = await verificarAccesoAProyecto(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const ficha = await obtenerFichaCompleta(params.proyectoId);
      if (!ficha) {
        return reply.code(404).send({ error: 'Ficha de trazabilidad no encontrada' });
      }

      return reply.send({ ficha });
    },
  );

  // "Notificación interna" de rrpp: pantalla de inicio, sin ruta propia
  // todavía antes de esto (ver HomePage.tsx en el frontend).
  app.get('/pendientes/perfil', { preHandler: [requireAuth, requireRole('rrpp')] }, async (_request, reply) => {
    const proyectos = await listarProyectosPendientesPerfil();
    return reply.send({ proyectos });
  });

  // "Notificación interna" de comercial: sección extra en su pantalla ya
  // existente, junto al formulario de crear autor.
  app.get('/pendientes/contrato', { preHandler: [requireAuth, requireRole('comercial')] }, async (_request, reply) => {
    const proyectos = await listarProyectosPendientesContrato();
    return reply.send({ proyectos });
  });

  // "Notificación interna" de disenador (también lider_creativo, dueño
  // de la misma sección, aunque su pantalla propia no se construye
  // todavía): pantalla de inicio.
  app.get(
    '/pendientes/diseno',
    { preHandler: [requireAuth, requireRole('disenador', 'lider_creativo')] },
    async (_request, reply) => {
      const proyectos = await listarProyectosPendientesDiseno();
      return reply.send({ proyectos });
    },
  );

  // "Notificación interna" de soporte_editorial: pantalla de inicio.
  app.get('/pendientes/calidad', { preHandler: [requireAuth, requireRole('soporte_editorial')] }, async (_request, reply) => {
    const proyectos = await listarProyectosPendientesCalidad();
    return reply.send({ proyectos });
  });

  // "Notificación interna" de soporte_digital: pantalla de inicio.
  app.get(
    '/pendientes/soporte-digital',
    { preHandler: [requireAuth, requireRole('soporte_digital')] },
    async (_request, reply) => {
      const proyectos = await listarProyectosPendientesSoporteDigital();
      return reply.send({ proyectos });
    },
  );

  app.patch(
    '/:proyectoId/proyecto-perfil',
    { preHandler: [requireAuth, requireRole('comercial', 'rrpp', 'jefe_area')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(seccionProyectoPerfilSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionProyectoPerfil(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  app.patch(
    '/:proyectoId/proyecto-contrato',
    { preHandler: [requireAuth, requireRole('comercial')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(seccionProyectoContratoSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionProyectoContrato(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  app.patch(
    '/:proyectoId/correccion',
    { preHandler: [requireAuth, requireRole('especialista')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(seccionCorreccionSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionCorreccion(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  app.patch(
    '/:proyectoId/diseno/brief',
    { preHandler: [requireAuth, requireRole('disenador', 'lider_creativo')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }
      const acceso = await verificarAccesoAProyecto(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const body = parseOrReply(disenoBriefSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarBriefDiseno(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  app.post(
    '/:proyectoId/diseno/propuestas',
    { preHandler: [requireAuth, requireRole('disenador', 'lider_creativo')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }
      const acceso = await verificarAccesoAProyecto(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const body = parseOrReply(disenoPropuestaSchema, request.body, reply);
      if (!body) return;

      const propuesta = await agregarPropuestaDiseno(params.proyectoId, body);
      return reply.code(201).send({ propuesta });
    },
  );

  app.patch(
    '/:proyectoId/diseno/propuestas/:propuestaId',
    { preHandler: [requireAuth, requireRole('disenador', 'lider_creativo')] },
    async (request, reply) => {
      const params = parseOrReply(disenoPropuestaParamsSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }
      const acceso = await verificarAccesoAProyecto(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const body = parseOrReply(disenoPropuestaSchema, request.body, reply);
      if (!body) return;

      const propuesta = await actualizarPropuestaDiseno(params.proyectoId, params.propuestaId, body);
      if (!propuesta) {
        return reply.code(404).send({ error: 'Propuesta de diseño no encontrada' });
      }
      return reply.send({ propuesta });
    },
  );

  app.delete(
    '/:proyectoId/diseno/propuestas/:propuestaId',
    { preHandler: [requireAuth, requireRole('disenador', 'lider_creativo')] },
    async (request, reply) => {
      const params = parseOrReply(disenoPropuestaParamsSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }
      const acceso = await verificarAccesoAProyecto(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const propuesta = await eliminarPropuestaDiseno(params.proyectoId, params.propuestaId);
      if (!propuesta) {
        return reply.code(404).send({ error: 'Propuesta de diseño no encontrada' });
      }
      return reply.send({ ok: true });
    },
  );

  app.post(
    '/:proyectoId/calidad/fases',
    { preHandler: [requireAuth, requireRole('soporte_editorial')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(calidadFaseSchema, request.body, reply);
      if (!body) return;

      const fase = await agregarFaseCalidad(params.proyectoId, body);
      return reply.code(201).send({ fase });
    },
  );

  app.patch(
    '/:proyectoId/calidad/fases/:faseId',
    { preHandler: [requireAuth, requireRole('soporte_editorial')] },
    async (request, reply) => {
      const params = parseOrReply(calidadFaseParamsSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(calidadFaseSchema, request.body, reply);
      if (!body) return;

      const fase = await actualizarFaseCalidad(params.proyectoId, params.faseId, body);
      if (!fase) {
        return reply.code(404).send({ error: 'Fase de calidad no encontrada' });
      }
      return reply.send({ fase });
    },
  );

  app.delete(
    '/:proyectoId/calidad/fases/:faseId',
    { preHandler: [requireAuth, requireRole('soporte_editorial')] },
    async (request, reply) => {
      const params = parseOrReply(calidadFaseParamsSchema, request.params, reply);
      if (!params) return;

      const fase = await eliminarFaseCalidad(params.proyectoId, params.faseId);
      if (!fase) {
        return reply.code(404).send({ error: 'Fase de calidad no encontrada' });
      }
      return reply.send({ ok: true });
    },
  );

  app.patch(
    '/:proyectoId/soporte-digital',
    { preHandler: [requireAuth, requireRole('soporte_digital')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(soporteDigitalSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionSoporteDigital(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  app.patch(
    '/:proyectoId/lanzamiento/general',
    { preHandler: [requireAuth, requireRole('rrpp')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }
      const acceso = await verificarAccesoAProyecto(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const body = parseOrReply(lanzamientoGeneralSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionLanzamientoGeneral(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  app.post(
    '/:proyectoId/lanzamiento/reuniones',
    { preHandler: [requireAuth, requireRole('rrpp')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(lanzamientoReunionSchema, request.body, reply);
      if (!body) return;

      const reunion = await agregarReunionLanzamiento(params.proyectoId, body);
      return reply.code(201).send({ reunion });
    },
  );

  app.patch(
    '/:proyectoId/lanzamiento/reuniones/:reunionId',
    { preHandler: [requireAuth, requireRole('rrpp')] },
    async (request, reply) => {
      const params = parseOrReply(lanzamientoReunionParamsSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(lanzamientoReunionSchema, request.body, reply);
      if (!body) return;

      const reunion = await actualizarReunionLanzamiento(params.proyectoId, params.reunionId, body);
      if (!reunion) {
        return reply.code(404).send({ error: 'Reunión de lanzamiento no encontrada' });
      }
      return reply.send({ reunion });
    },
  );

  app.delete(
    '/:proyectoId/lanzamiento/reuniones/:reunionId',
    { preHandler: [requireAuth, requireRole('rrpp')] },
    async (request, reply) => {
      const params = parseOrReply(lanzamientoReunionParamsSchema, request.params, reply);
      if (!params) return;

      const reunion = await eliminarReunionLanzamiento(params.proyectoId, params.reunionId);
      if (!reunion) {
        return reply.code(404).send({ error: 'Reunión de lanzamiento no encontrada' });
      }
      return reply.send({ ok: true });
    },
  );

  app.patch(
    '/:proyectoId/impresion',
    { preHandler: [requireAuth, requireRole('rrpp', 'jefe_area')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }
      const acceso = await verificarAccesoAProyecto(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const body = parseOrReply(seccionImpresionSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionImpresion(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  app.post(
    '/:proyectoId/distribucion/paises',
    { preHandler: [requireAuth, requireRole('rrpp')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(distribucionPaisSchema, request.body, reply);
      if (!body) return;

      const pais = await agregarPaisDistribucion(params.proyectoId, body);
      return reply.code(201).send({ pais });
    },
  );

  app.patch(
    '/:proyectoId/distribucion/paises/:paisId',
    { preHandler: [requireAuth, requireRole('rrpp')] },
    async (request, reply) => {
      const params = parseOrReply(distribucionPaisParamsSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(distribucionPaisSchema, request.body, reply);
      if (!body) return;

      const pais = await actualizarPaisDistribucion(params.proyectoId, params.paisId, body);
      if (!pais) {
        return reply.code(404).send({ error: 'País de distribución no encontrado' });
      }
      return reply.send({ pais });
    },
  );

  app.delete(
    '/:proyectoId/distribucion/paises/:paisId',
    { preHandler: [requireAuth, requireRole('rrpp')] },
    async (request, reply) => {
      const params = parseOrReply(distribucionPaisParamsSchema, request.params, reply);
      if (!params) return;

      const pais = await eliminarPaisDistribucion(params.proyectoId, params.paisId);
      if (!pais) {
        return reply.code(404).send({ error: 'País de distribución no encontrado' });
      }
      return reply.send({ ok: true });
    },
  );
}