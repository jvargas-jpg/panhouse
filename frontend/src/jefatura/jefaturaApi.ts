import { apiFetch } from '../lib/api';
import type { Autor, CargaEspecialista, Catalogos, Proyecto, ProyectoConRiesgo } from '../types/api';

export function fetchCargaEquipo() {
  return apiFetch<{ especialistas: CargaEspecialista[] }>('/especialistas/carga');
}

export function fetchProyectosRiesgo() {
  return apiFetch<{ proyectos: ProyectoConRiesgo[] }>('/proyectos/riesgo');
}

// Punto de partida del flujo crear-proyecto + asignar-especialista.
export function fetchAutoresSinProyecto() {
  return apiFetch<{ autores: Autor[] }>('/autores/sin-proyecto');
}

export function fetchCatalogos() {
  return apiFetch<Catalogos>('/catalogos');
}

export interface DatosNuevoProyecto {
  autorId: string;
  servicioId: string;
  unidadId: string;
  presupuestoId: string;
  fechaProgramadaInicio: string;
  fechaRealInicio?: string;
  fechaDeseadaAutor?: string;
}

export function crearProyecto(datos: DatosNuevoProyecto) {
  return apiFetch<{ proyecto: Proyecto }>('/proyectos', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

// Paso propio, separado de crear el proyecto — mismo endpoint que ya
// usa el resto del sistema (ver server/routes/proyectos.routes.ts).
export function asignarEspecialista(proyectoId: string, especialistaId: string) {
  return apiFetch<{ ok: true }>(`/proyectos/${proyectoId}/especialista`, {
    method: 'PATCH',
    body: JSON.stringify({ especialistaId }),
  });
}
export interface ProyectoResumen {
  id: string;
  estado: 'en_proceso' | 'retrasado' | 'stand_by' | 'pausado' | 'culminado' | 'retirado';
  autor: { id: string; nombre: string };
  servicio: { id: string; codigo: string; nombre: string };
}

export function fetchTodosLosProyectos() {
  return apiFetch<{ proyectos: ProyectoResumen[] }>('/proyectos');
}