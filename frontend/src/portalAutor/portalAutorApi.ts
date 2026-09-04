import { apiFetch } from '../lib/api';
import type { LibroAutor, Proyecto } from '../types/api';

export function fetchMisLibros() {
  return apiFetch<{ proyectos: LibroAutor[] }>('/proyectos/mis-libros');
}

export function actualizarManuscrito(proyectoId: string, manuscritoUrl: string | null) {
  return apiFetch<{ proyecto: Proyecto }>(`/proyectos/${proyectoId}/manuscrito`, {
    method: 'PATCH',
    body: JSON.stringify({ manuscritoUrl }),
  });
}

// Decisión del autor sobre la propuesta de portada — feedback nulo salvo
// al rechazar (el backend exige uno no vacío en ese caso, ver
// validarDecisionPortada en server/helpers/portalAutor.ts).
export function actualizarDecisionPortada(proyectoId: string, decision: 'aprobada' | 'rechazada', feedback: string | null) {
  return apiFetch<{ proyecto: Proyecto }>(`/proyectos/${proyectoId}/decision-portada`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, feedback }),
  });
}
