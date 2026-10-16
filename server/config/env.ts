import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  SESSION_COOKIE_NAME: z.string().default('panhouse_sid'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  APP_FRONTEND_URL: z.string().default('http://localhost:5173'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().default('http://localhost:3000/api/auth/google/callback'),
  GOOGLE_DRIVE_SCOPE: z.string().default('https://www.googleapis.com/auth/drive.file'),
  GOOGLE_TOKEN_ENCRYPTION_KEY: z.string().optional(),
  // SSO con el portal de pago (ver server/helpers/pagos.ts). Clave
  // compartida pendiente de coordinar con el equipo de pagos — no
  // tiene valor por defecto real a propósito.
  PAYMENT_SSO_SECRET: z.string().min(1),
  PAYMENT_PORTAL_URL: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variables de entorno inválidas:', parsed.error.flatten().fieldErrors);
  throw new Error('Configuración de entorno inválida. Revisa tu archivo .env (ver .env.example).');
}

const raw = parsed.data;

// En modo test, la app y las migraciones apuntan a "<db>_test" para no
// tocar los datos de desarrollo. Esa base la crea el script de init de
// Docker (docker/postgres-init/01-create-test-db.sh).
function resolverDatabaseUrl(url: string): string {
  if (raw.NODE_ENV !== 'test') return url;
  const parsedUrl = new URL(url);
  parsedUrl.pathname = `${parsedUrl.pathname}_test`;
  return parsedUrl.toString();
}

export const env = {
  ...raw,
  DATABASE_URL: resolverDatabaseUrl(raw.DATABASE_URL),
  COOKIE_SECURE: raw.COOKIE_SECURE === 'true',
};
