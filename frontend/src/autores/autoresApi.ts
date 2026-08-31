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

// A diferencia de crearAutorSchema, editarAutorSchema (backend) acepta
// null en los campos opcionales — corregir un dato mal escrito incluye
// poder borrarlo, no solo omitirlo.
export interface DatosEditarAutor {
  nombre?: string;
  email?: string | null;
  telefono?: string | null;
  pais?: string | null;
  relevancia?: number | null;
}

export function editarAutor(id: string, datos: DatosEditarAutor) {
  return apiFetch<{ autor: Autor }>(`/autores/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// El backend responde 400 (no 500) si el autor tiene proyectos
// asociados — ApiError.message ya trae ese texto listo para mostrar en
// el toast de error, no hace falta traducirlo del lado del cliente.
export function eliminarAutor(id: string) {
  return apiFetch<{ ok: true }>(`/autores/${id}`, {
    method: 'DELETE',
  });
}
