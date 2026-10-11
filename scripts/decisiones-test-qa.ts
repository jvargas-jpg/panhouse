import 'dotenv/config';
import pg from 'pg';
import { spawn } from 'node:child_process';

// Dedicated regression database: never share truncation with another agent.
const source = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(source.hostname))
  throw new Error('Regression QA must use local PostgreSQL');
const admin = new URL(source);
admin.pathname = '/postgres';
const pool = new pg.Pool({ connectionString: admin.toString() });
const shard = process.env.PANHOUSE_QA_SHARD;
if (shard && !['1', '2', '3'].includes(shard))
  throw new Error('QA shard must be 1, 2 or 3');
const base = shard ? `panhouse_codex_decisiones_${shard}` : 'panhouse_codex_decisiones';
const name = `${base}_test`;
try {
  const found = await pool.query('SELECT 1 FROM pg_database WHERE datname=$1', [
    name,
  ]);
  if (!found.rowCount)
    await pool.query(`CREATE DATABASE "${name}"`);
} finally {
  await pool.end();
}
// server/config/env.ts appends _test in NODE_ENV=test.
source.pathname = `/${base}`;
const child = spawn(
  process.execPath,
  ['node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: source.toString() },
  },
);
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
