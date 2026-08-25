import { eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { autores, proyectos } from '../db/schema/index.js';

// Para la pantalla de jefe_area "Autores sin proyecto": left join contra
// proyectos, filtrado a las filas sin match. Un autor con uno o más
// proyectos sí produce fila(s) con match y queda fuera del resultado;
// solo sobrevive el caso "cero proyectos", que el join resuelve en una
// única fila por autor (todas las columnas de proyectos en null).
export async function listarAutoresSinProyecto() {
  const filas = await db
    .select({ autor: autores })
    .from(autores)
    .leftJoin(proyectos, eq(proyectos.autorId, autores.id))
    .where(isNull(proyectos.id));

  return filas.map((fila) => fila.autor);
}
