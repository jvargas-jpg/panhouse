import type { ProjectsFilter, ProjectsOrder } from './projectsModel';

export function ProjectsToolbar({ busqueda, onBusqueda, filtro, onFiltro, orden, onOrden, total, pendientes, listos, enviados }: {
  busqueda: string; onBusqueda: (v: string) => void;
  filtro: ProjectsFilter; onFiltro: (v: ProjectsFilter) => void;
  orden: ProjectsOrder; onOrden: (v: ProjectsOrder) => void;
  total?: number; pendientes?: number; listos?: number; enviados?: number;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="relative min-w-0 flex-1">
        <svg aria-hidden="true" className="pointer-events-none absolute left-3.5 top-3 h-5 w-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
        <input type="search" aria-label="Buscar proyectos" placeholder="Buscar por ID, autor, título o servicio…" value={busqueda} onChange={(e) => onBusqueda(e.target.value)} className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-11 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-500 focus:border-dorado focus:ring-2 focus:ring-dorado/30" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
      <div role="group" aria-label="Filtrar proyectos" className="flex flex-wrap gap-2">
        {([{ valor: 'todos', nombre: 'Todos', cantidad: total }, { valor: 'pendientes', nombre: 'Datos pendientes', cantidad: pendientes }, { valor: 'listos', nombre: 'Listos para RRPP', cantidad: listos }, { valor: 'enviados', nombre: 'Enviados a RRPP', cantidad: enviados }] as const).map((opcion) => (
          <button key={opcion.valor} type="button" aria-pressed={filtro === opcion.valor} onClick={() => onFiltro(opcion.valor)} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado/50 ${filtro === opcion.valor ? 'bg-dorado/20 text-tinta' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
            {opcion.nombre}{opcion.cantidad !== undefined && <span className="rounded-md bg-white/70 px-1.5 py-0.5 tabular-nums">{opcion.cantidad}</span>}
          </button>
        ))}
      </div>
      <label className="flex shrink-0 items-center gap-2 text-xs text-gray-600">
        Ordenar por
        <select value={orden} onChange={(e) => onOrden(e.target.value as ProjectsOrder)} className="min-h-10 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-800 outline-none focus:border-dorado focus:ring-2 focus:ring-dorado/30 xl:flex-none">
          <option value="original">Orden del listado</option><option value="autor">Autor A-Z</option><option value="codigo">Código A-Z</option>
        </select>
      </label>
      </div>
    </div>
  );
}
