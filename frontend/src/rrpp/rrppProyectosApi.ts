import { apiFetch } from '../lib/api';
import type { DetalleIngreso, DatosIngreso } from './rrppIngresosApi';
export interface ProyectoConsulta {
  id: string;
  codigo: string;
  nombre: string;
  autorPrincipal: string;
  estado: string;
  contextoRrpp: string;
  contextoEtiqueta: string;
  actualizadoAt: string | null;
  servicio: { id: string; codigo: string; nombre: string };
}
export interface EtapaConsulta {
  key: string;
  label: string;
  estado: string;
  registrado: string | null;
  progress: number | null;
  responsables: string[];
  rol: string;
  dueAt: string | null;
  ultimaActividad: string | null;
  instancias: number;
  activas: number;
  bloqueadas: number;
}
export interface EventoConsulta {
  id: string;
  fecha: string;
  titulo: string;
  area: string;
  etapa?: string;
}
export interface ProyectosConsulta {
  proyectos: ProyectoConsulta[];
  total: number;
  pagina: number;
  paginas: number;
  porPagina: number;
  catalogos: {
    servicios: ProyectoConsulta['servicio'][];
    estados: string[];
    contextos: Record<string, string>;
  };
}
export interface ResumenProyectoConsulta extends ProyectoConsulta {
  subtipoCrudo: string | null;
  responsableActual: string;
  areasActuales: { area: string; personas: string[] }[];
  stages: EtapaConsulta[];
  informacion: {
    autorPrincipal: string;
    coautores: string[];
    titulo: string | null;
    coleccion: string | null;
    tema: string | null;
    publico: string | null;
    posibleTitulo: string | null;
  };
  contexto: DetalleIngreso['contexto'] | null;
  diagnostico: DatosIngreso | null;
  preparacion: DetalleIngreso['preparacion'] | null;
  abrirIngreso: boolean;
  fechas: {
    ingreso: string | null;
    proyectada: string | null;
    deseadaAutor: string | null;
    lanzamiento: string | null;
    ultimaActividad: string | null;
  };
  eventos: EventoConsulta[];
  creativa: {
    intervenciones: {
      id: string;
      tipo: string;
      fechaReunion: string | null;
      fechaCierre: string | null;
      resultado: string | null;
      estado: string | null;
    }[];
    propuestas: {
      id: string;
      direccionId: string | null;
      descripcion: string | null;
      enlace: string | null;
      estado: string | null;
      fechaRrpp: string | null;
      fechaAutor: string | null;
      fecha: string;
    }[];
    revision: {
      direccionId: string;
      propuestas: {
        id: string;
        descripcion: string | null;
        enlace: string | null;
      }[];
    }[];
  };
  produccion: { capitulos: { cantidad: number; entregados: number } };
  lanzamiento: {
    reuniones: {
      id: string;
      fecha: string | null;
      puntos: string | null;
      acuerdos: string | null;
    }[];
    primeraReunion: string | null;
    segundaReunion: string | null;
    puntosPrimera: string | null;
    acuerdosSegunda: string | null;
    objetivo: string | null;
    ferias: string | null;
    tipo: string | null;
    observaciones: string | null;
    estatus: string | null;
  } | null;
}
export const fetchProyectosConsulta = (params: URLSearchParams) =>
  apiFetch<ProyectosConsulta>(`/rrpp/proyectos?${params}`);
export const fetchResumenProyecto = (id: string) =>
  apiFetch<ResumenProyectoConsulta>(`/rrpp/proyectos/${id}/resumen`);
export const fetchHistorialProyecto = (id: string, pagina: number) =>
  apiFetch<{
    eventos: EventoConsulta[];
    total: number;
    pagina: number;
    paginas: number;
  }>(`/rrpp/proyectos/${id}/historial?pagina=${pagina}`);
export const ESTADOS_MACRO: Record<string, string> = {
  en_proceso: 'En proceso',
  retrasado: 'Retrasado',
  stand_by: 'Stand by',
  pausado: 'Pausado',
  culminado: 'Culminado',
  retirado: 'Retirado',
};
export const ESTADOS_ETAPA: Record<string, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En curso',
  bloqueado: 'Bloqueado',
  completado: 'Completo',
  cancelado: 'Cancelado',
};
