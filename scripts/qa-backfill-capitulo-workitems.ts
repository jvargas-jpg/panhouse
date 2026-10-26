/** QA temporal: materializa work_items para capítulos demo sembrados sin pasar por crearCapitulo(). */
import 'dotenv/config';
import { db, pool } from '../server/db/client.js';
import { capitulos } from '../server/db/schema/index.js';
import { sincronizarCapituloEditorial } from '../server/helpers/editorialInterventions.js';

async function main() {
  const rows = await db.select({ id: capitulos.id }).from(capitulos);
  await db.transaction(async tx => {
    for (const c of rows) await sincronizarCapituloEditorial(tx, c.id, 'crear');
  });
  console.log('materialized', rows.length, 'work_items');
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
