import { apiFetch } from '../lib/api';
import type { DigitalMaterialsResult, DigitalWorkDetail, DigitalWorkList } from '../../../shared/soporteDigitalWork';

export const fetchMiTrabajoDigital = (params: URLSearchParams) => apiFetch<DigitalWorkList>('/soporte-digital/mi-trabajo?' + params);
export const fetchMiTrabajoDigitalDetalle = (workItemId: string) => apiFetch<DigitalWorkDetail>('/soporte-digital/mi-trabajo/' + workItemId);
export const fetchMiTrabajoDigitalArchivos = (workItemId: string) => apiFetch<DigitalMaterialsResult>('/soporte-digital/mi-trabajo/' + workItemId + '/archivos');

// Las tres mutaciones reales ya existentes para esta sección de la ficha
// (ver server/routes/trazabilidad.routes.ts y fichaViva.routes.ts) — Mi
// trabajo no inventa un endpoint de escritura propio, reutiliza
// exactamente lo que ya usa la Ficha de trazabilidad completa.
export const registrarEnvioFormulario = (proyectoId: string, fecha: string) =>
  apiFetch(`/fichas-trazabilidad/${proyectoId}/soporte-digital`, { method: 'PATCH', body: JSON.stringify({ soporteDigitalFechaEnvioFormulario: fecha }) });
export const registrarActivacionCuenta = (proyectoId: string, fecha: string) =>
  apiFetch(`/fichas-trazabilidad/${proyectoId}/soporte-digital`, { method: 'PATCH', body: JSON.stringify({ soporteDigitalFechaActivacion: fecha }) });
export const marcarDigitalCompletado = (proyectoId: string, fecha: string) =>
  apiFetch(`/fichas-trazabilidad/${proyectoId}/digital-control`, { method: 'PATCH', body: JSON.stringify({ digitalEstatus: 'Completado', digitalFechaEntrega: fecha }) });
export const guardarCampoDigital = (proyectoId: string, key: string, value: string | null) =>
  apiFetch(`/fichas-trazabilidad/${proyectoId}/documental/digital`, { method: 'PATCH', body: JSON.stringify({ datos: { [key]: value } }) });
