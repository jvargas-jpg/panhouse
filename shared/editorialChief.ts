export type EditorialState = 'En edición' | 'Esperando autor' | 'Esperando Especialista' | 'En pausa' | 'Requiere ajustes' | 'Pendiente' | 'Completadas' | 'Bloqueadas';
export interface EditorialIntervention {
  id: string; workItemId: string | null; projectId: string; title: string; authors: string;
  code: string; service: string; coverUrl: string | null; label: string;
  editorId: string | null; editor: string | null; state: EditorialState;
  dueDate: string | null; overdue: boolean; atRisk: boolean; actionable: boolean;
  needsAssignment: boolean; requestedAt: string | null; requestedBy?: string; situation: string | null;
  cta: string; chapter: number | null; deliveredAt: string | null; block: string | null;
  serviceId?: string; serviceCode?: string; subtype?: string | null;
  interventionType?: string; volume?: string | null; notes?: string | null;
  requestedById?: string | null; requestedByRole?: string | null;
  waitingOn?: 'author' | 'specialist' | 'project_pause' | null;
  assignmentId?: string | null; plannedDueDate?: string | null; requestVersion?: number; requestPending?: boolean;
}
export interface EditorialLoad { id: string; name: string; active: number; upcoming: number; overdue: number; waiting: number }
export interface EditorialRequest { id: string; projectId: string; title: string; authors: string; label: string; requestedAt: string; requestedBy: string; state: 'Pendiente' }
export interface EditorialActivity { id: string; text: string; title: string; actor: string; at: string }
export interface EditorialDashboard {
  updatedAt: string; today: string;
  summary: { unassigned: number; overdue: number; atRisk: number; pendingRequests: number };
  editorLoads: EditorialLoad[];
  interventionDistribution: { state: EditorialState; count: number }[];
  attentionItems: EditorialIntervention[]; upcomingDeliveries: EditorialIntervention[];
  pendingRequests: EditorialRequest[]; attentionTotal: number;
}

export type EditorialAssignmentTab = 'unassigned' | 'editing' | 'waiting' | 'overdue' | 'all';
export interface EditorialAssignmentFilters {
  tab: EditorialAssignmentTab; search: string; service?: string; interventionType?: string;
  specialist?: string; editor?: string; date?: string; status?: string;
  page: number; pageSize: number; sort: 'due' | 'oldest' | 'project';
}
export interface EditorialAssignmentList {
  items: EditorialIntervention[]; total: number; page: number; pages: number;
  counts: Record<EditorialAssignmentTab, number>;
  options: { services: {id: string; name: string}[]; interventionTypes: {id: string; name: string}[];
    specialists: {id: string; name: string}[]; editors: {id: string; name: string}[]; states: string[] };
}
export interface EditorialEditorLoad {
  id: string; name: string; activeAssigned: number; actionableNow: number;
  waitingThirdParty: number; overdue: number; dueThisWeek: number;
  nextDeliveries: Pick<EditorialIntervention,'id'|'title'|'label'|'dueDate'|'overdue'>[];
}
export interface EditorialLoadSummary { editors: EditorialEditorLoad[]; today: string; updatedAt: string }
export interface EditorialRecommendation {
  rule: 'editorial-descriptive-v1'; observedAt: string; recommendedIds: string[];
  candidates: (EditorialEditorLoad & {rank: number; reasons: string[]})[];
  explanation: string; limitations: string;
}

// Proyectos de edición: una fila = un proyecto (síntesis de sus intervenciones). Explica, no decide.
export type EditorialProjectState = EditorialState | 'Por iniciar';
export interface EditorialProjectSummary {
  projectId: string; code: string; title: string; authors: string; coverUrl: string | null;
  service: string; serviceId: string; serviceCode: string; subtype: string | null;
  editorialState: EditorialProjectState; risk: boolean; overdue: boolean; blocker: string | null;
  responsibleNow: 'editor' | 'especialista' | 'autor' | null;
  interventionSummary: string; interventionCount: number;
  // Sin denominador contractual real (capitulos_pactados es un rango de texto, no un total) — queda nullable a propósito.
  progress: { completedUnits: number; totalUnits: number; unitLabel: string } | null;
  editor: string | null; editorId: string | null; multipleEditors: boolean; editorCount: number;
  specialist: string | null; specialistId: string | null;
  nextDelivery: { label: string; date: string } | null;
  lastActivity: { label: string; at: string } | null;
}
export interface EditorialProjectFilters {
  search: string; service?: string; state?: string; editor?: string;
  page: number; pageSize: number; sort: 'activity' | 'delivery' | 'title' | 'state' | 'editor';
}
export interface EditorialProjectList {
  items: EditorialProjectSummary[]; total: number; page: number; pages: number;
  counts: { inEditing: number; upcomingDeliveries: number; overdue: number; waitingAuthor: number };
  options: { services: {id: string; name: string}[]; editors: {id: string; name: string}[]; states: string[] };
}
export interface EditorialProjectIntervention {
  id: string; label: string; state: EditorialState; editor: string | null; editorId: string | null;
  dueDate: string | null; overdue: boolean; deliveredAt: string | null; waitingOn: string | null; cta: string;
}
export interface EditorialProjectDrive { rootUrl: string | null; links: { key: string; label: string; url: string }[] }
export interface EditorialProjectHistory { id: string; label: string; actor: string; at: string }
export interface EditorialProjectDetail {
  summary: EditorialProjectSummary; nextStep: string; interventions: EditorialProjectIntervention[];
  interventionsTotal: number; drive: EditorialProjectDrive; history: EditorialProjectHistory[];
}

