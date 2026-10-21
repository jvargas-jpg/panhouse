export interface DistribucionCreativa { nombre: string; cantidad: number; porcentaje: number }
export interface MesCreativo { clave: string; mes: string; briefs: number; conceptos: number; recursos: number; cubiertas: number }
export interface CicloCreativo { id: string; etiqueta: string; promedioDias: number | null; muestras: number; nota: string }
export interface HitoCreativo {
  id: string; proyectoId: string; codigo: string; titulo: string; autores: string; servicio: string;
  hito: string; fecha: string;
}
export type { CreativeActivity } from './creativeLeader.js';
import type { CreativeActivity } from './creativeLeader.js';
export interface FiltroServicioCreativo { id: string; label: string }

export interface IndicadoresCreativos {
  periodo: { from: string; to: string; anteriorFrom: string; anteriorTo: string; dias: number; zonaHoraria: string; hoy: string };
  summary: {
    briefsElaborados: number;
    conceptosCreados: number;
    recursosEntregados: number;
    cubiertasVerificadas: number;
    comparacionBriefs: number | null;
    comparacionConceptos: number | null;
    comparacionRecursos: number | null;
    comparacionCubiertas: number | null;
  };
  monthly: MesCreativo[];
  previousMonthly: MesCreativo[];
  stateDistribution: DistribucionCreativa[];
  byService: DistribucionCreativa[];
  cycleTimes: CicloCreativo[];
  workload: { activas: number; enEsperaTerceros: number; completadasPeriodo: number };
  milestones: HitoCreativo[];
  activity: CreativeActivity[];
  filters: { services: FiltroServicioCreativo[] };
}

export interface FiltrosIndicadoresCreativos { from?: string; to?: string; servicio?: string }
