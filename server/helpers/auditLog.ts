import { sql } from 'drizzle-orm';
import { auditLogs, proyectos } from '../db/schema/index.js';
import type { Tx } from './tx.js';
import type { EVENTOS_LANZAMIENTO_RRPP } from './rrppLanzamientoCatalogos.js';

// Fecha real del primer handoff, sin inventar fechas para flags legacy.
// Proyección SQL: no genera consultas adicionales por proyecto.
export const rrppEnviadoAtSql = sql<string | null>`(select min(evento.created_at)::text from audit_logs evento
  where evento.proyecto_id = ${proyectos.id} and evento.accion = 'RRPP_NOTIFICADO')`
  .mapWith((valor: string | null) => valor ? new Date(valor).toISOString() : null);

// Catálogo de acciones registradas — texto, no enum DB, a propósito
// (se amplía sin migración, mismo criterio que notificaciones.rolDestino).
// Mantener este tipo sincronizado es responsabilidad de quien agrega un
// evento nuevo; no es una validación de runtime.
export type AccionAuditoria =
  | 'DRIVE_PROJECTS_ROOT_CONFIGURADA' | 'PROJECT_WORKSPACE_INICIADO' | 'PROJECT_WORKSPACE_CONFIGURADO' | 'PROJECT_WORKSPACE_FALLIDO' | 'PROJECT_WORKSPACE_REINTENTO_EXITOSO' | 'PROJECT_WORKSPACE_INCONSISTENCIA'
  | 'GOOGLE_DRIVE_CONECTADO' | 'GOOGLE_DRIVE_DESCONECTADO' | 'GOOGLE_DRIVE_VERIFICADO' | 'GOOGLE_DRIVE_CARPETA_PRUEBA_CREADA'
  | 'OBJETIVO_CREADO' | 'OBJETIVO_AJUSTADO' | 'OBJETIVO_CUMPLIDO' | 'OBJETIVO_NO_CUMPLIDO' | 'OBJETIVO_CANCELADO' | 'OBJETIVO_CANCELADO_REASIGNACION'
  | 'PREPARACION_INICIAL_ACTUALIZADA' | 'SOLICITUD_AREA_CREADA' | 'SOLICITUD_AREA_ACTUALIZADA' | 'SOLICITUD_AREA_ACTIVADA' | 'IMPRESION_COORDINACION_ACTUALIZADA'
  | 'CONTRATO_CORRECCION_SOLICITADO' | 'CONTRATO_REVISION_INICIADA' | 'CONTRATO_INFORMACION_SOLICITADA'
  | 'CONTRATO_INFORMACION_RESPONDIDA' | 'CONTRATO_CONFIRMADO' | 'CONTRATO_RECHAZADO'
  | 'PROYECTO_AVANCE_REGISTRADO'
  | 'PROYECTO_TITULOS_REGISTRADOS'
  | 'AMAZON_ACTIVACION_HABILITADA' | 'AMAZON_ACTIVACION_REGISTRADA'
  | 'PROYECTO_ESTADO_CAMBIADO'
  | 'SEGUIMIENTO_NOTA_REGISTRADA' | 'SEGUIMIENTO_EVALUACION_REGISTRADA'
  | 'SEGUIMIENTO_PAGO_REGISTRADO' | 'SEGUIMIENTO_DATOS_REGISTRADOS'
  | 'EXPRESS_CONFIRMADO'
  | 'PRIORIDAD_NORMAL_CONFIRMADA'
  | 'FICHA_DOCUMENTAL_ACTUALIZADA'
  | keyof typeof EVENTOS_LANZAMIENTO_RRPP
  | 'ESPECIALISTA_ASIGNADO'
  | 'ESPECIALISTA_REASIGNADO'
  | 'EDITOR_ASIGNADO'
  | 'EDITOR_REASIGNADO'
  | 'DISENADOR_ASIGNADO'
  | 'DISENADOR_REASIGNADO'
  | 'RRPP_NOTIFICADO'
  | 'JEFATURA_NOTIFICADA'
  | 'INFORMACION_COMERCIAL_ACTUALIZADA'
  | 'INTAKE_RRPP_INICIADO' | 'DIAGNOSTICO_ACTUALIZADO' | 'DIAGNOSTICO_COMPLETADO'
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
  | 'CUBIERTA_REVISION_INTERNA' | 'CUBIERTA_REVISION_CREATIVA'
  | 'CALIDAD_INICIADA' | 'CALIDAD_REVISADA' | 'CALIDAD_ENVIADA_AUTOR'
  | 'CALIDAD_FEEDBACK_AUTOR' | 'CALIDAD_APROBADA_AUTOR' | 'CALIDAD_REVISION_FINAL_SOLICITADA'
  // Jefatura · Decisiones (docs/arquitectura/17-jefatura-decisiones.md).
  | 'DECISION_CREADA' | 'DECISION_REVISION_INICIADA' | 'DECISION_INFORMACION_SOLICITADA'
  | 'DECISION_INFORMACION_RESPONDIDA' | 'DECISION_RESUELTA';

export interface RegistrarEventoInput {
  actorId: string | null;
  accion: AccionAuditoria;
  entityType: 'external_integration' | 'proyecto' | 'project_assignment' | 'work_item' | 'evento_rrpp' | 'publicacion_rrpp' | 'reunion_lanzamiento' | 'decision' | 'solicitud' | 'monthly_goal';
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
