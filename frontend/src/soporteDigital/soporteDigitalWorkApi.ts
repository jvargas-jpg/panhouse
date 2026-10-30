import { apiFetch } from '../lib/api';
import type { DigitalMaterialsResult, DigitalWorkAction, DigitalWorkDetail, DigitalWorkList } from '../../../shared/soporteDigitalWork';

export const fetchMiTrabajoDigital = (params: URLSearchParams) => apiFetch<DigitalWorkList>('/soporte-digital/mi-trabajo?' + params);
export const fetchMiTrabajoDigitalDetalle = (workItemId: string) => apiFetch<DigitalWorkDetail>('/soporte-digital/mi-trabajo/' + workItemId);
export const fetchMiTrabajoDigitalArchivos = (workItemId: string, pageToken?: string) => apiFetch<DigitalMaterialsResult>('/soporte-digital/mi-trabajo/' + workItemId + '/archivos' + (pageToken ? '?' + new URLSearchParams({ pageToken }) : ''));

export const registrarAccionDigital = (workItemId: string, input: DigitalWorkAction) =>
  apiFetch<{ ok: boolean; replayed: boolean }>(`/soporte-digital/mi-trabajo/${workItemId}/acciones`, { method: 'POST', body: JSON.stringify(input) });
