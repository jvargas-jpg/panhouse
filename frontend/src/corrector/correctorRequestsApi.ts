import { apiFetch } from '../lib/api';
import type { CorrectorRequestDetail, CorrectorRequestList, CorrectorRequestType } from '../../../shared/correctorRequests';

export const correctorRequestsKey = ['corrector', 'mis-solicitudes'];

export const fetchMisSolicitudesCorrector = (params: URLSearchParams) => apiFetch<CorrectorRequestList>('/correcciones/mis-solicitudes?' + params);
export const fetchMiSolicitudCorrectorDetalle = (id: string) => apiFetch<CorrectorRequestDetail>('/correcciones/mis-solicitudes/' + id);
export const crearSolicitudCorrector = (workItemId: string, type: CorrectorRequestType, motivo: string) =>
  apiFetch<{ ok: true; id: string }>('/correcciones/mis-solicitudes', { method: 'POST', body: JSON.stringify({ workItemId, type, motivo }) });
export const cancelarSolicitudCorrector = (id: string, expectedVersion: number) =>
  apiFetch<{ ok: true }>('/correcciones/mis-solicitudes/' + id + '/cancelar', { method: 'POST', body: JSON.stringify({ expectedVersion }) });
export const responderSolicitudCorrector = (id: string, expectedVersion: number, text: string) =>
  apiFetch<{ ok: true }>('/correcciones/mis-solicitudes/' + id + '/responder', { method: 'POST', body: JSON.stringify({ expectedVersion, text }) });
