import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { actualizarRegistroSeguimiento, crearRegistroSeguimiento, listarSeguimiento } from '../helpers/seguimiento.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { parseOrReply } from '../helpers/validate.js';

// Módulo "Control de Tiempos" — exclusivo de jefe_area (ver
// SeguimientoPage.tsx). Ningún campo de contenido es obligatorio salvo
// proyectoId al crear — el Excel real se llena progresivamente, columna
// por columna, a medida que avanza el trabajo (ver el comentario
// completo en schema/seguimiento.ts).
const idParamSchema = z.object({ id: z.string().uuid() });

const datosRegistroSchema = z.object({
  analistaId: z.string().uuid().nullable().optional(),
  especialistaId: z.string().uuid().nullable().optional(),
  asignacionTipo: z.string().nullable().optional(),
  tipoServicio: z.string().nullable().optional(),
  paginas: z.number().int().nullable().optional(),
  fechaAsignada: z.string().nullable().optional(),
  horaRecibida: z.string().nullable().optional(),
  fechaInicio: z.string().nullable().optional(),
  horaInicio: z.string().nullable().optional(),
  fechaEntrega: z.string().nullable().optional(),
  horaEntrega: z.string().nullable().optional(),
  estatus: z.string().nullable().optional(),
  totalDias: z.string().nullable().optional(),
  totalHoras: z.string().nullable().optional(),
  tiempoCorrecto: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  freelance: z.boolean().optional(),
  pago80: z.boolean().optional(),
  pago20: z.boolean().optional(),
  resultadosCorreccion: z.string().nullable().optional(),
  cantidadComentarios: z.number().int().nullable().optional(),
  cumplimiento: z.string().nullable().optional(),
});

const crearRegistroSchema = datosRegistroSchema.extend({
  proyectoId: z.string().uuid(),
});

export async function seguimientoRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [requireAuth, requireRole('jefe_area')] }, async (_request, reply) => {
    const registros = await listarSeguimiento();
    return reply.send({ registros });
  });

  app.post('/', { preHandler: [requireAuth, requireRole('jefe_area')] }, async (request, reply) => {
    const body = parseOrReply(crearRegistroSchema, request.body, reply);
    if (!body) return;

    const registro = await crearRegistroSeguimiento(body);
    return reply.code(201).send({ registro });
  });

  app.patch('/:id', { preHandler: [requireAuth, requireRole('jefe_area')] }, async (request, reply) => {
    const params = parseOrReply(idParamSchema, request.params, reply);
    if (!params) return;
    const body = parseOrReply(datosRegistroSchema, request.body, reply);
    if (!body) return;

    const registro = await actualizarRegistroSeguimiento(params.id, body);
    return reply.send({ registro });
  });
}
