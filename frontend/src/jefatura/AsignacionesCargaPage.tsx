import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type {
  AsignacionesJefatura,
  EquipoAsignaciones,
  OrdenAsignaciones,
  ProyectoJefatura,
  TabAsignaciones,
} from '../../../shared/jefatura';
import { fetchAsignacionesJefatura } from './commandCenterApi';
import { ErrorJefatura, ExpressBadge } from './JefaturaCards';
import { RrppIcon } from '../rrpp/RrppIcons';
import './asignaciones.css';

const tabs = [
  { id: 'porAsignar', nombre: 'Por asignar', icono: 'ingreso' },
  { id: 'asignados', nombre: 'Asignados', icono: 'persona' },
  { id: 'express', nombre: 'Express', icono: 'rapido' },
  { id: 'enRiesgo', nombre: 'En riesgo', icono: 'riesgo' },
] as const;
const iniciales = (nombre: string) =>
  nombre
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('');

function FilaProyecto({
  p,
  onCompare,
}: {
  p: ProyectoJefatura;
  onCompare: (p: ProyectoJefatura, modo?: 'contexto' | 'candidatos') => void;
}) {
  return (
    <li
      className={`jac-project-row ${p.express.estado === 'confirmado' || p.express.estado === 'posible' ? 'jac-row-priority' : ''}`}
      onClick={() => onCompare(p, 'contexto')}
    >
      <div className="jac-project-identity">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCompare(p, 'contexto'); }}
          className="jac-title"
        >
          {p.titulo || p.autores}
        </button>
        <p className="jac-project-meta">
          #{p.codigo} · {p.autores}
        </p>
        <div className="jac-badges">
          <span
            className={`jac-badge ${p.especialista ? 'jac-badge-assigned' : 'jac-badge-pending'}`}
          >
            {p.especialista ? 'Asignado' : 'Por asignar'}
          </span>
          {(p.express.estado === 'posible' ||
            p.express.estado === 'confirmado') && (
            <ExpressBadge express={p.express} />
          )}
          {p.riesgo.atencion && (
            <span
              className="jac-badge jac-badge-risk"
              title={p.riesgo.causas.join(' · ')}
            >
              En riesgo
            </span>
          )}
          {!p.express.compresionDias && (
            <span className="jac-normal">
              <RrppIcon nombre="calendario" />
              Plazo normal
            </span>
          )}
          {p.express.estado === 'normal_confirmado' && (
            <span className="jac-normal">Prioridad normal confirmada</span>
          )}
        </div>
        {p.express.compresionDias > 0 && (
          <p className="jac-compression">
            <RrppIcon nombre="calendario" />
            Compresión de plazo: −{p.express.compresionDias} días
          </p>
        )}
        {p.asignacionDesincronizada && (
          <p className="jac-sync-note">
            Historial activo y FK difieren; se muestra el responsable del
            historial.
          </p>
        )}
      </div>
      <div className="jac-assignment">
        <p className="jac-service">
          <RrppIcon nombre="libro" />
          {p.servicio.nombre}
        </p>
        <p className="jac-owner">
          <RrppIcon nombre="persona" />
          {p.especialista?.nombre || 'Sin asignar'}
        </p>
        <p className="jac-recommendation">
          {p.recomendacion ? (
            <>
              {p.especialista ? 'Alternativa recomendada' : 'Recomendado'}:{' '}
              <strong>{p.recomendacion.nombre}</strong>
            </>
          ) : (
            'No hay recomendación automática'
          )}
        </p>
      </div>
      <div
        className="jac-impact"
        title="Peso del proyecto al asignarlo a otro especialista; el responsable actual ya lo tiene incluido."
      >
        <p>
          <RrppIcon nombre="capas" />
          <strong>+{p.impactoCarga} pts</strong>
        </p>
        <span>Impacto en carga</span>
      </div>
      <div className="jac-row-actions">
        <button
          className="jf-button jf-button-secondary"
          onClick={(e) => { e.stopPropagation(); onCompare(p, 'candidatos'); }}
        >
          <RrppIcon nombre="comparar" />
          Comparar
        </button>
        <button
          className={`jf-button ${p.especialista ? 'jac-reassign' : ''}`}
          onClick={(e) => { e.stopPropagation(); onCompare(p, 'contexto'); }}
          disabled={!p.entregadoJefatura}
          title={
            !p.entregadoJefatura
              ? 'Requiere envío formal desde RRPP'
              : undefined
          }
        >
          <RrppIcon nombre={p.especialista ? 'reasignar' : 'persona'} />
          {p.especialista ? 'Reasignar' : 'Asignar'}
        </button>
      </div>
    </li>
  );
}

