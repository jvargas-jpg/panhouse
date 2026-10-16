export const GOAL_TYPES = {
  GENERAL: 'Objetivo general', CIERRE_PROYECTO: 'Cerrar proyecto',
  ALCANZAR_PROCESO: 'Alcanzar un proceso', ALCANZAR_HITO: 'Completar un hito',
} as const;
export type GoalType = keyof typeof GOAL_TYPES;
export type GoalSource = 'JEFATURA' | 'ESPECIALISTA';
export type GoalBaseStatus = 'ACTIVO' | 'CUMPLIDO' | 'NO_CUMPLIDO' | 'CANCELADO';
export type GoalStatus = GoalBaseStatus | 'EN_RIESGO';
export interface GoalEvidence { kind: 'project_close' | 'process_opened' | 'work_item_completed'; id: string; at: string; precision: 'dia' | 'instante' }
export interface GoalSummary { total: number; assigned: number; own: number; active: number; risk: number; completed: number; unmet: number; cancelled: number }
export interface GoalProject {
  id: string; codigo: string; titulo: string; autores: string; servicio: string; estado: string;
  portadaUrl: string | null; fechaObjetivo: string | null; express: boolean;
}
export interface MonthlyGoal {
  id: string; specialistId: string; projectId: string | null; periodYear: number; periodMonth: number;
  source: GoalSource; createdBy: { id: string; nombre: string }; title: string; description: string | null;
  goalType: GoalType; targetProcess: string | null; targetWorkItemId: string | null; targetLabel: string;
  targetDate: string; status: GoalStatus; baseStatus: GoalBaseStatus; completedAt: string | null;
  evidence: GoalEvidence | null; cancelReason: string | null; createdAt: string; updatedAt: string;
  currentContext: string; riskReasons: string[]; daysRemaining: number; daysEarly: number | null;
  canEdit: boolean; project: GoalProject | null; canOpenProject: boolean;
}
export interface GoalList {
  period: string; readOnly: boolean; updatedAt: string; items: MonthlyGoal[];
  total: number; page: number; pages: number; pageSize: number;
}
export interface TeamGoals { period: string; readOnly: boolean; summary: GoalSummary; specialists: { id: string; nombre: string; summary: GoalSummary }[] }
export interface GoalHistory { goal: MonthlyGoal; events: { id: string; accion: string; actor: string; at: string; detalles: Record<string, unknown> | null }[] }
export interface GoalCatalog {
  types: { id: GoalType; nombre: string }[]; processes: { id: string; nombre: string }[];
  projects: GoalProject[]; milestones: { id: string; projectId: string; nombre: string; estado: string }[];
}
export interface GoalInput {
  periodYear: number; periodMonth: number; projectId: string | null; title: string; description: string | null;
  goalType: GoalType; targetProcess: string | null; targetWorkItemId: string | null; targetDate: string;
}
