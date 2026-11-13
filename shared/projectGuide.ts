export interface GuideRequirement { id: string; label: string; satisfied: boolean; source: string }
export type GuideState = 'Disponible' | 'En curso' | 'Esperando tercero' | 'Bloqueado' | 'Completado' | 'No aplica';
export interface GuideStep {
  id: string; label: string; completed: boolean; requirements: GuideRequirement[];
}
export interface GuidePath {
  id: string; label: string; state: GuideState; currentStep: string; instruction: string;
  responsible: string; waitingFor: string | null; requirements: GuideRequirement[];
  steps: GuideStep[]; canContinue: boolean; canOperate: boolean;
  action: { kind: 'native' | 'request_editor' | 'validation' | 'package'; label: string } | null;
  historicalReadOnly: boolean; editWarning: string | null;
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
}
