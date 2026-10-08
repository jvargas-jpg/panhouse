import { apiFetch } from '../lib/api';
import type { AlcanceCorreccion, Correccion, CorreccionSeguimiento, ResultadoCorreccion, TrabajoCorrector } from '../types/api';

export function fetchCorreccionesDeProyecto(proyectoId: string) {
  return apiFetch<{ correcciones: Correccion[] }>(`/proyectos/${proyectoId}/correcciones`);
}

export function solicitarCorreccion(proyectoId: string, datos: { alcance: AlcanceCorreccion; paginas?: number | null }) {
  return apiFetch<{ id: string; nueva: boolean }>(`/proyectos/${proyectoId}/correcciones`, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

export interface DatosAsignarCorrector {
  correctorId?: string | null;
  correctorNombre?: string | null;
  freelance: boolean;
  contratoConfirmado: boolean;
  revisionPreviaConfirmada?: boolean;
}

export function asignarCorrector(correccionId: string, datos: DatosAsignarCorrector) {
  return apiFetch<{ ok: true }>(`/correcciones/${correccionId}/asignar`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export function marcarInicioCorreccion(correccionId: string, fecha: string) {
  return apiFetch<{ ok: true }>(`/correcciones/${correccionId}/inicio`, {
    method: 'PATCH',
    body: JSON.stringify({ fecha }),
  });
}

export function registrarEntregaCorreccion(
  correccionId: string,
  datos: { fecha: string; entregadoEn?: string; controlCambiosUrl?: string | null; informeTecnicoUrl?: string | null },
) {
  return apiFetch<{ ok: true }>(`/correcciones/${correccionId}/entrega`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export function cerrarCorreccion(correccionId: string, datos: { resultado: ResultadoCorreccion; observaciones?: string | null }) {
  return apiFetch<{ ok: true }>(`/correcciones/${correccionId}/cierre`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// "Mis Correcciones" — rol corrector.
export function fetchMisCorrecciones() {
  return apiFetch<{ trabajos: TrabajoCorrector[] }>('/correcciones/mias');
}

// "Seguimiento de Corrección" — rol jefe_area.
export function fetchSeguimientoCorreccion() {
  return apiFetch<{ correcciones: CorreccionSeguimiento[] }>('/correcciones/seguimiento');
}
