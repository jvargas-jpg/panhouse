import 'dotenv/config';
import pg from 'pg';

// Fixed names owned by this QA run; no project/user deletion or dynamic names.
const source = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(source.hostname))
  throw new Error('QA cleanup requires local PostgreSQL');
const owned = ['panhouse_decisiones_qa', 'panhouse_codex_decisiones_test'];
if (owned.some((name) => source.pathname === `/${name}`))
  throw new Error('Use the original development configuration');
source.pathname = '/postgres';
const pool = new pg.Pool({ connectionString: source.toString() });
try {
  for (const name of owned) {
    await pool.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',
      [name],
    );
    // SQL identifiers are fixed literals, never supplied by the caller.
    if (name === 'panhouse_decisiones_qa')
      await pool.query('DROP DATABASE IF EXISTS panhouse_decisiones_qa');
    else await pool.query('DROP DATABASE IF EXISTS panhouse_codex_decisiones_test');
  }
  const left = await pool.query(
    'SELECT datname FROM pg_database WHERE datname=ANY($1::text[])',
    [owned],
  );
  if (left.rowCount) throw new Error('Owned QA database remains');
  console.log('Owned Decisions QA databases removed; absence verified.');
} finally {
  await pool.end();
}
