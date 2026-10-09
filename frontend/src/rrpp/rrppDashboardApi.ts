import { apiFetch } from '../lib/api';
export interface ProyectoRrpp {
  id: string;
  codigo: string;
  nombre: string;
  autores: { nombre: string }[];
  servicio: { codigo: string; nombre: string };
  subtipoCrudo: string | null;
}
export interface IngresoRrpp extends ProyectoRrpp {
  estado: 'nuevo' | 'diagnostico' | 'completo';
  pendiente: string;
  enviadoJefatura: boolean;
  actualizadoAt: string | null;
  actualizadoPor: string;
  compartidos: {
    observaciones: string | null;
    capitulos: string | null;
    paginas: string | null;
    fechaIngreso: string | null;
  };
}
export interface ConceptosRrpp {
  proyecto: ProyectoRrpp;
  direccionId: string;
  actualizadoAt: string;
  propuestas: {
    id: string;
    descripcion: string | null;
    enlace: string | null;
  }[];
}
export interface LanzamientoRrpp {
  id: string;
  proyecto: ProyectoRrpp;
  fecha: string;
  tipo: string;
  href: string;
}
export interface ActividadRrpp {
  id: string;
  proyecto: ProyectoRrpp;
  titulo: string;
  fecha: string;
  contexto: 'conceptos' | 'ingreso';
}
export interface DashboardRrpp {
  kpis: {
    nuevos: number;
    enProceso: number;
    conceptos: number;
    lanzamientos: number;
  };
  ingresos: IngresoRrpp[];
  conceptos: ConceptosRrpp[];
  lanzamientos: LanzamientoRrpp[];
  actividad: ActividadRrpp[];
  periodoLanzamientos: { desde: string; hasta: string };
}
export const fetchDashboardRrpp = () =>
  apiFetch<DashboardRrpp>('/rrpp/dashboard');
export const iniciarDiagnostico = (id: string) =>
  apiFetch<{ ok: true }>(`/rrpp/ingresos/${id}/iniciar`, { method: 'POST' });
