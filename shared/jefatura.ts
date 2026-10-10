export type EstadoExpressJefatura =
  | 'normal'
  | 'posible'
  | 'confirmado'
  | 'normal_confirmado';
export interface ExpressJefatura {
  estado: EstadoExpressJefatura;
  fechaEstandar: string;
  fechaDeseada: string | null;
  compresionDias: number;
  decididoEn: string | null;
  motivo: string | null;
}
export interface ProcesoJefatura {
  id: string;
  tipo: string;
  nombre: string;
  estado: string;
  vence: string | null;
  vencido: boolean;
  responsable: string | null;
}
export interface ProyectoJefatura {
  id: string;
  codigo: string;
  autores: string;
  estado: string;
  servicio: { codigo: string; nombre: string; peso: number };
  especialista: { id: string; nombre: string } | null;
  porAsignar: boolean;
  express: ExpressJefatura;
  riesgo: {
    atencion: boolean;
    causas: string[];
    vencido: boolean;
    diasRestantes: number;
    diasEfectivos: number;
  };
  procesos: ProcesoJefatura[];
  recomendacion: {
    especialistaId: string;
    nombre: string;
    razones: string[];
  } | null;
}
export interface CapacidadJefatura {
  id: string;
  nombre: string;
  carga: number;
  activos: number;
  express: number;
  enRiesgo: number;
  servicios: {
    codigo: string;
    nombre: string;
    cantidad: number;
    carga: number;
  }[];
}
export interface SolicitudJefatura {
  id: string;
  proyectoId: string;
  codigo: string;
  autores: string;
  titulo: string;
  destino: string;
  requiereJefatura: boolean;
  creadaEn: string;
  direccionCreativaId: string | null;
}
export interface DashboardJefatura {
  actualizadoEn: string;
  summary: {
    porAsignar: number;
    solicitudes: number;
    enRiesgo: number;
    express: number;
  };
  proyectos: ProyectoJefatura[];
  teamCapacity: CapacidadJefatura[];
  requests: SolicitudJefatura[];
  priorityTracking: ProyectoJefatura[];
}
export interface ActividadJefatura {
  id: string;
  proyectoId: string;
  codigo: string;
  actor: string;
  texto: string;
  fecha: string;
}
