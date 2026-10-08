import { apiFetch } from '../lib/api';
import type { TrabajoEditorCapitulo } from '../types/api';

// "Mis Trabajos de Edición" — a nivel de CAPÍTULO (ver GET /api/capitulos/mios,
// server/helpers/capitulos.ts:listarTrabajosEditor), no de proyecto.
export function fetchMisTrabajosEdicion() {
  return apiFetch<{ trabajos: TrabajoEditorCapitulo[] }>('/capitulos/mios');
}
