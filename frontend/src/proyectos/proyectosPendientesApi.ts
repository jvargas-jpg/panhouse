import { apiFetch } from '../lib/api';
import type { ProyectoPendienteSeccion1 } from '../types/api';

// "Notificación interna" de rrpp — pantalla de inicio.
export function fetchProyectosPendientesPerfil() {
  return apiFetch<{ proyectos: ProyectoPendienteSeccion1[] }>('/fichas-trazabilidad/pendientes/perfil');
}

// "Notificación interna" de comercial — sección extra junto a Crear autor.
export function fetchProyectosPendientesContrato() {
  return apiFetch<{ proyectos: ProyectoPendienteSeccion1[] }>('/fichas-trazabilidad/pendientes/contrato');
}

// "Notificación interna" de disenador — pantalla de inicio.
export function fetchProyectosPendientesDiseno() {
  return apiFetch<{ proyectos: ProyectoPendienteSeccion1[] }>('/fichas-trazabilidad/pendientes/diseno');
}

// "Notificación interna" de soporte_editorial — pantalla de inicio.
export function fetchProyectosPendientesCalidad() {
  return apiFetch<{ proyectos: ProyectoPendienteSeccion1[] }>('/fichas-trazabilidad/pendientes/calidad');
}

// "Notificación interna" de soporte_digital — pantalla de inicio.
export function fetchProyectosPendientesSoporteDigital() {
  return apiFetch<{ proyectos: ProyectoPendienteSeccion1[] }>('/fichas-trazabilidad/pendientes/soporte-digital');
}
