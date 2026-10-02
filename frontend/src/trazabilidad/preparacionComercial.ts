import type { FaltanteComercial } from '../types/api';
// Presentación solamente: la evaluación llega del backend.
export const FALTANTES_COMERCIAL: Record<FaltanteComercial, string> = {
  autores: 'Autoría', servicioId: 'Servicio', unidadId: 'Unidad', presupuestoId: 'Presupuesto inicial',
  ingresoFechaIngreso: 'Fecha de ingreso', ingresoServicioEjecucion: 'Ejecución',
  ingresoServicioAlianza: 'Alianza comercial', capitulosPactados: 'Cantidad de capítulos', paginasPactadas: 'Páginas pactadas',
};
export function resumenFaltantes(faltantes: readonly FaltanteComercial[] = []): string {
  return faltantes.map((campo) => FALTANTES_COMERCIAL[campo]).join(' · ');
}
