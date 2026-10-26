// Jefe de Edición · Indicadores (docs/arquitectura/29-jefe-edicion.md § Indicadores).
// Analítica agregada del área de Edición: qué está pasando a nivel de
// volumen, cumplimiento, tiempos, carga y desviaciones. No es una segunda
// fuente de verdad -- se construye sobre editorialInterventions() (estado
// actual) y una proyección histórica propia (completadas/SLA/ciclo), ambas
// reusando las mismas reglas centrales de edicionSla.ts.

export const PRESETS_INDICADORES_EDICION = ['este-mes', 'mes-anterior', 'ultimos-3-meses', 'ultimos-6-meses', 'este-anio', 'personalizado'] as const;
export type PresetIndicadoresEdicion = (typeof PRESETS_INDICADORES_EDICION)[number];

export interface FiltrosIndicadoresEdicion {
  preset: PresetIndicadoresEdicion;
  from?: string; to?: string;
  service?: string; editor?: string; interventionType?: string;
}

export interface PeriodoIndicadoresEdicion {
  preset: PresetIndicadoresEdicion;
  from: string; to: string;
  anteriorFrom: string; anteriorTo: string;
  zonaHoraria: string; hoy: string;
}

// value: snapshot actual o conteo del período, según el KPI (ver `snapshot`).
// deltaPct null = sin base comparable (período anterior en cero) o KPI de
// snapshot sin comparación coherente (ver docs/arquitectura/29-jefe-edicion.md).
export interface KpiIndicadorEdicion { value: number; deltaPct: number | null; snapshot: boolean }

export interface DistribucionEstadoEdicion { estado: string; cantidad: number; porcentaje: number }
export interface SemanaFlujoEdicion { semana: string; from: string; to: string; iniciadas: number; completadas: number; vencidas: number }

export interface EditorIndicador {
  id: string; nombre: string;
  activas: number; vencidas: number; vencenEstaSemana: number; esperandoTerceros: number;
  entregasCompletadas: number;
  slaPct: number | null; slaMuestras: number;
}

// definicion explica exactamente qué mide (incluye o no espera) -- nunca un
// tooltip genérico (prompt §66).
export interface CicloTipoIndicador { tipo: string; etiqueta: string; promedioDias: number | null; muestras: number; definicion: string }

export interface ServicioIndicadorEdicion { servicio: string; cantidad: number }

export interface ProyectoRiesgoEdicion {
  projectId: string; code: string; title: string; authors: string;
  interventionsAtRisk: number; nextDelivery: string | null; editorialState: string;
}

export interface ActividadIndicadorEdicion { id: string; text: string; title: string; actor: string; at: string }

export interface IndicadoresEdicion {
  actualizadoEn: string;
  periodo: PeriodoIndicadoresEdicion;
  kpis: {
    projectsInEditing: KpiIndicadorEdicion;
    completedDeliveries: KpiIndicadorEdicion;
    overdueInterventions: KpiIndicadorEdicion;
    waitingAuthor: KpiIndicadorEdicion;
  };
  stateDistribution: DistribucionEstadoEdicion[];
  weeklyFlow: SemanaFlujoEdicion[];
  editors: EditorIndicador[];
  cycleTimes: CicloTipoIndicador[];
  services: ServicioIndicadorEdicion[];
  riskProjects: ProyectoRiesgoEdicion[];
  activity: ActividadIndicadorEdicion[];
  filters: { services: { id: string; name: string }[]; editors: { id: string; name: string }[]; interventionTypes: { id: string; name: string }[] };
  insufficientData: string[]; // ids de métricas que no se pudieron calcular honestamente (prompt §74)
}
