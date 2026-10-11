import { apiFetch } from '../lib/api';
import type {
  ActividadJefatura,
  FiltrosProyectosJefatura,
  PortafolioJefatura,
  QuickViewJefatura,
} from '../../../shared/jefatura';

export function fetchPortafolio(f: FiltrosProyectosJefatura) {
  const params = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v));
  });
  return apiFetch<PortafolioJefatura>(`/jefatura/proyectos?${params}`);
}
export const fetchQuickView = (id: string) =>
  apiFetch<QuickViewJefatura>(`/jefatura/proyectos/${id}/resumen`);
export const fetchActividadProyecto = (id: string) =>
  apiFetch<{ actividad: ActividadJefatura[] }>(
    `/jefatura/proyectos/${id}/actividad`,
  );
