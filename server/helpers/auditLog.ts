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
  | 'FEEDBACK_TRIPA_REGISTRADO'
  | 'CORRECCION_SOLICITADA'
  | 'CORRECTOR_ASIGNADO'
  | 'CORRECTOR_REASIGNADO'
  | 'CORRECCION_INICIADA'
  | 'CORRECCION_ENTREGADA'
  | 'CORRECCION_CERRADA'
  | 'DIRECCION_CREATIVA_SOLICITADA'
  | 'LIDER_CREATIVO_ASIGNADO'
  | 'REUNION_CREATIVA_REGISTRADA'
  | 'BRIEF_CREATIVO_GENERADO'
  | 'BRIEF_CREATIVO_APROBADO'
  | 'CONCEPTOS_ENTREGADOS'
  | 'CONCEPTO_APROBADO_RRPP'
  | 'CONCEPTO_DEVUELTO_RRPP'
  | 'CONCEPTO_APROBADO_AUTOR'
  | 'RECURSOS_CREATIVOS_ENTREGADOS'
  | 'DIRECCION_CREATIVA_CERRADA'
  | 'DISENO_SOLICITADO' | 'DISENO_VERSION_ENTREGADA' | 'REVISION_CUBIERTA_SOLICITADA'
  | 'DISENO_ENVIAR_AUTOR' | 'DISENO_FEEDBACK' | 'DISENO_APROBAR_AUTOR' | 'DISENO_HANDOFF_CALIDAD'
  | 'CUBIERTA_REVISION_INTERNA' | 'CUBIERTA_REVISION_CREATIVA';

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
