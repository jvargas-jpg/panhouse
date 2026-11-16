import type { WorkflowFacts } from './finalPackage.js';

type PreparationFacts = Pick<WorkflowFacts, 'serviceCode' | 'extraction' | 'works'>;

// Las sesiones programadas pertenecen al recorrido nuevo. Las extracciones
// ya realizadas conservan el comportamiento histórico de preparación.
export function requiereEditorParaExtracciones(facts: PreparationFacts) {
  return facts.serviceCode === 'EF' && facts.extraction.some(r => r.fechaHora && !r.realizada);
}

export function tieneProcesosPosterioresALaPreparacion(facts: PreparationFacts) {
  const esperaEditor = requiereEditorParaExtracciones(facts);
  return facts.works.some(w => !['intake_rrpp', 'asignacion_especialista', 'preparacion_inicial'].includes(w.tipo)
    // Pedir/asignar el Editor forma parte de la preparación de estas sesiones.
    // Los capítulos y cualquier otra intervención sí mantienen la protección.
    && !(esperaEditor && w.tipo === 'edicion' && w.businessKey === 'default' && ['pendiente', 'en_progreso'].includes(w.estado)));
}
