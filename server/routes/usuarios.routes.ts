import type { FastifyInstance } from 'fastify';
import { listarUsuarios } from '../helpers/usuarios.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

// Único consumidor hoy: SeccionEquipo.tsx ("Escuadrón de Producción" en
// ProyectoDetallePage.tsx) — mismos roles que pueden ver esa sección
// (puedeVerFicha del frontend, sin comercial). La escritura real
// (PATCH /:id/equipo) sigue acotada a jefe_area — este GET solo resuelve
// nombres para que cualquiera que vea el panel pueda leer quién está
// asignado, no solo quien puede reasignar.
export async function usuariosRoutes(app: FastifyInstance) {
  app.get(
    '/',
    {
      preHandler: [
        requireAuth,
        requireRole('jefe_area', 'especialista', 'rrpp', 'disenador', 'lider_creativo', 'soporte_editorial', 'soporte_digital'),
      ],
    },
    async (_request, reply) => {
      const usuarios = await listarUsuarios();
      return reply.send({ usuarios });
    },
  );
}
