import { apiFetch } from '../lib/api';
import type {
  ActividadDecisionItem,
  DetalleDecision,
  ListaDecisiones,
  ResumenDecisiones,
} from '../../../shared/decisiones';

export interface FiltrosDecisionesQuery {
  q?: string;
  status?: string;
  tipo?: string;
  origen?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize?: number;
}

function query(f: object) {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v !== undefined && v !== '') p.set(k, String(v));
  });
  return p.toString();
}

export const fetchResumenDecisiones = () =>
  apiFetch<ResumenDecisiones>('/decisiones/resumen');

export const fetchDecisiones = (f: FiltrosDecisionesQuery) =>
  apiFetch<ListaDecisiones>(`/decisiones?${query(f)}`);

export const fetchDecision = (id: string) =>
  apiFetch<DetalleDecision>(`/decisiones/${id}`);

export const fetchActividadDecision = (id: string) =>
  apiFetch<{ actividad: ActividadDecisionItem[] }>(
    `/decisiones/${id}/actividad`,
  );

export const iniciarRevisionDecision = (id: string, expectedVersion?: number) =>
  apiFetch<{ ok: true }>(`/decisiones/${id}/revision`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
  });

export const solicitarInfoDecision = (
  id: string,
  mensaje: string,
  expectedVersion?: number,
) =>
  apiFetch<{ ok: true }>(`/decisiones/${id}/solicitar-info`, {
    method: 'POST',
    body: JSON.stringify({ mensaje, expectedVersion }),
  });

export const responderInfoDecision = (
  id: string,
  mensaje: string,
  expectedVersion?: number,
) =>
  apiFetch<{ ok: true }>(`/decisiones/${id}/responder-info`, {
    method: 'POST',
    body: JSON.stringify({ mensaje, expectedVersion }),
  });

export const resolverDecisionApi = (
  id: string,
  resolution: 'approved' | 'rejected' | 'cancelled',
  mensaje: string | undefined,
  expectedVersion?: number,
) =>
  apiFetch<{ ok: true }>(`/decisiones/${id}/resolver`, {
    method: 'POST',
    body: JSON.stringify({ resolution, mensaje, expectedVersion }),
  });
