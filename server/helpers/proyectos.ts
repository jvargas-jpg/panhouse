import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import type { CategoriaStandBy, EstadoProyecto, Rol } from '../db/schema/index.js';
import { autores, fichasTrazabilidad, proyectos, servicios } from '../db/schema/index.js';
import { ESTADOS_ACTIVOS } from './carga.js';

// Reexportadas desde alertas.ts: comparten el join autor/servicio/riesgo
// con listarRiesgoProyectosActivos (jefe_area/dirección) en vez de
// duplicar la consulta — ver ese archivo para la implementación real.
export { listarProyectosEditor, listarProyectosEspecialista } from './alertas.js';

export interface DatosNuevoProyecto {
  autorId: string;
  servicioId: string;
  unidadId: string;
  presupuestoId: string;
  coleccionId?: string | null;
  fechaProgramadaInicio: string;
  fechaRealInicio?: string | null;
  fechaDeseadaAutor?: string | null;
}

// Crea el proyecto y su ficha de trazabilidad vacía en la misma
// transacción: nunca debe quedar un proyecto sin ficha (ni una ficha
// huérfana) si algo falla a mitad de camino. especialistaId no se
// acepta aquí — se asigna aparte con asignarEspecialista, nunca se
// autoasigna a quien crea el proyecto.
export async function crearProyecto(datos: DatosNuevoProyecto) {
  return db.transaction(async (tx) => {
    const [proyecto] = await tx.insert(proyectos).values(datos).returning();
    if (!proyecto) throw new Error('El insert del proyecto no devolvió ninguna fila');

    await tx.insert(fichasTrazabilidad).values({ proyectoId: proyecto.id });

    return proyecto;
  });
}

export async function obtenerProyecto(proyectoId: string) {
  const [fila] = await db.select().from(proyectos).where(eq(proyectos.id, proyectoId)).limit(1);
  return fila;
}

export type AccesoProyecto =
  | { ok: true }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: 403; error: string };

// Único punto que decide "¿puede este usuario ver este proyecto?" para
// las pantallas de detalle (riesgo, ficha, capítulos, pausas) y para las
// rutas de capítulos (crear, lado editor): jefe_area ve cualquiera; un
// especialista, un editor o un disenador, solo el proyecto donde está
// asignado en su columna correspondiente (especialistaId / editorId /
// disenadorId). Reutilizado en vez de repetir el mismo 404/403 en cada
// ruta. lider_creativo pasa de largo a propósito (sin rama propia) —
// mismo alcance que jefe_area sobre esta sección, para poder auditar
// cualquier proyecto.
export async function verificarAccesoAProyecto(
  proyectoId: string,
  usuario: { id: string; rol: Rol },
): Promise<AccesoProyecto> {
  const proyecto = await obtenerProyecto(proyectoId);
  if (!proyecto) {
    return { ok: false, status: 404, error: 'Proyecto no encontrado' };
  }
  if (usuario.rol === 'especialista' && proyecto.especialistaId !== usuario.id) {
    return { ok: false, status: 403, error: 'No autorizado para ver este proyecto' };
  }
  if (usuario.rol === 'editor' && proyecto.editorId !== usuario.id) {
    return { ok: false, status: 403, error: 'No autorizado para ver este proyecto' };
  }
  if (usuario.rol === 'disenador' && proyecto.disenadorId !== usuario.id) {
    return { ok: false, status: 403, error: 'No autorizado para ver este proyecto' };
  }
  return { ok: true };
}

export interface DatosActualizarProyecto {
  estado?: EstadoProyecto;
  categoriaStandBy?: CategoriaStandBy | null;
  coleccionId?: string | null;
  presupuestoId?: string;
  unidadId?: string;
  servicioId?: string;
  fechaRealInicio?: string | null;
  fechaDeseadaAutor?: string | null;
}

// 'pausado' es el único estado que exige el guardián de pago
// (validarPausaFormal en server/helpers/pausas.ts): solo se llega a él
// creando una pausa formal, nunca por esta ruta general. Los otros
// cinco estados (en_proceso, retrasado, stand_by, culminado, retirado)
// no tienen esa exigencia y siguen editables libremente aquí.
export function validarCambioEstadoProyecto(estado?: EstadoProyecto): void {
  if (estado === 'pausado') {
    throw new Error(
      "No se puede cambiar el estado a 'pausado' por esta vía — usa POST /api/pausas con esPausadoFormal=true, el único camino que verifica el pago.",
    );
  }
}

// Edición directa de las especificaciones operativas del proyecto,
// confirmada a cargo del especialista. "Especificaciones especiales"
// (jefe de área) queda como categoría abierta para más adelante: hoy
// ningún campo de proyectos cae ahí.
export async function actualizarProyecto(proyectoId: string, datos: DatosActualizarProyecto) {
  validarCambioEstadoProyecto(datos.estado);

  const [fila] = await db.update(proyectos).set(datos).where(eq(proyectos.id, proyectoId)).returning();
  if (!fila) throw new Error(`Proyecto no encontrado: ${proyectoId}`);
  return fila;
}

