import { Link, useSearchParams } from 'react-router-dom';
import type {
  EspecialistaIndicador,
  IndicadoresJefatura,
} from '../../../shared/indicadoresJefatura';
import { ESTADOS_INDICADOR } from '../../../shared/indicadoresJefatura';
import {
  CardIndicadores,
  numeroIndicador,
  VacioIndicadores,
} from './IndicadoresElements';
import { RrppIcon } from '../rrpp/RrppIcons';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
export function IndicadoresEquipo({ data }: { data: IndicadoresJefatura }) {
  const [params, setParams] = useSearchParams();
  const q = params.get('buscarEquipo') ?? '';
  const equipo = data.equipo.filter((e) =>
    e.nombre.toLocaleLowerCase('es').includes(q.toLocaleLowerCase('es')),
  );
  const seleccionado =
    equipo.find((e) => e.id === params.get('detalle')) ?? equipo[0];
  const grupo =
    params.get('detalleGrupo') === 'cierres' ? 'cierres' : 'activos';
  function cambiar(key: string, value: string) {
    setParams((p) => {
      const next = new URLSearchParams(p);
      value ? next.set(key, value) : next.delete(key);
      if (key === 'detalle' || key === 'detalleGrupo')
        next.delete('paginaDetalle');
      return next;
    });
  }
  const enPeriodo = (value: string | null) => {
    if (!value) return false;
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(value));
    return day >= data.periodo.from && day <= data.periodo.to;
  };
  const filas = seleccionado
    ? data.proyectos.filter((p) =>
        grupo === 'activos'
          ? p.activo && p.especialistaId === seleccionado.id
          : p.cierreEspecialistaId === seleccionado.id && enPeriodo(p.cierreEn),
      )
    : [];
  const pages = Math.max(1, Math.ceil(filas.length / 5));
  const page = Math.max(
    1,
    Math.min(pages, Number(params.get('paginaDetalle')) || 1),
  );
  const links = seleccionado
    ? `/?vista=proyectos&especialista=${seleccionado.id}`
    : '/?vista=proyectos';
  const resumen = (e: EspecialistaIndicador) => [
    { label: 'Activos', value: e.activos },
    { label: 'Cierres del período', value: e.cierres },
    { label: 'Carga · puntos', value: e.carga },
    { label: 'Express', value: e.express },
    { label: 'En riesgo', value: e.enRiesgo },
  ];
  return (
    <CardIndicadores
      titulo="Desempeño por especialista"
      subtitulo="Carga actual y cierres registrados durante el período. Selecciona una persona para ver su cartera."
      className="ji-team-card"
      extra={
        <label className="ji-team-search">
          <RrppIcon nombre="buscar" />
          <input
            aria-label="Buscar especialista en la tabla"
            value={q}
            onChange={(e) => cambiar('buscarEquipo', e.target.value)}
            placeholder="Buscar especialista…"
          />
        </label>
      }
    >
      <div className="ji-team-grid">
        <div className="ji-team-list">
          <div className="ji-table-scroll" tabIndex={0}>
            <table className="ji-table ji-team-table">
              <thead>
                <tr>
                  <th>Especialista</th>
                  <th>Activos</th>
                  <th title="Primera culminación registrada; responsable en ese momento">
                    Cierres
                  </th>
                  <th>Carga</th>
                  <th>Express</th>
                  <th>Riesgo</th>
                  <th>
                    <span className="sr-only">Detalle</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {equipo.map((e) => (
                  <tr
                    key={e.id}
                    className={e.id === seleccionado?.id ? 'selected' : ''}
                  >
                    <th scope="row">
                      <button
                        className="ji-person"
                        onClick={() => cambiar('detalle', e.id)}
                        aria-pressed={e.id === seleccionado?.id}
                      >
                        <span className="ji-avatar" aria-hidden="true">
                          {initials(e.nombre)}
                        </span>
                        <span title={e.nombre}>
                          {e.nombre}
                          {!e.habilitado && (
                            <small>Fuera del equipo habilitado</small>
                          )}
                        </span>
                      </button>
                    </th>
                    <td>{e.activos}</td>
                    <td>{numeroIndicador(e.cierres)}</td>
                    <td>
                      <strong>{numeroIndicador(e.carga)}</strong>
                    </td>
                    <td className={e.express ? 'ji-blue' : ''}>{e.express}</td>
                    <td className={e.enRiesgo ? 'ji-risk' : ''}>
                      {e.enRiesgo}
                    </td>
                    <td>
                      <button
                        className="ji-row-open"
                        aria-label={`Ver detalle de ${e.nombre}`}
                        onClick={() => cambiar('detalle', e.id)}
                      >
                        ›
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!equipo.length && (
            <VacioIndicadores>
              No hay especialistas en esta selección.
            </VacioIndicadores>
          )}
          <p className="ji-note">
            Carga en puntos del catálogo; incluye pausados y stand-by. Cierres
            atribuidos al responsable registrado al culminar.
          </p>
        </div>
        <section
          className="ji-person-detail"
          aria-label="Detalle del especialista"
        >
          {!seleccionado ? (
            <VacioIndicadores>
              Selecciona un especialista para consultar sus proyectos.
            </VacioIndicadores>
          ) : (
            <>
              <header>
                <span className="ji-avatar large" aria-hidden="true">
                  {initials(seleccionado.nombre)}
                </span>
                <div>
                  <h3>{seleccionado.nombre}</h3>
                  <p>Especialista editorial</p>
                </div>
                <Link className="ji-text-link" to={links}>
                  Ver cartera <span aria-hidden="true">↗</span>
                </Link>
              </header>
              <div className="ji-person-stats">
                {resumen(seleccionado).map((r) => (
                  <div key={r.label}>
                    <strong>{numeroIndicador(r.value)}</strong>
                    <span>{r.label}</span>
                  </div>
                ))}
              </div>
              <div
                className="ji-detail-tabs"
                role="tablist"
                aria-label="Proyectos del especialista"
              >
                <button
                  role="tab"
                  aria-selected={grupo === 'activos'}
                  onClick={() => cambiar('detalleGrupo', 'activos')}
                >
                  Activos ({seleccionado.activos})
                </button>
                <button
                  role="tab"
                  aria-selected={grupo === 'cierres'}
                  onClick={() => cambiar('detalleGrupo', 'cierres')}
                >
                  Cierres del período ({numeroIndicador(seleccionado.cierres)})
                </button>
              </div>
              {!filas.length ? (
                <VacioIndicadores>
                  {grupo === 'cierres' && seleccionado.cierres === null
                    ? 'Sin datos suficientes: no hay una fecha de cierre verificable.'
                    : 'No hay proyectos en esta selección.'}
                </VacioIndicadores>
              ) : (
                <>
                  <div className="ji-table-scroll" tabIndex={0}>
                    <table className="ji-table ji-detail-table">
                      <thead>
                        <tr>
                          <th>Proyecto / autor</th>
                          <th>Servicio</th>
                          <th title="Plazo interno menos días efectivos de seguimiento">
                            Margen
                          </th>
                          <th title="Desde inicio real o programado; descuenta pausas">
                            Días efectivos
                          </th>
                          <th>Estado actual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filas.slice((page - 1) * 5, page * 5).map((p) => (
                          <tr key={p.id}>
                            <th scope="row">
                              <Link
                                to={`/proyectos/${p.id}?volver=${encodeURIComponent('/?' + params.toString())}`}
                              >
                                {p.titulo}
                              </Link>
                              <small>
                                {p.autores} · #{p.codigo}
                              </small>
                            </th>
                            <td>{p.servicio}</td>
                            <td
                              className={
                                p.margenDias !== null && p.margenDias < 0
                                  ? 'ji-risk'
                                  : 'ji-green'
                              }
                            >
                              {numeroIndicador(p.margenDias)}
                            </td>
                            <td>{numeroIndicador(p.diasEfectivos)}</td>
                            <td>
                              <span
                                className={`ji-status ${p.enRiesgo ? 'risk' : ''}`}
                              >
                                <i />
                                {ESTADOS_INDICADOR[p.estado]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <footer className="ji-detail-pagination">
                    <span>
                      Mostrando {(page - 1) * 5 + 1}–
                      {Math.min(page * 5, filas.length)} de {filas.length}
                    </span>
                    <div>
                      <button
                        disabled={page === 1}
                        onClick={() =>
                          cambiar('paginaDetalle', String(page - 1))
                        }
                        aria-label="Página anterior de proyectos"
                      >
                        ‹
                      </button>
                      <span>
                        {page}/{pages}
                      </span>
                      <button
                        disabled={page === pages}
                        onClick={() =>
                          cambiar('paginaDetalle', String(page + 1))
                        }
                        aria-label="Página siguiente de proyectos"
                      >
                        ›
                      </button>
                    </div>
                  </footer>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </CardIndicadores>
  );
}
