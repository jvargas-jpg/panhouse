export type EstadoExpressJefatura =
  'normal' | 'posible' | 'confirmado' | 'normal_confirmado';
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
  titulo: string | null;
  creadoEn: string;
  entregadoJefatura: boolean;
  asignacionDesincronizada: boolean;
  impactoCarga: number;
  autores: string;
  estado: string;
  servicio: { id: string; codigo: string; nombre: string; peso: number };
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
export type TabAsignaciones =
  'porAsignar' | 'asignados' | 'express' | 'enRiesgo';
export type OrdenAsignaciones =
  'urgentes' | 'recientes' | 'mayorImpacto' | 'menorImpacto';
export interface FiltrosAsignaciones {
  tab: TabAsignaciones;
  q: string;
  servicioId?: string;
  especialistaId?: string;
  orden: OrdenAsignaciones;
  page: number;
  pageSize: number;
}
export interface EquipoAsignaciones extends CapacidadJefatura {
  barraRelativa: number;
}
export interface AsignacionesJefatura {
  actualizadoEn: string;
  proyectos: ProyectoJefatura[];
  contadores: Record<TabAsignaciones, number>;
  equipo: EquipoAsignaciones[];
  servicios: { id: string; nombre: string }[];
  especialistas: { id: string; nombre: string }[];
  referenciaBarra: number;
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}
export interface CandidatoAsignacion extends CapacidadJefatura {
  esActual: boolean;
  impactoCarga: number;
  cargaProyectada: number;
  recomendado: boolean;
  razones: string[];
}
export interface ComparacionAsignacion {
  proyecto: ProyectoJefatura;
  candidatos: CandidatoAsignacion[];
  contexto: {
    ingreso: string | null;
    cierreProyectado: string | null;
    ejecucion: string | null;
    tiempoExpressMeses: number | null;
    subtipoCrudo: string | null;
    capitulos: string | null;
    paginas: string | null;
    presupuesto: string | null;
    alianza: boolean | null;
    unidad: string | null;
    comercial: string;
    rrpp: string;
  };
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
