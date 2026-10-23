export type EditorialState = 'En edición' | 'Esperando autor' | 'Esperando Especialista' | 'Requiere ajustes' | 'Pendiente' | 'Completadas' | 'Bloqueadas';
export interface EditorialIntervention {
  id: string; workItemId: string | null; projectId: string; title: string; authors: string;
  code: string; service: string; coverUrl: string | null; label: string;
  editorId: string | null; editor: string | null; state: EditorialState;
  dueDate: string | null; overdue: boolean; atRisk: boolean; actionable: boolean;
  needsAssignment: boolean; requestedAt: string | null; requestedBy?: string; situation: string | null;
  cta: string; chapter: number | null; deliveredAt: string | null; block: string | null;
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
