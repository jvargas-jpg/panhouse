import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { autores, proyectos, seguimientoFases, users } from '../db/schema/index.js';

export interface RegistroSeguimiento {
  id: string;
  proyecto: { id: string; autorNombre: string };
  analista: { id: string; nombre: string } | null;
  asignacionTipo: string | null;
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
  observaciones: string | null;
}

// "Control de Tiempos" de jefe_area: matriz completa, más reciente
// primero — a diferencia de fichas_trazabilidad, esta tabla es
// exclusivamente de lectura/reporte para jefatura, no hay "mis
// registros" por rol todavía (ver Restricción del pedido original: solo
// GET por ahora).
export async function listarSeguimiento(): Promise<RegistroSeguimiento[]> {
  const filas = await db
    .select({
      id: seguimientoFases.id,
      proyectoId: proyectos.id,
      autorNombre: autores.nombre,
      analistaId: users.id,
      analistaNombre: users.nombre,
      asignacionTipo: seguimientoFases.asignacionTipo,
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
      observaciones: seguimientoFases.observaciones,
    })
    .from(seguimientoFases)
    .innerJoin(proyectos, eq(seguimientoFases.proyectoId, proyectos.id))
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .leftJoin(users, eq(seguimientoFases.analistaId, users.id))
    .orderBy(desc(seguimientoFases.createdAt));

  return filas.map((fila) => ({
    id: fila.id,
    proyecto: { id: fila.proyectoId, autorNombre: fila.autorNombre },
    analista: fila.analistaId ? { id: fila.analistaId, nombre: fila.analistaNombre ?? '' } : null,
    asignacionTipo: fila.asignacionTipo,
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
    observaciones: fila.observaciones,
  }));
}
