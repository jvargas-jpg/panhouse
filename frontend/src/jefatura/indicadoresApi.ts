import { apiFetch } from '../lib/api';
import type {
  FiltrosIndicadoresJefatura,
  IndicadoresJefatura,
} from '../../../shared/indicadoresJefatura';
export type {
  FiltrosIndicadoresJefatura,
  IndicadoresJefatura,
} from '../../../shared/indicadoresJefatura';
export function parametrosIndicadores(f: FiltrosIndicadoresJefatura) {
  return new URLSearchParams(
    Object.entries(f).filter(([, value]) => !!value) as [string, string][],
  ).toString();
}
export const fetchIndicadoresJefatura = (f: FiltrosIndicadoresJefatura) =>
  apiFetch<IndicadoresJefatura>(
    `/jefatura/indicadores?${parametrosIndicadores(f)}`,
  );
export async function exportarIndicadores(f: FiltrosIndicadoresJefatura) {
  const response = await fetch(
    `/api/jefatura/indicadores/export.csv?${parametrosIndicadores(f)}`,
    { credentials: 'include' },
  );
  if (!response.ok)
    throw new Error('No pudimos exportar los indicadores. Intenta de nuevo.');
  const blob = await response.blob(),
    url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `indicadores-jefatura-${f.from}-${f.to}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const hoyIndicadores = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export function periodoIndicadores(preset: string, hoy = hoyIndicadores()) {
  const [year, month] = hoy.split('-').map(Number);
  const start = new Date(
    Date.UTC(
      year!,
      preset === 'ano'
        ? 0
        : month! - (preset === 'anterior' ? 2 : preset === '3m' ? 3 : 1),
      1,
    ),
  );
  const end =
    preset === 'anterior'
      ? new Date(Date.UTC(year!, month! - 1, 0)).toISOString().slice(0, 10)
      : hoy;
  return { from: start.toISOString().slice(0, 10), to: end };
}
