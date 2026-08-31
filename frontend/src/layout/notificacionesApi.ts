import { apiFetch } from '../lib/api';
import type { Notificacion } from '../types/api';

export function fetchNotificaciones() {
  return apiFetch<{ notificaciones: Notificacion[] }>('/notificaciones');
}

export function marcarNotificacionLeida(id: string) {
  return apiFetch<{ notificacion: Notificacion }>(`/notificaciones/${id}/leer`, {
    method: 'PATCH',
  });
}
