import { apiFetch } from '../lib/api';
import type { Autor } from '../types/api';

export function fetchAutores() {
  return apiFetch<{ autores: Autor[] }>('/autores');
}

// Igual que crearAutorSchema en server/routes/autores.routes.ts: nombre
// requerido, el resto opcional. Los campos opcionales van undefined
// (no null) cuando están vacíos — el schema del backend no los acepta
// como null, JSON.stringify simplemente los omite.
export interface DatosNuevoAutor {
  nombre: string;
  email?: string;
  telefono?: string;
  pais?: string;
  relevancia?: number;
}

export function crearAutor(datos: DatosNuevoAutor) {
  return apiFetch<{ autor: Autor }>('/autores', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}
