import { apiFetch } from '../lib/api';
import type { Pago } from '../types/api';

export interface DatosNuevoPago {
  proyectoId: string;
  monto: string;
  moneda?: string;
  fechaPago: string;
  metodoPago: string;
  referencia?: string | null;
  comprobanteUrl?: string | null;
}

// proyectoId opcional: sin filtro trae el historial completo
// (RegistrarPagoPage.tsx lo usa así para "Historial Reciente").
export function fetchPagos(proyectoId?: string) {
  const query = proyectoId ? `?proyectoId=${encodeURIComponent(proyectoId)}` : '';
  return apiFetch<{ pagos: Pago[] }>(`/pagos${query}`);
}

export function registrarPago(datos: DatosNuevoPago) {
  return apiFetch<{ pago: Pago }>('/pagos', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

export type EstatusVerificacionPago = 'Verificado' | 'Rechazado';

export interface DatosVerificacionPago {
  estatus: EstatusVerificacionPago;
  motivoRechazo?: string | null;
}

// Cierre del ciclo de vida del pago — cobranzas/jefe_area/dirección
// (ver server/routes/pagos.routes.ts). Vive acá junto al resto de la
// API de pagos aunque quien la use sea el módulo de cobranzas (mismo
// criterio que proyectos/campos.tsx, compartido entre dominios).
export function verificarPago(id: string, datos: DatosVerificacionPago) {
  return apiFetch<{ pago: Pago }>(`/pagos/${id}/verificar`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}
