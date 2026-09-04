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

// autorIds (no autorId): coautoría — al menos uno, ver
// server/db/schema/proyectos.ts (proyectos_autores). titulo obligatorio
// (crearProyectoSchema en server/routes/proyectos.routes.ts) — sigue
// editable después vía actualizarTituloProyecto (PATCH /:id/titulo).
export interface DatosNuevoProyecto {
  titulo: string;
  autorIds: string[];
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

// Corregir título, coautoría y parámetros comerciales de un proyecto ya
// creado — usado por el modal "Editar Proyecto" de AutoresPage.tsx (ver
// PATCH /:id/reasignar en server/routes/proyectos.routes.ts). autorId
// (singular, legacy) sigue en la interfaz por compatibilidad con el
// tipo del backend, pero CrearProyectoModalForm.tsx ya no lo usa — envía
// autorIds (coautoría, ver proyectos_autores en schema/proyectos.ts).
export interface DatosReasignarProyecto {
  titulo?: string;
  autorId?: string;
  autorIds?: string[];
  servicioId?: string;
  unidadId?: string;
  presupuestoId?: string;
  fechaProgramadaInicio?: string;
}

export function reasignarProyecto(proyectoId: string, datos: DatosReasignarProyecto) {
  return apiFetch<{ proyecto: Proyecto }>(`/proyectos/${proyectoId}/reasignar`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// Eliminación real — ver el comentario de eliminarProyecto en
// server/helpers/proyectos.ts para el alcance de la cascada (ficha
// completa, capítulos, pausas, pagos, seguimiento).
export function eliminarProyecto(proyectoId: string) {
  return apiFetch<{ ok: true }>(`/proyectos/${proyectoId}`, {
    method: 'DELETE',
  });
}

// Paso 1 de la cascada de Fase 1 (Inicio) — comercial → rrpp (ver
// notificarRrppProyectoBase en server/helpers/proyectos.ts). El backend
// responde 409 si ya se notificó antes (idempotencia vía
// proyecto.notificadoRrpp).
export function notificarRrpp(proyectoId: string) {
  return apiFetch<{ ok: true }>(`/proyectos/${proyectoId}/notificar-rrpp`, {
    method: 'POST',
  });
}

// Paso 2 de la misma cascada — rrpp → jefe_area (ver
// notificarJefaturaFichaCompletada en server/helpers/proyectos.ts). El
// backend responde 409 si ya se notificó antes (idempotencia vía
// proyecto.notificadoJefatura).
export function notificarJefatura(proyectoId: string) {
  return apiFetch<{ ok: true }>(`/proyectos/${proyectoId}/notificar-jefatura`, {
    method: 'POST',
  });
}
// autores: [] (no autor singular) — GET /api/proyectos migró a
// coautoría, ver server/helpers/proyectosAutores.ts.
export interface ProyectoResumen {
  id: string;
  estado: 'en_proceso' | 'retrasado' | 'stand_by' | 'pausado' | 'culminado' | 'retirado';
  autores: { id: string; nombre: string }[];
  servicio: { id: string; codigo: string; nombre: string };
}

export function fetchTodosLosProyectos() {
  return apiFetch<{ proyectos: ProyectoResumen[] }>('/proyectos');
}