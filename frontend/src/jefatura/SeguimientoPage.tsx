import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import type { ProyectoJefatura } from '../../../shared/jefatura';
import {
  MATERIALES_SEGUIMIENTO,
  PROCESOS_SEGUIMIENTO,
  RESULTADOS_SEGUIMIENTO,
  type FiltrosIntervenciones,
  type FiltrosSeguimientoGeneral,
  type IntervencionSeguimiento,
  type OrigenIntervencion,
} from '../../../shared/seguimientoOperativo';
import {
  fetchGeneralSeguimiento,
  fetchIntervenciones,
} from './seguimientoOperativoApi';
import {
  BusquedaSeguimiento,
  ErrorSeguimiento,
  EstadoIntervencionBadge,
  fechaSeguimiento,
  PaginacionSeguimiento,
  SelectSeguimiento,
  SlaBadge,
  StatsSeguimiento,
} from './SeguimientoElements';
import { GeneralSeguimientoDrawer } from './GeneralSeguimientoDrawer';
import { IntervencionDrawer } from './IntervencionDrawer';
import {
  EstadoProyecto,
  PortadaProyecto,
  PrioridadProyecto,
} from './PortafolioElements';
import './portafolio.css';
import './seguimiento.css';
const opciones = (v: Record<string, string>) =>
  Object.entries(v).map(([id, nombre]) => ({ id, nombre }));
