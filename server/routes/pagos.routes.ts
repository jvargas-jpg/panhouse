import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { actualizarEstatusPago, listarPagos, registrarPago } from '../helpers/pagosProyecto.js';
import { parseOrReply } from '../helpers/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const crearPagoSchema = z.object({
  proyectoId: z.string().uuid(),
  monto: z.string().min(1),
  moneda: z.string().min(1).optional(),
  fechaPago: z.string().min(1),
  metodoPago: z.string().min(1),
  referencia: z.string().nullable().optional(),
  comprobanteUrl: z.string().nullable().optional(),
});

const listarPagosQuerySchema = z.object({
  proyectoId: z.string().uuid().optional(),
});

const pagoIdParamSchema = z.object({ id: z.string().uuid() });

// motivoRechazo obligatorio solo cuando se rechaza — cobranzas necesita
// dejar registrado por qué (comprobante ilegible, monto no coincide,
// etc.), quien registró el pago lo necesita para corregir y reenviar.
const verificarPagoSchema = z
  .object({
    estatus: z.enum(['Verificado', 'Rechazado']),
    motivoRechazo: z.string().nullable().optional(),
  })
  .refine((datos) => datos.estatus !== 'Rechazado' || Boolean(datos.motivoRechazo?.trim()), {
    message: 'motivoRechazo es obligatorio al rechazar un pago',
    path: ['motivoRechazo'],
  });

// Módulo financiero de Comercial ("Registrar Pago" en el sidebar):
// comercial/rrpp (relación directa con el cliente que paga) y cobranzas
// (rol que ya existía en el enum de roles desde el inicio del proyecto
// pero nunca se usó en ninguna ruta — encaja exactamente acá), más
// jefe_area con el mismo alcance de supervisión que ya tiene sobre el
// resto del sistema.
export async function pagosRoutes(app: FastifyInstance) {
  app.post('/', { preHandler: [requireAuth, requireRole('comercial', 'rrpp', 'cobranzas', 'jefe_area')] }, async (request, reply) => {
    const body = parseOrReply(crearPagoSchema, request.body, reply);
    if (!body) return;

    const pago = await registrarPago(body);
    return reply.code(201).send({ pago });
  });

  app.get('/', { preHandler: [requireAuth, requireRole('comercial', 'rrpp', 'cobranzas', 'jefe_area')] }, async (request, reply) => {
    const query = parseOrReply(listarPagosQuerySchema, request.query, reply);
    if (!query) return;

    const pagos = await listarPagos(query.proyectoId);
    return reply.send({ pagos });
  });

  // Cierre del ciclo de vida del pago — exclusivo de quien audita, no
  // de quien registra: comercial/rrpp NO están en esta lista a
  // propósito (separación de funciones: quien carga un pago no puede
  // autoverificarlo).
  app.patch(
    '/:id/verificar',
    { preHandler: [requireAuth, requireRole('cobranzas', 'jefe_area', 'direccion')] },
    async (request, reply) => {
      const params = parseOrReply(pagoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(verificarPagoSchema, request.body, reply);
      if (!body) return;

      const pago = await actualizarEstatusPago(params.id, body);
      if (!pago) {
        return reply.code(404).send({ error: 'Pago no encontrado' });
      }
      return reply.send({ pago });
    },
  );
}
