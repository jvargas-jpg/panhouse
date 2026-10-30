import type { DigitalStage } from './soporteDigitalHome.js';
export const DIGITAL_REQUEST_TYPES = ['digital_material', 'digital_aclaracion', 'digital_tecnico'] as const;
export type DigitalRequestType = typeof DIGITAL_REQUEST_TYPES[number];
export const DIGITAL_REQUEST_LABELS: Record<DigitalRequestType, string> = {
  digital_material: 'Material incorrecto o faltante', digital_aclaracion: 'Aclaración operativa', digital_tecnico: 'Problema técnico o de acceso',
};
export const DIGITAL_REQUEST_STATUSES = ['pendiente', 'en_revision', 'requiere_informacion', 'resuelta', 'rechazada', 'cancelada'] as const;
export type DigitalRequestStatus = typeof DIGITAL_REQUEST_STATUSES[number];
export const DIGITAL_REQUEST_STATUS_LABELS: Record<DigitalRequestStatus, string> = {
  pendiente: 'Pendiente', en_revision: 'En revisión', requiere_informacion: 'Requiere información', resuelta: 'Resuelta', rechazada: 'Rechazada', cancelada: 'Cancelada',
};
export const DIGITAL_REQUEST_TABS = ['all', 'pending', 'returned', 'resolved', 'cancelled'] as const;
export type DigitalRequestTab = typeof DIGITAL_REQUEST_TABS[number];
export interface DigitalRequestFilters {
  tab: DigitalRequestTab; search: string; type?: DigitalRequestType; status?: DigitalRequestStatus; project?: string;
  from?: string; to?: string; page: number; pageSize: number;
}
export interface DigitalRequestContext {
  workItemId: string; projectId: string; projectCode: string; projectTitle: string; authors: string; coverUrl: string | null;
  stage: DigitalStage; taskLabel: string; specialist: string | null; canBlock: boolean;
}
export interface DigitalRequestRow extends DigitalRequestContext {
  id: string; type: DigitalRequestType; subject: string; summary: string; status: DigitalRequestStatus; version: number;
  createdAt: string; updatedAt: string; lastEvent: string; requiresAction: boolean; blocksWorkItem: boolean; canCancel: boolean; workAccessible: boolean;
}
export interface DigitalRequestList {
  items: DigitalRequestRow[]; total: number; page: number; pages: number; counts: Record<DigitalRequestTab, number>; projects: { id: string; name: string }[];
}
export interface DigitalRequestFile {
  id: string; name: string; mimeType: string; size: number; at: string; uploadedBy: string; url: string;
}
export interface DigitalRequestDetail {
  summary: DigitalRequestRow; description: string; destination: string;
  blocker: { id: string; active: boolean; reason: string; resolvedAt: string | null } | null;
  questions: { id: string; text: string; actor: string; at: string; answer: string | null; answeredAt: string | null; answeredBy: string | null }[];
  history: { id: string; label: string; actor: string; at: string; text: string | null }[];
  attachments: DigitalRequestFile[]; canAttach: boolean;
  result: { text: string; actor: string | null; at: string; workItemId: string | null; attachmentId: string | null; blockerResolved: boolean } | null;
}
export interface CreateDigitalRequest {
  workItemId: string; type: DigitalRequestType; subject: string; description: string; blocksWorkItem: boolean; idempotencyKey: string;
}
export interface DigitalRequestEligibility { items: DigitalRequestContext[]; total: number; page: number; pages: number }
export const digitalRequestsUrl = (id?: string) => '/?' + new URLSearchParams({ vista: 'mis-solicitudes', ...(id ? { request: id } : {}) });
