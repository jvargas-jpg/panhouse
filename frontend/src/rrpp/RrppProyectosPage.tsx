import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMe } from '../auth/useAuth';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { RRPP_FOOTER, RRPP_LOGO, RrppSidebarNav } from './RrppSidebarNav';
import { ErrorIngreso } from './RrppIngresosPage';
import { RrppIcon } from './RrppIcons';
import { fechaActividad } from './RrppDashboardCards';
import { ESTADOS_MACRO, fetchProyectosConsulta } from './rrppProyectosApi';
import {
  BadgeConsulta,
  ConsultaSkeleton,
  RrppProyectoDetalle,
} from './RrppProyectoDetalle';

export function RrppProyectosPage() {
  const { data: usuario } = useMe();
  const [params, setParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState(params.get('q') ?? '');
  const q = params.get('q') ?? '';
  useEffect(() => {
    setBusqueda(q);
  }, [q]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (busqueda.trim() === q) return;
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('pagina');
          next.delete('proyecto');
          next.delete('tab');
          if (busqueda.trim()) next.set('q', busqueda.trim());
          else next.delete('q');
          return next;
        },
        { replace: true },
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda, q, setParams]);
  const filtros = new URLSearchParams();
  for (const key of ['q', 'servicio', 'estado', 'rrpp', 'orden', 'pagina'])
    if (params.get(key)) filtros.set(key, params.get(key)!);
  const query = useQuery({
    queryKey: ['rrpp', 'proyectos', filtros.toString()],
    queryFn: () => fetchProyectosConsulta(filtros),
    enabled: usuario?.rol === 'rrpp',
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });
  const id = params.get('proyecto');
  // La selección automática solo en escritorio; móvil/tablet abren primero la lista.
  useEffect(() => {
    if (
      !id &&
      window.matchMedia('(min-width: 1200px)').matches &&
      query.data?.proyectos[0] &&
      !query.isPlaceholderData
    )
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('proyecto', query.data.proyectos[0].id);
          return next;
        },
        { replace: true },
      );
  }, [id, query.data, query.isPlaceholderData, setParams]);
  function cambiar(key: string, value: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'pagina') next.delete('pagina');
      next.delete('proyecto');
      next.delete('tab');
      return next;
    });
  }
  const hayFiltros = ['q', 'servicio', 'estado', 'rrpp'].some((key) =>
    params.get(key),
  );
  if (usuario && usuario.rol !== 'rrpp')
    return (
      <p role="alert" className="p-6">
        No tienes acceso a Proyectos RRPP.
      </p>
    );
  return (
    <CrmSidebarLayout
      nav={<RrppSidebarNav vista="proyectos" />}
      logo={RRPP_LOGO}
      footer={RRPP_FOOTER}
      contentMaxWidth="max-w-[1800px]"
      contentClassName="px-4 py-7 sm:px-6 min-[1200px]:px-7"
    >
      <div className="rrpp-projects min-w-0">
        <header className="mb-5">
          <div className="flex items-center gap-3">
            <span className="h-1 w-8 rounded bg-dorado" />
            <h1 className="text-[27px] font-bold tracking-tight text-gray-900">
              Proyectos
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-slate-500 sm:ml-11">
            Consulta y da seguimiento a todos los proyectos relacionados con
            RRPP.
          </p>
          <nav
            aria-label="Navegación RRPP"
            className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600 md:hidden"
          >
            <Link to="/">Inicio</Link>
            <Link to="/rrpp/ingresos">Ingresos</Link>
            <Link to="/rrpp/proyectos" aria-current="page">
              Proyectos
            </Link>
            <Link to="/?vista=lanzamientos">Lanzamientos y eventos</Link>
            <Link to="/rrpp/metricas">Indicadores</Link>
          </nav>
        </header>
        <div
          className={`${id ? 'hidden min-[1200px]:grid' : 'grid'} mb-4 grid-cols-2 gap-3 min-[1200px]:grid-cols-[minmax(220px,2.6fr)_repeat(4,minmax(110px,1fr))]`}
        >
          <label className="col-span-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 min-[1200px]:col-span-1">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5 shrink-0 text-slate-600"
            >
              <circle cx="10" cy="10" r="6" />
              <path d="m15 15 6 6" />
            </svg>
            <span className="sr-only">Buscar proyectos</span>
            <input
              value={busqueda}
              maxLength={150}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por proyecto, autor, título o código..."
              className="min-w-0 flex-1 bg-transparent py-4 text-xs outline-none placeholder:text-slate-500"
            />
          </label>
          {[
            {
              key: 'servicio',
              label: 'Servicio',
              opciones:
                query.data?.catalogos.servicios.map((s) => ({
                  value: s.id,
                  label: `${s.codigo} — ${s.nombre}`,
                })) ?? [],
            },
            {
              key: 'estado',
              label: 'Estado general',
              opciones: (
                query.data?.catalogos.estados ?? Object.keys(ESTADOS_MACRO)
              ).map((s) => ({ value: s, label: ESTADOS_MACRO[s] })),
            },
            {
              key: 'rrpp',
              label: 'Estado RRPP',
              opciones: Object.entries(
                query.data?.catalogos.contextos ?? {},
              ).map(([value, label]) => ({ value, label })),
            },
            {
              key: 'orden',
              label: 'Ordenar por',
              opciones: [
                { value: 'recientes', label: 'Más recientes' },
                { value: 'antiguos', label: 'Más antiguos' },
                { value: 'autor', label: 'Autor' },
              ],
            },
          ].map((f) => (
            <label
              key={f.key}
              className="min-w-0 rounded-lg border border-slate-200 bg-white p-1.5 text-[11px] text-slate-500"
            >
              <span className="block px-1 pb-1">{f.label}</span>
              <select
                value={
                  params.get(f.key) ?? (f.key === 'orden' ? 'recientes' : '')
                }
                onChange={(e) => cambiar(f.key, e.target.value)}
                className="w-full min-w-0 rounded-md border border-slate-100 bg-white px-1 py-1.5 text-[11px] text-slate-900"
              >
                {f.key !== 'orden' && <option value="">Todos</option>}
                {f.opciones.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="grid min-w-0 items-start gap-4 min-[1200px]:grid-cols-[minmax(0,31fr)_minmax(0,69fr)]">
          <section
            aria-label="Lista de proyectos"
            aria-busy={query.isFetching}
            className={`${id ? 'hidden min-[1200px]:flex' : 'flex'} min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm min-[1200px]:h-[calc(100dvh-240px)] min-[1200px]:min-h-[360px]`}
          >
            <div className="border-b border-slate-100 px-3 py-2.5 text-xs font-medium text-slate-900">
              {query.data
                ? `${query.data.total} ${query.data.total === 1 ? 'proyecto' : 'proyectos'}`
                : 'Proyectos'}
              {query.isFetching && query.data && (
                <span className="ml-2 text-slate-400">Actualizando…</span>
              )}
            </div>
            {query.isLoading ? (
              <ConsultaSkeleton />
            ) : query.isError ? (
              <div className="p-3">
                <ErrorIngreso
                  error={query.error}
                  reintentar={() => void query.refetch()}
                />
              </div>
            ) : !query.data?.proyectos.length ? (
              <div className="p-6 text-sm text-slate-500">
                <p>
                  {hayFiltros
                    ? 'No encontramos proyectos con estos filtros.'
                    : 'No hay proyectos disponibles para consultar.'}
                </p>
                {hayFiltros && (
                  <button
                    onClick={() => {
                      setBusqueda('');
                      setParams({});
                    }}
                    className="mt-3 font-semibold text-blue-600"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                {query.data.proyectos.map((p) => (
                  <button
                    key={p.id}
                    disabled={query.isPlaceholderData}
                    aria-pressed={id === p.id}
                    onClick={() =>
                      setParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.set('proyecto', p.id);
                        next.delete('tab');
                        return next;
                      })
                    }
                    className={`grid w-full grid-cols-[34px_minmax(0,1fr)_auto_minmax(88px,1fr)_12px] items-center gap-2 border-b px-3 py-3.5 text-left ${id === p.id ? 'rounded-lg border border-blue-400 bg-blue-50/80' : 'border-slate-100 hover:bg-slate-50'} disabled:opacity-60`}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-[11px] font-semibold text-amber-800">
                      {p.autorPrincipal
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block break-words text-[11px] font-semibold leading-4 text-slate-900">
                        {p.nombre}
                      </span>
                      <span className="mt-2 block text-[11px] text-slate-500">
                        #{p.codigo}
                      </span>
                    </span>
                    <span
                      className="rounded-md border border-slate-100 bg-white px-2 py-1.5 text-[10px] text-slate-900"
                      title={p.servicio.nombre}
                    >
                      {p.servicio.codigo}
                    </span>
                    <span className="min-w-0">
                      <BadgeConsulta estado={p.estado}>
                        {ESTADOS_MACRO[p.estado]}
                      </BadgeConsulta>
                      <span className="mt-1.5 block text-[10px] leading-3.5 text-slate-500">
                        {fechaActividad(p.actualizadoAt)}
                      </span>
                    </span>
                    <RrppIcon
                      nombre="flecha"
                      className="h-3 w-3 text-slate-500"
                    />
                  </button>
                ))}
              </div>
            )}
            {query.data && query.data.total > 0 && (
              <div className="flex items-center justify-center gap-3 border-t border-slate-100 px-3 py-2.5 text-xs">
                <button
                  aria-label="Página anterior"
                  disabled={query.data.pagina <= 1 || query.isPlaceholderData}
                  onClick={() =>
                    cambiar('pagina', String(query.data!.pagina - 1))
                  }
                  className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-30"
                >
                  ‹
                </button>
                <span>
                  Página {query.data.pagina} de {query.data.paginas}
                </span>
                <button
                  aria-label="Página siguiente"
                  disabled={
                    query.data.pagina >= query.data.paginas ||
                    query.isPlaceholderData
                  }
                  onClick={() =>
                    cambiar('pagina', String(query.data!.pagina + 1))
                  }
                  className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-30"
                >
                  ›
                </button>
              </div>
            )}
          </section>
          {id ? (
            <RrppProyectoDetalle
              key={id}
              id={id}
              params={params}
              setParams={setParams}
            />
          ) : (
            <div className="hidden rounded-lg border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 min-[1200px]:block">
              Selecciona un proyecto para consultar su recorrido.
            </div>
          )}
        </div>
      </div>
    </CrmSidebarLayout>
  );
}
