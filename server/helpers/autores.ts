import { eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { autores, proyectos, proyectosAutores } from '../db/schema/index.js';

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

export type ResultadoEliminarAutor =
  | { ok: true }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: 400; error: string };

// Las FK proyectos.autor_id y proyectos_autores.autor_id ya son
// onDelete: 'restrict' (ver server/db/schema/proyectos.ts) — la base de
// datos de todos modos rechazaría el DELETE si hay proyectos
// vinculados. Este chequeo previo existe para devolver un 400 legible
// en vez de dejar que se propague el error crudo de Postgres como un
// 500. Revisa las DOS tablas a propósito: proyectos.autorId (columna
// legacy, "autor principal") y proyectos_autores (coautoría) — un autor
// puede estar vinculado a un proyecto por cualquiera de las dos vías, y
// antes de este chequeo solo se revisaba la primera, así que un autor
// que fuera SOLO coautor (nunca autorId principal de nada) pasaba este
// chequeo sin problema y el DELETE de más abajo terminaba reventando
// con el error crudo de Postgres que este chequeo existe para evitar.
export async function eliminarAutor(autorId: string): Promise<ResultadoEliminarAutor> {
  const [proyectoVinculado] = await db.select({ id: proyectos.id }).from(proyectos).where(eq(proyectos.autorId, autorId)).limit(1);
  const [coautoriaVinculada] = await db
    .select({ proyectoId: proyectosAutores.proyectoId })
    .from(proyectosAutores)
    .where(eq(proyectosAutores.autorId, autorId))
    .limit(1);

  if (proyectoVinculado || coautoriaVinculada) {
    return {
      ok: false,
      status: 400,
      error: 'No se puede eliminar un autor con proyectos activos. Elimina sus proyectos primero.',
    };
  }

  const [autor] = await db.delete(autores).where(eq(autores.id, autorId)).returning();
  if (!autor) {
    return { ok: false, status: 404, error: 'Autor no encontrado' };
  }

  return { ok: true };
}
