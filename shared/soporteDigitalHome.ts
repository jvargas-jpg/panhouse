// Proyección de lectura sobre hitos existentes. No son estados nuevos del workflow.
export type DigitalStage = 'preparation' | 'testing' | 'loaded' | 'completed';
export type DigitalDeadlineState = 'overdue' | 'today' | 'soon' | 'scheduled' | null;
export type DigitalCounts = Record<DigitalStage, number>;
export interface DigitalPriorityTask {
  workItemId: string; projectId: string; projectTitle: string; projectCode: string;
  authors: string; coverUrl: string | null; stage: DigitalStage; taskType: string; taskLabel: string;
  deadline: string | null; deadlineState: DigitalDeadlineState; status: string;
  blocker: string | null; actionable: boolean; packageAvailable: boolean; href: string;
}
export interface DigitalActivity {
  id: string; label: string; projectTitle: string; at: string; actor: string; href: string;
}
export interface DigitalSupportDashboard {
  today: string;
  summary: DigitalCounts;
  priorityTasks: DigitalPriorityTask[];
  flowSummary: { counts: DigitalCounts; activeTasks: number; waitingPackage: number; pausedProjects: number };
  recentActivity: { items: DigitalActivity[]; unavailable: boolean };
}
export const DIGITAL_STAGE_LABELS: Record<DigitalStage, string> = {
  preparation: 'En preparación', testing: 'Para pruebas KDP', loaded: 'Cargas registradas', completed: 'Digital completado',
};
// Antes apuntaba a /proyectos/:id#digital como placeholder porque Mi
// trabajo todavía no existía; ahora que existe, Inicio enlaza directo a
// la tarea seleccionada en la bandeja real (mismo patrón que Corrector/
// Soporte Editorial: vista=mi-trabajo&workItem=<id>). Sin workItemId
// (actividad reciente, a veces solo referencia al proyecto) filtra la
// bandeja por ese proyecto en vez de abrir una tarea puntual.
export const digitalWorkUrl = (projectId: string, workItemId?: string) =>
  workItemId ? `/?vista=mi-trabajo&workItem=${encodeURIComponent(workItemId)}` : `/?vista=mi-trabajo&project=${encodeURIComponent(projectId)}`;
