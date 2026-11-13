export interface GuideRequirement { id: string; label: string; satisfied: boolean; source: string }
export type GuideState = 'Disponible' | 'En curso' | 'Esperando tercero' | 'Bloqueado' | 'Completado' | 'No aplica';
export interface GuideStep {
  id: string; label: string; completed: boolean; requirements: GuideRequirement[];
}
export interface GuidePath {
  id: string; label: string; state: GuideState; currentStep: string; instruction: string;
  responsible: string; waitingFor: string | null; requirements: GuideRequirement[];
  steps: GuideStep[]; canContinue: boolean; canOperate: boolean;
  /** Editorial action required, independent of the viewer's permissions. */
  requiresAction: boolean;
  action: { kind: 'native' | 'request_editor' | 'validation' | 'package' | 'chapter_author' | 'brief_author' | 'concept_author' | 'creative_request' | 'correction_start' | 'correction_contract' | 'correction_assign' | 'correction_review' | 'decision_response'; label: string; targetId?: string; chapter?: number; designType?: 'muestra_diagramacion'|'cubierta_extendida'|'diagramacion' } | null;
  historicalReadOnly: boolean; editWarning: string | null;
  /** Unknown legacy timestamps stay null, without invented receipt times. */
  requestedAt: string | null; assignedAt: string | null; assignee: string | null;
  waitingSince: string | null; dueAt: string | null;
  delivery: { receivedAt: string | null; url: string; label: string } | null;
  blockingReasons: string[];
}
export interface FinalPackageGate {
  requirements: GuideRequirement[]; canPrepare: boolean; prepared: boolean;
  canRelease: boolean; financialSatisfied: boolean; financialMessage: string;
  configurationSource: 'service_configuration' | 'persisted_workspace' | 'unconfirmed';
}
export interface ProjectGuide {
  currentPath: string | null; position: string; nextMilestone: string;
  paths: GuidePath[]; finalPackage: FinalPackageGate;
  mode: 'operate' | 'supervise'; editable: boolean;
  priorityAction: string | null;
  requiresUserAction: boolean; waitingOn: { processId: string; actor: string }[];
  availableProcesses: string[]; blockedProcesses: string[]; activeProcesses: string[];
  nextMilestones: { processId: string; label: string; dueAt: string | null }[];
  supervisionActions: {id:string;processId:string|null;label:string;href:string;kind:'assignment'|'decision'}[];
}
