import { apiFetch } from '../lib/api';
import type { ProyectoConRiesgo, ProyectoResumen } from '../types/api';

export function fetchMisProyectos() {
  return apiFetch<{ proyectos: ProyectoConRiesgo[] }>('/proyectos/mios');
}

// Selector del módulo de pagos (comercial/RegistrarPagoPage.tsx) —
// ruta nueva y angosta, no la lista general (GET /proyectos, solo
// jefatura/dirección, ver server/routes/proyectos.routes.ts).
export function fetchProyectosActivos() {
  return apiFetch<{ proyectos: ProyectoResumen[] }>('/proyectos/activos');
}
