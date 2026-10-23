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
