// Mi trabajo de Soporte Digital — misma etapa/estado que Inicio
// (shared/soporteDigitalHome.ts), una fila por work item (nunca por
// proyecto): un proyecto puede tener más de una tarea digital abierta.
import type { DigitalDeadlineState, DigitalStage } from './soporteDigitalHome.js';
export type { DigitalDeadlineState, DigitalStage };
export const DIGITAL_WORK_TABS = ['all', 'preparation', 'testing', 'loaded', 'completed'] as const;
export type DigitalWorkTab = (typeof DIGITAL_WORK_TABS)[number];

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
}
