import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CATEGORIAS_STAND_BY, ESTADOS_PROYECTO } from '../db/schema/index.js';
import { listarRiesgoProyectosActivos, obtenerProyectoConRiesgo } from '../helpers/alertas.js';
import {
  actualizarEquipoProyecto,
  actualizarProyecto,
  actualizarTituloProyecto,
  asignarDisenador,
  asignarEditor,
  asignarEspecialista,
  crearProyecto,
  listarProyectosActivosResumen,
  listarProyectosEditor,
  listarProyectosEspecialista,
  listarProyectosSinEditor,
  listarTodosLosProyectos,
  obtenerProyecto,
  reasignarProyecto,
  validarCambioEstadoProyecto,
  verificarAccesoAProyecto,
} from '../helpers/proyectos.js';
import { parseOrReply } from '../helpers/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const idParamSchema = z.object({ id: z.string().uuid() });

const crearProyectoSchema = z.object({
  autorId: z.string().uuid(),
  servicioId: z.string().uuid(),
  unidadId: z.string().uuid(),
  presupuestoId: z.string().uuid(),
  coleccionId: z.string().uuid().optional(),
  fechaProgramadaInicio: z.string(),
  fechaRealInicio: z.string().optional(),
  fechaDeseadaAutor: z.string().optional(),
});

// Reasignar autor y/o servicio de un proyecto ya creado — capacidad
// propia de comercial (corregir un dato mal cargado al crear), separada
// de PATCH /:id (especificaciones operativas, a cargo de especialista)
// por el mismo motivo que asignarEspecialista/asignarEditor/asignarDisenador
// viven en rutas propias: un dueño claro por ruta, en vez de una sola
// ruta general con permisos mezclados.
const reasignarProyectoSchema = z
  .object({
    autorId: z.string().uuid().optional(),
    servicioId: z.string().uuid().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No se recibió ningún campo válido para actualizar',
  });

// "Escuadrón de Producción" — panel único de jefe_area para las cinco
// columnas de asignación a la vez (ver DatosEquipoProyecto en
// server/helpers/proyectos.ts). nullable: también debe poder dejar un
// rol sin asignar de nuevo.
const equipoProyectoSchema = z
  .object({
    especialistaId: z.string().uuid().nullable().optional(),
    editorId: z.string().uuid().nullable().optional(),
    correctorId: z.string().uuid().nullable().optional(),
    disenadorId: z.string().uuid().nullable().optional(),
    calidadId: z.string().uuid().nullable().optional(),
    digitalId: z.string().uuid().nullable().optional(),
    lanzamientoId: z.string().uuid().nullable().optional(),
    distribucionId: z.string().uuid().nullable().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No se recibió ningún campo válido para actualizar',
  });

const asignarEspecialistaSchema = z.object({
  especialistaId: z.string().uuid(),
});

const asignarEditorSchema = z.object({
  editorId: z.string().uuid(),
});

const asignarDisenadorSchema = z.object({
  disenadorId: z.string().uuid(),
});

const tituloProyectoSchema = z.object({
  titulo: z.string().nullable(),
});

// Los mismos ocho campos operativos confirmados por negocio: ninguno
// requiere jefe de área hoy. "Especificaciones especiales" queda sin
// ruta propia — no hay ningún campo que caiga ahí todavía.
const actualizarProyectoSchema = z.object({
  estado: z.enum(ESTADOS_PROYECTO).optional(),
  categoriaStandBy: z.enum(CATEGORIAS_STAND_BY).nullable().optional(),
  coleccionId: z.string().uuid().nullable().optional(),
  presupuestoId: z.string().uuid().optional(),
  unidadId: z.string().uuid().optional(),
  servicioId: z.string().uuid().optional(),
  fechaRealInicio: z.string().nullable().optional(),
  fechaDeseadaAutor: z.string().nullable().optional(),
});

