export type CorrectorHomeState = 'assigned' | 'inProgress' | 'blocked' | 'paused' | 'completed';
export interface CorrectorHomeItem {
  correctionId: string; workItemId: string; projectId: string; code: string; title: string; authors: string; coverUrl: string | null;
  intervention: string; state: CorrectorHomeState; stateLabel: string; deadline: string | null;
  deadlineState: 'en_tiempo' | 'proximo_a_vencer' | 'vencido' | null; blocker: string | null; actionable: boolean;
  completedAt: string | null; cta: string;
}
export interface CorrectorDashboard {
  today: string; monthLabel: string;
  summary: { active: number; dueSoon: number; overdue: number; completedThisMonth: number };
  attentionItems: CorrectorHomeItem[]; activeTotal: number; nextDeadline: CorrectorHomeItem | null; recentCompleted: CorrectorHomeItem[];
}
