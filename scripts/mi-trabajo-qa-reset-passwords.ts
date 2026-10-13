/** Utilidad QA temporal: resetea passwords de cuentas demo ya existentes. */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, pool } from '../server/db/client.js';
import { users } from '../server/db/schema/index.js';
import { hashPassword } from '../server/helpers/password.js';

async function main() {
  const accounts: [string, string][] = [
    ['especialista.demo@panhouse.test', process.env.SPECIALIST_DEMO_QA_PASSWORD ?? ''],
    ['jefatura.demo@panhouse.test', process.env.JEFATURA_DEMO_QA_PASSWORD ?? ''],
  ];
  if (accounts.some(([, password]) => !password)) throw new Error('Define SPECIALIST_DEMO_QA_PASSWORD y JEFATURA_DEMO_QA_PASSWORD antes de ejecutar QA');
  for (const [email, password] of accounts) {
    const hash = await hashPassword(password);
    await db.update(users).set({ passwordHash: hash }).where(eq(users.email, email));
    console.log('updated', email);
  }
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
