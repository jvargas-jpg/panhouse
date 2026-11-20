// Editor · Inicio / Mi trabajo / Mis proyectos / Mis solicitudes
// (docs/arquitectura/30-editor.md). Reutiliza EditorialIntervention y
// EditorialState (shared/editorialChief.ts) como unidad de trabajo -- esto
// NO es una segunda matriz, es otra vista sobre el mismo dominio.
import type { EditorialIntervention, EditorialActivity } from './editorialChief.js';

export interface EditorDashboard {
  today: string;
  summary: { pendingToday: number; dueSoon: number; blocked: number; feedbackToApply: number };
  attentionItems: EditorialIntervention[];
  upcomingDeliveries: { id: string; label: string; title: string; dueDate: string | null }[];
  recentActivity: EditorialActivity[];
  weekStatus: { completed: number; inProgress: number; dueSoon: number; blocked: number };
}

export interface EditorWorkRow extends EditorialIntervention {
  lastActivity: { label: string; at: string } | null;
}

export interface EditorWorkDetail {
  item: EditorialIntervention; specialist?: string | null; assignedAt?: string | null;
  materialUnavailable?: boolean; slaLabel?: string | null;
  folders: { key: string; label: string; driveUrl: string | null }[];
  deliveries: { id: string; driveUrl: string; observaciones: string | null; submittedAt: string }[];
  blocker: { id: string; reason: string; createdAt: string; resolvedAt: string | null; resolution: string | null } | null;
  history: { id: string; label: string; actor: string; at: string }[];
  // Escritura Fantasma: sesiones de extracción que el Especialista programó
  // y lo que produce quien las conduce — el Editor, no el Especialista.
  // Solo presente en la intervención "Inicio de edición" (antes de que
  // existan capítulos) de un proyecto EF.
  extraction?: { sesiones: {
    id: string; numero: number; fechaHora: string | null; duracionMinutos: number | null; realizada: boolean;
    meetUrl: string | null; videoUrl: string | null; notasGeminiUrl: string | null;
    // Propuesta del Autor esperando que el Editor la acepte o la rechace.
    solicitudCambio: { id: string; fechaHoraPropuesta: string; motivo: string | null } | null;
    // Propuesta del propio Editor, esperando que el Autor la acepte o la rechace.
    solicitudCambioPropia: { id: string; fechaHoraPropuesta: string } | null;
  }[] };
}

export const EDITOR_REQUEST_TYPES = ['editor_apoyo', 'editor_reasignacion', 'editor_aclaracion'] as const;
export type EditorRequestType = (typeof EDITOR_REQUEST_TYPES)[number];
export const EDITOR_REQUEST_LABELS: Record<EditorRequestType, string> = {
  editor_apoyo: 'Solicitar apoyo',
  editor_reasignacion: 'Solicitar reasignación',
  editor_aclaracion: 'Solicitar aclaración',
};

export type EditorRequestStatus = 'pendiente' | 'en_revision' | 'devuelta' | 'resuelta' | 'rechazada' | 'cancelada';

export interface EditorRequestSummary {
  id: string;
  type: EditorRequestType;
  projectId: string;
  code: string;
  title: string;
  workItemId: string;
  interventionLabel: string;
  motivo: string;
  status: EditorRequestStatus;
  target: string;
  requestedAt: string;
  resolvedAt: string | null;
  outcome: string | null;
  reassignment?: {previousEditor:string;nextEditor:string;assignedAt:string} | null;
  version: number; returnReason?: string | null; resolvedBy?: string | null;
  authors?: string; coverUrl?: string | null; requestedBy?: string;
  updatedAt?: string; lastEventLabel?: string; workAccessible?: boolean; canRespond?: boolean;
  resultReferences?: { projectId: string; workItemId: string; assignmentId: string | null; resolvedById: string | null };
}

export interface EditorRequestList {
  items: EditorRequestSummary[];
  total: number;
  pages: number;
  page: number;
  counts: { pending: number; resolved: number; returned: number; cancelled: number; all: number; rejected?: number };
  options?: { projects: {id: string; name: string}[] };
}

export interface EditorRequestDetail {
  summary: EditorRequestSummary;
  description: string | null; observations?: {id:string;question:string;answer:string|null;at:string;askedBy?:string;answeredBy?:string|null;answeredAt?:string|null}[];
  history: { id: string; label: string; actor: string; at: string }[];
}
