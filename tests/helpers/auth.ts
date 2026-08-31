import type { FastifyInstance } from 'fastify';
import request from 'supertest';
import type { Rol } from '../../server/db/schema/index.js';
import { crearUsuario } from './fixtures.js';

// Ya no pasa por POST /api/auth/register (cerrado a propósito — ver
// server/routes/auth.routes.ts): crea el usuario directo en la base,
// mismo patrón que cualquier otro fixture, y solo usa el endpoint
// público de login para conseguir una cookie de sesión real.
export async function registrarYLoguear(app: FastifyInstance, rol: Rol, autorId?: string): Promise<string> {
  const usuario = await crearUsuario(rol, autorId);

  const login = await request(app.server).post('/api/auth/login').send({
    email: usuario.email,
    password: 'password123',
  });

  const cookie = login.headers['set-cookie'];
  if (!cookie) throw new Error('El login no devolvió cookie de sesión');
  return cookie;
}
