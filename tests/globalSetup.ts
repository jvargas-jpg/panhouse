export default async function setup() {
  process.env.NODE_ENV = 'test';

  const { migrate } = await import('drizzle-orm/node-postgres/migrator');
  const { db, pool } = await import('../server/db/client.js');

  await migrate(db, { migrationsFolder: './server/db/migrations' });
  await pool.end();
}
