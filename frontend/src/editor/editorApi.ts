import { apiFetch } from '../lib/api';
import type { EditorialProjectDetail, EditorialProjectList } from '../../../shared/editorialChief';
import type { EditorDashboard, EditorRequestDetail, EditorRequestList, EditorRequestType, EditorWorkDetail } from '../../../shared/editorOwn';

export const editorKey = ['editor'];
export const fetchEditorDashboard = () => apiFetch<EditorDashboard>('/editores/mi-inicio');

export const fetchMiTrabajo = (params: URLSearchParams) =>
  apiFetch<{ items: import('../../../shared/editorialChief').EditorialIntervention[]; total: number; pages: number; page: number; counts: Record<string, number> }>('/editores/mi-trabajo?' + params);
export const fetchMiTrabajoDetalle = (id: string) => apiFetch<EditorWorkDetail>('/editores/mi-trabajo/' + id);
export const iniciarTrabajo = (id: string) => apiFetch<{ ok: true }>('/editores/mi-trabajo/' + id + '/iniciar', { method: 'POST', body: '{}' });
export const registrarEntrega = (id: string, driveUrl: string, observaciones?: string) =>
  apiFetch<{ ok: true; deliveryId: string }>('/editores/mi-trabajo/' + id + '/entrega', { method: 'PATCH', body: JSON.stringify({ driveUrl, observaciones: observaciones || undefined }) });
export const reportarBloqueo = (id: string, reason: string) =>
  apiFetch<{ ok: true; blockerId: string }>('/editores/mi-trabajo/' + id + '/bloqueo', { method: 'POST', body: JSON.stringify({ reason }) });
export const resolverBloqueo = (id: string, resolution?: string) =>
  apiFetch<{ ok: true }>('/editores/mi-trabajo/' + id + '/bloqueo/resolver', { method: 'POST', body: JSON.stringify({ resolution: resolution || undefined }) });

export const fetchMisProyectos = (params: URLSearchParams) => apiFetch<EditorialProjectList>('/editores/mis-proyectos?' + params);
export const fetchMiProyectoDetalle = (projectId: string) => apiFetch<EditorialProjectDetail>('/editores/mis-proyectos/' + projectId);

export const fetchMisSolicitudes = (params: URLSearchParams) => apiFetch<EditorRequestList>('/editores/mis-solicitudes?' + params);
export const fetchMiSolicitudDetalle = (id: string) => apiFetch<EditorRequestDetail>('/editores/mis-solicitudes/' + id);
export const crearSolicitud = (workItemId: string, type: EditorRequestType, motivo: string) =>
  apiFetch<{ ok: true; id: string }>('/editores/mis-solicitudes', { method: 'POST', body: JSON.stringify({ workItemId, type, motivo }) });
export const cancelarSolicitud = (id: string, expectedVersion: number) =>
  apiFetch<{ ok: true }>('/editores/mis-solicitudes/' + id + '/cancelar', { method: 'POST', body: JSON.stringify({ expectedVersion }) });
