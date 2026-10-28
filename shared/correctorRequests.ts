// Corrector · Mis solicitudes (docs/arquitectura/35-corrector-mis-solicitudes.md).
// Mismo sistema que Editor (shared/editorOwn.ts): reutiliza solicitudes_area,
// nunca un segundo sistema de tickets. Todos los tipos del Corrector van
// dirigidos al Especialista coordinador del proyecto -- el Corrector reporta
// y consulta, el Especialista decide.
export const CORRECTOR_REQUEST_TYPES = ['corrector_material', 'corrector_aclaracion', 'corrector_tecnico'] as const;
export type CorrectorRequestType = (typeof CORRECTOR_REQUEST_TYPES)[number];
export const CORRECTOR_REQUEST_LABELS: Record<CorrectorRequestType, string> = {
  corrector_material: 'Material incorrecto o faltante',
  corrector_aclaracion: 'Aclaración de criterio',
  corrector_tecnico: 'Problema técnico',
};

export type CorrectorRequestStatus = 'pendiente' | 'en_revision' | 'devuelta' | 'resuelta' | 'rechazada' | 'cancelada';

export interface CorrectorRequestSummary {
  id: string;
  type: CorrectorRequestType;
  projectId: string;
  code: string;
  title: string;
  authors: string;
  coverUrl: string | null;
  workItemId: string;
  interventionLabel: string;
  motivo: string;
  status: CorrectorRequestStatus;
  target: string;
  requestedAt: string;
  updatedAt: string;
  lastEventLabel: string | null;
  resolvedAt: string | null;
  outcome: string | null;
  returnReason?: string | null;
  resolvedBy?: string | null;
  requestedBy?: string;
  workAccessible?: boolean;
  canRespond?: boolean;
  version: number;
}

export interface CorrectorRequestList {
  items: CorrectorRequestSummary[];
  total: number;
  pages: number;
  page: number;
  counts: { pending: number; resolved: number; returned: number; cancelled: number; rejected: number; all: number };
  options: { projects: { id: string; name: string }[] };
}

export interface CorrectorRequestDetail {
  summary: CorrectorRequestSummary;
  description: string | null;
  observations: { id: string; question: string; answer: string | null; at: string; askedBy?: string; answeredBy?: string | null; answeredAt?: string | null }[];
  history: { id: string; label: string; actor: string; at: string }[];
}
