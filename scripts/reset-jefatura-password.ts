/** Utilidad QA temporal: resetea la contraseña de jefatura demo. */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, pool } from '../server/db/client.js';
import { users } from '../server/db/schema/index.js';
import { hashPassword } from '../server/helpers/password.js';

async function main() {
  const email = 'jefatura.demo@panhouse.test';
  const password = process.env.JEFATURA_DEMO_QA_PASSWORD;
  if (!password) throw new Error('Define JEFATURA_DEMO_QA_PASSWORD antes de ejecutar este script');
  const hash = await hashPassword(password);
  await db.update(users).set({ passwordHash: hash }).where(eq(users.email, email));
  console.log('updated', email);
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
