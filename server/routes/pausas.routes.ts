import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CAUSAS_PAUSA } from '../db/schema/index.js';
import { crearPausa, listarPausasProyecto, validarPausaFormal } from '../helpers/pausas.js';
import { verificarAccesoAProyecto } from '../helpers/proyectos.js';
import { parseOrReply } from '../helpers/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const proyectoIdParamSchema = z.object({ proyectoId: z.string().uuid() });

const crearPausaSchema = z.object({
  proyectoId: z.string().uuid(),
  causa: z.enum(CAUSAS_PAUSA),
  fechaInicio: z.coerce.date(),
  fechaFin: z.coerce.date().nullable().optional(),
  esPausadoFormal: z.boolean().optional(),
  fechaLimiteRetoma: z.string().nullable().optional(),
  recargoAplica: z.boolean().optional(),
  pagoConfirmado: z.boolean().optional(),
});

export async function pausasRoutes(app: FastifyInstance) {
  // Lista de pausas del proyecto (para la pantalla de detalle): el
  // especialista dueño, y jefe_area.
  app.get('/:proyectoId', { preHandler: [requireAuth, requireRole('jefe_area', 'especialista')] }, async (request, reply) => {
    const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
    if (!params) return;

    if (!request.user) {
      return reply.code(401).send({ error: 'No autenticado' });
    }

    const acceso = await verificarAccesoAProyecto(params.proyectoId, request.user);
    if (!acceso.ok) {
      return reply.code(acceso.status).send({ error: acceso.error });
    }

    const pausas = await listarPausasProyecto(params.proyectoId);
    return reply.send({ pausas });
  });

  // Puerta base: especialista puede crear pausas normales; jefe_area
  // además puede crear pausas formales. Cuál de las dos aplica depende
  // del contenido del body (esPausadoFormal), no solo del rol, así que
  // se resuelve dentro del handler y no en requireRole.
  app.post('/', { preHandler: [requireAuth, requireRole('especialista', 'jefe_area')] }, async (request, reply) => {
    const body = parseOrReply(crearPausaSchema, request.body, reply);
    if (!body) return;

    if (!request.user) {
      return reply.code(401).send({ error: 'No autenticado' });
    }

    if (body.esPausadoFormal && request.user.rol !== 'jefe_area') {
      // TODO: confirmar con negocio quién puede marcar pago_confirmado
      // — hoy restringido a jefe de área como default provisional.
      return reply.code(403).send({ error: 'Solo jefe de área puede crear pausas formales (PAUSADO)' });
    }

    try {
      validarPausaFormal(body);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Datos inválidos' });
    }

    // Quién y cuándo confirmó el pago se deriva de la sesión, nunca del
    // body: el cliente no puede atribuirle la confirmación a otro usuario.
    const pausa = await crearPausa({
      ...body,
      origenConfirmacionPago: body.pagoConfirmado ? 'manual' : undefined,
      confirmadoPagoPorId: body.pagoConfirmado ? request.user.id : undefined,
      confirmadoPagoEn: body.pagoConfirmado ? new Date() : undefined,
    });

    return reply.code(201).send({ pausa });
  });
}