export async function proyectosRoutes(app: FastifyInstance) {
  // Cambio de flujo confirmado: el jefe de área crea los proyectos, no
  // el especialista (revierte una decisión anterior a propósito).
  // Lista histórica/general de todos los proyectos sin importar su estado.
  // Solo accesible para jefatura y dirección.
  app.get('/', { preHandler: [requireAuth, requireRole('jefe_area', 'direccion')] }, async (_request, reply) => {
    const proyectos = await listarTodosLosProyectos();
    return reply.send({ proyectos });
  });

  // Selector de proyectos del módulo de pagos (RegistrarPagoPage.tsx):
  // deliberadamente una ruta nueva y angosta, no un ensanchamiento de la
  // de arriba (esa sigue "Solo accesible para jefatura y dirección").
  app.get(
    '/activos',
    { preHandler: [requireAuth, requireRole('comercial', 'rrpp', 'cobranzas', 'jefe_area')] },
    async (_request, reply) => {
      const proyectos = await listarProyectosActivosResumen();
      return reply.send({ proyectos });
    },
  );
  // comercial también puede crear proyectos desde su propio CRM (modal
  // "Nuevo Proyecto" en AutoresPage.tsx) — mismo endpoint y validación
  // que jefe_area, ningún campo nuevo.
  app.post('/', { preHandler: [requireAuth, requireRole('jefe_area', 'comercial')] }, async (request, reply) => {
    const body = parseOrReply(crearProyectoSchema, request.body, reply);
    if (!body) return;

    const proyecto = await crearProyecto(body);
    return reply.code(201).send({ proyecto });
  });

  app.patch('/:id/reasignar', { preHandler: [requireAuth, requireRole('comercial', 'jefe_area')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOrReply(reasignarProyectoSchema, request.body, reply);
    if (!body) return;

    const proyecto = await reasignarProyecto(params.id, body);
    return reply.send({ proyecto });
  });

  app.patch('/:id/equipo', { preHandler: [requireAuth, requireRole('jefe_area')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOrReply(equipoProyectoSchema, request.body, reply);
    if (!body) return;

    const proyecto = await actualizarEquipoProyecto(params.id, body);
    return reply.send({ proyecto });
  });

  // "Mis proyectos": lista para la pantalla del especialista o del
  // editor, con autor/servicio ya resueltos y riesgo ya calculado por
  // fila — mismo endpoint para los dos roles, la columna de asignación
  // que se filtra depende de quién pregunta.
  app.get('/mios', { preHandler: [requireAuth, requireRole('especialista', 'editor')] }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'No autenticado' });
    }

    const proyectos =
      request.user.rol === 'editor'
        ? await listarProyectosEditor(request.user.id)
        : await listarProyectosEspecialista(request.user.id);
    return reply.send({ proyectos });
  });

  // "Proyectos sin editor asignado": punto de partida del flujo de
  // jefe_edicion, mismo patrón que "Autores sin proyecto" de jefe_area.
  app.get('/sin-editor', { preHandler: [requireAuth, requireRole('jefe_edicion')] }, async (_request, reply) => {
    const proyectos = await listarProyectosSinEditor();
    return reply.send({ proyectos });
  });

  app.patch('/:id/especialista', { preHandler: [requireAuth, requireRole('jefe_area')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOrReply(asignarEspecialistaSchema, request.body, reply);
    if (!body) return;

    await asignarEspecialista(params.id, body.especialistaId);
    return reply.send({ ok: true });
  });

  // Mismo patrón exacto que PATCH /:id/especialista, pero lo decide
  // jefe_edicion, no jefe_area.
  app.patch('/:id/editor', { preHandler: [requireAuth, requireRole('jefe_edicion')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOrReply(asignarEditorSchema, request.body, reply);
    if (!body) return;

    await asignarEditor(params.id, body.editorId);
    return reply.send({ ok: true });
  });

  // A diferencia de /especialista y /editor (que las decide jefatura),
  // el disenador lo asigna el propio especialista dueño del proyecto —
  // de ahí el chequeo de pertenencia con verificarAccesoAProyecto antes
  // de asignar, que las otras dos no necesitan (jefe_area/jefe_edicion
  // no tienen columna de pertenencia que verificar).
  app.patch('/:id/disenador', { preHandler: [requireAuth, requireRole('especialista')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOrReply(asignarDisenadorSchema, request.body, reply);
    if (!body) return;

    if (!request.user) {
      return reply.code(401).send({ error: 'No autenticado' });
    }

    const acceso = await verificarAccesoAProyecto(params.id, request.user);
    if (!acceso.ok) {
      return reply.code(acceso.status).send({ error: acceso.error });
    }

    await asignarDisenador(params.id, body.disenadorId);
    const proyecto = await obtenerProyecto(params.id);
    return reply.send({ proyecto });
  });

  // Título del libro — dueño rrpp, mismo rol que el resto de Sección 1
  // (Perfil), aunque escribe proyectos directamente (ruta propia, no
  // pasa por fichas-trazabilidad como perfilAutor/publicoObjetivo).
  app.patch('/:id/titulo', { preHandler: [requireAuth, requireRole('rrpp')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOrReply(tituloProyectoSchema, request.body, reply);
    if (!body) return;

    const proyecto = await actualizarTituloProyecto(params.id, body.titulo);
    return reply.send({ proyecto });
  });

  app.patch('/:id', { preHandler: [requireAuth, requireRole('especialista')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOrReply(actualizarProyectoSchema, request.body, reply);
    if (!body) return;

    try {
      validarCambioEstadoProyecto(body.estado);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Datos inválidos' });
    }

    const proyecto = await actualizarProyecto(params.id, body);
    return reply.send({ proyecto });
  });

  // jefe_area y dirección: para la futura torre de control.
  app.get('/riesgo', { preHandler: [requireAuth, requireRole('jefe_area', 'direccion')] }, async (_request, reply) => {
    const proyectos = await listarRiesgoProyectosActivos();
    return reply.send({ proyectos });
  });

  // Detalle de un proyecto puntual (autor/servicio/estado/riesgo ya
  // resueltos): el especialista dueño del proyecto, jefe_area, y los
  // roles que hoy tienen algo que escribir en la pantalla de detalle
  // (rrpp, comercial, editor, disenador, lider_creativo,
  // soporte_editorial, soporte_digital) — necesitan poder abrirla para
  // editar su sección y ver que quedó guardada.
  app.get(
    '/:id/riesgo',
    {
      preHandler: [
        requireAuth,
        requireRole(
          'jefe_area',
          'especialista',
          'rrpp',
          'comercial',
          'editor',
          'disenador',
          'lider_creativo',
          'soporte_editorial',
          'soporte_digital',
        ),
      ],
    },
    async (request, reply) => {
      const params = parseOrReply(idParamSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }

      const acceso = await verificarAccesoAProyecto(params.id, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const proyecto = await obtenerProyectoConRiesgo(params.id);
      if (!proyecto) {
        return reply.code(404).send({ error: 'Proyecto no encontrado' });
      }

      return reply.send({ proyecto });
    },
  );
}
