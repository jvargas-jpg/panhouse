import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import type { Rol } from '../db/schema/index.js';
import type { AuthenticatedUser } from '../helpers/session.js';
import { validateSession } from '../helpers/session.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

// Siempre verifica en el servidor: nunca confiar en un rol enviado por
// el cliente. `requireAuth` resuelve request.user desde la sesión
// guardada en base de datos; `requireRole` decide sobre ese valor.
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies[env.SESSION_COOKIE_NAME];
  if (!token) {
    await reply.code(401).send({ error: 'No autenticado' });
    return;
  }

  const user = await validateSession(token);
  if (!user) {
    await reply.code(401).send({ error: 'Sesión inválida o expirada' });
    return;
  }

  request.user = user;
}

export function requireRole(...roles: Rol[]) {
  return async function checkRole(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      await reply.code(401).send({ error: 'No autenticado' });
      return;
    }
    if (!roles.includes(request.user.rol)) {
      await reply.code(403).send({ error: 'No autorizado para este recurso' });
    }
  };
}
