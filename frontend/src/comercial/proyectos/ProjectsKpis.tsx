const PATHS = [
  'M9 3h6l2 3h3a1 1 0 011 1v11a2 2 0 01-2 2H5a2 2 0 01-2-2V7a1 1 0 011-1h3l2-3z',
  'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  'M5 13l4 4L19 7',
  'M4 19V10m6 9V5m6 14v-6',
];

export interface ProjectKpi { etiqueta: string; ayuda: string; valor?: number; cargando: boolean; error: boolean; reintentar: () => void }

export function ProjectsKpis({ indicadores }: { indicadores: ProjectKpi[] }) {
  return <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 sm:gap-4">{indicadores.map((kpi, i) => (
    <div key={kpi.etiqueta} className="min-w-0 rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:flex sm:items-start sm:gap-4 sm:p-5">
      <span className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:flex ${i === 2 ? 'bg-green-50 text-green-600' : 'bg-dorado/10 text-amber-700'}`}><svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path strokeLinecap="round" strokeLinejoin="round" d={PATHS[i]} /></svg></span>
      <div className="min-w-0"><p className="min-h-8 text-[11px] font-medium leading-4 text-gray-600 sm:min-h-0 sm:text-xs sm:leading-5"><span className="sm:hidden">{['Activos', 'Datos pendientes', 'Listos para RRPP', 'Este mes'][i]}</span><span className="sr-only sm:not-sr-only">{kpi.etiqueta}</span></p>
        {kpi.cargando ? <div aria-label="Cargando indicador" className="my-1 h-8 w-14 animate-pulse rounded bg-gray-100" /> : <p className="mt-1 text-[28px] font-bold leading-8 tabular-nums text-gray-900">{kpi.error ? '—' : kpi.valor ?? '—'}</p>}
        {kpi.error ? <button type="button" onClick={kpi.reintentar} className="mt-1 text-xs font-medium text-gray-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado">Reintentar</button> : <p className="mt-1 hidden text-xs leading-5 text-gray-500 sm:block">{kpi.ayuda}</p>}
      </div>
    </div>
  ))}</div>;
}
