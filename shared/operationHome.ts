import type { GuidePath } from './projectGuide.js';
import type { CapacidadJefatura } from './jefatura.js';
import type { GuidedProjectSummary } from './projectPortfolio.js';
export interface OperationItem {
 project: Pick<GuidedProjectSummary,'id'|'title'|'authors'|'code'|'service'|'specialist'>;
 process: GuidePath; reason: string; overdue: boolean; availableElsewhere: number;
}
export interface OperationHome {
 role: 'especialista'|'jefe_area';
 summary: { active: number; actionable: number; waiting: number; overdue: number; newAssignments: number };
 actions: OperationItem[]; waiting: OperationItem[];
 newAssignments: GuidedProjectSummary[];
 risks: { projectId: string; title: string; processId: string | null; message: string }[];
 interventions: { id: string; projectId: string; title: string; reason: string; href: string; kind: 'assignment'|'decision' }[];
 team: CapacidadJefatura[];
}
