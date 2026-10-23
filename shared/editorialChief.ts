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
  assignmentId?: string | null; plannedDueDate?: string | null;
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
