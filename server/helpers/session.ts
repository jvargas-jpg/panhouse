import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import type { Rol } from '../db/schema/index.js';
import { sessions, users } from '../db/schema/index.js';
import { env } from '../config/env.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  // Solo tiene valor cuando rol = 'autor' (ver users.autorId en
  // server/db/schema/users.ts) — resuelto acá, en la misma consulta de
  // sesión, para que las rutas del Portal del Autor no necesiten una
  // consulta aparte para saber "los libros de quién".
  autorId: string | null;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);

  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });

  return token;
}

export async function validateSession(token: string): Promise<AuthenticatedUser | null> {
  const tokenHash = hashToken(token);

  const [fila] = await db
    .select({
      expiresAt: sessions.expiresAt,
      userId: users.id,
      email: users.email,
      nombre: users.nombre,
      rol: users.rol,
      activo: users.activo,
      autorId: users.autorId,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, tokenHash))
    .limit(1);

  if (!fila || !fila.activo) return null;

  if (fila.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, tokenHash));
    return null;
  }

  return { id: fila.userId, email: fila.email, nombre: fila.nombre, rol: fila.rol, autorId: fila.autorId };
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}
