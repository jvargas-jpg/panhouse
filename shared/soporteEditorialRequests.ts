// Solicitudes operativas de Calidad: mismo lifecycle y tablas canónicas.
// No reutilizar editor/corrector_*: pertenecen a otros handoffs.
export const QUALITY_REQUEST_TYPES = ['calidad_material', 'calidad_aclaracion', 'calidad_tecnico'] as const;
export type QualityRequestType = typeof QUALITY_REQUEST_TYPES[number];
export const QUALITY_REQUEST_LABELS: Record<QualityRequestType, string> = {
  calidad_material: 'Material incorrecto o faltante',
  calidad_aclaracion: 'Aclaración operativa',
  calidad_tecnico: 'Problema de acceso o archivo',
};
export const QUALITY_REQUEST_STATUSES = ['pendiente', 'en_revision', 'requiere_informacion', 'resuelta', 'rechazada', 'cancelada'] as const;
export type QualityRequestStatus = typeof QUALITY_REQUEST_STATUSES[number];
export type QualityRequestTab = 'all' | 'pending' | 'returned' | 'resolved' | 'cancelled';
export const QUALITY_REQUEST_STATUS_LABELS: Record<QualityRequestStatus, string> = {
  pendiente: 'Pendiente', en_revision: 'En revisión', requiere_informacion: 'Requiere información', resuelta: 'Resuelta', rechazada: 'Rechazada', cancelada: 'Cancelada',
};
export interface QualityRequestFilters {
  tab: QualityRequestTab; search: string; type?: QualityRequestType; status?: QualityRequestStatus; project?: string;
  from?: string; to?: string; page: number; pageSize: number;
}
export interface QualityRequestContext {
  projectId: string; projectCode: string; projectTitle: string; authors: string; coverUrl: string | null;
  workItemId: string; qualityPhaseId: string; phase: number; round: number; versionLabel: string | null;
}
export interface QualityRequestRow extends QualityRequestContext {
  id: string; type: QualityRequestType; subject: string; status: QualityRequestStatus;
  requestedAt: string; updatedAt: string; lastEvent: string; requiresAction: boolean;
  version: number; canCancel: boolean; workAccessible: boolean;
}
export interface QualityRequestList {
  items: QualityRequestRow[]; total: number; page: number; pages: number;
  counts: Record<QualityRequestTab, number>; projects: { id: string; name: string }[];
}
export interface QualityRequestDetail {
  summary: QualityRequestRow; description: string; destination: string; specialist: string | null; designer: string | null;
  questions: { id: string; text: string; actor: string; at: string; answer: string | null; answeredBy: string | null; answeredAt: string | null }[];
  history: { id: string; label: string; actor: string; at: string; text: string | null }[];
  result: { text: string; actor: string | null; at: string; references: QualityRequestContext | null } | null;
  cancellation: { actor: string | null; at: string; reason: string | null } | null;
}
export interface QualityRequestEligibility {
  items: (QualityRequestContext & { specialist: string })[]; total: number; page: number; pages: number;
}
export interface CreateQualityRequest {
  workItemId: string; type: QualityRequestType; subject: string; description: string; idempotencyKey: string;
}
