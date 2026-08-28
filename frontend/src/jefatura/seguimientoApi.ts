import { apiFetch } from '../lib/api';
import type { RegistroSeguimiento } from '../types/api';

export function fetchSeguimiento() {
  return apiFetch<{ registros: RegistroSeguimiento[] }>('/seguimiento');
}
