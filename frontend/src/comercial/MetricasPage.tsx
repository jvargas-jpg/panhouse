import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { COMERCIAL_FOOTER, COMERCIAL_LOGO, ComercialSidebarNav } from './ComercialSidebarNav';
import { IndicadoresCharts } from './IndicadoresCharts';
import { FlujoComercial, ICONOS, IndicadoresKpis, IndicadoresSkeleton, IndicadorSeccion, numero } from './IndicadoresComponents';
import { MapaCalorPaises } from './MapaCalorPaises';
import { fetchIndicadoresComercial, type PeriodoIndicadores } from './metricasApi';

export function MetricasPage() {
  const [periodo, setPeriodo] = useState<PeriodoIndicadores>('6m');
  // Comparte el prefijo de invalidación con altas y ediciones comerciales.
  const query = useQuery({ queryKey: ['metricas', 'comercial', 'indicadores', periodo], queryFn: () => fetchIndicadoresComercial(periodo) });
  const data = query.data;
  const maxServicio = data?.services[0]?.cantidad ?? 1;
  return <CrmSidebarLayout logo={COMERCIAL_LOGO} footer={COMERCIAL_FOOTER} nav={<ComercialSidebarNav activo="indicadores" />} contentMaxWidth="max-w-[1600px]" contentClassName="px-4 py-5 sm:p-6">
    <div className="[--indicadores-dorado:theme(colors.dorado)]">
      <header className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div><h1 className="text-2xl font-bold tracking-tight text-gray-900">Indicadores Comerciales</h1><p className="mt-1 text-sm text-gray-500">Analiza el rendimiento del área comercial y el avance de los proyectos hacia RRPP.</p></div>
        <label className="relative flex w-fit shrink-0 items-center">
          <span className="sr-only">Período de indicadores comerciales</span>
          <svg aria-hidden="true" className="pointer-events-none absolute left-3 h-4 w-4 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" /></svg>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as PeriodoIndicadores)} className="h-10 appearance-none rounded-xl border border-gray-200 bg-white pl-9 pr-9 text-xs font-semibold text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado">
            <option value="3m">Últimos 3 meses</option><option value="6m">Últimos 6 meses</option><option value="12m">Últimos 12 meses</option>
          </select>
          <svg aria-hidden="true" className="pointer-events-none absolute right-3 h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
        </label>
      </header>
      {query.isLoading && <IndicadoresSkeleton />}
      {query.isError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-white p-4 text-sm text-red-700"><p>No se pudieron cargar los indicadores comerciales.</p><button type="button" onClick={() => { void query.refetch(); }} className="rounded-lg border border-gray-200 px-3 py-2 font-medium text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado">Reintentar</button></div>}
      {data && <div className="space-y-4">
        <IndicadoresKpis data={data} />
        <FlujoComercial data={data} />
        <IndicadoresCharts monthly={data.monthly} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,35fr)_minmax(0,40fr)_minmax(0,25fr)]">
          <IndicadorSeccion titulo="Proyectos por servicio" icono={ICONOS.servicio}>
            {data.services.length === 0 ? <Vacio /> : <ul tabIndex={0} aria-label="Ranking de servicios" className="max-h-[184px] space-y-2 overflow-y-auto pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado">
              {data.services.map((s) => <li key={s.servicio} className="grid grid-cols-[minmax(0,110px)_minmax(0,1fr)] items-center gap-2 text-[11px]">
                <span className="text-right leading-4 text-gray-600">{s.servicio}</span><div className="relative h-[18px] rounded bg-gray-100"><div className="h-full rounded bg-dorado" style={{ width: `${s.cantidad / maxServicio * 100}%` }} /><span className="absolute right-1 top-0 rounded bg-white/90 px-1 text-[10px] font-semibold leading-[18px] text-gray-900">{numero(s.cantidad)}</span></div>
              </li>)}
            </ul>}
          </IndicadorSeccion>
          <IndicadorSeccion titulo="Autores por país" icono={ICONOS.pais}>
            <div className="flex min-h-[144px] flex-col gap-2 sm:flex-row sm:items-center">
              <div tabIndex={0} aria-label="Ranking de países" className="max-h-[160px] w-full overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado sm:w-[42%] sm:shrink-0">
                {data.countries.length === 0 ? <Vacio /> : <ol className="space-y-1.5">{data.countries.map((p, i) => <li key={p.pais} className="flex items-center gap-2 text-[11px]"><span className="text-[10px] text-gray-500">{i + 1}.</span><span className="min-w-0 flex-1 capitalize text-gray-600">{p.pais}</span><span className="font-semibold text-gray-900">{numero(p.cantidad)}</span></li>)}</ol>}
              </div>
              <div className="flex h-[180px] min-w-0 flex-1 items-center sm:h-[144px]"><MapaCalorPaises paises={data.countries} /></div>
            </div>
          </IndicadorSeccion>
          <IndicadorSeccion titulo="Tiempo promedio para completar ficha" icono={ICONOS.reloj}>
            <p className="text-[28px] font-bold leading-none text-gray-900">{data.timings.promedioDias === null ? '—' : `${numero(data.timings.promedioDias)} días`}</p>
            <p className="mt-2 text-xs text-gray-500">Sin datos suficientes</p>
            <div title={data.timings.motivo} className="mt-4 rounded-lg bg-gray-50 p-3 text-[11px] leading-4 text-gray-600">Desde la creación del proyecto hasta tener todos los datos comerciales completos.</div>
          </IndicadorSeccion>
        </div>
        <p className="text-[10px] leading-4 text-gray-500">Mes actual en curso · Caracas. Las altas se comparan con los {data.periodo.meses} meses anteriores completos. Preparación y entregas: estado actual de los proyectos creados en el período. Una ficha completa está lista para RRPP; su entrega es independiente. No hay comparación histórica de preparación.</p>
      </div>}
    </div>
  </CrmSidebarLayout>;
}
function Vacio() { return <p className="py-4 text-xs text-gray-500">Sin datos en este período</p>; }
