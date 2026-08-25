import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { actualizarCapituloAutor, actualizarCapituloEditor, crearCapitulo, obtenerCapitulosProyecto } from '../helpers/capitulos.js';
import { verificarAccesoAProyecto } from '../helpers/proyectos.js';
import { parseOrReply } from '../helpers/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const capituloParamsSchema = z.object({
  proyectoId: z.string().uuid(),
  numero: z.coerce.number().int().positive(),
});

const proyectoIdParamSchema = z.object({ proyectoId: z.string().uuid() });

const crearCapituloSchema = z.object({
  proyectoId: z.string().uuid(),
  numero: z.number().int().positive(),
});

const actualizarCapituloAutorSchema = z.object({
  fechaEnvioAutor: z.string().nullable().optional(),
  fechaPautadaFeedback: z.string().nullable().optional(),
  fechaRespuestaReal: z.string().nullable().optional(),
  enlaces: z.array(z.string()).nullable().optional(),
});

const actualizarCapituloEditorSchema = z.object({
  fechaInicioEditor: z.string().nullable().optional(),
  paginas: z.number().int().nonnegative().nullable().optional(),
  fechaEntregaEditor: z.string().nullable().optional(),
});

export async function capitulosRoutes(app: FastifyInstance) {
  // Lista de capítulos del proyecto (sección Edición de la ficha, más
  // las columnas cara al editor): el especialista dueño, jefe_area, y
  // editor — necesita verla para encontrar el capítulo que va a marcar
  // como entregado.
  app.get(
    '/:proyectoId',
    { preHandler: [requireAuth, requireRole('jefe_area', 'especialista', 'editor')] },
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

      const capitulos = await obtenerCapitulosProyecto(params.proyectoId);
      return reply.send({ capitulos });
    },
  );

  // El capítulo nace cuando el editor arranca su parte — solo en su
  // propio proyecto (ver verificarAccesoAProyecto).
  app.post('/', { preHandler: [requireAuth, requireRole('editor')] }, async (request, reply) => {
    const body = parseOrReply(crearCapituloSchema, request.body, reply);
    if (!body) return;

    if (!request.user) {
      return reply.code(401).send({ error: 'No autenticado' });
    }

    const acceso = await verificarAccesoAProyecto(body.proyectoId, request.user);
    if (!acceso.ok) {
      return reply.code(acceso.status).send({ error: acceso.error });
    }

    const capitulo = await crearCapitulo(body.proyectoId, body.numero);
    return reply.code(201).send({ capitulo });
  });

  // Sección Edición de la ficha: lado autor — solo en su propio
  // proyecto (ver verificarAccesoAProyecto).
  // Restringido a especialista por consistencia con el patrón de "único
  // punto de contacto con el autor" — pendiente de confirmación
  // explícita de jefatura para este campo en particular.
  app.patch(
    '/:proyectoId/:numero/autor',
    { preHandler: [requireAuth, requireRole('especialista')] },
    async (request, reply) => {
      const params = parseOrReply(capituloParamsSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(actualizarCapituloAutorSchema, request.body, reply);
      if (!body) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }

      const acceso = await verificarAccesoAProyecto(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const capitulo = await actualizarCapituloAutor(params.proyectoId, params.numero, body);
      return reply.send({ capitulo });
    },
  );

  // Flujo operativo del editor, fuera de la ficha — solo en su propio
  // proyecto (ver verificarAccesoAProyecto).
  app.patch(
    '/:proyectoId/:numero/editor',
    { preHandler: [requireAuth, requireRole('editor')] },
    async (request, reply) => {
      const params = parseOrReply(capituloParamsSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(actualizarCapituloEditorSchema, request.body, reply);
      if (!body) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }

      const acceso = await verificarAccesoAProyecto(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const capitulo = await actualizarCapituloEditor(params.proyectoId, params.numero, body);
      return reply.send({ capitulo });
    },
  );
}