// Seguimiento: supervisión operativa. Unidad = intervención/work item, nunca proyecto — el mismo
// proyecto puede aparecer varias veces (una fila por capítulo/intervención activa).
export type CurrentResponsible = 'editor' | 'autor' | 'especialista' | null;
export type EditorialTrackingTab = 'priority' | 'overdue' | 'risk' | 'blocked' | 'editing' | 'waiting' | 'all';
export interface EditorialTrackingFilters {
  tab: EditorialTrackingTab; search: string; service?: string; status?: string; editor?: string;
  responsible?: Exclude<CurrentResponsible, null>; interventionType?: string; from?: string; to?: string;
  page: number; pageSize: number; sort: 'due' | 'status' | 'editor' | 'project';
}
export interface EditorialTrackingRow extends EditorialIntervention {
  currentResponsible: CurrentResponsible; daysLabel: string;
}
export interface EditorialTrackingList {
  items: EditorialTrackingRow[]; total: number; page: number; pages: number;
  counts: { overdue: number; risk: number; blocked: number; waitingThirdParty: number; priority: number; all: number };
  options: { services: {id: string; name: string}[]; editors: {id: string; name: string}[]; states: string[]; interventionTypes: {id: string; name: string}[] };
}
export interface EditorialTrackingDrive { rootUrl: string | null; links: { key: string; label: string; url: string }[]; files: { label: string; url: string }[] }
export interface EditorialTrackingSibling { id: string; label: string; state: EditorialState; dueDate: string | null; overdue: boolean }
export interface EditorialTrackingDetail {
  summary: EditorialTrackingRow;
  project: { id: string; code: string; title: string; authors: string; service: string; coverUrl: string | null };
  specialist: string | null; specialistId: string | null;
  nextStep: string; riskReason: string | null; blockerReason: string | null;
  siblings: EditorialTrackingSibling[]; siblingsTotal: number;
  drive: EditorialTrackingDrive; history: EditorialProjectHistory[];
}

// Solicitudes: bandeja de decisiones, no de notificaciones. Hoy el único tipo real respaldado por el
// dominio es asignación de Editor (EDITOR_SOLICITADO) — reasignación-como-solicitud, apoyo por carga y
// escalación se auditaron y no tienen infraestructura propia; no se inventan (ver docs/arquitectura/29-jefe-edicion.md).
export type EditorialRequestStatus = 'pendiente' | 'resuelta' | 'devuelta' | 'cancelada';
export interface EditorialRequestSummary {
  id: string; projectId: string; code: string; title: string; authors: string; coverUrl: string | null;
  service: string; serviceId: string;
  requester: string | null; requesterId: string | null; requesterRole: string | null;
  status: EditorialRequestStatus; requestedAt: string;
  resolvedAt: string | null; resolvedBy: string | null;
  resultEditorId: string | null; resultEditor: string | null; resultWorkItemId: string | null;
  workItemId: string; businessKey: string; requestType: 'ASSIGN_EDITOR'; projectActive: boolean;
  interventionLabel: string; description: string; volume: string | null; requestedDate: string | null;
  notes: string | null; returnReason: string | null; actionable: boolean; assignmentReady: boolean; version: number;
  resultAssignmentId: string | null;
}
export interface EditorialRequestFilters {
  tab: 'pending' | 'resolved' | 'returned' | 'all'; search: string; service?: string; requester?: string;
  from?: string; to?: string; page: number; pageSize: number; sort: 'oldest' | 'newest' | 'project';
}
export interface EditorialRequestList {
  items: EditorialRequestSummary[]; total: number; page: number; pages: number;
  counts: { pending: number; resolved: number; all: number; returned: number };
  pendingTotal: number;
  options: { services: { id: string; name: string }[]; requesters: { id: string; name: string }[] };
}
export interface EditorialRequestContext {
  editorialState: EditorialState; currentEditor: string | null; specialist: string | null;
  deadline: string | null; waitingOn: string | null; blocker: string | null;
}
export interface EditorialRequestDetail {
  summary: EditorialRequestSummary; context: EditorialRequestContext | null; history: EditorialProjectHistory[];
  files: { label: string; url: string }[];
  recommendationSummary: { rule: EditorialRecommendation['rule']; observedAt: string; explanation: string; tied: number;
    editor: Pick<EditorialEditorLoad, 'id' | 'name' | 'actionableNow' | 'overdue' | 'dueThisWeek'> | null } | null;
}
