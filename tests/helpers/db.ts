import { sql } from 'drizzle-orm';
import { db, pool } from '../../server/db/client.js';

const TABLAS = [
  'sesiones',
  'ficha_calidad_fases',
  'ficha_diseno_propuestas',
  'ficha_lanzamiento_reuniones',
  'ficha_distribucion_paises',
  'fichas_trazabilidad',
  'capitulos',
  'pausas',
  'proyectos',
  'servicio_fases',
  'pasos',
  'fases',
  'servicios',
  'colecciones',
  'presupuestos',
  'unidades',
  'autores',
  'usuarios',
];

export async function limpiarBaseDeDatos(): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE TABLE ${TABLAS.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`));
}

export async function cerrarConexionDb(): Promise<void> {
  await pool.end();
}
