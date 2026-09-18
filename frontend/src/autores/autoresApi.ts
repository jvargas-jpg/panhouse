import { apiFetch } from '../lib/api';
import type { Autor, CategoriaCliente, RedesSociales } from '../types/api';

export function fetchAutores() {
  return apiFetch<{ autores: Autor[] }>('/autores');
}

// Igual que crearAutorSchema en server/routes/autores.routes.ts: nombre
// requerido, el resto opcional. Los campos opcionales van undefined
// (no null) cuando están vacíos — el schema del backend no los acepta
// como null, JSON.stringify simplemente los omite.
export interface DatosNuevoAutor {
  nombre: string;
  nombreArtistico?: string;
  nacionalidad?: string[];
  fechaNacimiento?: string;
  redesSociales?: RedesSociales;
  personalidad?: string[];
  ocupacion?: string;
  email?: string[];
  telefono?: string;
  pais?: string;
  categoria?: CategoriaCliente;
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
  nombreArtistico?: string | null;
  nacionalidad?: string[] | null;
  fechaNacimiento?: string | null;
  redesSociales?: RedesSociales | null;
  personalidad?: string[] | null;
  ocupacion?: string | null;
  email?: string[] | null;
  telefono?: string | null;
  pais?: string | null;
  // Sin null, a diferencia del resto de este objeto: categoria es
  // NOT NULL en la base (ver server/routes/autores.routes.ts), no se
  // puede "borrar" a un estado vacío, solo cambiar entre los dos
  // valores válidos.
  categoria?: CategoriaCliente;
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
