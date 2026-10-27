import { and, count, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { autores, capitulos, proyectos, servicios, notificaciones } from '../db/schema/index.js';
import { sincronizarCapituloEditorial } from './editorialInterventions.js';
import { registrarEvento } from './auditLog.js';
import { calcularFechaPautadaFeedbackCapitulo } from './edicionSla.js';
import { ESTADOS_ACTIVOS, obtenerEspecialistaActual } from './carga.js';
import { habilitarPlanificacionRrpp } from './rrppLanzamientoGate.js';
import type { Tx } from './tx.js';

// El capítulo nace cuando alguien lo crea por primera vez (típicamente
// el editor, al arrancar su parte), con los campos de contenido
// vacíos. Se va completando después con actualizarCapituloAutor.
export async function crearCapitulo(proyectoId: string, numero: number, actorId?:string) {
  return db.transaction(async tx => {
    const [project]=await tx.select({id:proyectos.id,editorId:proyectos.editorId}).from(proyectos).where(eq(proyectos.id,proyectoId)).for('update');
    if(actorId&&project?.editorId!==actorId)throw Object.assign(new Error('El proyecto ya no está asignado a este Editor'),{statusCode:403});
    const [fila] = await tx.insert(capitulos).values({ proyectoId, numero }).returning();
    if (!fila) throw new Error('El insert del capítulo no devolvió ninguna fila');
    await sincronizarCapituloEditorial(tx,fila.id,'crear');
    return fila;
  });
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
    const [anterior] = await tx.select().from(capitulos).where(and(eq(capitulos.proyectoId,proyectoId),eq(capitulos.numero,numero)));
    const [fila] = await tx
      .update(capitulos)
      .set(datosConPlazo)
      .where(and(eq(capitulos.proyectoId, proyectoId), eq(capitulos.numero, numero)))
      .returning();

    if (!fila) throw new Error(`Capítulo no encontrado: proyecto ${proyectoId}, número ${numero}`);
    const feedback=!!datos.fechaRespuestaReal && datos.fechaRespuestaReal!==anterior?.fechaRespuestaReal;
    const synced=await sincronizarCapituloEditorial(tx,fila.id,'autor',false,feedback);
    for (const [cambia,accion] of [[feedback,'CAPITULO_FEEDBACK_REGISTRADO'],[!!datos.fechaEnvioAutor && datos.fechaEnvioAutor!==anterior?.fechaEnvioAutor,'CAPITULO_ENVIADO_AUTOR']] as const) {
      if(cambia)await registrarEvento(tx,{actorId,accion,entityType:'capitulo',entityId:fila.id,proyectoId,detalles:{numero}});
    }
    if(feedback){
      const [p]=await tx.select({editorId:proyectos.editorId}).from(proyectos).where(eq(proyectos.id,proyectoId));
      if(p?.editorId)await tx.insert(notificaciones).values({proyectoId,targetPath:'/?vista=mi-trabajo&workItem='+synced?.workItemId,rolDestino:'editor',usuarioDestinoId:p.editorId,mensaje:`Feedback del autor disponible para el capítulo ${numero}.`});
    }
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
export async function actualizarCapituloEditor(proyectoId: string, numero: number, datos: DatosCapituloEditor, actorId:string|null=null, transaction?: Tx) {
  const update = async (tx: Tx) => {
  const [project]=await tx.select({id:proyectos.id,editorId:proyectos.editorId,especialistaId:proyectos.especialistaId}).from(proyectos).where(eq(proyectos.id,proyectoId)).for('update');
  if(actorId&&project?.editorId!==actorId)throw Object.assign(new Error('El proyecto ya no está asignado a este Editor'),{statusCode:403});
  const [anterior]=await tx.select().from(capitulos).where(and(eq(capitulos.proyectoId,proyectoId),eq(capitulos.numero,numero)));
  const [fila] = await tx
    .update(capitulos)
    .set(datos)
    .where(and(eq(capitulos.proyectoId, proyectoId), eq(capitulos.numero, numero)))
    .returning();

  if (!fila) throw new Error(`Capítulo no encontrado: proyecto ${proyectoId}, número ${numero}`);
  const sync=await sincronizarCapituloEditorial(tx,fila.id,'editor',!!datos.fechaEntregaEditor);
  if(datos.fechaEntregaEditor && (datos.fechaEntregaEditor!==anterior?.fechaEntregaEditor||sync?.stateChanged)){
    await registrarEvento(tx,{actorId,accion:anterior?.fechaRespuestaReal?'CAPITULO_FEEDBACK_APLICADO':'CAPITULO_EDITOR_ENTREGADO',entityType:'capitulo',entityId:fila.id,proyectoId,detalles:{numero,fecha:datos.fechaEntregaEditor}});
    const owner=await obtenerEspecialistaActual(proyectoId,project?.especialistaId??null,tx);
    if(owner)await tx.insert(notificaciones).values({proyectoId,rolDestino:'especialista',usuarioDestinoId:owner,mensaje:`Editor entregó el capítulo ${numero}.`});
  }
  return fila;
  };
  return transaction ? update(transaction) : db.transaction(update);
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
