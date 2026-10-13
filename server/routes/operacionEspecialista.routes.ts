import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { ErrorFichaViva } from '../helpers/fichaViva.js';
import { guardarPreparacionInicial, preparacionInicialSchema } from '../helpers/preparacionInicial.js';
import { solicitarProcesoArea, actuarSolicitudArea } from '../helpers/solicitudesArea.js';

const proyectoParams = z.object({ proyectoId: z.string().uuid() });
const accion = z.object({ accion: z.enum(['revisar', 'informacion', 'responder', 'aceptar', 'rechazar']),
  texto: z.string().trim().min(10).max(2000).optional(), preguntaId: z.string().uuid().optional(), expectedVersion: z.number().int().positive().optional(),
}).strict();
export async function operacionEspecialistaRoutes(app: FastifyInstance) {
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ErrorFichaViva) return reply.code(error.status).send({ error: error.message });
    if (error instanceof z.ZodError) return reply.code(400).send({ error: 'Datos de operación inválidos', detalles: error.flatten().fieldErrors });
    throw error;
  });
  app.patch('/proyectos/:proyectoId/preparacion-inicial', { preHandler: [requireAuth, requireRole('especialista')] }, async req => {
    const { proyectoId } = proyectoParams.parse(req.params);
    return guardarPreparacionInicial(proyectoId, preparacionInicialSchema.parse(req.body), req.user!);
  });
  for (const tipo of ['lanzamiento', 'impresion'] as const) {
    app.post(`/proyectos/:proyectoId/solicitar-${tipo}`, { preHandler: [requireAuth, requireRole('especialista')] }, async req => {
      const { proyectoId } = proyectoParams.parse(req.params);
      z.object({}).strict().parse(req.body ?? {});
      return solicitarProcesoArea(proyectoId, tipo, req.user!);
    });
  }
  app.post('/solicitudes-area/:id/acciones', { preHandler: [requireAuth, requireRole('especialista', 'rrpp')] }, async req => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { accion: command, ...datos } = accion.parse(req.body);
    return actuarSolicitudArea(id, command, req.user!, datos);
  });
}
