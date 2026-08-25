import type { EstadoProyecto } from '../types/api';

// Compartido por ProyectoCard y ProyectoDetallePage — una sola fuente
// para las etiquetas/colores de estado, no una copia por pantalla.
export const ESTADO_LABEL: Record<EstadoProyecto, string> = {
  en_proceso: 'En proceso',
  retrasado: 'Retrasado',
  stand_by: 'Stand-by',
  pausado: 'Pausado',
  culminado: 'Culminado',
  retirado: 'Retirado',
};

export const ESTADO_CLASE: Record<EstadoProyecto, string> = {
  en_proceso: 'bg-tinta/5 text-tinta',
  retrasado: 'bg-red-100 text-red-800',
  stand_by: 'bg-amber-100 text-amber-800',
  pausado: 'bg-amber-100 text-amber-800',
  culminado: 'bg-green-100 text-green-800',
  retirado: 'bg-tinta/5 text-tinta/60',
};
