import type { AccionEspecialista } from './especialistaInicio.js';
import type { ProyectoJefatura } from './jefatura.js';

export const TABS_CARTERA = ['todos', 'accion', 'riesgo', 'express', 'pausados', 'por-iniciar', 'cerrados'] as const;
export type TabCartera = typeof TABS_CARTERA[number];
export type OrdenCartera = 'prioridad' | 'fecha' | 'recientes' | 'autor';
export interface FiltrosCartera {
  tab: TabCartera;
  search: string;
  servicio?: string;
  subtipo?: 'Tripa' | 'Capítulo';
  estado?: string;
  proceso?: string;
  riesgo?: 'si' | 'no';
  orden: OrdenCartera;
  page: number;
  pageSize: 10 | 20 | 50;
}
export interface ProyectoCartera {
  id: string;
  codigo: string;
  titulo: string | null;
  autores: string;
  estado: string;
  servicio: { id: string; codigo: string; nombre: string };
  subtipoCrudo: string | null;
  procesos: ProyectoJefatura['procesos'];
  fechaObjetivo: string | null;
  riesgo: ProyectoJefatura['riesgo'];
  express: boolean;
  pausado: boolean;
  porIniciar: boolean;
  objetivoMes: null;
  proximaAccion: AccionEspecialista | null;
  accionesPendientes: number;
  espera: string | null;
}
export interface EspecialistaCartera {
  actualizadoEn: string;
  resumen: { asignados: number; ejecucion: number; atencion: number; riesgo: number; express: number };
  contadores: Record<TabCartera, number>;
  catalogos: {
    servicios: { id: string; codigo: string; nombre: string }[];
    procesos: { tipo: string; nombre: string }[];
    estados: { valor: string; nombre: string }[];
  };
  objetivos: { disponible: false; motivo: string };
  proyectos: ProyectoCartera[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}
