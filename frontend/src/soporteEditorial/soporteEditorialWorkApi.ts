import { apiFetch } from '../lib/api';
import type { ValidatorWorkDetail, ValidatorWorkList } from '../../../shared/soporteEditorialWork';

export const fetchMiTrabajoValidador = (params: URLSearchParams) => apiFetch<ValidatorWorkList>('/calidad/mi-trabajo?' + params);
export const fetchMiTrabajoValidadorDetalle = (id: string) => apiFetch<ValidatorWorkDetail>('/calidad/mi-trabajo/' + id);
export const iniciarValidacion = (id: string, dueAt?: string) => apiFetch(`/calidad/${id}/inicio`, { method: 'PATCH', body: JSON.stringify({ dueAt }) });
export interface ResolverValidacion {
  aprobar: boolean; cantidadComentarios: number; cantidadPaginas?: number; comentariosUrl?: string;
  cambiosPendientesPorAplicar?: number; cambiosNuevosSugeridos?: number; observaciones?: string;
  checklist?: Record<string, { cumple: boolean | null; observaciones?: string }>;
}
export const resolverValidacion = (id: string, body: ResolverValidacion) => apiFetch(`/calidad/${id}/resultado`, { method: 'PATCH', body: JSON.stringify(body) });
export const escalarColeccionValidacion = (id: string, motivo: string) => apiFetch<{ ok: true; yaExistia: boolean }>(`/calidad/${id}/escalar-coleccion`, { method: 'POST', body: JSON.stringify({ motivo }) });
