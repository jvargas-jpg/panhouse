export interface GuidedProjectSummary {
 id: string; title: string; authors: string; code: string; service: string;
 specialist: string | null; macroState: string; position: string;
 responsible: string; waitingFor: string[]; nextMilestone: string;
 alert: string | null; overdue: boolean; dueAt: string | null; actionable: boolean;
}
export interface GuidedPortfolio { items: GuidedProjectSummary[]; page: number; pages: number; total: number }
