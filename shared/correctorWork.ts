// Mismo tipo que server/helpers/correccionSla.ts y frontend/src/types/api.ts
// (sin shared/correccionSla.ts hoy -- se declara acá igual que el resto de
// este archivo, no se crea un módulo compartido nuevo solo para un alias).
export type EstadoPlazoCorreccion = 'en_tiempo' | 'proximo_a_vencer' | 'vencido';

// Mi trabajo del Corrector: UNA FILA = UNA INTERVENCIÓN DE CORRECCIÓN
// (nunca proyecto), scoped por assignment vigente (server/helpers/
// correctorWork.ts reutiliza listarMisCorrecciones, ya acotado por
// cuenta). Sin progreso % (no hay denominador real), sin prioridad
// inventada (surge de deadlineState/blocker), sin KPIs arriba.
export type CorrectorWorkTab = 'active' | 'completed' | 'all';
export type CorrectorWorkStatus = 'asignada' | 'en_correccion' | 'bloqueada' | 'completada';

export interface CorrectorWorkFilters {
  tab: CorrectorWorkTab; search: string; status?: CorrectorWorkStatus; scope?: string; project?: string;
  page: number; pageSize: number;
}

export interface CorrectorWorkRow {
  id: string; // = workItemId, clave de selección/deep link
  correctionId: string;
  projectId: string;
  projectCode: string;
  title: string;
  authors: string;
  coverUrl: string | null;
  intervention: string; // alcance real (Tripa completa / Preliminares / Cubierta extendida)
  scope: string;
  status: CorrectorWorkStatus;
  statusLabel: string;
  deadline: string | null; // dueAt ISO, derivado en backend
  deadlineState: EstadoPlazoCorreccion | null;
  blocker: string | null;
  lastActivity: { label: string; at: string } | null;
  completedAt: string | null;
  actionable: boolean;
  cta: string;
}

export interface CorrectorWorkList {
  items: CorrectorWorkRow[]; total: number; page: number; pages: number;
  counts: Record<CorrectorWorkTab, number>;
  options: { projects: { id: string; name: string }[] };
}

export interface CorrectorWorkFolder { key: string; label: string; driveUrl: string | null }
export interface CorrectorWorkDelivery { id: string; tripaDriveUrl: string; reportDriveUrl: string; observaciones: string | null; submittedAt: string }
export interface CorrectorWorkBlocker { id: string; reason: string; createdAt: string; resolvedAt: string | null; resolution: string | null }
export interface CorrectorWorkHistoryEntry { id: string; label: string; actor: string; at: string }

export interface CorrectorWorkDetail {
  summary: CorrectorWorkRow;
  assignedAt: string | null;
  specialist: string | null;
  folders: CorrectorWorkFolder[];
  materialUnavailable: boolean;
  slaLabel: string | null;
  deliveries: CorrectorWorkDelivery[];
  blocker: CorrectorWorkBlocker | null;
  history: CorrectorWorkHistoryEntry[];
}
