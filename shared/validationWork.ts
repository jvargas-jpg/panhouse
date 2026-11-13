// A role identifies a person; context and type identify their assigned work.
export const VALIDATION_CONTEXTS = ['CALIDAD', 'SOPORTE_EDITORIAL'] as const;
export type ValidationContext = typeof VALIDATION_CONTEXTS[number];
export type ValidationWorkType = 'VALIDACION_FASE_1' | 'VALIDACION_APLICACION_COMENTARIOS' | 'REVISION_FINAL' | 'VALIDACION_FINAL' | 'REVISION_CUBIERTA';
export interface ValidationWorkIdentity {
  context: ValidationContext;
  contextLabel: string;
  workType: ValidationWorkType;
  workTypeLabel: string;
}
export function validationWorkIdentity(designType: string, phase: number): ValidationWorkIdentity {
  if (designType === 'cubierta_extendida') return { context: 'SOPORTE_EDITORIAL', contextLabel: 'Soporte Editorial', workType: 'REVISION_CUBIERTA', workTypeLabel: 'Revisión de cubierta' };
  const types = {
    1: ['VALIDACION_FASE_1', 'Validación Fase 1'],
    2: ['VALIDACION_APLICACION_COMENTARIOS', 'Validación de aplicación de comentarios'],
    3: ['REVISION_FINAL', 'Revisión Final'],
    4: ['VALIDACION_FINAL', 'Validación Final'],
  } as const;
  const type = types[phase as keyof typeof types];
  if (!type || designType !== 'diagramacion') throw new Error('Tipo de trabajo de validación no confirmado');
  return { context: 'CALIDAD', contextLabel: 'Calidad', workType: type[0], workTypeLabel: type[1] };
}
export function validationWorkLabel(work: ValidationWorkIdentity) {
  return `${work.contextLabel} · ${work.workTypeLabel}`;
}
