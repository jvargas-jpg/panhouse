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
  folders: { key: string; label: string; driveUrl: string | null }[];
  deliveries: { id: string; driveUrl: string; observaciones: string | null; submittedAt: string }[];
  blocker: { id: string; reason: string; createdAt: string; resolvedAt: string | null; resolution: string | null } | null;
  history: { id: string; label: string; actor: string; at: string }[];
}

export const EDITOR_REQUEST_TYPES = ['editor_apoyo', 'editor_reasignacion', 'editor_aclaracion'] as const;
export type EditorRequestType = (typeof EDITOR_REQUEST_TYPES)[number];
export const EDITOR_REQUEST_LABELS: Record<EditorRequestType, string> = {
  editor_apoyo: 'Solicitar apoyo',
  editor_reasignacion: 'Solicitar reasignación',
  editor_aclaracion: 'Solicitar aclaración',
};

export type EditorRequestStatus = 'pendiente' | 'en_revision' | 'devuelta' | 'resuelta' | 'cancelada';

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
}

export interface EditorRequestList {
  items: EditorRequestSummary[];
  total: number;
  pages: number;
  page: number;
  counts: { pending: number; resolved: number; returned: number; cancelled: number; all: number };
}

export interface EditorRequestDetail {
  summary: EditorRequestSummary;
  description: string | null; observations?: {id:string;question:string;answer:string|null;at:string}[];
  history: { id: string; label: string; actor: string; at: string }[];
}
