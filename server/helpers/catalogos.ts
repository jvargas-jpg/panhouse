import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { presupuestos, servicios, unidades } from '../db/schema/index.js';

// Para el formulario de creación de proyecto (jefe_area): las tres
// listas activas en una sola llamada, en vez de tres round-trips. No
// incluye colecciones — esa tabla está vacía a propósito, sin nada que
// elegir todavía (ver comentario en server/db/schema/catalogos.ts).
export async function listarCatalogosProyecto() {
  const [listaServicios, listaUnidades, listaPresupuestos] = await Promise.all([
    db.select().from(servicios).where(eq(servicios.activo, true)),
    db.select().from(unidades).where(eq(unidades.activo, true)),
    db.select().from(presupuestos).where(eq(presupuestos.activo, true)),
  ]);

  return { servicios: listaServicios, unidades: listaUnidades, presupuestos: listaPresupuestos };
}
