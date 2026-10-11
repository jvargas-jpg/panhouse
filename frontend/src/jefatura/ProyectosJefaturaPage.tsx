import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import type {
  EstadoPortafolio,
  FiltrosProyectosJefatura,
  ProyectoJefatura,
  TabProyectosJefatura,
} from '../../../shared/jefatura';
import {
  ETIQUETAS_ESTADO,
  ETIQUETAS_TAB,
} from '../../../shared/portafolioJefatura';
import { RrppIcon } from '../rrpp/RrppIcons';
import { ErrorJefatura, fechaJefatura } from './JefaturaCards';
import { fetchPortafolio } from './portafolioApi';
import { ProyectoQuickView } from './ProyectoQuickView';
import {
  AvatarProyecto,
  EstadoProyecto,
  PortadaProyecto,
  PrioridadProyecto,
  ServicioProyecto,
} from './PortafolioElements';
import './portafolio.css';

const tabs = Object.keys(ETIQUETAS_TAB) as TabProyectosJefatura[];
const iconos = [
  'proyectos',
  'persona',
  'capas',
  'riesgo',
  'rapido',
  'check',
] as const;
const vacios: Record<TabProyectosJefatura, string> = {
  todos: 'No hay proyectos disponibles.',
  porAsignar: 'No hay proyectos pendientes de asignación.',
  enProduccion: 'No hay proyectos en producción para este filtro.',
  enRiesgo: 'No hay proyectos críticos en este momento.',
  express: 'No hay proyectos Express activos.',
  completados: 'No hay proyectos completados para este filtro.',
};
export function ProyectosJefaturaPage() {
  const [params, setParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState(params.get('q') ?? '');
  const [menu, setMenu] = useState<string | null>(null);
  const lastSelected = useRef<HTMLElement | null>(null);
  const tab = tabs.includes(params.get('grupo') as TabProyectosJefatura)
    ? (params.get('grupo') as TabProyectosJefatura)
    : 'todos';
  const estadoParam = params.get('estado');
  const ordenParam = params.get('orden');
  const f: FiltrosProyectosJefatura = {
    tab,
    q: (params.get('q') ?? '').slice(0, 160),
    servicioId: params.get('servicio') || undefined,
    especialistaId: params.get('especialista') || undefined,
    estado:
      estadoParam && estadoParam in ETIQUETAS_ESTADO
        ? (estadoParam as EstadoPortafolio)
        : undefined,
    orden: ['urgentes', 'recientes', 'fecha', 'autor'].includes(
      ordenParam ?? '',
    )
      ? (ordenParam as FiltrosProyectosJefatura['orden'])
      : 'urgentes',
    page: Math.max(1, Math.min(100000, Number(params.get('pagina')) || 1)),
    pageSize: 10,
  };
  const seleccionado = params.get('proyecto');
  const query = useQuery({
    queryKey: ['jefatura', 'portafolio', f],
    queryFn: () => fetchPortafolio(f),
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 30000,
  });
  useEffect(() => {
    setBusqueda(params.get('q') ?? '');
  }, [params.get('q')]);
  useEffect(() => {
    if (busqueda.trim() === f.q) return;
    const timer = setTimeout(
      () =>
        setParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            if (busqueda.trim()) next.set('q', busqueda.trim());
            else next.delete('q');
            next.delete('pagina');
            return next;
          },
          { replace: true },
        ),
      300,
    );
    return () => clearTimeout(timer);
  }, [busqueda, f.q, setParams]);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener('click', close);
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', esc);
    };
  }, [menu]);
  function cambiar(key: string, value: string) {
    setMenu(null);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'pagina' && key !== 'proyecto') next.delete('pagina');
      return next;
    });
  }
  function seleccionar(p: ProyectoJefatura, trigger?: HTMLElement | null) {
    lastSelected.current = trigger ?? null;
    cambiar('proyecto', p.id);
  }
  function cerrar() {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('proyecto');
      next.delete('detalle');
      return next;
    });
    lastSelected.current?.focus();
  }
  const data = query.data;
  const retorno = `/?${params}`;
  const href = (p: ProyectoJefatura, ficha = false) =>
    `/proyectos/${p.id}${ficha ? '/ficha-trazabilidad' : ''}?volver=${encodeURIComponent(retorno)}`;
  return (
    <div className={`jp-explorer ${seleccionado ? 'jp-has-selection' : ''}`}>
      <div className="jp-list-column">
        <div className="jp-summary" aria-label="Resumen del portafolio">
          {tabs.map((t, i) => (
            <button
              key={t}
              className={`jp-stat jp-stat-${t}`}
              onClick={() => cambiar('grupo', t)}
              aria-pressed={tab === t}
            >
              <span className="jp-stat-icon">
                <RrppIcon nombre={iconos[i]} />
              </span>
              <span>
                {t === 'todos' ? 'Total' : ETIQUETAS_TAB[t]}
                <strong>
                  {data ? data.counts[t] : <i className="jp-skeleton" />}
                </strong>
              </span>
            </button>
          ))}
        </div>
        <div className="jp-group-tabs" aria-label="Filtrar proyectos">
          {tabs.map((t) => (
            <button
              key={t}
              aria-pressed={tab === t}
              onClick={() => cambiar('grupo', t)}
              className={tab === t ? 'active' : ''}
            >
              {ETIQUETAS_TAB[t]}
              <span>{data?.tabCounts?.[t] ?? data?.counts[t] ?? '—'}</span>
            </button>
          ))}
        </div>
        <div className="jp-filters">
          <label className="jp-search">
            <RrppIcon nombre="buscar" className="h-4 w-4" />
            <input
              aria-label="Buscar proyectos"
              maxLength={160}
              placeholder="Buscar por autor, título o código..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </label>
          <select
            aria-label="Servicio"
            value={f.servicioId ?? ''}
            onChange={(e) => cambiar('servicio', e.target.value)}
          >
            <option value="">Servicio</option>
            {data?.filters.servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
          <select
            aria-label="Estado"
            value={f.estado ?? ''}
            onChange={(e) => cambiar('estado', e.target.value)}
          >
            <option value="">Estado</option>
            {Object.entries(ETIQUETAS_ESTADO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            aria-label="Especialista"
            value={f.especialistaId ?? ''}
            onChange={(e) => cambiar('especialista', e.target.value)}
          >
            <option value="">Especialista</option>
            <option value="sinAsignar">Sin asignar</option>
            {data?.filters.especialistas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
          <select
            aria-label="Ordenar proyectos"
            value={f.orden}
            onChange={(e) => cambiar('orden', e.target.value)}
          >
            <option value="urgentes">Más urgentes</option>
            <option value="recientes">Más recientes</option>
            <option value="fecha">Fecha objetivo próxima</option>
            <option value="autor">Autor A–Z</option>
          </select>
          <button
            className="jp-clear"
            onClick={() => {
              setBusqueda('');
              setParams((prev) => {
                const next = new URLSearchParams(prev);
                [
                  'q',
                  'servicio',
                  'estado',
                  'especialista',
                  'orden',
                  'pagina',
                  'grupo',
                ].forEach((k) => next.delete(k));
                return next;
              });
            }}
          >
            Limpiar
          </button>
        </div>
        {query.isError && (
          <ErrorJefatura
            texto="No pudimos cargar los proyectos."
            retry={() => void query.refetch()}
          />
        )}
        <div className="jp-list-surface" aria-busy={query.isFetching}>
          {query.isLoading ? (
            <div className="jp-row-skeletons">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="jp-skeleton" />
              ))}
            </div>
          ) : !data?.items.length ? (
            <div className="jp-empty">
              <RrppIcon nombre="libro" className="h-9 w-9" />
              <h2>{vacios[tab]}</h2>
              <p>
                {f.q || f.estado || f.servicioId || f.especialistaId
                  ? 'Prueba con otros filtros o limpia la búsqueda.'
                  : 'Los proyectos aparecerán aquí al llegar a Producción.'}
              </p>
            </div>
          ) : (
            <>
              <table className="jp-table">
                <thead>
                  <tr>
                    {[
                      'Proyecto / autor',
                      'Código',
                      'Servicio',
                      'Estado',
                      'Especialista',
                      'Fecha objetivo',
                      'Prioridad',
                      '',
                    ].map((h, i) => (
                      <th key={i} scope="col">
                        {h || <span className="sr-only">Acciones</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p) => (
                    <tr
                      key={p.id}
                      className={seleccionado === p.id ? 'selected' : ''}
                      onClick={(e) =>
                        seleccionar(p, e.currentTarget.querySelector('button'))
                      }
                    >
                      <td>
                        <div className="jp-project">
                          <PortadaProyecto p={p} />
                          <div>
                            <button
                              className="jp-project-title"
                              aria-pressed={seleccionado === p.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                seleccionar(p, e.currentTarget);
                              }}
                            >
                              {p.titulo ?? p.autores}
                            </button>
                            <span title={p.autores}>
                              {p.titulo ? p.autores : 'Título por definir'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="jp-code">#{p.codigo}</td>
                      <td>
                        <ServicioProyecto p={p} />
                      </td>
                      <td>
                        <EstadoProyecto p={p} />
                      </td>
                      <td>
                        <div className="jp-specialist">
                          {p.especialista ? (
                            <>
                              <AvatarProyecto nombre={p.especialista.nombre} />
                              <span title={p.especialista.nombre}>
                                {p.especialista.nombre}
                              </span>
                            </>
                          ) : (
                            <span className="jp-muted">—</span>
                          )}
                        </div>
                      </td>
                      <td className="jp-date">
                        {fechaJefatura(p.fechaObjetivo ?? null)}
                      </td>
                      <td>
                        <PrioridadProyecto p={p} />
                      </td>
                      <td className="jp-menu-cell">
                        <button
                          className="jp-menu-trigger"
                          aria-label={`Acciones del proyecto ${p.codigo}`}
                          aria-expanded={menu === p.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenu(menu === p.id ? null : p.id);
                          }}
                        >
                          ⋮
                        </button>
                        {menu === p.id && (
                          <div
                            className="jp-row-menu"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link to={href(p)}>Abrir proyecto 360°</Link>
                            <Link to={href(p, true)}>Ver ficha completa</Link>
                            {p.porAsignar && (
                              <Link
                                to={`/?vista=asignaciones&proyecto=${p.id}&decision=candidatos`}
                              >
                                Ir a asignaciones
                              </Link>
                            )}
                            {p.especialista && p.estado !== 'culminado' && (
                              <Link to={`/?vista=seguimiento&proyecto=${p.id}`}>
                                Ver seguimiento
                              </Link>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="jp-mobile-list">
                {data.items.map((p) => (
                  <button
                    key={p.id}
                    className="jp-mobile-project"
                    onClick={(e) => seleccionar(p, e.currentTarget)}
                    aria-pressed={seleccionado === p.id}
                  >
                    <div className="jp-project">
                      <PortadaProyecto p={p} />
                      <div>
                        <strong>{p.titulo ?? p.autores}</strong>
                        <span>
                          {p.titulo ? p.autores : 'Título por definir'} · #
                          {p.codigo}
                        </span>
                      </div>
                    </div>
                    <div className="jp-mobile-badges">
                      <ServicioProyecto p={p} />
                      <EstadoProyecto p={p} />
                      <PrioridadProyecto p={p} />
                    </div>
                    <div className="jp-mobile-bottom">
                      <span>{p.especialista?.nombre ?? 'Sin asignar'}</span>
                      <span>{fechaJefatura(p.fechaObjetivo ?? null)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
          {data && (
            <footer className="jp-pagination">
              <span>
                {data.pagination.total
                  ? `Mostrando ${(data.pagination.page - 1) * data.pagination.pageSize + 1}–${Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total)} de ${data.pagination.total} proyectos`
                  : '0 proyectos'}
              </span>
              <div>
                <button
                  disabled={data.pagination.page === 1 || query.isFetching}
                  onClick={() =>
                    cambiar('pagina', String(data.pagination.page - 1))
                  }
                >
                  Anterior
                </button>
                {Array.from(
                  { length: Math.min(3, data.pagination.pages) },
                  (_, i) =>
                    Math.max(
                      1,
                      Math.min(
                        data.pagination.page - 1,
                        data.pagination.pages - 2,
                      ),
                    ) + i,
                ).map((n) => (
                  <button
                    key={n}
                    className={n === data.pagination.page ? 'active' : ''}
                    aria-current={
                      n === data.pagination.page ? 'page' : undefined
                    }
                    disabled={query.isFetching}
                    onClick={() => cambiar('pagina', String(n))}
                  >
                    {n}
                  </button>
                ))}
                <button
                  disabled={
                    data.pagination.page === data.pagination.pages ||
                    query.isFetching
                  }
                  onClick={() =>
                    cambiar('pagina', String(data.pagination.page + 1))
                  }
                >
                  Siguiente
                </button>
              </div>
            </footer>
          )}
        </div>
      </div>
      {seleccionado ? (
        <ProyectoQuickView
          key={seleccionado}
          id={seleccionado}
          onClose={cerrar}
        />
      ) : (
        <aside className="jp-quick-empty">
          <span className="jp-empty-book">
            <RrppIcon nombre="libro" className="h-8 w-8" />
          </span>
          <h2>Una mirada al proyecto</h2>
          <p>
            Selecciona un proyecto para consultar su estado, equipo y próximos
            hitos.
          </p>
          <span>Explora el portafolio sin salir de esta vista.</span>
        </aside>
      )}
    </div>
  );
}
