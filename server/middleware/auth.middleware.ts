import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import type { Rol } from '../db/schema/index.js';
import type { AuthenticatedUser } from '../helpers/session.js';
import { sessionContext } from '../helpers/session.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    realAdmin?: AuthenticatedUser;
    sessionPublicId?: string;
    authChecked?: boolean;
  }
}

// Siempre verifica en el servidor: nunca confiar en un rol enviado por
// el cliente. `requireAuth` resuelve request.user desde la sesión
// guardada en base de datos; `requireRole` decide sobre ese valor.
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if(request.user)return;
  const token = request.cookies[env.SESSION_COOKIE_NAME];
  if (!token) {
    await reply.code(401).send({ error: 'No autenticado' });
    return;
  }

  const context = request.authChecked ? null : await sessionContext(token);
  if (!context) {
    await reply.code(401).send({ error: 'Sesión inválida o expirada' });
    return;
  }

  request.user = context.user;
  request.realAdmin = context.realAdmin;
  request.sessionPublicId = context.publicId;
}

// Runs before route guards, including legacy writes. The context lives only
// in the server-side session, never in an impersonation header/body/query.
export async function enforceSessionContext(request:FastifyRequest,reply:FastifyReply){
 const token=request.cookies[env.SESSION_COOKIE_NAME];if(!token)return;
 const c=await sessionContext(token);request.authChecked=true;if(!c)return;
 request.user=c.user;request.realAdmin=c.realAdmin;request.sessionPublicId=c.publicId;
 const path=request.url.split('?')[0];
 if(c.realAdmin&&((!['GET','HEAD','OPTIONS'].includes(request.method)&&!['/api/admin/view-as/stop','/api/auth/logout'].includes(path!))||path==='/api/auth/google/callback'))await reply.code(403).send({error:'Modo administrador solo lectura: sal de Ver como usuario para realizar cambios'});
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
