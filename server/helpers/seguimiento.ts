import { desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../db/client.js';
import { autores, proyectos, seguimientoFases, unidades, users } from '../db/schema/index.js';

export interface RegistroSeguimiento {
  id: string;
  proyecto: { id: string; autorNombre: string; codigo: string; unidadNombre: string | null };
  analista: { id: string; nombre: string } | null;
  especialista: { id: string; nombre: string } | null;
  asignacionTipo: string | null;
  tipoServicio: string | null;
  paginas: number | null;
  fechaAsignada: string | null;
  horaRecibida: string | null;
  fechaInicio: string | null;
  horaInicio: string | null;
  fechaEntrega: string | null;
  horaEntrega: string | null;
  estatus: string | null;
  totalDias: string | null;
  totalHoras: string | null;
  tiempoCorrecto: string | null;
  observaciones: string | null;
  freelance: boolean;
  pago80: boolean;
  pago20: boolean;
  resultadosCorreccion: string | null;
  cantidadComentarios: number | null;
  cumplimiento: string | null;
}

// Columnas compartidas por listar/crear/actualizar — un solo join, en
// vez de repetirlo en las tres funciones de abajo.
const SELECT_REGISTRO = {
  id: seguimientoFases.id,
  proyectoId: proyectos.id,
  autorNombre: autores.nombre,
  codigo: proyectos.codigo,
  unidadNombre: unidades.nombre,
  analistaId: users.id,
  analistaNombre: users.nombre,
  asignacionTipo: seguimientoFases.asignacionTipo,
  tipoServicio: seguimientoFases.tipoServicio,
  paginas: seguimientoFases.paginas,
  fechaAsignada: seguimientoFases.fechaAsignada,
  horaRecibida: seguimientoFases.horaRecibida,
  fechaInicio: seguimientoFases.fechaInicio,
  horaInicio: seguimientoFases.horaInicio,
  fechaEntrega: seguimientoFases.fechaEntrega,
  horaEntrega: seguimientoFases.horaEntrega,
  estatus: seguimientoFases.estatus,
  totalDias: seguimientoFases.totalDias,
  totalHoras: seguimientoFases.totalHoras,
  tiempoCorrecto: seguimientoFases.tiempoCorrecto,
  observaciones: seguimientoFases.observaciones,
  freelance: seguimientoFases.freelance,
  pago80: seguimientoFases.pago80,
  pago20: seguimientoFases.pago20,
  resultadosCorreccion: seguimientoFases.resultadosCorreccion,
  cantidadComentarios: seguimientoFases.cantidadComentarios,
  cumplimiento: seguimientoFases.cumplimiento,
};

// especialistaId/especialistaNombre no entran en SELECT_REGISTRO porque
// necesitan su PROPIO leftJoin a `users` (analistaId ya usa uno) — un
// segundo alias de la misma tabla no se puede resolver con el mismo
// nombre de columna en un solo objeto de select. Se agregan aparte en
// cada consulta.

function mapearFila(fila: {
  id: string;
  proyectoId: string;
  autorNombre: string;
  codigo: string;
  unidadNombre: string | null;
  analistaId: string | null;
  analistaNombre: string | null;
  especialistaId: string | null;
  especialistaNombre: string | null;
  asignacionTipo: string | null;
  tipoServicio: string | null;
  paginas: number | null;
  fechaAsignada: string | null;
  horaRecibida: string | null;
  fechaInicio: string | null;
  horaInicio: string | null;
  fechaEntrega: string | null;
  horaEntrega: string | null;
  estatus: string | null;
  totalDias: string | null;
  totalHoras: string | null;
  tiempoCorrecto: string | null;
  observaciones: string | null;
  freelance: boolean;
  pago80: boolean;
  pago20: boolean;
  resultadosCorreccion: string | null;
  cantidadComentarios: number | null;
  cumplimiento: string | null;
}): RegistroSeguimiento {
  return {
    id: fila.id,
    proyecto: { id: fila.proyectoId, autorNombre: fila.autorNombre, codigo: fila.codigo, unidadNombre: fila.unidadNombre },
    analista: fila.analistaId ? { id: fila.analistaId, nombre: fila.analistaNombre ?? '' } : null,
    especialista: fila.especialistaId ? { id: fila.especialistaId, nombre: fila.especialistaNombre ?? '' } : null,
    asignacionTipo: fila.asignacionTipo,
    tipoServicio: fila.tipoServicio,
    paginas: fila.paginas,
    fechaAsignada: fila.fechaAsignada,
    horaRecibida: fila.horaRecibida,
    fechaInicio: fila.fechaInicio,
    horaInicio: fila.horaInicio,
    fechaEntrega: fila.fechaEntrega,
    horaEntrega: fila.horaEntrega,
    estatus: fila.estatus,
    totalDias: fila.totalDias,
    totalHoras: fila.totalHoras,
    tiempoCorrecto: fila.tiempoCorrecto,
    observaciones: fila.observaciones,
    freelance: fila.freelance,
    pago80: fila.pago80,
    pago20: fila.pago20,
    resultadosCorreccion: fila.resultadosCorreccion,
    cantidadComentarios: fila.cantidadComentarios,
    cumplimiento: fila.cumplimiento,
  };
}

// alias de `users` para el segundo leftJoin (especialistaId) — Drizzle
// necesita una instancia de tabla separada para unir la misma tabla dos
// veces en una sola consulta (analistaId ya usa `users` sin alias).
const especialistas = alias(users, 'especialistas_seguimiento');

// "Control de Tiempos" de jefe_area: matriz completa, más reciente
// primero — a diferencia de fichas_trazabilidad, esta tabla es
// exclusivamente de lectura/reporte para jefatura (además de las
// funciones de creación/edición de abajo, que sí puede escribir
// jefatura desde este mismo módulo).
export async function listarSeguimiento(): Promise<RegistroSeguimiento[]> {
  const filas = await db
    .select({ ...SELECT_REGISTRO, especialistaId: especialistas.id, especialistaNombre: especialistas.nombre })
    .from(seguimientoFases)
    .innerJoin(proyectos, eq(seguimientoFases.proyectoId, proyectos.id))
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .leftJoin(unidades, eq(proyectos.unidadId, unidades.id))
    .leftJoin(users, eq(seguimientoFases.analistaId, users.id))
    .leftJoin(especialistas, eq(seguimientoFases.especialistaId, especialistas.id))
    .orderBy(desc(seguimientoFases.createdAt));

  return filas.map(mapearFila);
}

// Campos editables tanto al crear como al actualizar un registro.
// proyectoId se agrega aparte (DatosNuevoRegistroSeguimiento, abajo)
// porque solo tiene sentido al crear — una fila nunca cambia de
// proyecto una vez creada.
export interface DatosRegistroSeguimiento {
  analistaId?: string | null;
  especialistaId?: string | null;
  asignacionTipo?: string | null;
  tipoServicio?: string | null;
  paginas?: number | null;
  fechaAsignada?: string | null;
  horaRecibida?: string | null;
  fechaInicio?: string | null;
  horaInicio?: string | null;
  fechaEntrega?: string | null;
  horaEntrega?: string | null;
  estatus?: string | null;
  totalDias?: string | null;
  totalHoras?: string | null;
  tiempoCorrecto?: string | null;
  observaciones?: string | null;
  freelance?: boolean;
  pago80?: boolean;
  pago20?: boolean;
  resultadosCorreccion?: string | null;
  cantidadComentarios?: number | null;
  cumplimiento?: string | null;
}

export interface DatosNuevoRegistroSeguimiento extends DatosRegistroSeguimiento {
  proyectoId: string;
}

async function obtenerRegistroPorId(id: string): Promise<RegistroSeguimiento> {
  const [fila] = await db
    .select({ ...SELECT_REGISTRO, especialistaId: especialistas.id, especialistaNombre: especialistas.nombre })
    .from(seguimientoFases)
    .innerJoin(proyectos, eq(seguimientoFases.proyectoId, proyectos.id))
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .leftJoin(unidades, eq(proyectos.unidadId, unidades.id))
    .leftJoin(users, eq(seguimientoFases.analistaId, users.id))
    .leftJoin(especialistas, eq(seguimientoFases.especialistaId, especialistas.id))
    .where(eq(seguimientoFases.id, id))
    .limit(1);
  if (!fila) throw new Error(`Registro de seguimiento no encontrado: ${id}`);
  return mapearFila(fila);
}

// "+ Nuevo Registro" en SeguimientoPage.tsx — único campo obligatorio es
// proyectoId (toda otra columna del Excel real se llena progresivamente,
// ver el comentario de la tabla en schema/seguimiento.ts).
export async function crearRegistroSeguimiento(datos: DatosNuevoRegistroSeguimiento): Promise<RegistroSeguimiento> {
  const [fila] = await db.insert(seguimientoFases).values(datos).returning({ id: seguimientoFases.id });
  if (!fila) throw new Error('El insert de seguimiento no devolvió ninguna fila');
  return obtenerRegistroPorId(fila.id);
}

// Edición de una fila ya creada — el Excel real se llena columna por
// columna a medida que avanza el trabajo (fechaEntrega/estatus/pago80,
// etc. llegan después de fechaAsignada), no todo de una vez.
export async function actualizarRegistroSeguimiento(id: string, datos: DatosRegistroSeguimiento): Promise<RegistroSeguimiento> {
  const [fila] = await db.update(seguimientoFases).set(datos).where(eq(seguimientoFases.id, id)).returning({ id: seguimientoFases.id });
  if (!fila) throw new Error(`Registro de seguimiento no encontrado: ${id}`);
  return obtenerRegistroPorId(fila.id);
}
