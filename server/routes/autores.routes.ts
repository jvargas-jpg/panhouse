import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { autores } from '../db/schema/index.js';
import { listarAutoresSinProyecto } from '../helpers/autores.js';
import { parseOrReply } from '../helpers/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

// Ejemplo mínimo de recurso protegido por rol, usado también como base
// para los tests de RBAC. Los roles con acceso a esta lista interna de
// autores se ajustarán cuando se definan los permisos reales del módulo.
const ROLES_LECTURA_AUTORES = ['comercial', 'rrpp', 'jefe_area', 'direccion'] as const;
const ROLES_ESCRITURA_AUTORES = ['comercial', 'direccion'] as const;

const crearAutorSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email().optional(),
  telefono: z.string().optional(),
  pais: z.string().optional(),
  relevancia: z.number().int().min(1).max(5).optional(),
});

export async function autoresRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { preHandler: [requireAuth, requireRole(...ROLES_LECTURA_AUTORES)] },
    async (_request, reply) => {
      const lista = await db.select().from(autores);
      return reply.send({ autores: lista });
    },
  );

  // Pantalla "Autores sin proyecto" de jefe_area: punto de partida del
  // flujo crear-proyecto + asignar-especialista. Solo jefe_area la usa
  // hoy; se amplía por rol si otro lo necesita más adelante.
  app.get(
    '/sin-proyecto',
    { preHandler: [requireAuth, requireRole('jefe_area')] },
    async (_request, reply) => {
      const lista = await listarAutoresSinProyecto();
      return reply.send({ autores: lista });
    },
  );

  app.post(
    '/',
    { preHandler: [requireAuth, requireRole(...ROLES_ESCRITURA_AUTORES)] },
    async (request, reply) => {
      const body = parseOrReply(crearAutorSchema, request.body, reply);
      if (!body) return;

      const [autor] = await db.insert(autores).values(body).returning();
      return reply.code(201).send({ autor });
    },
  );
}
