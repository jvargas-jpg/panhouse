import { apiFetch } from '../lib/api';
import type { CargaEspecialista, Catalogos, Proyecto, ProyectoConRiesgo } from '../types/api';

export function fetchCargaEquipo() {
  return apiFetch<{ especialistas: CargaEspecialista[] }>('/especialistas/carga');
}

export function fetchProyectosRiesgo() {
  return apiFetch<{ proyectos: ProyectoConRiesgo[] }>('/proyectos/riesgo');
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

// Corregir a qué autor está asociado un proyecto, o su tipo de
// servicio, después de creado — usado por el modal "Editar Proyecto"
// de AutoresPage.tsx (ver PATCH /:id/reasignar en
// server/routes/proyectos.routes.ts).
export interface DatosReasignarProyecto {
  autorId?: string;
  servicioId?: string;
}

export function reasignarProyecto(proyectoId: string, datos: DatosReasignarProyecto) {
  return apiFetch<{ proyecto: Proyecto }>(`/proyectos/${proyectoId}/reasignar`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
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