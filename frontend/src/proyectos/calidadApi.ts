import { apiFetch } from '../lib/api';
import type { VersionDiseno } from './disenoApi';
export type ChecklistCalidad = Record<string, { cumple: boolean | null; observaciones?: string }>;
export interface RondaCalidad {
  id: string; proyectoId: string; disenoId: string; proyectoCodigo: string; autorNombre: string;
  numeroFase: number; ronda: number; pdfUrl: string; pdfVersion: string; fuenteUrl: string;
  solicitadoEn: string; dueAt: string | null; iniciadoEn: string | null; revisadoEn: string | null;
  nombreQuienRecibe: string | null; cantidadPaginas: number | null; cantidadComentarios: number | null;
  cambiosPorVerificar: number | null; cambiosPendientesPorAplicar: number | null; cambiosNuevosSugeridos: number | null;
  comentariosUrl: string | null; observaciones: string | null; aprobado: boolean | null; checklist: ChecklistCalidad | null;
  version: VersionDiseno; estado: string; activa: boolean; tripaLista: boolean; cubiertaLista: boolean; listoPaqueteFinal: boolean; criterios: string[];
  numerosLegalesUrl: string | null; diasReferencia: number | null; plazo: string | null;
  comentariosAnterioresUrl: string | null; versionAnteriorUrl: string | null;
}
export interface ResultadoCalidad {
  aprobar: boolean; cantidadComentarios: number; cantidadPaginas?: number; comentariosUrl?: string;
  cambiosPendientesPorAplicar?: number; cambiosNuevosSugeridos?: number; observaciones?: string; checklist?: ChecklistCalidad;
}
export interface CoordinacionCalidad {
  accion: 'enviar_autor' | 'feedback_autor' | 'aprobar_autor' | 'revision_final'; feedback?: string; comentariosUrl?: string;
  cantidadComentarios?: number; feedbackAutorDueAt?: string; numerosLegalesUrl?: string;
}
export const fetchCalidad = (proyectoId?: string) => apiFetch<{ rondas: RondaCalidad[] }>(proyectoId ? `/calidad/proyecto/${proyectoId}` : '/calidad/bandeja');
export const iniciarCalidad = (id: string, dueAt?: string) => apiFetch(`/calidad/${id}/inicio`, { method: 'PATCH', body: JSON.stringify({ dueAt }) });
export const resolverCalidad = (id: string, body: ResultadoCalidad) => apiFetch(`/calidad/${id}/resultado`, { method: 'PATCH', body: JSON.stringify(body) });
export const coordinarCalidad = (id: string, body: CoordinacionCalidad) => apiFetch(`/calidad/${id}/coordinacion`, { method: 'PATCH', body: JSON.stringify(body) });
