import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { users,securityEvents } from '../db/schema/index.js';
import { verifyPassword } from '../helpers/password.js';
import { createSession, destroySession } from '../helpers/session.js';
import { parseOrReply } from '../helpers/validate.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: env.SESSION_TTL_HOURS * 3600,
  });
}

// No hay POST /register: crear cuentas de equipo (o de autor) es una
// acción administrativa, no un formulario público — ver
// server/db/createUser.ts para provisión manual mientras no exista el
// flujo real de alta/baja de usuarios (RF pendiente).
export async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (request, reply) => {
    if(request.headers.origin&&request.headers.origin!==new URL(env.APP_FRONTEND_URL).origin)return reply.code(403).send({error:'Origen no autorizado'});
    const body = parseOrReply(loginSchema, request.body, reply);
    if (!body) return;

    const user = await db.query.users.findFirst({ where: eq(users.email, body.email) });
    if (!user || !user.activo || !(await verifyPassword(user.passwordHash, body.password))) {
      await db.insert(securityEvents).values({action:'LOGIN_FAILURE',targetUserId:user?.id??null,ip:request.ip.slice(0,64),userAgent:request.headers['user-agent']?.slice(0,400)});
      return reply.code(401).send({ error: 'Credenciales inválidas' });
    }

    const token = await createSession(user.id,{ip:request.ip,userAgent:request.headers['user-agent']});
    setSessionCookie(reply, token);

    return reply.send({
      user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol },
    });
  });

  app.post('/logout', { preHandler: requireAuth }, async (request, reply) => {
    const token = request.cookies[env.SESSION_COOKIE_NAME];
    if (token) await destroySession(token);
    reply.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' });
    return reply.send({ ok: true });
  });

  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    return reply.send({ user: request.user });
  });
}
