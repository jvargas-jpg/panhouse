// Jefatura · Decisiones — docs/arquitectura/17-jefatura-decisiones.md.
// Tipos compartidos entre server/helpers/decisiones.ts y el frontend
// (frontend/src/jefatura/DecisionesPage.tsx) -- mismo criterio que
// shared/seguimientoOperativo.ts.

export type DecisionTipo =
  'revision_previa_correccion' | 'coleccion_inconsistente';
export type DecisionStatus =
  'pendiente' | 'en_revision' | 'informacion_solicitada' | 'resuelta';
export type DecisionResolution = 'approved' | 'rejected' | 'cancelled';

export const SUBJECTS_DECISION: Record<DecisionTipo, string> = {
  revision_previa_correccion: 'Revisión previa de Corrección',
  coleccion_inconsistente: 'Revisión de colección',
};

export interface ItemDecision {
  id: string;
  proyectoId: string;
  codigo: string;
  titulo: string;
  autores: string;
  tipo: string;
  subject: string;
  status: string;
  resolutionType: string | null;
  requestedAt: string;
  requestedByNombre: string;
  requestMessage: string | null;
  origen: 'correccion' | 'calidad';
  bloqueaCorreccion: boolean;
  urgente: boolean;
}

export interface ListaDecisiones {
  items: ItemDecision[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DetalleDecision {
  id: string;
  proyectoId: string;
  codigo: string;
  titulo: string;
  autores: string;
  servicioCodigo: string | null;
  servicioNombre: string;
  especialistaNombre: string | null;
  tipo: string;
  subject: string;
  status: string;
  resolutionType: string | null;
  resolutionMessage: string | null;
  requestMessage: string | null;
  requestedAt: string;
  requestedByNombre: string;
  requestedByRole: string;
  requestedByUserId: string;
  originWorkItemId: string | null;
  reviewStartedAt: string | null;
  requestedInfoMessage: string | null;
  requestedInfoAt: string | null;
  respondedInfoMessage: string | null;
  respondedInfoAt: string | null;
  resolvedAt: string | null;
  resolvedByNombre: string | null;
  contextSnapshot: Record<string, unknown> | null;
  version: number;
  correccion: {
    paginas: number | null;
    alcance: string | null;
    requiereRevisionPrevia: boolean;
    revisionPreviaConfirmada: boolean;
  } | null;
}

export interface ActividadDecisionItem {
  id: string;
  actor: string;
  texto: string;
  fecha: string;
  detalles: Record<string, unknown> | null;
}

export interface ResumenDecisiones {
  pendientes: number;
  urgentes: number;
  esperandoInfo: number;
}

export interface FiltrosDecisionesUI {
  q: string;
  status:
    | 'pendiente'
    | 'en_revision'
    | 'informacion_solicitada'
    | 'resuelta'
    | 'todas';
  tipo: string;
  page: number;
}
