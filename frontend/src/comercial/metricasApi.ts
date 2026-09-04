import { apiFetch } from '../lib/api';
import type { MetricasComerciales } from '../types/api';

export function fetchMetricasComercial() {
  return apiFetch<MetricasComerciales>('/metricas/comercial');
}
