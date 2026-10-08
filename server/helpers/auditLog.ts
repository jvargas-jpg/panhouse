import { auditLogs } from '../db/schema/index.js';
import type { Tx } from './tx.js';

// Catálogo de acciones registradas — texto, no enum DB, a propósito
// (se amplía sin migración, mismo criterio que notificaciones.rolDestino).
// Mantener este tipo sincronizado es responsabilidad de quien agrega un
// evento nuevo; no es una validación de runtime.
export type AccionAuditoria =
  | 'ESPECIALISTA_ASIGNADO'
  | 'ESPECIALISTA_REASIGNADO'
  | 'EDITOR_ASIGNADO'
  | 'EDITOR_REASIGNADO'
  | 'DISENADOR_ASIGNADO'
  | 'DISENADOR_REASIGNADO'
  | 'RRPP_NOTIFICADO'
  | 'JEFATURA_NOTIFICADA'
  | 'EDITOR_SOLICITADO'
  | 'FEEDBACK_TRIPA_REGISTRADO';

export interface RegistrarEventoInput {
  actorId: string | null;
  accion: AccionAuditoria;
  entityType: 'proyecto' | 'project_assignment' | 'work_item';
  entityId: string;
  proyectoId?: string | null;
  detalles?: Record<string, unknown>;
}

// Única función de escritura de audit_logs — evento puntual e
// inmutable, nunca se actualiza ni se borra (ver comentario del schema
// en server/db/schema/auditLogs.ts). Siempre se llama dentro de la
// misma transacción que el cambio real que describe: si la transacción
// completa falla, el evento tampoco debe quedar huérfano describiendo
// algo que no ocurrió.
export async function registrarEvento(tx: Tx, input: RegistrarEventoInput): Promise<void> {
  await tx.insert(auditLogs).values({
    actorId: input.actorId,
    accion: input.accion,
    entityType: input.entityType,
    entityId: input.entityId,
    proyectoId: input.proyectoId ?? null,
    detalles: input.detalles ?? null,
  });
}
