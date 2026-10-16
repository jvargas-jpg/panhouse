import type { ProyectoJefatura } from './jefatura.js';
export interface AccionEspecialista {
  id: string; proyectoId: string; titulo: string; detalle: string;
  proceso: string; fecha: string | null; prioridad: 'vencida' | 'pendiente';
  href?: string; editarContexto?: boolean;
}
export interface VencimientoEspecialista {
  id: string; proyectoId: string; proceso: string; titulo: string;
  fecha: string; precision: 'dia' | 'instante'; vencido: boolean; proximo: boolean;
}
export interface SolicitudEspecialista {
  id: string; proyectoId: string; titulo: string; destino: string;
  estado: string; fecha: string; proceso: string; href?: string;
}
export interface EspecialistaInicio {
  actualizadoEn: string; mes: string;
  kpis: { activos: number; acciones: number | null; proximos: number | null; express: number; cerrados: number | null; cierresSinFecha: number };
  proyectos: ProyectoJefatura[]; acciones: AccionEspecialista[];
  vencimientos: VencimientoEspecialista[]; solicitudes: SolicitudEspecialista[];
  carga: number; horizonteHoras: number;
  errores: ('acciones' | 'vencimientos' | 'solicitudes' | 'cierres')[];
  objetivos: { disponible: true; motivo: null };
}
export interface ActividadInicio {
  id: string; proyectoId: string; titulo: string; texto: string; actor: string; fecha: string;
}
