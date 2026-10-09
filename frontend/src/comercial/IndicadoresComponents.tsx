import type { ReactNode } from 'react';
import type { IndicadoresComerciales } from '../types/api';
import { IconoKpi } from './ComercialKpis';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { COMERCIAL_FOOTER, COMERCIAL_LOGO, ComercialSidebarNav } from './ComercialSidebarNav';

export const ICONOS = {
  autor: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  proyecto: 'M9 3h6l2 3h3a1 1 0 011 1v11a2 2 0 01-2 2H5a2 2 0 01-2-2V7a1 1 0 011-1h3l2-3z',
  listo: 'M22 2L9 15m13-13-7 20-6-7-7-6 20-7z',
  reloj: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  ficha: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm0 0v6h6M8 12h8M8 16h6',
  equipo: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2m20 0v-2a4 4 0 00-3-3.87M13 3a4 4 0 010 8M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  barras: 'M4 19V10m6 9V5m6 14v-6',
  servicio: 'M12 3 2 8l10 5 10-5-10-5zM2 12l10 5 10-5M2 16l10 5 10-5',
  pais: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0zM3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18z',
};
export const CARD = 'min-w-0 rounded-xl border border-gray-100 bg-white shadow-sm';
export const numero = (valor: number) => valor.toLocaleString('es-VE', { maximumFractionDigits: 1 });

