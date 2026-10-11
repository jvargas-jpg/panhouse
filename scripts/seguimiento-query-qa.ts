import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const source = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(source.hostname))
  throw new Error('Only isolated local QA');
source.pathname = '/panhouse_seguimiento_qa';
process.env.DATABASE_URL = source.toString();
process.env.NODE_ENV = 'development';
const { db, pool } = await import('../server/db/client.js');
const { migrate } = await import('drizzle-orm/node-postgres/migrator');
await migrate(db, { migrationsFolder: './server/db/migrations' });
const { listarIntervenciones, obtenerIntervencion, actividadIntervencion } =
  await import('../server/helpers/seguimientoIntervenciones.js');
const { obtenerSeguimientoGeneral } = await import(
  '../server/helpers/seguimientoGeneral.js'
);
const { obtenerDashboardJefatura } = await import(
  '../server/helpers/jefatura.js'
);
const { obtenerQuickViewJefatura } = await import(
  '../server/helpers/jefaturaProyectos.js'
);
const cases = JSON.parse(
  await readFile(
    join(tmpdir(), 'panhouse-browser-qa/cases-seguimiento.json'),
    'utf8',
  ),
);
let count = 0;
const original = pool.query.bind(pool);
pool.query = ((...args: unknown[]) => {
  count++;
  return (original as (...v: unknown[]) => unknown)(...args);
}) as typeof pool.query;
const defaults = {
  q: '',
  grupo: 'todas' as const,
  orden: 'urgentes' as const,
  page: 1,
  pageSize: 10,
};
const results: Record<string, { queries: number; rows?: number }> = {};
for (const size of [10, 50]) {
  count = 0;
  const r = await listarIntervenciones({ ...defaults, pageSize: size });
  results[`intervenciones-${size}`] = { queries: count, rows: r.items.length };
}
count = 0;
const general = await obtenerSeguimientoGeneral({
  q: '',
  orden: 'urgentes',
  page: 1,
  pageSize: 20,
});
results.general = { queries: count, rows: general.items.length };
count = 0;
const snapshot = await obtenerDashboardJefatura();
await obtenerQuickViewJefatura(cases.A.proyectoId, snapshot);
results['general-detalle'] = { queries: count };
count = 0;
await obtenerIntervencion(cases.A.origen, cases.A.id);
results['intervencion-detalle'] = { queries: count };
count = 0;
await actividadIntervencion(cases.J.origen, cases.J.id);
results['intervencion-actividad'] = { queries: count };
await writeFile(
  'docs/evidencias/seguimiento-jefatura/query-counts.json',
  JSON.stringify(results, null, 2),
);
console.log(results);
await pool.end();
