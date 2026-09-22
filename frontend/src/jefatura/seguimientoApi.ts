import { apiFetch } from '../lib/api';
import type { RegistroSeguimiento } from '../types/api';

export function fetchSeguimiento() {
  return apiFetch<{ registros: RegistroSeguimiento[] }>('/seguimiento');
}

// Campos editables tanto al crear como al actualizar un registro —
// proyectoId se agrega aparte (DatosNuevoRegistroSeguimiento, abajo)
// porque solo tiene sentido al crear.
export interface DatosRegistroSeguimiento {
  analistaId?: string | null;
  especialistaId?: string | null;
  asignacionTipo?: string | null;
  tipoServicio?: string | null;
  paginas?: number | null;
  fechaAsignada?: string | null;
  horaRecibida?: string | null;
  fechaInicio?: string | null;
  horaInicio?: string | null;
  fechaEntrega?: string | null;
  horaEntrega?: string | null;
  estatus?: string | null;
  totalDias?: string | null;
  totalHoras?: string | null;
  tiempoCorrecto?: string | null;
  observaciones?: string | null;
  freelance?: boolean;
  pago80?: boolean;
  pago20?: boolean;
  resultadosCorreccion?: string | null;
  cantidadComentarios?: number | null;
  cumplimiento?: string | null;
}

export interface DatosNuevoRegistroSeguimiento extends DatosRegistroSeguimiento {
  proyectoId: string;
}

export function crearRegistroSeguimiento(datos: DatosNuevoRegistroSeguimiento) {
  return apiFetch<{ registro: RegistroSeguimiento }>('/seguimiento', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

export function actualizarRegistroSeguimiento(id: string, datos: DatosRegistroSeguimiento) {
  return apiFetch<{ registro: RegistroSeguimiento }>(`/seguimiento/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}