function CapacidadEquipo({
  equipo,
  seleccionar,
  seleccionado,
}: {
  equipo: EquipoAsignaciones[];
  seleccionar: (id: string) => void;
  seleccionado: string;
}) {
  const persona = equipo.find((c) => c.id === seleccionado);
  return (
    <section
      className="jac-card jac-capacity"
      aria-label="Capacidad del equipo"
    >
      <div className="jac-card-heading">
        <div>
          <h2>
            <RrppIcon nombre="equipo" />
            Capacidad del equipo
          </h2>
          <p>Carga ponderada actual del equipo</p>
        </div>
        <span className="jac-count">{equipo.length} especialistas</span>
      </div>
      {!equipo.length ? (
        <p className="jac-empty">
          No hay Especialistas disponibles para asignación.
        </p>
      ) : (
        <ul>
          {equipo.map((c) => (
            <li
              key={c.id}
              className={c.id === seleccionado ? 'jac-person-selected' : ''}
            >
              <span className="jac-avatar">{iniciales(c.nombre)}</span>
              <div className="jac-person-detail">
                <div className="jac-person-top">
                  <strong>{c.nombre}</strong>
                  <span>
                    <b>{c.carga}</b> pts
                  </span>
                </div>
                <p>
                  {c.activos} {c.activos === 1 ? 'activo' : 'activos'} ·{' '}
                  {c.express} Express · {c.enRiesgo} en riesgo
                </p>
                <div className="jac-person-bottom">
                  <div
                    className="jac-load-track"
                    role="img"
                    aria-label={`${c.nombre}: ${c.carga} puntos; barra relativa al mayor valor del equipo`}
                  >
                    <span style={{ width: `${c.barraRelativa}%` }} />
                  </div>
                  <button onClick={() => seleccionar(c.id)}>
                    Ver carga <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="jac-bar-note">
        Barras relativas al mayor valor del equipo; no representan capacidad
        máxima.
      </p>
      {persona && (
        <div className="jac-composition-detail">
          <h3>Composición de {persona.nombre}</h3>
          <p>
            {persona.carga} puntos · {persona.activos} proyectos activos
          </p>
          <ul>
            {persona.servicios.map((s) => (
              <li key={s.codigo}>
                <span>{s.nombre}</span>
                <strong>
                  {s.cantidad} · {s.carga} pts
                </strong>
              </li>
            ))}
          </ul>
          {!persona.servicios.length && <p>Sin proyectos activos asignados.</p>}
        </div>
      )}
    </section>
  );
}

export function AsignacionesCargaPage({
  onCompare,
}: {
  onCompare: (p: ProyectoJefatura, modo?: 'contexto' | 'candidatos') => void;
}) {
  const [params, setParams] = useSearchParams();
  const paramsRef = useRef(params);
  paramsRef.current = params;
  function guardar(key: string, value: string) {
    const next = new URLSearchParams(paramsRef.current);
    if (value) next.set(key, value); else next.delete(key);
    paramsRef.current = next;
    setParams(next, { replace: true });
  }
  const tab = (tabs.some(t => t.id === params.get('jacTab')) ? params.get('jacTab') : 'porAsignar') as TabAsignaciones;
  const setTab = (v: TabAsignaciones) => guardar('jacTab', v);
  const q = params.get('jacQ') ?? '';
  const setQ = (v: string) => guardar('jacQ', v);
  const [busqueda, setBusqueda] = useState(q);
  const servicioId = params.get('jacServicio') ?? '';
  const setServicio = (v: string) => guardar('jacServicio', v);
  const especialistaId = params.get('jacEspecialista') ?? '';
  const setEspecialista = (v: string) => guardar('jacEspecialista', v);
  const orden = (['urgentes','recientes','mayorImpacto','menorImpacto'].includes(params.get('jacOrden') ?? '') ? params.get('jacOrden') : 'urgentes') as OrdenAsignaciones;
  const setOrden = (v: OrdenAsignaciones) => guardar('jacOrden', v);
  const page = Math.max(1, Number(params.get('jacPagina')) || 1);
  const setPage = (v: number) => guardar('jacPagina', String(v));
  const [opciones, setOpciones] = useState<
    Pick<AsignacionesJefatura, 'servicios' | 'especialistas'>
  >({ servicios: [], especialistas: [] });
  useEffect(() => {
    const timer = setTimeout(() => {
      setParams(previous => { const next = new URLSearchParams(previous); if (busqueda.trim() !== (previous.get('jacQ') ?? '')) { next.set('jacQ', busqueda.trim()); next.set('jacPagina', '1'); } return next; }, { replace: true });
    }, 250);
    return () => clearTimeout(timer);
  }, [busqueda, setParams]);
  const filtros = {
    tab,
    q,
    servicioId: servicioId || undefined,
    especialistaId: especialistaId || undefined,
    orden,
    page,
    pageSize: 20,
  };
  const query = useQuery({
    queryKey: ['jefatura', 'asignaciones', filtros],
    queryFn: () => fetchAsignacionesJefatura(filtros),
    staleTime: 0,
    refetchInterval: 60000,
  });
  const data = query.isError ? undefined : query.data;
  useEffect(() => {
    if (query.data)
      setOpciones({
        servicios: query.data.servicios,
        especialistas: query.data.especialistas,
      });
  }, [query.data]);
  const filtrando = !!(q || servicioId || especialistaId);
  function seleccionarPersona(id: string) {
    setEspecialista(id);
    setTab('asignados');
    setPage(1);
  }
  function limpiar() {
    setBusqueda('');
    setQ('');
    setServicio('');
    setEspecialista('');
    setPage(1);
  }
  return (
    <div className="jac-layout">
      <div className="jac-left">
        <header className="jac-header">
          <p className="jf-eyebrow">JEFATURA · OPERACIÓN EDITORIAL</p>
          <h1>Asignaciones y carga</h1>
          <p>
            Compara la carga ponderada, la urgencia y la composición del equipo
            antes de distribuir el trabajo.
          </p>
        </header>
        <div
          className="jac-tabs"
          role="tablist"
          aria-label="Filtros de asignación"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`jac-tab-${t.id}`}
              aria-controls="jac-project-panel"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'jac-tab-active' : ''}
              onClick={() => {
                setTab(t.id);
                setPage(1);
              }}
            >
              <RrppIcon nombre={t.icono} />
              {t.nombre}
              <span>
                {query.isLoading ? '…' : (data?.contadores[t.id] ?? '—')}
              </span>
            </button>
          ))}
        </div>
        <div className="jac-toolbar">
          <label className="jac-search">
            <RrppIcon nombre="buscar" />
            <input
              type="search"
              aria-label="Buscar proyecto, autor o código"
              placeholder="Buscar proyecto, autor o código..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              maxLength={160}
            />
          </label>
          <label className="jac-select">
            Servicio
            <select
              aria-label="Filtrar por servicio"
              value={servicioId}
              onChange={(e) => {
                setServicio(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {(data?.servicios ?? opciones.servicios).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="jac-select">
            Especialista
            <select
              aria-label="Filtrar por especialista"
              value={especialistaId}
              onChange={(e) => {
                setEspecialista(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {(data?.especialistas ?? opciones.especialistas).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="jac-select">
            Orden
            <select
              aria-label="Ordenar proyectos"
              value={orden}
              onChange={(e) => {
                setOrden(e.target.value as OrdenAsignaciones);
                setPage(1);
              }}
            >
              <option value="urgentes">Más urgentes</option>
              <option value="recientes">Más recientes</option>
              <option value="mayorImpacto">Mayor impacto</option>
              <option value="menorImpacto">Menor impacto</option>
            </select>
          </label>
        </div>
        {filtrando && (
          <div className="jac-filter-note">
            <span>
              {data?.total ?? '…'} resultados con los filtros actuales
            </span>
            <button onClick={limpiar}>Limpiar filtros</button>
          </div>
        )}
        {query.isError && (
          <ErrorJefatura
            retry={() => {
              void query.refetch();
            }}
            texto="No pudimos cargar los proyectos y la capacidad. Actualiza los datos para comparar al equipo."
          />
        )}
        <section
          className="jac-card jac-projects"
          id="jac-project-panel"
          role="tabpanel"
          aria-labelledby={`jac-tab-${tab}`}
          aria-busy={query.isFetching}
        >
          <div className="jac-card-heading">
            <h2>
              <RrppIcon nombre="ingreso" />
              Proyectos para distribuir
            </h2>
            <span>
              {data
                ? `${data.total} proyecto${data.total === 1 ? '' : 's'} ${tab === 'porAsignar' ? 'por asignar' : tab === 'asignados' ? (data.total === 1 ? 'asignado' : 'asignados') : tab === 'express' ? 'Express / por revisar' : 'en riesgo'}`
                : query.isError
                  ? 'Proyectos no disponibles'
                  : 'Consultando proyectos'}
            </span>
          </div>
          {query.isLoading ? (
            <div className="jac-skeleton-rows">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="jf-skeleton" />
              ))}
            </div>
          ) : !data ? (
            <p className="jac-empty">
              Los proyectos y las recomendaciones no están disponibles.
            </p>
          ) : !data.proyectos.length ? (
            <div className="jac-empty">
              {filtrando
                ? 'No hay proyectos que coincidan con los filtros.'
                : tab === 'porAsignar'
                  ? 'Todos los proyectos recibidos tienen un Especialista asignado.'
                  : tab === 'asignados'
                    ? 'No hay proyectos asignados en este ámbito.'
                    : tab === 'express'
                      ? 'No hay proyectos Express ni fechas pendientes de revisión.'
                      : 'No hay proyectos que requieran atención.'}
              {!filtrando && tab === 'porAsignar' && (
                <button
                  className="jf-button jf-button-secondary"
                  onClick={() => setTab('asignados')}
                >
                  Ver asignados
                </button>
              )}
            </div>
          ) : (
            <ul className="jac-project-list">
              {data.proyectos.map((p) => (
                <FilaProyecto key={p.id} p={p} onCompare={onCompare} />
              ))}
            </ul>
          )}
          {data && data.total > 0 && (
            <footer className="jac-pagination">
              <span>
                {(data.page - 1) * data.pageSize + 1}–
                {Math.min(data.page * data.pageSize, data.total)} de{' '}
                {data.total} proyectos
              </span>
              <div>
                <button
                  aria-label="Página anterior"
                  disabled={data.page <= 1 || query.isFetching}
                  onClick={() => setPage(data.page - 1)}
                >
                  ←
                </button>
                <span>
                  {data.page} / {data.pages}
                </span>
                <button
                  aria-label="Página siguiente"
                  disabled={data.page >= data.pages || query.isFetching}
                  onClick={() => setPage(data.page + 1)}
                >
                  →
                </button>
              </div>
            </footer>
          )}
        </section>
      </div>
      <aside className="jac-right">
        {query.isLoading ? (
          <section className="jac-card jac-capacity">
            <div className="jac-skeleton-rows">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="jf-skeleton" />
              ))}
            </div>
          </section>
        ) : data ? (
          <CapacidadEquipo
            equipo={data.equipo}
            seleccionar={seleccionarPersona}
            seleccionado={especialistaId}
          />
        ) : (
          <section className="jac-card">
            <div className="jac-card-heading">
              <h2>Capacidad del equipo</h2>
            </div>
            <p className="jac-empty">
              La capacidad y las recomendaciones no están disponibles.
            </p>
          </section>
        )}
        <section className="jac-card jac-criteria">
          <div className="jac-card-heading">
            <RrppIcon nombre="rapido" />
            <div>
              <h2>Criterios de recomendación</h2>
              <p>Se comparan especialistas activos por:</p>
            </div>
          </div>
          <ol>
            <li>Menor carga ponderada actual.</li>
            <li>En empate, menos proyectos en riesgo.</li>
            <li>En empate, menos Express confirmados.</li>
          </ol>
          <p>
            Orden estable por nombre e identificador. La cantidad de proyectos
            aporta contexto; Jefatura decide.
          </p>
        </section>
      </aside>
    </div>
  );
}
