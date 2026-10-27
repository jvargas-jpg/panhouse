import type { EditorialProjectSummary, EditorialProjectHistory, EditorialProjectDrive, EditorialState } from './editorialChief.js';

// Read models over the existing project/assignment/work-item domain.
export interface EditorProjectWork {
  id: string; label: string; type: string; state: EditorialState;
  dueDate: string | null; deliveredAt: string | null; startedAt: string | null;
  waitingOn: 'author' | 'specialist' | 'project_pause' | null;
  overdue: boolean; actionable: boolean; historical: boolean;
}
export interface EditorProjectRow extends EditorialProjectSummary {
  participation: 'active' | 'history'; stateLabel: string;
  assignedAt: string | null; endedAt: string | null;
  workCounts: { known: number; active: number; pending: number; waiting: number; blocked: number; completed: number };
  currentWork: EditorProjectWork | null;
}
export interface EditorProjectList {
  items: EditorProjectRow[]; total: number; page: number; pages: number;
  options: { services: { id: string; name: string }[]; states: string[]; specialists: { id: string; name: string }[]; editors: { id: string; name: string }[] };
}
export interface EditorProjectDetail {
  summary: EditorProjectRow; nextStep: string;
  interventions: EditorProjectWork[]; interventionsTotal: number;
  drive: EditorialProjectDrive; materialUnavailable: boolean;
  blockers: { workItemId: string; reason: string; createdAt: string }[];
  deliveries: { id: string; workItemId: string; label: string; driveUrl: string | null; submittedAt: string; observaciones: string | null }[];
  feedback: { id: string; workItemId: string; interventionLabel: string; label: string; actor: string; at: string; kind: 'received' | 'applied'; pending: boolean }[];
  history: EditorialProjectHistory[];
}
export interface EditorProjectFilters {
  search: string; state?: string; service?: string; specialist?: string;
  participation?: 'active' | 'history'; page: number; pageSize: number;
  sort: 'priority' | 'activity' | 'delivery' | 'title' | 'state';
}
