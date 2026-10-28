import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { getDigitalSupportDashboard } from '../helpers/soporteDigitalHome.js';
export async function soporteDigitalHomeRoutes(app: FastifyInstance) {
  app.get('/inicio', {preHandler:[requireAuth,requireRole('soporte_digital')]}, async (request,reply) => {
    if (!z.object({}).strict().safeParse(request.query).success) return reply.code(400).send({error:'Inicio no admite identificadores ni filtros de otros proyectos'});
    return getDigitalSupportDashboard();
  });
}
