import { apiFetch } from '../lib/api';
import type {
  ActividadJefatura,
  DashboardJefatura,
  ExpressJefatura,
  AsignacionesJefatura,
  FiltrosAsignaciones,
  ComparacionAsignacion,
} from '../../../shared/jefatura';
export const fetchDashboardJefatura = () =>
  apiFetch<DashboardJefatura>('/jefatura/dashboard');
export const fetchActividadJefatura = () =>
  apiFetch<{ actividad: ActividadJefatura[] }>('/jefatura/actividad');
export const fetchAsignacionesJefatura = (f: FiltrosAsignaciones) => {
  const params = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v));
  });
  return apiFetch<AsignacionesJefatura>(`/jefatura/asignaciones?${params}`);
};
export const fetchComparacionAsignacion = (id: string) =>
  apiFetch<ComparacionAsignacion>(`/jefatura/proyectos/${id}/candidatos`);
export const asignarDesdeJefatura = (
  id: string,
  especialistaId: string,
  especialistaActualEsperado?: string | null,
) =>
  apiFetch<{ ok: true }>(`/jefatura/proyectos/${id}/especialista`, {
    method: 'PATCH',
    body: JSON.stringify({
      especialistaId,
      ...(especialistaActualEsperado !== undefined
        ? { especialistaActualEsperado }
        : {}),
    }),
  });
export const decidirExpress = (
  id: string,
  decision: 'confirmado' | 'normal',
  express: ExpressJefatura,
  motivo: string,
) =>
  apiFetch<{ ok: true }>(`/jefatura/proyectos/${id}/express`, {
    method: 'PATCH',
    body: JSON.stringify({
      decision,
      fechaEstandar: express.fechaEstandar,
      fechaDeseada: express.fechaDeseada,
      ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
    }),
  });
