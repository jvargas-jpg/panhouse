import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';

async function main() {
  console.log('Ejecutando migraciones...');
  await migrate(db, { migrationsFolder: './server/db/migrations' });
  console.log('Migraciones aplicadas correctamente.');
  await pool.end();
}

main().catch((err) => {
  console.error('Error ejecutando migraciones:', err);
  process.exit(1);
});
