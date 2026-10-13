import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ESTADOS_INDICADOR } from '../../../shared/indicadoresJefatura';
import type {
  EstadoIndicador,
  FiltrosIndicadoresJefatura,
} from '../../../shared/indicadoresJefatura';
import {
  exportarIndicadores,
  fetchIndicadoresJefatura,
  periodoIndicadores,
} from './indicadoresApi';
import {
  CardIndicadores,
  fechaIndicadorJefatura,
  KpisIndicadores,
  LoadingIndicadores,
  numeroIndicador,
  SlaResumen,
} from './IndicadoresElements';
import {
  CargaIndicadores,
  DonutIndicadores,
  TendenciaIndicadores,
} from './IndicadoresCharts';
import { IndicadoresEquipo } from './IndicadoresEquipo';
import { RrppIcon } from '../rrpp/RrppIcons';
import './indicadores.css';

export function IndicadoresPage() {
  const [params, setParams] = useSearchParams();
  const fallback = periodoIndicadores('mes');
  const filtros: FiltrosIndicadoresJefatura = {
    from: params.get('from') ?? fallback.from,
    to: params.get('to') ?? fallback.to,
    servicioId: params.get('servicio') || undefined,
    especialistaId: params.get('especialista') || undefined,
    prioridad: (params.get('prioridad') ||
      undefined) as FiltrosIndicadoresJefatura['prioridad'],
    estado: (params.get('estado') || undefined) as EstadoIndicador | undefined,
  };
  const requestedTab = params.get('indicador');
  const tab =
    requestedTab && ['resumen', 'equipo', 'tiempos'].includes(requestedTab)
      ? requestedTab
      : 'resumen';
  const meses = params.get('meses') === '6' ? 6 : 12;
  const [exportando, setExportando] = useState(false);
  const [errorExport, setErrorExport] = useState('');
  const query = useQuery({
    queryKey: ['jefatura', 'indicadores', filtros],
    queryFn: () => fetchIndicadoresJefatura(filtros),
    staleTime: 0,
    refetchInterval: 60000,
  });
  useEffect(() => {
    document.body.classList.add('ji-report');
    return () => document.body.classList.remove('ji-report');
  }, []);
  const set = (key: string, value: string) =>
    setParams((p) => {
      const next = new URLSearchParams(p);
      value ? next.set(key, value) : next.delete(key);
      return next;
    });
  function preset(value: string) {
    if (value === 'custom') return;
    const range = periodoIndicadores(value);
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.set('from', range.from);
      next.set('to', range.to);
      return next;
    });
  }
  const actualPreset =
    ['mes', 'anterior', '3m', 'ano'].find((p) => {
      const range = periodoIndicadores(p);
      return range.from === filtros.from && range.to === filtros.to;
    }) ?? 'custom';
  async function descargar() {
    setErrorExport('');
    setExportando(true);
    try {
      await exportarIndicadores(filtros);
    } catch (e) {
      setErrorExport(e instanceof Error ? e.message : 'No pudimos exportar');
    } finally {
      setExportando(false);
    }
  }
  const data = query.data;
  return (
    <div className="ji-workspace">
      <div className="ji-toolbar">
        <label>
          <span>Período de actividad</span>
          <select
            aria-label="Período de actividad"
            value={actualPreset}
            onChange={(e) => preset(e.target.value)}
          >
            <option value="mes">Este mes</option>
            <option value="anterior">Mes anterior</option>
            <option value="3m">Últimos 3 meses</option>
            <option value="ano">Este año</option>
            <option value="custom">Personalizado</option>
          </select>
        </label>
        <p className="ji-scope">
          Cartera actual
          {data && (
            <>
              {' '}
              · corte{' '}
              {fechaIndicadorJefatura(
                new Intl.DateTimeFormat('en-CA', {
                  timeZone: 'America/Caracas',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                }).format(new Date(data.actualizadoEn)),
              )}
            </>
          )}
        </p>
        <div className="ji-actions">
          <button
            className="ji-button"
            onClick={descargar}
            disabled={exportando || !data || query.isError}
          >
            <RrppIcon nombre="externo" />
            {exportando ? 'Exportando…' : 'Exportar CSV'}
          </button>
          <button
            className="ji-button gold"
            onClick={() => window.print()}
            disabled={!data || query.isError}
          >
            <RrppIcon nombre="ingreso" />
            Imprimir reporte
          </button>
        </div>
      </div>
      <div className="ji-filters">
        <label>
          Desde
          <input
            aria-label="Desde"
            type="date"
            value={filtros.from}
            onChange={(e) => set('from', e.target.value)}
          />
        </label>
        <label>
          Hasta
          <input
            aria-label="Hasta"
            type="date"
            value={filtros.to}
            onChange={(e) => set('to', e.target.value)}
          />
        </label>
        <label>
          Servicio
          <select
            aria-label="Servicio"
            value={filtros.servicioId ?? ''}
            onChange={(e) => set('servicio', e.target.value)}
          >
            <option value="">Todos los servicios</option>
            {data?.catalogos.servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Especialista
          <select
            aria-label="Especialista"
            value={filtros.especialistaId ?? ''}
            onChange={(e) => set('especialista', e.target.value)}
          >
            <option value="">Todo el equipo</option>
            <option value="sin_asignar">Sin asignar</option>
            {data?.catalogos.especialistas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prioridad
          <select
            aria-label="Prioridad"
            value={filtros.prioridad ?? ''}
            onChange={(e) => set('prioridad', e.target.value)}
          >
            <option value="">Todas</option>
            <option value="confirmado">Express confirmado</option>
            <option value="posible">Express por confirmar</option>
            <option value="normal">Normal</option>
          </select>
        </label>
        <label>
          Estado actual
          <select
            aria-label="Estado actual"
            value={filtros.estado ?? ''}
            onChange={(e) => set('estado', e.target.value)}
          >
            <option value="">Todos</option>
            {Object.entries(ESTADOS_INDICADOR).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="ji-clear"
          onClick={() => setParams({ vista: 'indicadores' })}
        >
          Limpiar
        </button>
      </div>
      <nav className="ji-tabs" aria-label="Secciones de indicadores">
        {[
          ['resumen', 'Resumen'],
          ['equipo', 'Equipo y capacidad'],
          ['tiempos', 'Tiempos y SLA'],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => set('indicador', id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {errorExport && (
        <p className="ji-error" role="alert">
          {errorExport}
        </p>
      )}
      {query.isLoading ? (
        <LoadingIndicadores />
      ) : query.isError ? (
        <div className="ji-error ji-load-error" role="alert">
          <h2>No pudimos cargar los indicadores</h2>
          <p>{query.error.message}</p>
          <button className="ji-button" onClick={() => query.refetch()}>
            Reintentar
          </button>
        </div>
      ) : (
        data && (
          <>
            <p className="ji-print-period">
              Período: {fechaIndicadorJefatura(data.periodo.from)} –{' '}
              {fechaIndicadorJefatura(data.periodo.to)} · Cartera al{' '}
              {new Date(data.actualizadoEn).toLocaleDateString('es-VE')}
              <br />
              Filtros:{' '}
              {data.catalogos.servicios.find((s) => s.id === filtros.servicioId)
                ?.nombre ?? 'Todos los servicios'}{' '}
              /{' '}
              {filtros.especialistaId === 'sin_asignar'
                ? 'Sin asignar'
                : (data.catalogos.especialistas.find(
                    (s) => s.id === filtros.especialistaId,
                  )?.nombre ?? 'Todo el equipo')}{' '}
              /{' '}
              {filtros.prioridad === 'confirmado'
                ? 'Express confirmado'
                : filtros.prioridad === 'posible'
                  ? 'Express por confirmar'
                  : filtros.prioridad === 'normal'
                    ? 'Normal'
                    : 'Todas las prioridades'}{' '}
              /{' '}
              {filtros.estado
                ? ESTADOS_INDICADOR[filtros.estado]
                : 'Todos los estados'}
            </p>
            <KpisIndicadores data={data} />
            {!data.proyectos.length && (
              <p className="ji-notice" role="status">
                No hay proyectos con estos filtros. Ajusta la selección para
                consultar la cartera.
              </p>
            )}
            {tab === 'resumen' && (
              <>
                <div className="ji-overview-grid">
                  <CardIndicadores
                    titulo="Cierres registrados por mes"
                    subtitulo="Primera culminación con fecha verificable"
                    extra={
                      <div
                        className="ji-segmented"
                        aria-label="Horizonte de tendencia"
                      >
                        <button
                          aria-pressed={meses === 6}
                          onClick={() => set('meses', '6')}
                        >
                          6 meses
                        </button>
                        <button
                          aria-pressed={meses === 12}
                          onClick={() => set('meses', '12')}
                        >
                          12 meses
                        </button>
                      </div>
                    }
                  >
                    <TendenciaIndicadores data={data.meses.slice(-meses)} />
                  </CardIndicadores>
                  <CardIndicadores
                    titulo="Ingresos vs. cierres"
                    subtitulo="Movimientos de la cartera analizada"
                  >
                    <TendenciaIndicadores
                      data={data.meses.slice(-meses)}
                      lineas
                    />
                    <div className="ji-period-stats">
                      <span>Período seleccionado</span>
                      <strong>
                        {data.actividad.ingresos}
                        <small> ingresos</small>
                      </strong>
                      <strong>
                        {numeroIndicador(data.actividad.cierres)}
                        <small> cierres</small>
                      </strong>
                      <span>
                        Ingresos − cierres{' '}
                        <b>
                          {data.actividad.cierres === null
                            ? '—'
                            : data.actividad.ingresos - data.actividad.cierres}
                        </b>
                      </span>
                      <span>
                        Anterior: {data.actividad.anterior.ingresos} ingresos ·{' '}
                        {numeroIndicador(data.actividad.anterior.cierres)}{' '}
                        cierres
                      </span>
                    </div>
                  </CardIndicadores>
                  <CardIndicadores
                    titulo="Distribución del trabajo"
                    subtitulo="Proyectos activos por servicio y subtipo"
                  >
                    <DonutIndicadores data={data.servicios} />
                  </CardIndicadores>
                </div>
                <IndicadoresEquipo data={data} />
                <div className="ji-two-grid">
                  <CardIndicadores
                    titulo="Carga ponderada por especialista"
                    subtitulo="¿Dónde se concentra el trabajo de esta selección?"
                  >
                    <CargaIndicadores equipo={data.equipo} />
                  </CardIndicadores>
                  <CardIndicadores
                    titulo="Salud operativa"
                    subtitulo="Entregas de Corrección y Calidad del período"
                  >
                    <SlaResumen sla={data.sla} />
                  </CardIndicadores>
                </div>
              </>
            )}
            {tab === 'equipo' && (
              <>
                <div className="ji-two-grid">
                  <CardIndicadores
                    titulo="Carga ponderada por especialista"
                    subtitulo="Comparación relativa de los puntos de esta selección"
                  >
                    <CargaIndicadores equipo={data.equipo} />
                    <p className="ji-note">
                      {data.menorCargaId
                        ? `${data.equipo.find((e) => e.id === data.menorCargaId)?.nombre} tiene la menor carga en esta vista.`
                        : 'No hay especialistas habilitados en esta selección.'}{' '}
                      <Link to="/?vista=asignaciones">
                        Consultar capacidad y asignaciones →
                      </Link>
                    </p>
                  </CardIndicadores>
                  <CardIndicadores
                    titulo="Composición de prioridades"
                    subtitulo="Express confirmado y solicitudes por confirmar"
                  >
                    <DonutIndicadores data={data.prioridades} />
                  </CardIndicadores>
                </div>
                <IndicadoresEquipo data={data} />
                <CardIndicadores titulo="Estado de la cartera activa">
                  <DonutIndicadores data={data.estados} />
                </CardIndicadores>
              </>
            )}
            {tab === 'tiempos' && (
              <>
                <div className="ji-two-grid">
                  <CardIndicadores
                    titulo="Cumplimiento de SLA"
                    subtitulo="Entregas medibles del período"
                  >
                    <SlaResumen sla={data.sla} />
                  </CardIndicadores>
                  <CardIndicadores
                    titulo="Estado de la cartera activa"
                    subtitulo="Incluye pausados y stand-by"
                  >
                    <DonutIndicadores data={data.estados} />
                  </CardIndicadores>
                </div>
                <CardIndicadores
                  titulo="Tiempos y cumplimiento por etapa"
                  subtitulo="La aprobación de Calidad y su evaluación se conservan en sus flujos operativos"
                >
                  <div className="ji-table-scroll" tabIndex={0}>
                    <table className="ji-table">
                      <thead>
                        <tr>
                          <th>Etapa</th>
                          <th>Entregas</th>
                          <th>Con SLA verificable</th>
                          <th>En plazo</th>
                          <th>Fuera de plazo</th>
                          <th>Cumplimiento</th>
                          <th>Tiempo efectivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.etapas.map((e) => (
                          <tr key={e.id}>
                            <th>{e.nombre}</th>
                            <td>{e.sla.entregas}</td>
                            <td>{e.sla.medibles}</td>
                            <td>{e.sla.enPlazo}</td>
                            <td>{e.sla.fueraPlazo}</td>
                            <td>
                              {e.sla.cumplimiento === null
                                ? 'Sin datos suficientes'
                                : `${numeroIndicador(e.sla.cumplimiento)}%`}
                            </td>
                            <td>
                              {e.sla.promedioHoras === null
                                ? 'Sin datos suficientes'
                                : `${numeroIndicador(e.sla.promedioHoras)} h · n=${e.sla.muestrasTiempo}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardIndicadores>
                <CardIndicadores titulo="Movimientos registrados por mes">
                  <div className="ji-table-scroll" tabIndex={0}>
                    <table className="ji-table">
                      <thead>
                        <tr>
                          <th>Mes</th>
                          <th>Ingresos a Producción</th>
                          <th>Asignaciones</th>
                          <th>Cierres registrados</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.meses.map((m) => (
                          <tr key={m.clave}>
                            <th>{m.clave}</th>
                            <td>{m.ingresos}</td>
                            <td>{m.asignaciones}</td>
                            <td>{numeroIndicador(m.cierres)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardIndicadores>
              </>
            )}
            <footer className="ji-source-note">
              <p>
                El período filtra movimientos y entregas; carga, estados y
                riesgo describen la cartera actual. Comparación:{' '}
                {fechaIndicadorJefatura(data.periodo.anteriorFrom)} –{' '}
                {fechaIndicadorJefatura(data.periodo.anteriorTo)}.
              </p>
              <p>
                {data.cobertura.ingresosSinFecha > 0 &&
                  `${data.cobertura.ingresosSinFecha} ingresos sin fecha verificable. `}
                {data.cobertura.culminadosSinFecha > 0 &&
                  `${data.cobertura.culminadosSinFecha} culminados sin fecha de cierre. `}
                {data.cobertura.cierresSinResponsable > 0 &&
                  `${data.cobertura.cierresSinResponsable} cierres sin responsable registrado. `}
                {data.cobertura.sinPlazo > 0 &&
                  `${data.cobertura.sinPlazo} proyectos sin clasificación suficiente para interpretar el plazo. `}
                Los registros sin fecha no se atribuyen a un mes.
              </p>
            </footer>
          </>
        )
      )}
    </div>
  );
}
