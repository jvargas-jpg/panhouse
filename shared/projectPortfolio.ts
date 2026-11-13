import type { GuidePath } from './projectGuide.js';
export interface GuidedProjectSummary {
 id: string; title: string; authors: string; code: string; service: string;
 specialist: string | null; macroState: string;
 alert: string | null; overdue: boolean; dueAt: string | null; actionable: boolean;
 mainProcess: GuidePath | null; parallelProcesses: GuidePath[];
 risks: { processId: string | null; message: string }[];
 nextMilestones: { processId: string; label: string; dueAt: string | null }[];
 newAssignment: { assignedAt: string; nextStep: string } | null;
}
export interface GuidedPortfolio { items: GuidedProjectSummary[]; page: number; pages: number; total: number }
