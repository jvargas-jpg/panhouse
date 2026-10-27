import { apiFetch } from '../lib/api';
import type { CorrectorWorkDetail, CorrectorWorkList } from '../../../shared/correctorWork';

export const fetchMiTrabajoCorrector = (params: URLSearchParams) => apiFetch<CorrectorWorkList>('/correcciones/mi-trabajo?' + params);
export const fetchMiTrabajoCorrectorDetalle = (workItemId: string) => apiFetch<CorrectorWorkDetail>('/correcciones/mi-trabajo/' + workItemId);
export const fetchArchivosCorreccion = (workItemId: string, folderKey: string, pageToken?: string) =>
  apiFetch<{ items: { id: string; name: string; url: string }[]; nextPageToken: string | null }>('/correcciones/mi-trabajo/' + workItemId + '/archivos?' + new URLSearchParams({ folderKey, ...(pageToken ? { pageToken } : {}) }));
export const registrarEntregaCorrector = (workItemId: string, tripaUrl: string, reportUrl: string, observaciones?: string) =>
  apiFetch<{ ok: true; deliveryId: string }>('/correcciones/mi-trabajo/' + workItemId + '/entrega', { method: 'PATCH', body: JSON.stringify({ tripaUrl, reportUrl, observaciones: observaciones || undefined }) });
export const reportarBloqueoCorrector = (workItemId: string, reason: string) =>
  apiFetch<{ ok: true; blockerId: string }>('/correcciones/mi-trabajo/' + workItemId + '/bloqueo', { method: 'POST', body: JSON.stringify({ reason }) });
