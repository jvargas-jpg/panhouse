import 'dotenv/config';
import pg from 'pg';

// Only the disposable database created by seguimiento-isolated-qa.ts.
const qaDatabase = 'panhouse_seguimiento_qa';
const source = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(source.hostname))
  throw new Error('QA cleanup requires a local PostgreSQL server');
if (source.pathname === `/${qaDatabase}`)
  throw new Error('Run cleanup from the original development configuration');
source.pathname = '/postgres';
const pool = new pg.Pool({ connectionString: source.toString() });
try {
  await pool.query(
    'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
    [qaDatabase],
  );
  await pool.query('DROP DATABASE IF EXISTS panhouse_seguimiento_qa');
  const remaining = await pool.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [qaDatabase],
  );
  if (remaining.rowCount !== 0) throw new Error('QA database still exists');
  console.log(
    'Disposable seguimiento QA database removed and absence verified.',
  );
} finally {
  await pool.end();
}
