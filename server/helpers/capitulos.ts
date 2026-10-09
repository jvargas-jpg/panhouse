import { and, count, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { autores, capitulos, proyectos, servicios } from '../db/schema/index.js';
import { calcularFechaPautadaFeedbackCapitulo } from './edicionSla.js';
import { ESTADOS_ACTIVOS } from './carga.js';
import { habilitarPlanificacionRrpp } from './rrppLanzamientoGate.js';

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
//
// Fase 5 (5A Edición): si se registra fechaEnvioAutor y el caller NO
// trae ya una fechaPautadaFeedback explícita en el mismo payload, se
// calcula el default (3 días hábiles, ver server/helpers/edicionSla.ts)
// en vez de dejarlo en blanco esperando que alguien lo calcule a mano.
// Nunca pisa un valor que el caller sí envió explícitamente.
export async function actualizarCapituloAutor(proyectoId: string, numero: number, datos: DatosCapituloAutor, actorId: string | null = null) {
  const datosConPlazo = { ...datos };
  if (datos.fechaEnvioAutor && datos.fechaPautadaFeedback === undefined) {
    datosConPlazo.fechaPautadaFeedback = calcularFechaPautadaFeedbackCapitulo(datos.fechaEnvioAutor);
  }

  return db.transaction(async tx => {
    await tx.select({ id: proyectos.id }).from(proyectos).where(eq(proyectos.id, proyectoId)).for('update');
    const [fila] = await tx
      .update(capitulos)
      .set(datosConPlazo)
      .where(and(eq(capitulos.proyectoId, proyectoId), eq(capitulos.numero, numero)))
      .returning();

    if (!fila) throw new Error(`Capítulo no encontrado: proyecto ${proyectoId}, número ${numero}`);
    if (numero === 4 && fila.fechaEnvioAutor) await habilitarPlanificacionRrpp(tx, proyectoId, actorId);
    return fila;
  });
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

export type EstadoTrabajoCapitulo = 'feedback_para_aplicar' | 'esperando_autor' | 'por_iniciar' | 'entregado';

export interface TrabajoEditorCapitulo {
  proyectoId: string;
  proyectoCodigo: string;
  autorNombre: string;
  servicioCodigo: string;
  numero: number;
  fechaEnvioAutor: string | null;
  fechaPautadaFeedback: string | null;
  fechaRespuestaReal: string | null;
  fechaInicioEditor: string | null;
  fechaEntregaEditor: string | null;
  estado: EstadoTrabajoCapitulo;
}

// "Mis Trabajos de Edición" (Fase 5, §38 — Editor): a diferencia de
// listarProyectosEditor (alertas.ts, nivel proyecto), esto resuelve a
// nivel de CAPÍTULO — lo que el editor realmente necesita saber: qué
// capítulo tiene feedback del autor esperando ser aplicado (prioridad
// más alta), cuál está esperando que el autor responda, cuál no ha
// arrancado, cuál ya se entregó. Nunca expone capítulos de proyectos
// ajenos (editorId filtra al dueño real, mismo criterio que
// verificarAccesoAProyecto en server/helpers/proyectos.ts).
function estadoTrabajoCapitulo(fila: {
  fechaRespuestaReal: string | null;
  fechaEntregaEditor: string | null;
  fechaEnvioAutor: string | null;
}): EstadoTrabajoCapitulo {
  if (fila.fechaEntregaEditor) return 'entregado';
  if (fila.fechaRespuestaReal) return 'feedback_para_aplicar';
  if (fila.fechaEnvioAutor) return 'esperando_autor';
  return 'por_iniciar';
}

export async function listarTrabajosEditor(editorId: string): Promise<TrabajoEditorCapitulo[]> {
  const filas = await db
    .select({
      proyectoId: proyectos.id,
      proyectoCodigo: proyectos.codigo,
      autorNombre: autores.nombre,
      servicioCodigo: servicios.codigo,
      numero: capitulos.numero,
      fechaEnvioAutor: capitulos.fechaEnvioAutor,
      fechaPautadaFeedback: capitulos.fechaPautadaFeedback,
      fechaRespuestaReal: capitulos.fechaRespuestaReal,
      fechaInicioEditor: capitulos.fechaInicioEditor,
      fechaEntregaEditor: capitulos.fechaEntregaEditor,
    })
    .from(capitulos)
    .innerJoin(proyectos, eq(capitulos.proyectoId, proyectos.id))
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .where(and(eq(proyectos.editorId, editorId), inArray(proyectos.estado, ESTADOS_ACTIVOS)));

  return filas
    .map((fila) => ({ ...fila, estado: estadoTrabajoCapitulo(fila) }))
    .sort((a, b) => ORDEN_PRIORIDAD[a.estado] - ORDEN_PRIORIDAD[b.estado]);
}

const ORDEN_PRIORIDAD: Record<EstadoTrabajoCapitulo, number> = {
  feedback_para_aplicar: 0,
  por_iniciar: 1,
  esperando_autor: 2,
  entregado: 3,
};
