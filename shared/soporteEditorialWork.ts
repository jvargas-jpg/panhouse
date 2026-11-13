// Legacy shared-inbox DTO, retained only for historical compatibility.
// The active Validador inbox uses individual assignments and shared/validationWork.
export type EstadoPlazoCalidad = 'en_tiempo' | 'proximo_a_vencer' | 'vencido';
export type ValidatorWorkTab = 'active' | 'waiting' | 'completed' | 'all';
export type ValidatorWorkStatus = 'new_round' | 'in_review' | 'waiting_design' | 'completed';

export interface ValidatorWorkFilters {
  tab: ValidatorWorkTab; search: string; status?: ValidatorWorkStatus; type?: string; project?: string;
  page: number; pageSize: number;
}

export interface ValidatorWorkRow {
  id: string; // fichaCalidadFases.id -- la RONDA, clave de selección/deep link
  workItemId: string;
  projectId: string;
  projectCode: string;
  title: string;
  authors: string;
  coverUrl: string | null;
  numeroFase: number;
  ronda: number;
  versionLabel: string; // pdfVersion real (p.ej. "V3") -- nunca igualado a `ronda`
  validationType: string; // fases[numeroFase], mismo label real de SeccionCalidadOperativa.tsx
  status: ValidatorWorkStatus;
  statusLabel: string;
  deadline: string | null;
  deadlineState: EstadoPlazoCalidad | null;
  lastActivity: { label: string; at: string } | null;
  actionable: boolean;
  paused?: boolean;
  blockedReason?: string | null;
  cta: string;
}

export interface ValidatorWorkList {
  items: ValidatorWorkRow[]; total: number; page: number; pages: number;
  counts: Record<ValidatorWorkTab, number>;
  options: { projects: { id: string; name: string }[]; types: { id: string; name: string }[] };
}

export interface ValidatorMaterial { role: 'diagrammed' | 'source' | 'previous' | 'previous_comments' | 'legal' | 'comments'; label: string; url: string }
export interface ValidatorCriterion { key: string; label: string; cumple: boolean | null; observaciones: string }
export interface ValidatorHistoryEntry { id: string; label: string; at: string }

// Resultado de ronda: MISMO modelo real que ResultadoCalidad en
// server/helpers/calidad.ts (checklist por criterio + comentariosUrl +
// contadores reales) -- nunca una taxonomía de observaciones inventada
// (sin severidades/categorías/scores, ver §51-52 del master prompt).
export interface ValidatorWorkDetail {
  summary: ValidatorWorkRow;
  specialist: string | null;
  designer: string | null;
  requestedAt: string;
  startedAt: string | null;
  resolvedAt: string | null;
  materials: ValidatorMaterial[];
  criteria: ValidatorCriterion[];
  approved: boolean | null;
  reviewedBy?: string | null;
  pagesReviewed: number | null;
  commentsCount: number | null;
  commentsUrl: string | null;
  toVerifyChanges: number | null;
  pendingChanges: number | null;
  newChanges: number | null;
  observations: string | null;
  designAdjustment: { feedback: string | null; attachmentUrl: string | null } | null;
  previousRound: { id: string; label: string } | null;
  history: ValidatorHistoryEntry[];
}
