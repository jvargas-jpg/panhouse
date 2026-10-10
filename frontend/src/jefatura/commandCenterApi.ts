import { apiFetch } from '../lib/api';
import type {
  ActividadJefatura,
  DashboardJefatura,
  ExpressJefatura,
} from '../../../shared/jefatura';
export const fetchDashboardJefatura = () =>
  apiFetch<DashboardJefatura>('/jefatura/dashboard');
export const fetchActividadJefatura = () =>
  apiFetch<{ actividad: ActividadJefatura[] }>('/jefatura/actividad');
export const asignarDesdeJefatura = (id: string, especialistaId: string) =>
  apiFetch<{ ok: true }>(`/jefatura/proyectos/${id}/especialista`, {
    method: 'PATCH',
    body: JSON.stringify({ especialistaId }),
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
