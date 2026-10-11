import type { ProyectoJefatura } from './jefatura.js';

export const MATERIALES_SEGUIMIENTO = {
  tripa_completa: 'Tripa completa',
  tripa_diagramada: 'Tripa diagramada',
  preliminares: 'Preliminares',
  cubierta_extendida: 'Cubierta extendida',
  texto_contraportada: 'Texto contraportada',
  sin_clasificar: 'Sin clasificar',
} as const;
export const PROCESOS_SEGUIMIENTO = {
  correccion: 'Corrección',
  validacion: 'Validación',
  fase_calidad_1: 'Fase de Calidad 1',
  revision_final: 'Revisión final',
  edicion: 'Edición',
  sin_clasificar: 'Sin clasificar',
} as const;
export const RESULTADOS_SEGUIMIENTO = {
  buena: 'Buena',
  regular: 'Regular',
  deficiente: 'Deficiente',
  excelente: 'Excelente',
  desestimar: 'Desestimar',
  no_aplica: 'No aplica',
} as const;
export type OrigenIntervencion = 'correccion' | 'calidad' | 'legacy';
export type EstadoIntervencion =
  | 'pendiente'
  | 'asignado'
  | 'en_progreso'
  | 'bloqueado'
  | 'entregado'
  | 'cancelado';
export type ResultadoSeguimiento = keyof typeof RESULTADOS_SEGUIMIENTO;
export type PaginaSeguimiento = {
  page: number;
  pageSize: number;
  pages: number;
  total: number;
};
export interface FiltrosIntervenciones {
  q: string;
  grupo: 'todas' | 'pendientes' | 'en_progreso' | 'vencidas' | 'entregadas';
  proceso?: keyof typeof PROCESOS_SEGUIMIENTO;
  material?: keyof typeof MATERIALES_SEGUIMIENTO;
  analistaId?: string;
  especialistaId?: string;
  proyectoId?: string;
  freelance?: 'si' | 'no';
  resultado?: ResultadoSeguimiento | 'sin_evaluar';
  origen?: OrigenIntervencion;
  from?: string;
  to?: string;
  orden: 'urgentes' | 'vencimiento' | 'recientes';
  page: number;
  pageSize: number;
}
export interface IntervencionSeguimiento {
  id: string;
  origen: OrigenIntervencion;
  workItemId: string | null;
  decisionId: string | null;
  ronda: number | null;
  faseNumero: number | null;
  proyecto: {
    id: string;
    codigo: string;
    titulo: string | null;
    autores: string;
    unidad: string | null;
    servicio: string;
    subtipoCrudo: string | null;
    estado: string;
  };
  especialista: { id: string; nombre: string } | null;
  analista: {
    id: string | null;
    nombre: string;
    tipo: 'usuario' | 'freelance' | 'bandeja' | 'legacy';
  } | null;
  material: keyof typeof MATERIALES_SEGUIMIENTO;
  proceso: keyof typeof PROCESOS_SEGUIMIENTO;
  estado: EstadoIntervencion;
  paginas: number | null;
  creadoEn: string;
  tiempos: {
    recibido: string | null;
    iniciado: string | null;
    entregado: string | null;
    fechaRecibido: string | null;
    fechaInicio: string | null;
    fechaEntrega: string | null;
    vence: string | null;
    horasEfectivas: number | null;
    horasTotales: number | null;
    horasPausadas: number | null;
    esperaHoras: number | null;
  };
  sla: {
    estado: 'en_plazo' | 'vence_hoy' | 'proximo' | 'vencido' | 'sin_sla';
    etiqueta: string;
    horasObjetivo: number | null;
    cumplimiento: 'en_plazo' | 'fuera_plazo' | null;
  };
  freelance: boolean;
  contratoConfirmado: boolean | null;
  pago80: boolean | null;
  pago20: boolean | null;
  resultadoOperativo: string | null;
  resultadoSeguimiento: ResultadoSeguimiento | null;
  cantidadComentarios: number | null;
  observacionesF1: string | null;
  observaciones: string | null;
  observacionesOperativas: string | null;
  listadoCorrectoresLegacy: string | null;
  registroAnterior: Record<string, string | null> | null;
  gate: { requerido: boolean; confirmado: boolean };
  alertas: string[];
  updatedAt: string | null;
  permisos: {
    notas: boolean;
    pagos: boolean;
    evaluacion: boolean;
    comentarios: boolean;
    paginasLegacy: boolean;
  };
}
export interface ListaIntervenciones {
  items: IntervencionSeguimiento[];
  pagination: PaginaSeguimiento;
  counts: {
    activas: number;
    porIniciar: number;
    vencidas: number;
    entregadasHoy: number;
    freelancePendientes: number;
  };
  grupos: Record<FiltrosIntervenciones['grupo'], number>;
  filters: {
    especialistas: { id: string; nombre: string }[];
    analistas: { id: string; nombre: string }[];
  };
}
export interface FiltrosSeguimientoGeneral {
  q: string;
  proceso?: string;
  especialistaId?: string;
  proyectoId?: string;
  estado?: 'en_proceso' | 'retrasado' | 'pausado' | 'stand_by';
  riesgo?: 'riesgo' | 'bloqueados' | 'proximos' | 'express';
  orden: 'urgentes' | 'vencimiento' | 'recientes';
  page: number;
  pageSize: number;
}
export interface SeguimientoGeneral {
  items: ProyectoJefatura[];
  pagination: PaginaSeguimiento;
  counts: {
    seguimiento: number;
    riesgo: number;
    bloqueados: number;
    proximos: number;
    express: number;
  };
  filters: {
    especialistas: { id: string; nombre: string }[];
    procesos: { id: string; nombre: string }[];
  };
}
export interface CambiosSupervision {
  observaciones?: string | null;
  resultadoSeguimiento?: ResultadoSeguimiento | null;
  observacionesF1?: string | null;
  cantidadComentarios?: number | null;
  pago80?: boolean;
  pago20?: boolean;
  paginas?: number | null;
  expectedUpdatedAt: string | null;
}