export function IndicadorSeccion({ titulo, icono, children, extra }: { titulo: string; icono: string; children: ReactNode; extra?: ReactNode }) {
  return <section className={`${CARD} p-4`} aria-label={titulo}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 [&>span]:h-6 [&>span]:w-6"><IconoKpi path={icono} />{titulo}</h2>
      {extra}
    </div>
    {children}
  </section>;
}
function Sparkline({ valores }: { valores: number[] }) {
  const max = Math.max(...valores, 1);
  const puntos = valores.map((v, i) => `${i * 80 / Math.max(valores.length - 1, 1)},${34 - v / max * 30}`).join(' ');
  return <svg aria-hidden="true" viewBox="0 0 84 40" className="h-8 w-20 shrink-0 text-dorado">
    <polygon points={`0,40 ${puntos} 80,40`} fill="currentColor" opacity="0.06" />
    <polyline points={puntos} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>;
}
function Comparacion({ valor, meses }: { valor: number | null; meses: number }) {
  return <p className="mt-2 flex flex-wrap items-center gap-x-1 text-[11px] leading-4 text-gray-500">
    {valor === null ? 'Sin base de comparación' : <><span className={`font-semibold ${valor >= 0 ? 'text-green-700' : 'text-red-700'}`}><span aria-hidden="true">{valor >= 0 ? '↗' : '↘'} </span>{valor > 0 ? '+' : ''}{numero(valor)}%</span> vs. {meses} meses anteriores</>}
  </p>;
}
export function IndicadoresKpis({ data }: { data: IndicadoresComerciales }) {
  const { summary: s, monthly, periodo } = data;
  const tarjetas = [
    { etiqueta: 'Autores ingresados', valor: s.autores, icono: ICONOS.autor, cambio: s.crecimientoAutores, serie: monthly.map((m) => m.autores) },
    { etiqueta: 'Proyectos creados', valor: s.proyectos, icono: ICONOS.proyecto, cambio: s.crecimientoProyectos, serie: monthly.map((m) => m.proyectos) },
    { etiqueta: 'Listos para RRPP', valor: s.listos, icono: ICONOS.listo, cambio: null, serie: monthly.map((m) => m.listos) },
  ];
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {tarjetas.map((t, i) => <section key={t.etiqueta} aria-label={t.etiqueta} className={`${CARD} p-4`}>
      <IconoKpi path={t.icono} />
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t.etiqueta}</p>
      <div className="mt-1 flex items-center justify-between gap-2"><p className="text-[32px] font-bold leading-none tracking-tight text-gray-900">{numero(t.valor)}</p><Sparkline valores={t.serie} /></div>
      {i === 2 ? <p className="mt-2 text-[11px] leading-4 text-gray-500">Preparación actual · proyectos del período</p> : <Comparacion valor={t.cambio} meses={periodo.meses} />}
    </section>)}
    <section aria-label="Porcentaje de completitud comercial" className={`${CARD} relative p-4`}>
      <IconoKpi path={ICONOS.reloj} />
      <div className="mt-3">
        <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">% Completitud comercial</p>
          <p className="mt-1 text-[32px] font-bold leading-none tracking-tight text-gray-900">{s.completitud === null ? '—' : `${numero(s.completitud)}%`}</p>
          <p className="mt-1 pr-[70px] text-[11px] leading-4 text-gray-500">de proyectos con datos completos</p>
        </div>
        <svg aria-hidden="true" viewBox="0 0 80 80" className="absolute right-4 top-[74px] h-[68px] w-[68px]">
          <circle cx="40" cy="40" r="32" fill="none" stroke="#f0f1f4" strokeWidth="8" />
          <circle cx="40" cy="40" r="32" fill="none" className="stroke-dorado" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(s.completitud ?? 0) / 100 * 201.06} 201.06`} transform="rotate(-90 40 40)" />
          <text x="40" y="45" textAnchor="middle" className="fill-gray-900 text-[13px] font-bold">{s.completitud === null ? '—' : `${numero(s.completitud)}%`}</text>
        </svg>
      </div>
    </section>
  </div>;
}
export function FlujoComercial({ data }: { data: IndicadoresComerciales }) {
  const f = data.funnel;
  const contexto = (porcentaje: number | null, base: string) => porcentaje === null ? 'Sin base en este período' : `${numero(porcentaje)}% ${base}`;
  const pasos = [
    { label: 'Autores registrados', n: f.autores, icono: ICONOS.autor, contexto: f.autores ? '100% de autores del período' : 'Sin autores en este período' },
    { label: 'Proyectos creados', n: f.proyectos, icono: ICONOS.proyecto, contexto: contexto(f.proyectosPorAutor, 'del total de autores') },
    { label: 'Datos comerciales completos', n: f.completos, icono: ICONOS.ficha, contexto: contexto(f.completosPorcentaje, 'de proyectos') },
    { label: 'Listos para RRPP', n: f.listos, icono: ICONOS.listo, contexto: contexto(f.listosPorcentaje, 'de proyectos') },
    { label: 'Entregados a RRPP', n: f.entregados, icono: ICONOS.equipo, contexto: contexto(f.entregadosPorcentaje, 'de proyectos') },
  ];
  return <section className={`${CARD} p-3`} aria-label="Flujo comercial">
    <div className="mb-2 flex items-start gap-2"><IconoKpi path={ICONOS.equipo} /><div><h2 className="text-base font-semibold text-gray-900">Flujo comercial</h2><p className="mt-0.5 text-xs text-gray-500">Desde el registro de autores hasta la entrega a RRPP.</p></div></div>
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5 xl:gap-4">
      {pasos.map((p, i) => <li key={p.label} className={`relative flex items-start gap-3 rounded-xl px-3 py-2 ${i === 4 ? 'bg-gray-50 [&>span]:bg-gray-100 [&>span]:text-gray-600' : 'bg-dorado/[0.045]'} xl:rounded-r-none xl:[clip-path:polygon(0_0,94%_0,100%_50%,94%_100%,0_100%)]`}>
        <IconoKpi path={p.icono} /><div className="min-w-0"><p className="min-h-7 text-[11px] font-medium leading-4 text-slate-700">{p.label}</p><p className="mt-1 text-xl font-bold leading-none text-gray-900">{numero(p.n)}</p><p className="mt-1 text-[10px] leading-[14px] text-gray-500">{p.contexto}</p></div>
        {i < pasos.length - 1 && <svg aria-hidden="true" className="absolute right-0 top-1/2 hidden h-3 w-3 -translate-y-1/2 text-slate-600 xl:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="m9 5 7 7-7 7" /></svg>}
      </li>)}
    </ol>
  </section>;
}
export function IndicadoresSkeleton() {
  return <div role="status" aria-label="Cargando indicadores" className="space-y-4 motion-safe:animate-pulse">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className={`${CARD} h-[172px] p-5`}><div className="h-8 w-8 rounded bg-gray-100" /><div className="mt-4 h-3 w-32 rounded bg-gray-100" /><div className="mt-3 h-8 w-16 rounded bg-gray-100" /></div>)}</div>
    <div className={`${CARD} h-44 bg-gray-50`} />
    <div className="grid gap-4 lg:grid-cols-2"><div className={`${CARD} h-56 bg-gray-50`} /><div className={`${CARD} h-56 bg-gray-50`} /></div>
    <div className="grid gap-4 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className={`${CARD} h-52 bg-gray-50`} />)}</div>
    <span className="sr-only">Cargando indicadores comerciales…</span>
  </div>;
}
// También preserva el shell durante la descarga inicial del bundle de charts.
export function IndicadoresLoading() {
  return <CrmSidebarLayout logo={COMERCIAL_LOGO} footer={COMERCIAL_FOOTER} nav={<ComercialSidebarNav activo="indicadores" />} contentMaxWidth="max-w-[1600px]" contentClassName="px-4 py-5 sm:p-6">
    <div className="mb-4"><h1 className="text-2xl font-bold tracking-tight text-gray-900">Indicadores Comerciales</h1><p className="mt-1 text-sm text-gray-500">Analiza el rendimiento del área comercial y el avance de los proyectos hacia RRPP.</p></div>
    <IndicadoresSkeleton />
  </CrmSidebarLayout>;
}
