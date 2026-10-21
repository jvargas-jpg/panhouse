import { apiFetch } from '../lib/api';
export type { IndicadoresCreativos, DistribucionCreativa, MesCreativo, CicloCreativo, HitoCreativo, CreativeActivity } from '../../../shared/creativeIndicadores';
import type { IndicadoresCreativos } from '../../../shared/creativeIndicadores';
export const fetchIndicadoresCreativos = (from: string, to: string, servicio?: string) =>
  apiFetch<IndicadoresCreativos>(`/direccion-creativa/indicadores?${new URLSearchParams({ from, to, ...(servicio ? { servicio } : {}) })}`);
export type PresetCreativo = 'mes' | '3m' | '6m' | 'ano' | 'custom';
export function rangoCreativo(preset: Exclude<PresetCreativo, 'custom'>, hoy: string) {
  const [year, month] = hoy.split('-').map(Number);
  const fecha = new Date(Date.UTC(year!, preset === 'ano' ? 0 : month! - (preset === 'mes' ? 1 : preset === '3m' ? 3 : 6), 1));
  return { from: fecha.toISOString().slice(0, 10), to: hoy };
}
export const hoyIndicadoresCreativos = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export async function exportarIndicadoresCreativos(from: string, to: string, servicio?: string) {
  const params = new URLSearchParams({ from, to, ...(servicio ? { servicio } : {}) });
  const response = await fetch(`/api/direccion-creativa/indicadores/export.csv?${params}`, { credentials: 'include' });
  if (!response.ok) throw new Error('No pudimos exportar los indicadores. Intenta de nuevo.');
  const blob = await response.blob(), url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `indicadores-direccion-creativa-${from}-${to}.csv`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
