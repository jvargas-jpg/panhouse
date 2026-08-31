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

export type ResultadoEliminarAutor =
  | { ok: true }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: 400; error: string };

// La FK proyectos.autor_id ya es onDelete: 'restrict' (ver
// server/db/schema/proyectos.ts) — la base de datos de todos modos
// rechazaría el DELETE si hay proyectos vinculados. Este chequeo previo
// existe para devolver un 400 legible en vez de dejar que se propague
// el error crudo de Postgres como un 500.
export async function eliminarAutor(autorId: string): Promise<ResultadoEliminarAutor> {
  const [proyectoVinculado] = await db.select({ id: proyectos.id }).from(proyectos).where(eq(proyectos.autorId, autorId)).limit(1);

  if (proyectoVinculado) {
    return { ok: false, status: 400, error: 'No se puede eliminar un autor con proyectos asociados' };
  }

  const [autor] = await db.delete(autores).where(eq(autores.id, autorId)).returning();
  if (!autor) {
    return { ok: false, status: 404, error: 'Autor no encontrado' };
  }

  return { ok: true };
}
