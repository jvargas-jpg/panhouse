import { apiFetch } from '../lib/api';
import type { IndicadoresComerciales, MetricasComerciales } from '../types/api';

export type PeriodoIndicadores = '3m' | '6m' | '12m';
export function fetchIndicadoresComercial(periodo: PeriodoIndicadores) {
  return apiFetch<IndicadoresComerciales>(`/metricas/comercial/indicadores?periodo=${periodo}`);
}

export function fetchMetricasComercial() {
  return apiFetch<MetricasComerciales>('/metricas/comercial');
}
