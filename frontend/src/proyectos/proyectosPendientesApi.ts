import { apiFetch } from '../lib/api';
import type { ProyectoPendienteSeccion1 } from '../types/api';

// "Notificación interna" de rrpp — pantalla de inicio.
export function fetchProyectosPendientesPerfil() {
  return apiFetch<{ proyectos: ProyectoPendienteSeccion1[] }>('/fichas-trazabilidad/pendientes/perfil');
}

// "Matrices de Ingreso (RRPP)" — módulo propio en el inicio de rrpp,
// ver MatrizIngresoPage.tsx. A diferencia de fetchProyectosPendientesPerfil
// arriba, es un archivo persistente (todo proyecto ya enviado a rrpp),
// no solo lo pendiente — ver listarProyectosEnviadosARrpp en
// server/helpers/trazabilidad.ts.
export function fetchProyectosEnviadosARrpp() {
  return apiFetch<{ proyectos: ProyectoPendienteSeccion1[] }>('/fichas-trazabilidad/enviados-a-rrpp');
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
