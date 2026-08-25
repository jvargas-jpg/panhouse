import { apiFetch } from '../lib/api';
import type { ProyectoConRiesgo } from '../types/api';

export function fetchMisProyectos() {
  return apiFetch<{ proyectos: ProyectoConRiesgo[] }>('/proyectos/mios');
}
