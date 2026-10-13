// Cola de trabajo del Especialista (docs/arquitectura/21-especialista-mi-trabajo.md).
// Una fila = una acción/espera/bloqueo de coordinación, nunca un proyecto
// (eso es Mis proyectos, ver shared/especialistaCartera.ts).
export const ESTADOS_ITEM_TRABAJO = ['pendiente', 'vencida', 'hoy', 'proxima', 'esperando', 'bloqueada'] as const;
export type EstadoItemTrabajo = (typeof ESTADOS_ITEM_TRABAJO)[number];

export interface ItemTrabajoEspecialista {
  id: string;
  proyectoId: string;
  proyectoTitulo: string;
  proyectoAutores: string;
  proyectoCodigo: string;
  proceso: string;
  procesoNombre: string;
  accion: string;
  detalle: string;
  fecha: string | null;
  estado: EstadoItemTrabajo;
  // Solo una de las dos aplica, nunca ambas: esperando tiene waitingOn,
  // bloqueada tiene blockedBy. accion/vencida no llevan ninguna.
  waitingOn: string | null;
  blockedBy: string | null;
  href?: string;
  editarContexto?: boolean;
  actionType: string;
  ctaLabel: string | null;
  workItemId: string | null;
  source: {tipo:string;id:string;businessKey:string};
  waitingSince: string | null;
  waitingOnType: string | null;
  entregaRecibidaEn: string | null;
  context: {capitulo?:number;versionId?:string;ronda?:number;solicitudId?:string};
}

export interface ResumenMiTrabajo {
  pendientes: number; // accion propia: hoy + proxima + vencida
  vencidas: number;
  esperando: number;
  bloqueadas: number;
}

export interface ResumenDiaMiTrabajo {
  accionesHoy: number;
  vencidas: number;
  entregasRecibidas: number;
}

export interface DependenciaMiTrabajo {
  destino: string;
  cantidad: number;
  tipo: string;
}

// Sin "completadas": estos items se derivan en caliente de hechos
// operativos (no son filas persistidas con su propio ciclo de vida), así
// que no existe un evento "item completado" real que listar sin inventar
// un tracking nuevo. Ver docs/arquitectura/21-especialista-mi-trabajo.md
// (gaps) -- "Actividad reciente" en Inicio ya cubre el historial real.
export const TABS_MI_TRABAJO = ['hoy', 'pendientes', 'vencidas', 'proximas', 'esperando', 'bloqueadas'] as const;
export type TabMiTrabajo = (typeof TABS_MI_TRABAJO)[number];

export interface FiltrosMiTrabajo {
  tab: TabMiTrabajo;
  proceso?: string;
  proyectoId?: string;
  dependencia?: string;
  orden?: 'prioridad' | 'fecha';
  search: string;
  page: number;
  pageSize: 10 | 20 | 50;
}

export interface MiTrabajo {
  actualizadoEn: string;
  resumen: ResumenMiTrabajo;
  resumenDia: ResumenDiaMiTrabajo;
  dependencias: DependenciaMiTrabajo[];
  catalogos: { procesos: { tipo: string; nombre: string }[]; proyectos: { id: string; titulo: string }[] };
  contadores: Record<TabMiTrabajo, number>;
  items: ItemTrabajoEspecialista[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}
