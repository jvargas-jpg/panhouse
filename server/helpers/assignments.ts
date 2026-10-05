import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { projectAssignments } from '../db/schema/index.js';
import type { TipoAsignacion } from '../db/schema/enums.js';
import type { Tx } from './tx.js';

export interface AsignarConHistorialInput {
  proyectoId: string;
  // null = asignación a nivel de proyecto (especialista/jefe_area/
  // editor/disenador: roles exclusivos "uno a la vez" según el modelo
  // actual). No-null = asignación ligada a una tarea puntual
  // (corrector/validador/lider_creativo cuando se asignan a un
  // work_item concreto) — ver el índice único parcial por scope en
  // server/db/schema/assignments.ts.
  workItemId?: string | null;
  tipo: TipoAsignacion;
  usuarioId: string;
  asignadoPorId: string | null;
  motivoFin?: string;
}

export interface AsignarConHistorialResultado {
  // false si el usuario solicitado ya era el activo para este scope
  // (mismo request repetido no duplica fila — ver §23 del master
  // prompt de rearquitectura, "Idempotencia").
  cambio: boolean;
  asignacionId: string;
  anteriorUsuarioId: string | null;
}

// Pieza central del historial de asignaciones (Fase 2, Opción B
// aprobada): cierra la fila activa anterior del mismo scope (si existe
// y es distinta) y abre una nueva. SIEMPRE se llama dentro de la misma
// transacción que actualiza el puntero `proyectos.*Id` correspondiente
// (cuando aplica) y que escribe el audit_log — las tres escrituras son
// atómicas entre sí, nunca pasos separados (ver
// docs/arquitectura/11-fase2-modelo-canonico.md §E, último punto).
export async function asignarConHistorial(tx: Tx, input: AsignarConHistorialInput): Promise<AsignarConHistorialResultado> {
  const workItemId = input.workItemId ?? null;

  const condicionScope = workItemId
    ? and(eq(projectAssignments.workItemId, workItemId), eq(projectAssignments.tipo, input.tipo), isNull(projectAssignments.finalizadoEn))
    : and(
        eq(projectAssignments.proyectoId, input.proyectoId),
        eq(projectAssignments.tipo, input.tipo),
        isNull(projectAssignments.workItemId),
        isNull(projectAssignments.finalizadoEn),
      );

  const [activaActual] = await tx.select().from(projectAssignments).where(condicionScope).limit(1);

  // Idempotencia: si ya es exactamente la misma persona, no se cierra
  // ni se vuelve a abrir nada — un segundo click/retry del mismo
  // request no debe generar una fila nueva ni un evento de auditoría
  // falso de "reasignación".
  if (activaActual && activaActual.usuarioId === input.usuarioId) {
    return { cambio: false, asignacionId: activaActual.id, anteriorUsuarioId: activaActual.usuarioId };
  }

  if (activaActual) {
    await tx
      .update(projectAssignments)
      .set({ finalizadoEn: new Date(), motivoFin: input.motivoFin ?? 'Reasignado' })
      .where(eq(projectAssignments.id, activaActual.id));
  }

  const [nueva] = await tx
    .insert(projectAssignments)
    .values({
      proyectoId: input.proyectoId,
      workItemId,
      tipo: input.tipo,
      usuarioId: input.usuarioId,
      asignadoPorId: input.asignadoPorId,
    })
    .returning({ id: projectAssignments.id });

  if (!nueva) throw new Error('El insert de project_assignments no devolvió ninguna fila');

  return { cambio: true, asignacionId: nueva.id, anteriorUsuarioId: activaActual?.usuarioId ?? null };
}

export interface HistorialAsignacion {
  id: string;
  proyectoId: string;
  workItemId: string | null;
  tipo: TipoAsignacion;
  usuarioId: string;
  asignadoPorId: string | null;
  asignadoEn: Date;
  finalizadoEn: Date | null;
  motivoFin: string | null;
}

// "¿Quién estuvo asignado antes?" — responde con SQL directo, sin
// parsear jsonb (ver docs/arquitectura/11-fase2-modelo-canonico.md §E).
export async function historialAsignacionesDeProyecto(proyectoId: string, tipo?: TipoAsignacion): Promise<HistorialAsignacion[]> {
  const condiciones = [eq(projectAssignments.proyectoId, proyectoId)];
  if (tipo) condiciones.push(eq(projectAssignments.tipo, tipo));

  return db
    .select()
    .from(projectAssignments)
    .where(and(...condiciones))
    .orderBy(desc(projectAssignments.asignadoEn));
}

// "¿En qué proyectos/roles ha estado esta persona?" — usa el índice
// `project_assignments_usuario_idx`.
export async function historialAsignacionesDeUsuario(usuarioId: string): Promise<HistorialAsignacion[]> {
  return db
    .select()
    .from(projectAssignments)
    .where(eq(projectAssignments.usuarioId, usuarioId))
    .orderBy(desc(projectAssignments.asignadoEn));
}
