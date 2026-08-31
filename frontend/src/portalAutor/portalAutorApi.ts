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
