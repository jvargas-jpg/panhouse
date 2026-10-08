import { apiFetch } from '../lib/api';
import type { DireccionCreativa, PropuestaCreativa, PropuestaPendienteRrpp, TrabajoLiderCreativo } from '../types/api';

export function fetchDireccionesCreativasDeProyecto(proyectoId: string) {
  return apiFetch<{ direcciones: DireccionCreativa[] }>(`/proyectos/${proyectoId}/direccion-creativa`);
}

export function solicitarDireccionCreativa(proyectoId: string) {
  return apiFetch<{ id: string }>(`/proyectos/${proyectoId}/direccion-creativa`, { method: 'POST' });
}

export function asignarLiderCreativo(direccionCreativaId: string, liderCreativoId: string) {
  return apiFetch<{ ok: true }>(`/direccion-creativa/${direccionCreativaId}/asignar`, {
    method: 'PATCH',
    body: JSON.stringify({ liderCreativoId }),
  });
}

export function registrarReunionCreativa(direccionCreativaId: string, datos: { fecha?: string | null; realizada?: boolean; enlaceGrabacion?: string | null }) {
  return apiFetch<{ ok: true }>(`/direccion-creativa/${direccionCreativaId}/reunion`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export function registrarBrief(direccionCreativaId: string, datos: { briefEnlace?: string | null; fechaBriefEnviadoEspecialista?: string | null }) {
  return apiFetch<{ ok: true }>(`/direccion-creativa/${direccionCreativaId}/brief`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export function registrarBriefAutor(
  direccionCreativaId: string,
  datos: { fechaBriefEnviadoAutor?: string | null; fechaBriefAprobadoAutor?: string | null },
) {
  return apiFetch<{ ok: true }>(`/direccion-creativa/${direccionCreativaId}/brief-autor`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export function fetchPropuestasDeDireccionCreativa(direccionCreativaId: string) {
  return apiFetch<{ propuestas: PropuestaCreativa[] }>(`/direccion-creativa/${direccionCreativaId}/propuestas`);
}

export function agregarConceptoPortada(direccionCreativaId: string, datos: { descripcion?: string | null; enlace?: string | null }) {
  return apiFetch<{ id: string }>(`/direccion-creativa/${direccionCreativaId}/propuestas`, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

export function aprobarConceptoRrpp(propuestaId: string, datos: { aprobar: boolean; observaciones?: string | null }) {
  return apiFetch<{ ok: true }>(`/direccion-creativa/propuestas/${propuestaId}/rrpp`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export function registrarConceptoAutor(
  propuestaId: string,
  datos: { fechaEnviadaAutor?: string | null; fechaAprobadaAutor?: string | null; estado?: string | null },
) {
  return apiFetch<{ ok: true }>(`/direccion-creativa/propuestas/${propuestaId}/autor`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export function registrarRecursosCreativos(
  direccionCreativaId: string,
  datos: { recursoImagenUrl?: string | null; recursoConceptoPdfUrl?: string | null },
) {
  return apiFetch<{ ok: true }>(`/direccion-creativa/${direccionCreativaId}/recursos`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export function cerrarDireccionCreativa(direccionCreativaId: string, datos: { resultadoFinal: 'aprobado' | 'rechazado'; observaciones?: string | null }) {
  return apiFetch<{ ok: true }>(`/direccion-creativa/${direccionCreativaId}/cerrar`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// "¿Qué necesita mi atención hoy?" — rol lider_creativo.
export function fetchMisDireccionesCreativas() {
  return apiFetch<{ trabajos: TrabajoLiderCreativo[] }>('/direccion-creativa/mias');
}

// "PENDIENTE DE APROBACIÓN CREATIVA" — rol rrpp.
export function fetchPropuestasPendientesRrpp() {
  return apiFetch<{ propuestas: PropuestaPendienteRrpp[] }>('/direccion-creativa/pendientes-rrpp');
}
