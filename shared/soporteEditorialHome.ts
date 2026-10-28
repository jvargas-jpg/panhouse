export type ValidationState = 'new' | 'inProgress';
export interface ValidationItem {
  faseId: string; workItemId: string; projectId: string; code: string; title: string; authors: string; coverUrl: string | null;
  numeroFase: number; ronda: number; validationType: string; state: ValidationState; stateLabel: string;
  deadline: string | null; deadlineState: 'en_tiempo' | 'proximo_a_vencer' | 'vencido' | null; actionable: boolean; cta: string;
  requestedAt: string; startedAt: string | null;
}
export interface SoporteEditorialActivity { id: string; label: string; projectTitle: string; at: string }
export interface SoporteEditorialDashboard {
  today: string;
  summary: { active: number; dueSoon: number; overdue: number; newRounds: number };
  attentionItems: ValidationItem[];
  upcomingDeadlines: ValidationItem[];
  recentActivity: SoporteEditorialActivity[];
}
