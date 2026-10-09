import { apiFetch } from '../lib/api';
export type { IndicadoresRrpp, DistribucionRrpp, MesRrpp, FilaIndicadorRrpp } from '../../../shared/rrppIndicadores';
import type { IndicadoresRrpp } from '../../../shared/rrppIndicadores';
export const fetchIndicadoresRrpp = (from: string, to: string) => apiFetch<IndicadoresRrpp>(`/rrpp/indicadores?${new URLSearchParams({ from, to })}`);
export type PresetRrpp = 'mes' | '3m' | '6m' | 'ano' | 'custom';
export function rangoRrpp(preset: Exclude<PresetRrpp, 'custom'>, hoy: string) {
  const [year, month] = hoy.split('-').map(Number);
  const fecha = new Date(Date.UTC(year!, preset === 'ano' ? 0 : month! - (preset === 'mes' ? 1 : preset === '3m' ? 3 : 6), 1));
  return { from: fecha.toISOString().slice(0, 10), to: hoy };
}
export const hoyIndicadoresRrpp = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
