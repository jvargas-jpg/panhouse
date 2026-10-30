// Mi trabajo de Soporte Digital — misma etapa/estado que Inicio
// (shared/soporteDigitalHome.ts), una fila por work item (nunca por
// proyecto): un proyecto puede tener más de una tarea digital abierta.
import type { DigitalDeadlineState, DigitalStage } from './soporteDigitalHome.js';
export type { DigitalDeadlineState, DigitalStage };
export const DIGITAL_WORK_TABS = ['all', 'preparation', 'testing', 'loaded', 'completed'] as const;
export type DigitalWorkTab = (typeof DIGITAL_WORK_TABS)[number];
export const DIGITAL_WORK_STATES = ['pending', 'in_progress', 'blocked', 'waiting_material', 'paused', 'completed'] as const;
export type DigitalWorkState = (typeof DIGITAL_WORK_STATES)[number];
export const DIGITAL_WORK_STATE_LABELS: Record<DigitalWorkState, string> = {
  pending: 'Pendiente', in_progress: 'En curso', blocked: 'Bloqueada', waiting_material: 'Esperando paquete final', paused: 'Proyecto en pausa', completed: 'Control digital completado',
};
export const DIGITAL_DEADLINE_FILTERS = ['overdue', 'today', 'soon', 'scheduled', 'none'] as const;
export const DIGITAL_WORK_SORTS = ['priority', 'deadline', 'recent'] as const;
export const DIGITAL_ACTIONS = ['iniciarTarea', 'enviarFormulario', 'registrarActivacion', 'registrarPrueba', 'registrarCarga', 'marcarCompletado', 'actualizarDatos'] as const;
export type DigitalActionKind = (typeof DIGITAL_ACTIONS)[number];
export interface DigitalWorkAction {
  kind: DigitalActionKind;
  expectedRevision: string;
  requestId: string;
  date?: string;
  dateKindle?: string;
  datos?: Record<string, string | null>;
}

export interface DigitalWorkRow {
  workItemId: string;
  projectId: string;
  projectTitle: string;
  projectCode: string;
  authors: string;
  coverUrl: string | null;
  stage: DigitalStage;
  taskLabel: string;
  deadline: string | null;
  deadlineState: DigitalDeadlineState;
  status: string;
  blocker: string | null;
  actionable: boolean;
  packageAvailable: boolean;
  lastActivity: { label: string; at: string } | null;
}

export interface DigitalWorkFilters {
  tab: DigitalWorkTab;
  search: string;
  project?: string;
  page: number;
  pageSize: number;
  state?: DigitalWorkState;
  stage?: DigitalStage;
  deadline?: (typeof DIGITAL_DEADLINE_FILTERS)[number];
  blocked?: 'yes' | 'no';
  sort?: (typeof DIGITAL_WORK_SORTS)[number];
}

export interface DigitalWorkList {
  items: DigitalWorkRow[];
  total: number;
  pages: number;
  page: number;
  counts: Record<DigitalWorkTab, number>;
  options: { projects: { id: string; name: string }[] };
}

// Campos reales del catálogo documental 'digital' (fichaDocumentalCatalogo.ts)
// que esta pantalla muestra — nunca todo el catálogo de 16 campos de
// golpe, agrupados por lo que el negocio ya distingue operativamente.
export interface DigitalCatalogField {
  key: string;
  label: string;
  type: 'texto' | 'fecha' | 'enlace';
  value: string | null;
}
export interface DigitalCatalogGroup {
  label: string;
  fields: DigitalCatalogField[];
}

export type DigitalNextAction =
  | { kind: 'enviarFormulario' }
  | { kind: 'registrarActivacion' }
  | { kind: 'registrarPrueba' }
  | { kind: 'registrarCarga' }
  | { kind: 'marcarCompletado' }
  | null;

export interface DigitalHistoryEntry {
  id: string;
  label: string;
  at: string;
}

export interface DigitalWorkDetail {
  summary: DigitalWorkRow;
  revision: string;
  canStart: boolean;
  canEditData: boolean;
  currentLoads: { kdp: boolean; kindle: boolean };
  startedAt: string | null;
  specialist: string | null;
  assignedAt: string;
  cuentaAmazon: string | null;
  formSentAt: string | null;
  activatedAt: string | null;
  digitalEstatus: string | null;
  packageAvailable: boolean;
  nextAction: DigitalNextAction;
  waitingOn: string | null;
  catalog: DigitalCatalogGroup[];
  materialsAvailable: boolean;
  history: DigitalHistoryEntry[];
}

export interface DigitalMaterialFile {
  id: string;
  name: string;
  url: string;
}
export interface DigitalMaterialsResult {
  items: DigitalMaterialFile[];
  nextPageToken: string | null;
  folderUrl?: string | null;
}
