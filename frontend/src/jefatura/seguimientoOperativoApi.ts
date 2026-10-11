import { apiFetch } from '../lib/api';
import type {
  ActividadJefatura,
  QuickViewJefatura,
  SolicitudJefatura,
} from '../../../shared/jefatura';
import type {
  CambiosSupervision,
  FiltrosIntervenciones,
  FiltrosSeguimientoGeneral,
  IntervencionSeguimiento,
  ListaIntervenciones,
  OrigenIntervencion,
  SeguimientoGeneral,
} from '../../../shared/seguimientoOperativo';
function query(f: object) {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v !== undefined && v !== '') p.set(k, String(v));
  });
  return p.toString();
}
export const fetchGeneralSeguimiento = (f: FiltrosSeguimientoGeneral) =>
  apiFetch<SeguimientoGeneral>(`/seguimiento/general?${query(f)}`);
export const fetchIntervenciones = (f: FiltrosIntervenciones) =>
  apiFetch<ListaIntervenciones>(`/seguimiento/intervenciones?${query(f)}`);
export const fetchGeneralDetalle = (id: string) =>
  apiFetch<QuickViewJefatura & { solicitudes: SolicitudJefatura[] }>(
    `/seguimiento/general/${id}`,
  );
export const fetchGeneralActividad = (id: string) =>
  apiFetch<{ actividad: ActividadJefatura[] }>(
    `/seguimiento/general/${id}/actividad`,
  );
export const fetchIntervencion = (origen: OrigenIntervencion, id: string) =>
  apiFetch<IntervencionSeguimiento>(
    `/seguimiento/intervenciones/${origen}/${id}`,
  );
export const fetchIntervencionActividad = (
  origen: OrigenIntervencion,
  id: string,
) =>
  apiFetch<{ actividad: ActividadJefatura[] }>(
    `/seguimiento/intervenciones/${origen}/${id}/actividad`,
  );
export const patchSupervision = (
  origen: OrigenIntervencion,
  id: string,
  b: CambiosSupervision,
) =>
  apiFetch<IntervencionSeguimiento>(
    `/seguimiento/intervenciones/${origen}/${id}`,
    { method: 'PATCH', body: JSON.stringify(b) },
  );
