import type {
  EstadoPortafolio,
  ProyectoJefatura,
  TabProyectosJefatura,
} from './jefatura.js';

export const enProduccion = (p: ProyectoJefatura) =>
  !!p.especialista &&
  ['en_proceso', 'retrasado'].includes(p.estado) &&
  p.procesos.length > 0;
export function estadoPortafolio(p: ProyectoJefatura): EstadoPortafolio {
  if (p.estado === 'culminado') return 'completado';
  if (p.estado === 'pausado') return 'pausado';
  if (p.estado === 'stand_by') return 'standBy';
  if (p.porAsignar) return 'porAsignar';
  if (p.riesgo.atencion) return 'enRiesgo';
  return enProduccion(p) ? 'enProduccion' : 'asignado';
}
export const ETIQUETAS_ESTADO: Record<EstadoPortafolio, string> = {
  porAsignar: 'Por asignar',
  enProduccion: 'En producción',
  enRiesgo: 'En riesgo',
  pausado: 'Pausado',
  standBy: 'Stand-by',
  completado: 'Completado',
  asignado: 'Asignado',
};
export const ETIQUETAS_TAB: Record<TabProyectosJefatura, string> = {
  todos: 'Todos',
  porAsignar: 'Por asignar',
  enProduccion: 'En producción',
  enRiesgo: 'En riesgo',
  express: 'Express',
  completados: 'Completados',
};
export function perteneceTab(p: ProyectoJefatura, tab: TabProyectosJefatura) {
  if (tab === 'todos') return true;
  if (tab === 'porAsignar') return p.porAsignar;
  if (tab === 'enProduccion') return enProduccion(p);
  if (tab === 'enRiesgo') return p.riesgo.atencion;
  if (tab === 'express')
    return p.estado !== 'culminado' && p.express.estado === 'confirmado';
  return p.estado === 'culminado';
}