// Título del libro — dueño rrpp, mismo rol que el resto de Sección 1
// (Perfil). Ruta propia porque escribe proyectos, no fichasTrazabilidad
// como el resto de esa sección.
export async function actualizarTituloProyecto(proyectoId: string, titulo: string | null) {
  const [fila] = await db.update(proyectos).set({ titulo }).where(eq(proyectos.id, proyectoId)).returning();
  if (!fila) throw new Error(`Proyecto no encontrado: ${proyectoId}`);
  return fila;
}

// Asignar especialista es un paso propio (lo decide jefatura de área),
// separado de la creación del proyecto: jefe_area crea el proyecto y
// luego reparte el trabajo, casi siempre en dos pasos seguidos de la
// misma pantalla, pero nunca es el mismo paso.
export async function asignarEspecialista(proyectoId: string, especialistaId: string): Promise<void> {
  const [fila] = await db
    .update(proyectos)
    .set({ especialistaId })
    .where(eq(proyectos.id, proyectoId))
    .returning({ id: proyectos.id });

  if (!fila) throw new Error(`Proyecto no encontrado: ${proyectoId}`);
}

// Mismo patrón que asignarEspecialista, pero lo decide jefe_edicion:
// paso propio, separado de la creación del proyecto.
export async function asignarEditor(proyectoId: string, editorId: string): Promise<void> {
  const [fila] = await db.update(proyectos).set({ editorId }).where(eq(proyectos.id, proyectoId)).returning({ id: proyectos.id });

  if (!fila) throw new Error(`Proyecto no encontrado: ${proyectoId}`);
}

// Mismo patrón que asignarEditor, pero lo decide el propio especialista
// dueño del proyecto (no una jefatura): la ruta que la llama verifica
// esa pertenencia con verificarAccesoAProyecto antes de invocarla.
export async function asignarDisenador(proyectoId: string, disenadorId: string): Promise<void> {
  const [fila] = await db.update(proyectos).set({ disenadorId }).where(eq(proyectos.id, proyectoId)).returning({ id: proyectos.id });

  if (!fila) throw new Error(`Proyecto no encontrado: ${proyectoId}`);
}

export interface ProyectoSinEditor {
  id: string;
  autor: { id: string; nombre: string };
  servicio: { id: string; codigo: string; nombre: string };
}

// Para la pantalla de jefe_edicion "Proyectos sin editor asignado":
// mismo join autor/servicio que alertas.ts, filtrado a proyectos
// activos sin editorId. No filtra por si ya llegó el manuscrito — ese
// dato no existe todavía en el modelo (limitación conocida: hoy se ven
// acá proyectos que ni siquiera tienen manuscrito aún).
export async function listarProyectosSinEditor(): Promise<ProyectoSinEditor[]> {
  const filas = await db
    .select({
      id: proyectos.id,
      autorId: autores.id,
      autorNombre: autores.nombre,
      servicioId: servicios.id,
      servicioCodigo: servicios.codigo,
      servicioNombre: servicios.nombre,
    })
    .from(proyectos)
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .where(and(isNull(proyectos.editorId), inArray(proyectos.estado, ESTADOS_ACTIVOS)));

  return filas.map((fila) => ({
    id: fila.id,
    autor: { id: fila.autorId, nombre: fila.autorNombre },
    servicio: { id: fila.servicioId, codigo: fila.servicioCodigo, nombre: fila.servicioNombre },
  }));
}
export interface ProyectoResumen {
  id: string;
  estado: EstadoProyecto;
  autor: { id: string; nombre: string };
  servicio: { id: string; codigo: string; nombre: string };
}

// TODO (Regla de negocio no confirmada): Si el volumen de proyectos crece 
// mucho a lo largo de los años, esta consulta podría necesitar paginación. 
// Por ahora trae todos los proyectos ordenados por fecha de creación.
export async function listarTodosLosProyectos(): Promise<ProyectoResumen[]> {
  const filas = await db
    .select({
      id: proyectos.id,
      estado: proyectos.estado,
      autorId: autores.id,
      autorNombre: autores.nombre,
      servicioId: servicios.id,
      servicioCodigo: servicios.codigo,
      servicioNombre: servicios.nombre,
    })
    .from(proyectos)
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .orderBy(proyectos.createdAt);

  return filas.map((fila) => ({
    id: fila.id,
    estado: fila.estado,
    autor: { id: fila.autorId, nombre: fila.autorNombre },
    servicio: { id: fila.servicioId, codigo: fila.servicioCodigo, nombre: fila.servicioNombre },
  }));
}