const grupos = {
  todas: 'Todas',
  pendientes: 'Pendientes',
  en_progreso: 'En proceso',
  vencidas: 'Vencidas',
  entregadas: 'Entregadas',
};
function nextDue(p: ProyectoJefatura) {
  return (
    p.procesos
      .map((r) => r.vence)
      .filter((v): v is string => !!v)
      .sort()[0] ?? null
  );
}
function ProyectoCell({
  p,
}: {
  p: {
    titulo: string | null;
    autores: string;
    codigo: string;
    portadaUrl?: string | null;
    servicio?: unknown;
  };
}) {
  return (
    <div className="js-project">
      {typeof p.servicio === 'object' && p.servicio !== null ? (
        <PortadaProyecto p={p as ProyectoJefatura} />
      ) : (
        <span className="js-book-placeholder" aria-hidden="true">
          ▤
        </span>
      )}
      <div>
        <strong>{p.titulo ?? p.autores}</strong>
        <span>
          {p.autores} <small>#{p.codigo}</small>
        </span>
      </div>
    </div>
  );
}
function IntervencionRow({
  d,
  onSelect,
}: {
  d: IntervencionSeguimiento;
  onSelect: () => void;
}) {
  return (
    <tr>
      <td>
        <button className="js-project-button" onClick={onSelect}>
          <ProyectoCell p={d.proyecto} />
        </button>
      </td>
      <td>
        {MATERIALES_SEGUIMIENTO[d.material]}
        {d.origen === 'legacy' && <small>Registro anterior</small>}
      </td>
      <td>
        <strong>{PROCESOS_SEGUIMIENTO[d.proceso]}</strong>
        <small>
          {d.ronda === null ? 'Ronda sin registro' : `Ronda ${d.ronda}`}
          {d.faseNumero ? ` · Fase ${d.faseNumero}` : ''}
        </small>
      </td>
      <td title={d.analista?.nombre}>
        {d.analista?.tipo === 'bandeja'
          ? 'Bandeja de Soporte'
          : (d.analista?.nombre ?? 'Sin asignar')}
        {d.freelance && <small className="js-gold-text">Freelance</small>}
      </td>
      <td>{d.especialista?.nombre ?? 'Sin asignar'}</td>
      <td>
        <span>
          {d.tiempos.iniciado
            ? fechaSeguimiento(d.tiempos.iniciado, false)
            : d.tiempos.fechaInicio
              ? fechaSeguimiento(d.tiempos.fechaInicio, false)
              : 'Por iniciar'}
        </span>
        <small>
          {d.tiempos.vence
            ? `Vence ${fechaSeguimiento(d.tiempos.vence, false)}`
            : 'Sin fecha límite'}
        </small>
      </td>
      <td>
        <EstadoIntervencionBadge estado={d.estado} />
      </td>
      <td>
        <SlaBadge sla={d.sla} />
      </td>
      <td>
        {d.alertas.length ? (
          <span className="js-alert-count" title={d.alertas.join(' · ')}>
            {d.alertas.length} {d.alertas.length === 1 ? 'alerta' : 'alertas'}
          </span>
        ) : (
          <span className="js-muted">—</span>
        )}
      </td>
      <td>
        <button
          className="js-more"
          aria-label={`Abrir intervención ${d.proyecto.titulo ?? d.proyecto.autores}, ${PROCESOS_SEGUIMIENTO[d.proceso]}, ${d.ronda === null ? 'ronda sin registro' : `ronda ${d.ronda}`}`}
          onClick={onSelect}
        >
          ⋮
        </button>
      </td>
    </tr>
  );
}
export function SeguimientoPage() {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const mode = params.get('modo') === 'correccion' ? 'correccion' : 'general';
  const get = (k: string) => params.get(k) || undefined;
  const page = Math.max(1, Number(get('page')) || 1);
  const pageSize = [10, 20, 50].includes(Number(get('size')))
    ? Number(get('size'))
    : 10;
  const change = useCallback(
    (key: string, value: string, reset = true) =>
      setParams((prev) => {
        const n = new URLSearchParams(prev);
        value ? n.set(key, value) : n.delete(key);
        if (reset) {
          n.delete('page');
          n.delete('detalle');
          n.delete('intervencion');
        }
        return n;
      }),
    [setParams],
  );
  const search = useCallback((v: string) => change('q', v), [change]);
  const switchMode = (m: string, project?: string) =>
    setParams((prev) => {
      const n = new URLSearchParams({ vista: 'seguimiento', modo: m });
      for (const k of ['q', 'especialista', 'proyecto']) {
        const v = prev.get(k);
        if (v) n.set(k, v);
      }
      if (project) n.set('proyecto', project);
      return n;
    });
  const f: FiltrosSeguimientoGeneral = {
    q: get('q') ?? '',
    proceso: get('proceso'),
    especialistaId: get('especialista'),
    proyectoId: get('proyecto'),
    estado: get('estado') as FiltrosSeguimientoGeneral['estado'],
    riesgo: get('riesgo') as FiltrosSeguimientoGeneral['riesgo'],
    orden: (get('orden') ?? 'urgentes') as FiltrosSeguimientoGeneral['orden'],
    page,
    pageSize,
  };
  const fi: FiltrosIntervenciones = {
    q: f.q,
    grupo: (get('grupo') ?? 'todas') as FiltrosIntervenciones['grupo'],
    proceso: get('proceso') as FiltrosIntervenciones['proceso'],
    material: get('material') as FiltrosIntervenciones['material'],
    analistaId: get('analista'),
    especialistaId: f.especialistaId,
    proyectoId: f.proyectoId,
    freelance: get('freelance') as FiltrosIntervenciones['freelance'],
    resultado: get('resultado') as FiltrosIntervenciones['resultado'],
    origen: get('origen') as FiltrosIntervenciones['origen'],
    from: get('from'),
    to: get('to'),
    orden: f.orden,
    page,
    pageSize,
  };
  const general = useQuery({
    queryKey: ['seguimiento', 'general', f],
    queryFn: () => fetchGeneralSeguimiento(f),
    enabled: mode === 'general',
    refetchInterval: 30000,
  });
  const interv = useQuery({
    queryKey: ['seguimiento', 'intervenciones', fi],
    queryFn: () => fetchIntervenciones(fi),
    enabled: mode === 'correccion',
    refetchInterval: 30000,
  });
  const query = mode === 'general' ? general : interv;
  const data = query.data;
  const catalog =
    mode === 'general' ? general.data?.filters : interv.data?.filters;
  const selection = params.get('intervencion')?.split(':');
  const selectedSource = selection?.[0] as OrigenIntervencion | undefined,
    selectedId = selection?.[1];
  const close = useCallback(
    () =>
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete('detalle');
          n.delete('intervencion');
          return n;
        },
        { replace: true },
      ),
    [setParams],
  );
  const volver = `/?${params}`;
  const select = (d: IntervencionSeguimiento) =>
    change('intervencion', `${d.origen}:${d.id}`, false);
  const clear = () => setParams({ vista: 'seguimiento', modo: mode });
  const activeFilters = [
    'q',
    'proyecto',
    'proceso',
    'especialista',
    'material',
    'analista',
    'freelance',
    'resultado',
    'origen',
    'from',
    'to',
    'estado',
    'riesgo',
  ].filter((k) => params.has(k)).length;
  return (
    <div className="js-workspace">
      <div
        className="js-mode-switch"
        role="group"
        aria-label="Modo de Seguimiento"
      >
        <button
          aria-pressed={mode === 'general'}
          onClick={() => switchMode('general')}
        >
          Vista general
        </button>
        <button
          aria-pressed={mode === 'correccion'}
          onClick={() => switchMode('correccion')}
        >
          Corrección y Calidad
        </button>
        <p>
          {mode === 'general'
            ? 'Proyectos, procesos paralelos y prioridades'
            : 'Intervenciones reales, tiempos y supervisión de calidad'}
        </p>
      </div>
      {mode === 'general' ? (
        <StatsSeguimiento
          items={[
            {
              label: 'En seguimiento',
              value: general.data?.counts.seguimiento,
            },
            {
              label: 'En riesgo',
              value: general.data?.counts.riesgo,
              tone: 'js-red',
            },
            {
              label: 'Bloqueados',
              value: general.data?.counts.bloqueados,
              tone: 'js-red',
            },
            {
              label: 'Próximos a vencer',
              value: general.data?.counts.proximos,
              tone: 'js-amber',
            },
            {
              label: 'Express',
              value: general.data?.counts.express,
              tone: 'js-amber',
            },
          ]}
        />
      ) : (
        <StatsSeguimiento
          items={[
            {
              label: 'Intervenciones activas',
              value: interv.data?.counts.activas,
            },
            { label: 'Por iniciar', value: interv.data?.counts.porIniciar },
            {
              label: 'Vencidas',
              value: interv.data?.counts.vencidas,
              tone: 'js-red',
            },
            {
              label: 'Entregadas hoy',
              value: interv.data?.counts.entregadasHoy,
            },
            {
              label: 'Freelance pendientes',
              value: interv.data?.counts.freelancePendientes,
              tone: 'js-amber',
            },
          ]}
        />
      )}
      <p className="js-count-context">
        {mode === 'general'
          ? 'Conteos de la cartera activa de Jefatura.'
          : 'Conteos del periodo y filtros seleccionados, antes de aplicar el grupo.'}
      </p>
      {mode === 'correccion' && (
        <nav className="js-groups" aria-label="Grupos de intervenciones">
          {Object.entries(grupos).map(([k, v]) => (
            <button
              key={k}
              aria-pressed={fi.grupo === k}
              onClick={() => change('grupo', k)}
            >
              {v}
              <span>
                {interv.data?.grupos[k as keyof typeof grupos] ?? '—'}
              </span>
            </button>
          ))}
        </nav>
      )}
      <div
        className={`js-filters ${filtersOpen ? '' : 'js-filters-collapsed'}`}
      >
        <BusquedaSeguimiento value={f.q} onChange={search} />
        <button
          className="js-toggle-filters"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((v) => !v)}
        >
          Filtros{activeFilters ? ` (${activeFilters})` : ''}
        </button>
        <SelectSeguimiento
          label="Proceso"
          value={get('proceso') ?? ''}
          onChange={(v) => change('proceso', v)}
          options={
            mode === 'general'
              ? (general.data?.filters.procesos ?? [])
              : opciones(PROCESOS_SEGUIMIENTO)
          }
        />
        <SelectSeguimiento
          label="Especialista"
          value={get('especialista') ?? ''}
          onChange={(v) => change('especialista', v)}
          options={[
            { id: 'sin_asignar', nombre: 'Sin asignar' },
            ...(catalog?.especialistas ?? []),
          ]}
        />
        {mode === 'general' ? (
          <>
            <SelectSeguimiento
              label="Estado"
              value={get('estado') ?? ''}
              onChange={(v) => change('estado', v)}
              options={opciones({
                en_proceso: 'En producción',
                retrasado: 'Retrasado',
                pausado: 'Pausado',
                stand_by: 'Stand-by',
              })}
            />
            <SelectSeguimiento
              label="Atención"
              value={get('riesgo') ?? ''}
              onChange={(v) => change('riesgo', v)}
              options={opciones({
                riesgo: 'En riesgo',
                bloqueados: 'Bloqueados',
                proximos: 'Próximos a vencer',
                express: 'Express confirmado',
              })}
            />
          </>
        ) : (
          <>
            <SelectSeguimiento
              label="Material"
              value={get('material') ?? ''}
              onChange={(v) => change('material', v)}
              options={opciones(MATERIALES_SEGUIMIENTO)}
            />
            <SelectSeguimiento
              label="Analista"
              value={get('analista') ?? ''}
              onChange={(v) => change('analista', v)}
              options={[
                { id: 'sin_asignar', nombre: 'Sin usuario asignado' },
                ...(interv.data?.filters.analistas ?? []),
              ]}
            />
            <SelectSeguimiento
              label="Freelance"
              value={get('freelance') ?? ''}
              onChange={(v) => change('freelance', v)}
              options={opciones({ si: 'Freelance', no: 'Equipo interno' })}
            />
            <SelectSeguimiento
              label="Resultado"
              value={get('resultado') ?? ''}
              onChange={(v) => change('resultado', v)}
              options={[
                ...opciones(RESULTADOS_SEGUIMIENTO),
                { id: 'sin_evaluar', nombre: 'A espera de evaluación' },
              ]}
            />
            <SelectSeguimiento
              label="Origen"
              value={get('origen') ?? ''}
              onChange={(v) => change('origen', v)}
              options={opciones({
                correccion: 'Corrección',
                calidad: 'Calidad',
                legacy: 'Registros anteriores',
              })}
            />
            <label className="js-date">
              Desde
              <input
                aria-label="Periodo desde"
                type="date"
                value={get('from') ?? ''}
                onChange={(e) => change('from', e.target.value)}
              />
            </label>
            <label className="js-date">
              Hasta
              <input
                aria-label="Periodo hasta"
                type="date"
                value={get('to') ?? ''}
                onChange={(e) => change('to', e.target.value)}
              />
            </label>
          </>
        )}
        <SelectSeguimiento
          label="Orden"
          value={get('orden') ?? 'urgentes'}
          onChange={(v) => change('orden', v)}
          options={opciones({
            urgentes: 'Mayor urgencia',
            vencimiento: 'Próximo vencimiento',
            recientes: 'Más recientes',
          })}
        />
        <button className="js-clear" onClick={clear} disabled={!activeFilters}>
          Limpiar{activeFilters ? ` (${activeFilters})` : ''}
        </button>
      </div>
      {f.proyectoId && (
        <div className="js-context-filter">
          <span>Seguimiento del proyecto seleccionado</span>
          <Link to={`/?vista=proyectos&proyecto=${f.proyectoId}`}>
            Ver en Proyectos
          </Link>
          <button onClick={() => change('proyecto', '')}>Ver todos</button>
        </div>
      )}
      {query.isError && (
        <ErrorSeguimiento
          error={query.error}
          retry={() => void query.refetch()}
        />
      )}
      {query.isLoading && (
        <div className="js-loading" role="status">
          Cargando seguimiento…
        </div>
      )}
      {data && (
        <section
          className="js-list"
          aria-label={
            mode === 'general'
              ? 'Proyectos en seguimiento'
              : 'Intervenciones de corrección y calidad'
          }
        >
          <div className="js-list-heading">
            <h2>
              {mode === 'general' ? 'Supervisión operativa' : 'Intervenciones'}
            </h2>
            <span>
              {data.pagination.total}{' '}
              {mode === 'general' ? 'proyectos' : 'intervenciones'}
              {query.isFetching ? ' · Actualizando…' : ''}
            </span>
          </div>
          {!data.items.length ? (
            <div className="js-empty">
              <h3>
                {activeFilters
                  ? 'No hay resultados con estos filtros'
                  : 'Sin registros disponibles'}
              </h3>
              <p>
                {mode === 'general'
                  ? 'Los proyectos entregados a Jefatura aparecen aquí con sus procesos actuales.'
                  : 'Las solicitudes reales de Corrección y Calidad aparecen automáticamente; los registros anteriores se identifican por su origen.'}
              </p>
              {activeFilters > 0 && (
                <button className="js-secondary" onClick={clear}>
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="js-desktop-table">
                <table
                  className={`js-table ${mode === 'correccion' ? 'js-interv-table' : ''}`}
                >
                  <thead>
                    <tr>
                      {(mode === 'general'
                        ? [
                            'Proyecto / autor',
                            'Especialista',
                            'Procesos abiertos',
                            'Próximo vencimiento',
                            'Estado',
                            'Alertas',
                            '',
                          ]
                        : [
                            'Proyecto / autor',
                            'Material',
                            'Proceso',
                            'Analista',
                            'Especialista',
                            'Inicio / vencimiento',
                            'Estado',
                            'SLA',
                            'Alertas',
                            '',
                          ]
                      ).map((h, i) => (
                        <th key={i}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mode === 'general'
                      ? general.data?.items.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <button
                                className="js-project-button"
                                onClick={() => change('detalle', p.id, false)}
                              >
                                <ProyectoCell p={p} />
                              </button>
                            </td>
                            <td>{p.especialista?.nombre ?? 'Sin asignar'}</td>
                            <td>
                              <div className="js-process-tags">
                                {p.procesos.length ? (
                                  p.procesos.map((r) => (
                                    <span
                                      key={r.id}
                                      className={`js-badge ${r.estado === 'bloqueado' ? 'js-state-bloqueado' : ''}`}
                                    >
                                      {r.nombre}
                                    </span>
                                  ))
                                ) : (
                                  <span className="js-muted">
                                    Sin procesos abiertos
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              {nextDue(p)
                                ? fechaSeguimiento(nextDue(p), false)
                                : 'Sin fecha pautada'}
                            </td>
                            <td>
                              <EstadoProyecto p={p} />
                            </td>
                            <td>
                              <PrioridadProyecto p={p} />
                              {p.riesgo.atencion && (
                                <span
                                  className="js-alert-count"
                                  title={p.riesgo.causas.join(' · ')}
                                >
                                  {p.riesgo.causas.length} alertas
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                className="js-more"
                                aria-label={`Abrir seguimiento de ${p.titulo ?? p.autores}`}
                                onClick={() => change('detalle', p.id, false)}
                              >
                                ⋮
                              </button>
                            </td>
                          </tr>
                        ))
                      : interv.data?.items.map((d) => (
                          <IntervencionRow
                            key={`${d.origen}:${d.id}`}
                            d={d}
                            onSelect={() => select(d)}
                          />
                        ))}
                  </tbody>
                </table>
              </div>
              <div className="js-mobile-list">
                {mode === 'general'
                  ? general.data?.items.map((p) => (
                      <button
                        className="js-mobile-card"
                        key={p.id}
                        onClick={() => change('detalle', p.id, false)}
                      >
                        <ProyectoCell p={p} />
                        <div>
                          <EstadoProyecto p={p} />
                          <PrioridadProyecto p={p} />
                        </div>
                        <p>
                          {p.especialista?.nombre ?? 'Sin Especialista'} ·{' '}
                          {p.procesos.length} procesos abiertos
                        </p>
                        <small>
                          {nextDue(p)
                            ? `Próximo ${fechaSeguimiento(nextDue(p), false)}`
                            : 'Sin vencimiento pautado'}
                        </small>
                        {p.riesgo.atencion && (
                          <p className="js-danger">{p.riesgo.causas[0]}</p>
                        )}
                      </button>
                    ))
                  : interv.data?.items.map((d) => (
                      <button
                        className="js-mobile-card"
                        key={`${d.origen}:${d.id}`}
                        onClick={() => select(d)}
                      >
                        <ProyectoCell p={d.proyecto} />
                        <div>
                          <EstadoIntervencionBadge estado={d.estado} />
                          <SlaBadge sla={d.sla} />
                        </div>
                        <p>
                          {MATERIALES_SEGUIMIENTO[d.material]} ·{' '}
                          {PROCESOS_SEGUIMIENTO[d.proceso]} ·{' '}
                          {d.ronda === null
                            ? 'Ronda sin registro'
                            : `Ronda ${d.ronda}`}
                        </p>
                        <small>
                          {d.analista?.nombre ?? 'Sin analista'} ·{' '}
                          {d.especialista?.nombre ?? 'Sin Especialista'}
                        </small>
                        {d.alertas.length > 0 && (
                          <p className="js-danger">{d.alertas[0]}</p>
                        )}
                      </button>
                    ))}
              </div>
            </>
          )}
          <PaginacionSeguimiento
            p={data.pagination}
            onPage={(v) => change('page', String(v), false)}
            onSize={(v) => change('size', String(v))}
          />
        </section>
      )}
      {mode === 'general' && get('detalle') && (
        <GeneralSeguimientoDrawer
          key={get('detalle')}
          id={get('detalle')!}
          onClose={close}
          volver={volver}
          onCorreccion={() => switchMode('correccion', get('detalle'))}
        />
      )}
      {mode === 'correccion' &&
        selectedId &&
        selectedSource &&
        ['correccion', 'calidad', 'legacy'].includes(selectedSource) && (
          <IntervencionDrawer
            key={`${selectedSource}:${selectedId}`}
            origen={selectedSource}
            id={selectedId}
            onClose={close}
            volver={volver}
          />
        )}
    </div>
  );
}
