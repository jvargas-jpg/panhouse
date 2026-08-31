import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CATEGORIAS_STAND_BY, ESTADOS_PROYECTO } from '../db/schema/index.js';
import { listarRiesgoProyectosActivos, obtenerProyectoConRiesgo } from '../helpers/alertas.js';
import { actualizarManuscrito, listarMisLibros, verificarAccesoLibroAutor } from '../helpers/portalAutor.js';
import {
  actualizarEquipoProyecto,
  actualizarProyecto,
  actualizarTituloProyecto,
  asignarDisenador,
  asignarEditor,
  asignarEspecialista,
  crearProyecto,
  eliminarProyecto,
  listarProyectosActivosResumen,
  listarProyectosEditor,
  listarProyectosEspecialista,
  listarProyectosSinEditor,
  listarTodosLosProyectos,
  notificarJefaturaFichaCompletada,
  notificarRrppProyectoBase,
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

// Corregir los parámetros comerciales de un proyecto ya creado — autor
// (bloqueado del lado del frontend, ver CrearProyectoModalForm.tsx —
// autorId sigue aceptado acá porque el backend no impone esa regla de
// UI) y ahora también servicio/unidad/presupuesto/fecha programada, a
// pedido explícito: "habilitar la edición completa de los parámetros
// comerciales". Nota de solapamiento: servicioId/unidadId/presupuestoId
// ya eran editables por especialista vía PATCH /:id (especificaciones
// operativas) — con este cambio quedan editables por las DOS rutas, con
// permisos distintos. No se resolvió ese solapamiento (no se pidió);
// queda documentado acá para quien lo encuentre después.
const reasignarProyectoSchema = z
  .object({
    autorId: z.string().uuid().optional(),
    servicioId: z.string().uuid().optional(),
    unidadId: z.string().uuid().optional(),
    presupuestoId: z.string().uuid().optional(),
    fechaProgramadaInicio: z.string().optional(),
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

// Portal del Autor: sin .url() a propósito — mismo criterio laxo que el
// resto de los campos "enlace" de este sistema (fichaDisenoPropuestas.enlace,
// pagos.comprobanteUrl), ninguno valida formato de URL.
const manuscritoSchema = z.object({
  manuscritoUrl: z.string().nullable(),
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

  // Paso 1 de la cascada de Fase 1 (Inicio): comercial termina de cargar
  // los datos de venta y pasa el proyecto a rrpp (ver
  // notificarRrppProyectoBase en helpers/proyectos.ts) — acción
  // explícita, no un efecto colateral de POST / de arriba. Exclusiva de
  // comercial: es el único rol dueño de este primer tramo.
  app.post('/:id/notificar-rrpp', { preHandler: [requireAuth, requireRole('comercial')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;

    const resultado = await notificarRrppProyectoBase(params.id);
    if (!resultado.ok) {
      return reply.code(resultado.status).send({ error: resultado.error });
    }
    return reply.code(201).send({ ok: true });
  });

  // Paso 2 de la misma cascada: rrpp termina de llenar la ficha de
  // trazabilidad y pasa el proyecto a jefe_area (ver
  // notificarJefaturaFichaCompletada en helpers/proyectos.ts). Exclusiva
  // de rrpp — comercial y jefe_area ya no disparan este paso (antes
  // compartían la ruta con rrpp cuando era un solo tramo sin la
  // notificación intermedia a rrpp).
  app.post('/:id/notificar-jefatura', { preHandler: [requireAuth, requireRole('rrpp')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;

    const resultado = await notificarJefaturaFichaCompletada(params.id);
    if (!resultado.ok) {
      return reply.code(resultado.status).send({ error: resultado.error });
    }
    return reply.code(201).send({ ok: true });
  });

  // Eliminación real, no un cambio de estado a 'retirado' (que ya
  // existe como opción no destructiva) — a pedido explícito. jefe_area
  // y dirección por su alcance amplio habitual; comercial porque el
  // pedido dice "el creador (Comercial)" — no existe una columna que
  // registre quién creó cada proyecto (nunca se pidió rastrear eso), así
  // que esto autoriza a comercial como rol, no solo a quien lo creó.
  // Cascada real hacia ficha/capítulos/pausas/pagos/seguimiento — ver el
  // comentario de eliminarProyecto en helpers/proyectos.ts.
  app.delete('/:id', { preHandler: [requireAuth, requireRole('jefe_area', 'direccion', 'comercial')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;

    const proyecto = await eliminarProyecto(params.id);
    if (!proyecto) {
      return reply.code(404).send({ error: 'Proyecto no encontrado' });
    }
    return reply.send({ ok: true });
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

  // Portal del Autor — "Mis Libros". Exclusivo de rol autor,
  // deliberadamente distinto de /mios de arriba (ese es interno,
  // filtra por especialista/editor, trae riesgo y control de tiempos).
  // Sin ownership que verificar por :id porque list-y-filter no lo
  // necesita: autorId sale de la sesión (users.autorId), nunca del
  // cliente — un autor no puede pedir los libros de otro cambiando un
  // parámetro, la ruta ni siquiera acepta uno.
  app.get('/mis-libros', { preHandler: [requireAuth, requireRole('autor')] }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'No autenticado' });
    }
    if (!request.user.autorId) {
      return reply.code(403).send({ error: 'Esta cuenta todavía no está vinculada a ningún autor' });
    }

    const proyectos = await listarMisLibros(request.user.autorId);
    return reply.send({ proyectos });
  });

  app.patch(
    '/:id/manuscrito',
    { preHandler: [requireAuth, requireRole('autor')] },
    async (request, reply) => {
      const params = parseOrReply(idParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(manuscritoSchema, request.body, reply);
      if (!body) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }
      if (!request.user.autorId) {
        return reply.code(403).send({ error: 'Esta cuenta todavía no está vinculada a ningún autor' });
      }

      const acceso = await verificarAccesoLibroAutor(params.id, request.user.autorId);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const proyecto = await actualizarManuscrito(params.id, body.manuscritoUrl);
      return reply.send({ proyecto });
    },
  );

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
