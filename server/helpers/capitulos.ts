import { and, count, eq, isNotNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { capitulos } from '../db/schema/index.js';

// El capítulo nace cuando alguien lo crea por primera vez (típicamente
// el editor, al arrancar su parte), con los campos de contenido
// vacíos. Se va completando después con actualizarCapituloAutor.
export async function crearCapitulo(proyectoId: string, numero: number) {
  const [fila] = await db.insert(capitulos).values({ proyectoId, numero }).returning();
  if (!fila) throw new Error('El insert del capítulo no devolvió ninguna fila');
  return fila;
}

export interface DatosCapituloAutor {
  fechaEnvioAutor?: string | null;
  fechaPautadaFeedback?: string | null;
  fechaRespuestaReal?: string | null;
  enlaces?: string[] | null;
}

// Sección Edición de la ficha de trazabilidad: solo toca las columnas
// "cara al autor" del capítulo, nunca las "cara al editor" (paginas,
// fechaInicioEditor, fechaEntregaEditor) — esas pertenecen a un futuro
// flujo de edición operativa, no a la ficha.
export async function actualizarCapituloAutor(proyectoId: string, numero: number, datos: DatosCapituloAutor) {
  const [fila] = await db
    .update(capitulos)
    .set(datos)
    .where(and(eq(capitulos.proyectoId, proyectoId), eq(capitulos.numero, numero)))
    .returning();

  if (!fila) throw new Error(`Capítulo no encontrado: proyecto ${proyectoId}, número ${numero}`);
  return fila;
}

export interface DatosCapituloEditor {
  fechaInicioEditor?: string | null;
  paginas?: number | null;
  fechaEntregaEditor?: string | null;
}

// Lado editor del capítulo (flujo operativo, fuera de la ficha de
// trazabilidad): nunca toca las columnas "cara al autor" — mismo
// principio de aislamiento que actualizarCapituloAutor, en reversa.
export async function actualizarCapituloEditor(proyectoId: string, numero: number, datos: DatosCapituloEditor) {
  const [fila] = await db
    .update(capitulos)
    .set(datos)
    .where(and(eq(capitulos.proyectoId, proyectoId), eq(capitulos.numero, numero)))
    .returning();

  if (!fila) throw new Error(`Capítulo no encontrado: proyecto ${proyectoId}, número ${numero}`);
  return fila;
}

export async function obtenerCapitulosProyecto(proyectoId: string) {
  return db.select().from(capitulos).where(eq(capitulos.proyectoId, proyectoId)).orderBy(capitulos.numero);
}

// Avance operativo real de la sección 1 de la ficha: nunca un contador
// almacenado que alguien deba mantener al día, siempre se cuenta desde
// `capitulos` en el momento de la consulta. "Entregado" = tiene fecha
// de entrega del editor.
export async function contarCapitulosEntregados(proyectoId: string): Promise<number> {
  const [fila] = await db
    .select({ total: count() })
    .from(capitulos)
    .where(and(eq(capitulos.proyectoId, proyectoId), isNotNull(capitulos.fechaEntregaEditor)));

  return fila?.total ?? 0;
}
