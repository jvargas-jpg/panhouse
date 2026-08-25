import { apiFetch } from '../lib/api';
import type { CargaEditor, ProyectoPendienteSeccion1 } from '../types/api';

// Punto de partida del flujo de jefe_edicion: mismo patrón que
// "Autores sin proyecto" de jefe_area (server/helpers/proyectos.ts:listarProyectosSinEditor).
export function fetchProyectosSinEditor() {
  return apiFetch<{ proyectos: ProyectoPendienteSeccion1[] }>('/proyectos/sin-editor');
}

export function fetchCargaEditores() {
  return apiFetch<{ editores: CargaEditor[] }>('/editores/carga');
}

// Mismo endpoint que ya usa jefe_area para especialista
// (PATCH /proyectos/:id/especialista), acá con editor.
export function asignarEditor(proyectoId: string, editorId: string) {
  return apiFetch<{ ok: true }>(`/proyectos/${proyectoId}/editor`, {
    method: 'PATCH',
    body: JSON.stringify({ editorId }),
  });
}
