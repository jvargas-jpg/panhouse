export type EstadoIndicador =
  | 'en_proceso'
  | 'retrasado'
  | 'pausado'
  | 'stand_by'
  | 'culminado'
  | 'retirado';
export interface FiltrosIndicadoresJefatura {
  from: string;
  to: string;
  servicioId?: string;
  especialistaId?: string;
  prioridad?: 'confirmado' | 'posible' | 'normal';
  estado?: EstadoIndicador;
}
export interface DistribucionIndicador {
  id: string;
  nombre: string;
  cantidad: number;
  carga: number;
}
export interface MesIndicadorJefatura {
  clave: string;
  mes: string;
  ingresos: number;
  asignaciones: number;
  cierres: number | null;
}
export interface SlaIndicador {
  entregas: number;
  medibles: number;
  enPlazo: number;
  fueraPlazo: number;
  cumplimiento: number | null;
  promedioHoras: number | null;
  muestrasTiempo: number;
}
export interface ProyectoIndicador {
  id: string;
  codigo: string;
  titulo: string;
  autores: string;
  servicio: string;
  estado: EstadoIndicador;
  especialistaId: string | null;
  especialistaNombre: string | null;
  cierreEspecialistaId: string | null;
  cierreEn: string | null;
  activo: boolean;
  peso: number;
  enRiesgo: boolean;
  vencido: boolean;
  margenDias: number | null;
  diasEfectivos: number | null;
  express: string;
}
export interface EspecialistaIndicador {
  id: string;
  nombre: string;
  habilitado: boolean;
  activos: number;
  carga: number;
  express: number;
  enRiesgo: number;
  vencidos: number;
  cierres: number | null;
  asignaciones: number;
}
export interface IndicadoresJefatura {
  actualizadoEn: string;
  periodo: {
    from: string;
    to: string;
    anteriorFrom: string;
    anteriorTo: string;
    zonaHoraria: string;
  };
  resumen: {
    activos: number;
    porAsignar: number;
    enRiesgo: number;
    express: number;
    expressPosibles: number;
    cargaEquipo: number;
    cargaSinAsignar: number;
    cierres: number | null;
  };
  actividad: {
    ingresos: number;
    asignaciones: number;
    cierres: number | null;
    anterior: {
      ingresos: number;
      asignaciones: number;
      cierres: number | null;
    };
  };
  cobertura: {
    ingresosSinFecha: number;
    culminadosSinFecha: number;
    cierresSinResponsable: number;
    sinPlazo: number;
  };
  meses: MesIndicadorJefatura[];
  servicios: DistribucionIndicador[];
  estados: DistribucionIndicador[];
  prioridades: DistribucionIndicador[];
  equipo: EspecialistaIndicador[];
  menorCargaId: string | null;
  sla: SlaIndicador;
  etapas: { id: string; nombre: string; sla: SlaIndicador }[];
  proyectos: ProyectoIndicador[];
  catalogos: {
    servicios: { id: string; nombre: string }[];
    especialistas: { id: string; nombre: string }[];
  };
}
export const ESTADOS_INDICADOR: Record<EstadoIndicador, string> = {
  en_proceso: 'En proceso',
  retrasado: 'Retrasado',
  pausado: 'Pausado',
  stand_by: 'Stand-by',
  culminado: 'Culminado',
  retirado: 'Retirado',
};
