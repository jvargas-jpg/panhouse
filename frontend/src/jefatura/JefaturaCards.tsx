import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { asignarLiderCreativo } from '../proyectos/direccionCreativaApi';
const fechaProcesoJefatura = (v: string | null) =>
  v && v.length > 10
    ? new Intl.DateTimeFormat('es-VE', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Caracas',
      }).format(new Date(v))
    : fechaJefatura(v);
import type {
  CapacidadJefatura,
  DashboardJefatura,
  ExpressJefatura,
  ProyectoJefatura,
  SolicitudJefatura,
} from '../../../shared/jefatura';
import { RrppIcon } from '../rrpp/RrppIcons';
export const fechaJefatura = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat('es-VE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(v.length === 10 ? `${v}T00:00:00Z` : v))
    : 'Sin fecha';
export function ExpressBadge({ express }: { express: ExpressJefatura }) {
  const prioritario =
    express.estado === 'confirmado' || express.estado === 'posible';
  return (
    <span
      className={`jf-badge ${prioritario ? 'jf-badge-express' : 'jf-badge-normal'}`}
    >
      {prioritario && <RrppIcon nombre="rapido" className="h-3 w-3" />}
      {express.estado === 'confirmado'
        ? 'Express confirmado'
        : express.estado === 'posible'
          ? 'Posible Express'
          : express.estado === 'normal_confirmado'
            ? 'Prioridad normal'
            : express.estado === 'pendiente_clasificacion' ? 'Plazo pendiente' : 'Normal'}
    </span>
  );
}
export function ErrorJefatura({
  retry,
  texto = 'No pudimos cargar esta sección.',
}: {
  retry: () => void;
  texto?: string;
}) {
  return (
    <div className="jf-error" role="alert">
      <p>{texto}</p>
      <button type="button" onClick={retry}>
        Reintentar
      </button>
    </div>
  );
}
export type TabDecision = 'porAsignar' | 'express' | 'solicitudes' | 'enRiesgo';
export function JefaturaKpis({
  summary,
  loading,
  onSelect,
}: {
  summary?: DashboardJefatura['summary'];
  loading: boolean;
  onSelect: (tab: TabDecision) => void;
}) {
  const kpis = [
    {
      key: 'porAsignar',
      label: 'Por asignar',
      sub: 'Desde RRPP',
      icon: 'proceso',
    },
    {
      key: 'solicitudes',
      label: 'Solicitudes',
      sub: 'Decisiones de Jefatura',
      icon: 'ingreso',
    },
    {
      key: 'enRiesgo',
      label: 'En riesgo',
      sub: 'Requieren atención',
      icon: 'actividad',
    },
    {
      key: 'express',
      label: 'Express',
      sub: 'Posibles y confirmados',
      icon: 'rapido',
    },
  ] as const;
  return (
    <section className="jf-kpis" aria-label="Pendientes operativos">
      {kpis.map((k) => (
        <button
          key={k.key}
          type="button"
          className={`jf-kpi jf-kpi-${k.key}`}
          onClick={() => onSelect(k.key)}
        >
          <div>
            <span className="jf-eyebrow">{k.label}</span>
            <RrppIcon nombre={k.icon} className="h-4 w-4" />
          </div>
          {loading ? (
            <span className="jf-skeleton jf-kpi-skeleton" />
          ) : (
            <strong>{summary?.[k.key] ?? '—'}</strong>
          )}
          <p>{k.sub}</p>
        </button>
      ))}
    </section>
  );
}
export function ProjectIdentity({
  p,
}: {
  p: Pick<ProyectoJefatura, 'id' | 'autores' | 'codigo'>;
}) {
  return (
    <Link
      className="jf-project-name"
      to={`/?vista=proyectos&proyecto=${p.id}`}
    >
      <strong>{p.autores}</strong>
      <span>#{p.codigo}</span>
    </Link>
  );
}
export function DecisionQueue({
  data,
  tab,
  onTab,
  onCompare,
  search,
  onSearch,
  loading,
}: {
  data?: DashboardJefatura;
  tab: TabDecision;
  onTab: (tab: TabDecision) => void;
  onCompare: (p: ProyectoJefatura) => void;
  search: string;
  onSearch: (v: string) => void;
  loading: boolean;
}) {
  const matches = (p: { autores: string; codigo: string }) =>
    `${p.autores} ${p.codigo}`
      .toLocaleLowerCase('es')
      .includes(search.trim().toLocaleLowerCase('es'));
  const listado =
    data?.proyectos.filter(
      (p) =>
        (tab === 'porAsignar'
          ? p.porAsignar
          : tab === 'express'
            ? ['posible', 'confirmado'].includes(p.express.estado)
            : p.riesgo.atencion) && matches(p),
    ) ?? [];
  const solicitudes =
    data?.requests.filter((r) => r.requiereJefatura && matches(r)) ?? [];
  const tabs = [
    { key: 'porAsignar', name: 'Por asignar' },
    { key: 'express', name: 'Express' },
    { key: 'solicitudes', name: 'Solicitudes' },
    { key: 'enRiesgo', name: 'En riesgo' },
  ] as const;
  const vacio = search
    ? 'No hay resultados para esta búsqueda.'
    : tab === 'porAsignar'
      ? 'Todos los proyectos recibidos tienen Especialista asignado.'
      : tab === 'enRiesgo'
        ? 'No hay proyectos críticos en este momento.'
        : tab === 'express'
          ? 'No hay proyectos Express por revisar.'
          : 'No tienes solicitudes pendientes.';
  return (
    <section className="jf-card jf-decision">
      <div className="jf-card-head">
        <div>
          <h2>Requieren tu decisión</h2>
          <p>Proyectos y solicitudes que necesitan intervención de Jefatura.</p>
        </div>
      </div>
      <div className="jf-tabs" role="tablist" aria-label="Bandeja de decisión">
        {tabs.map((t) => (
          <button
            key={t.key}
            id={`jf-tab-${t.key}`}
            aria-controls="jf-decision-panel"
            role="tab"
            aria-selected={t.key === tab}
            type="button"
            onClick={() => onTab(t.key)}
          >
            {t.name}
            <span>{data?.summary[t.key] ?? '—'}</span>
          </button>
        ))}
      </div>
      <div className="jf-queue-search">
        <RrppIcon nombre="buscar" className="h-4 w-4" />
        <input
          aria-label="Buscar proyecto en la bandeja"
          type="search"
          placeholder="Buscar autor o código"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div
        id="jf-decision-panel"
        role="tabpanel"
        aria-labelledby={`jf-tab-${tab}`}
      >
        {loading ? (
          <div className="jf-list-skeleton">
            {[1, 2, 3].map((i) => (
              <div key={i} className="jf-skeleton" />
            ))}
          </div>
        ) : !data ? (
          <p className="jf-empty">Los pendientes no están disponibles.</p>
        ) : tab === 'solicitudes' ? (
          <RequestsList requests={solicitudes} empty={vacio} />
        ) : !listado.length ? (
          <div className="jf-empty">
            <RrppIcon nombre="check" className="h-6 w-6" />
            <p>{vacio}</p>
          </div>
        ) : (
          <div className="jf-table-wrap">
            <table className="jf-table jf-decision-table">
              <thead>
                <tr>
                  <th>Proyecto / Autor</th>
                  <th>Servicio</th>
                  <th>Prioridad</th>
                  <th>Fecha objetivo</th>
                  <th>Diferencia</th>
                  <th>{tab === 'enRiesgo' ? 'Atención' : 'Recomendación'}</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {listado.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Proyecto / Autor">
                      <ProjectIdentity p={p} />
                    </td>
                    <td data-label="Servicio">
                      <strong className="jf-service" title={p.servicio.nombre}>
                        {p.servicio.codigo === 'CR' ? `CR — ${p.servicio.nombre}` : p.servicio.codigo}
                      </strong>
                    </td>
                    <td data-label="Prioridad">
                      <ExpressBadge express={p.express} />
                    </td>
                    <td data-label="Fecha objetivo">
                      <span className="jf-date">
                        {fechaJefatura(
                          p.express.fechaDeseada ?? p.express.fechaEstandar,
                        )}
                      </span>
                      <span className="jf-meta">
                        {p.express.fechaDeseada
                          ? 'Deseada por el autor'
                          : 'Plazo estándar'}
                      </span>
                    </td>
                    <td data-label="Diferencia">
                      <strong className="jf-difference">
                        {p.express.compresionDias
                          ? `−${p.express.compresionDias} días`
                          : 'Sin compresión'}
                      </strong>
                      {p.express.compresionDias > 0 && (
                        <span className="jf-meta">
                          Estándar: {fechaJefatura(p.express.fechaEstandar)}
                        </span>
                      )}
                    </td>
                    <td
                      data-label={
                        tab === 'enRiesgo' ? 'Atención' : 'Recomendación'
                      }
                    >
                      {tab === 'enRiesgo' ? (
                        <>
                          <span className="jf-risk-label">
                            {p.riesgo.vencido ? 'Vencido' : 'Atención'}
                          </span>
                          <span className="jf-meta">
                            {p.riesgo.causas.join(' · ')}
                          </span>
                        </>
                      ) : (
                        <>
                          <strong className="jf-recommend-name">
                            {p.recomendacion?.nombre ??
                              p.especialista?.nombre ??
                              'Sin candidatos activos'}
                          </strong>
                          <span className="jf-meta">
                            {p.recomendacion
                              ? `${data?.teamCapacity.find((c) => c.id === p.recomendacion?.especialistaId)?.carga ?? 0} puntos ponderados`
                              : p.especialista
                                ? 'Especialista responsable'
                                : 'Revisa el equipo'}
                          </span>
                        </>
                      )}
                    </td>
                    <td data-label="Acción">
                      <div className="jf-row-actions">
                        {p.porAsignar || tab === 'express' ? (
                          <>
                            <button
                              type="button"
                              className="jf-link-button"
                              onClick={() => onCompare(p)}
                            >
                              Comparar
                            </button>
                            <button
                              type="button"
                              className="jf-button jf-button-small"
                              onClick={() => onCompare(p)}
                            >
                              {p.porAsignar
                                ? 'Asignar'
                                : p.express.estado === 'posible'
                                  ? 'Revisar'
                                  : 'Ver equipo'}
                            </button>
                          </>
                        ) : (
                          <Link
                            className="jf-link-button"
                            to={`/proyectos/${p.id}/ficha-trazabilidad`}
                          >
                            Supervisar
                            <RrppIcon nombre="flecha" className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
export function TeamCapacityCard({
  equipo,
  loading,
  completo = false,
}: {
  equipo?: CapacidadJefatura[];
  loading: boolean;
  completo?: boolean;
}) {
  return (
    <section className="jf-card jf-capacity">
      <div className="jf-card-head">
        <div>
          <h2>Capacidad del equipo</h2>
          <p>Carga ponderada actual</p>
        </div>
        <span className="jf-count">{equipo?.length ?? '—'}</span>
      </div>
      <div className="jf-capacity-list">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="jf-skeleton jf-capacity-skeleton" />
          ))
        ) : !equipo ? (
          <p className="jf-empty">La carga del equipo no está disponible.</p>
        ) : !equipo.length ? (
          <p className="jf-empty">No hay Especialistas activos.</p>
        ) : (
          (completo ? equipo : equipo.slice(0, 6)).map((c) => (
            <div key={c.id} className="jf-capacity-person">
              <div className="jf-capacity-top">
                <div className="jf-avatar">
                  {c.nombre
                    .split(' ')
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join('')}
                </div>
                <strong>{c.nombre}</strong>
                <span className="jf-points">
                  {c.carga}
                  <small>pt</small>
                </span>
              </div>
              <div className="jf-capacity-stats">
                <span>{c.activos} activos</span>
                <span>{c.express} Express</span>
                <span className={c.enRiesgo ? 'jf-text-danger' : ''}>
                  {c.enRiesgo} en riesgo
                </span>
              </div>
              {completo && (
                <p className="jf-composition">
                  {c.servicios
                    .map((s) => `${s.cantidad} ${s.codigo} (${s.carga} pt)`)
                    .join(' · ') || 'Sin proyectos asignados'}
                </p>
              )}
            </div>
          ))
        )}
      </div>
      <div className="jf-card-footer">
        <p>Los puntos provienen de los pesos vigentes por servicio.</p>
        {!completo && (
          <Link to="/?vista=asignaciones">
            Ver carga completa
            <RrppIcon nombre="flecha" className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </section>
  );
}
export function PriorityTracking({
  proyectos,
  loading,
}: {
  proyectos?: ProyectoJefatura[];
  loading: boolean;
}) {
  return (
    <section className="jf-card">
      <div className="jf-card-head">
        <div>
          <h2>Seguimiento prioritario</h2>
          <p>Procesos que requieren supervisión de Jefatura.</p>
        </div>
        <Link className="jf-link-button" to="/?vista=seguimiento">
          Ver seguimiento
        </Link>
      </div>
      {loading ? (
        <div className="jf-list-skeleton">
          <div className="jf-skeleton" />
        </div>
      ) : !proyectos ? (
        <p className="jf-empty">El seguimiento no está disponible.</p>
      ) : !proyectos.length ? (
        <p className="jf-empty">
          No hay procesos críticos que requieran supervisión.
        </p>
      ) : (
        <div className="jf-table-wrap">
          <table className="jf-table jf-tracking-table">
            <thead>
              <tr>
                <th>Proyecto / Especialista</th>
                <th>Procesos activos</th>
                <th>Vence / Desviación</th>
                <th>Riesgo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {proyectos.map((p) => (
                <tr key={p.id}>
                  <td data-label="Proyecto / Especialista">
                    <ProjectIdentity p={p} />
                    <span className="jf-meta">{p.especialista?.nombre}</span>
                  </td>
                  <td data-label="Procesos activos">
                    <div className="jf-processes">
                      {p.procesos.length ? (
                        p.procesos.map((t) => (
                          <span
                            key={t.id}
                            title={`${t.responsable ?? 'Responsable por asignar'} · ${t.estado.replaceAll('_', ' ')}`}
                            className={`jf-process ${t.estado === 'bloqueado' || t.vencido ? 'jf-process-warning' : ''}`}
                          >
                            {t.nombre}
                            <small>{t.estado.replaceAll('_', ' ')}</small>
                            {t.responsable && <small>{t.responsable}</small>}
                          </span>
                        ))
                      ) : (
                        <span className="jf-meta">
                          Sin procesos abiertos registrados
                        </span>
                      )}
                    </div>
                  </td>
                  <td data-label="Vence / Desviación">
                    <span className="jf-date">
                      {p.procesos
                        .filter((t) => t.vence)
                        .map((t) => (
                          <span
                            key={t.id}
                            className={t.vencido ? 'jf-text-danger' : ''}
                          >
                            {t.nombre}: {fechaProcesoJefatura(t.vence)}
                            <br />
                          </span>
                        ))}
                    </span>
                    <span className="jf-meta">
                      {Math.floor(Math.abs(p.riesgo.diasRestantes))}{' '}
                      {Math.floor(Math.abs(p.riesgo.diasRestantes)) === 1
                        ? 'día'
                        : 'días'}{' '}
                      {p.riesgo.diasRestantes < 0
                        ? 'fuera del plazo operativo'
                        : 'de margen operativo'}
                    </span>
                  </td>
                  <td data-label="Riesgo">
                    <span className="jf-risk-label">
                      {p.riesgo.vencido ? 'Vencido' : 'Atención'}
                    </span>
                    <span className="jf-meta">
                      {p.riesgo.causas.join(' · ')}
                    </span>
                  </td>
                  <td data-label="Acción">
                    <Link
                      aria-label={`Supervisar proyecto ${p.codigo}`}
                      className="jf-link-button"
                      to={`/proyectos/${p.id}/ficha-trazabilidad`}
                    >
                      Abrir
                      <RrppIcon nombre="externo" className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function RequestPreview({ request: r }: { request: SolicitudJefatura }) {
  const [review, setReview] = useState(false);
  const [selected, setSelected] = useState('');
  const cache = useQueryClient();
  const people = useQuery({
    queryKey: ['usuarios', 'equipo'],
    queryFn: () =>
      apiFetch<{ usuarios: { id: string; nombre: string; rol: string }[] }>(
        '/usuarios',
      ),
    enabled: review,
  });
  const leaders =
    people.data?.usuarios.filter((u) => u.rol === 'lider_creativo') ?? [];
  const assignment = useMutation({
    mutationFn: () => asignarLiderCreativo(r.direccionCreativaId!, selected),
    onSuccess: async () => {
      await Promise.all(
        [
          ['jefatura'],
          ['ficha-viva'],
          ['direcciones-creativas'],
          ['notificaciones'],
        ].map((queryKey) => cache.invalidateQueries({ queryKey })),
      );
    },
  });
  return (
    <li>
      <span className="jf-request-icon">
        <RrppIcon nombre="ingreso" className="h-4 w-4" />
      </span>
      <div className="jf-request-content">
        <strong>{r.titulo}</strong>
        <p>
          {r.autores} · #{r.codigo}
        </p>
        <span
          className={`jf-badge ${r.requiereJefatura ? 'jf-badge-express' : 'jf-badge-normal'}`}
        >
          Destino: {r.destino}
        </span>
        {r.requiereJefatura && r.direccionCreativaId && (
          <button
            type="button"
            className="jf-link-button"
            onClick={() => setReview(!review)}
            aria-expanded={review}
          >
            {review ? 'Cerrar revisión' : 'Revisar solicitud'}
            <RrppIcon nombre="flecha" className="h-3 w-3" />
          </button>
        )}
        {review && (
          <div className="jf-request-review">
            <p>
              Asigna el responsable creativo. El trabajo y las aprobaciones
              continúan en su espacio.
            </p>
            {people.isError ? (
              <ErrorJefatura
                retry={() => {
                  void people.refetch();
                }}
              />
            ) : people.isLoading ? (
              <p>Cargando responsables...</p>
            ) : !leaders.length ? (
              <p>No hay líderes creativos activos.</p>
            ) : (
              <>
                <label className="jf-field">
                  Líder Creativo
                  <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    disabled={assignment.isPending}
                  >
                    <option value="">Selecciona responsable</option>
                    {leaders.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="jf-button jf-button-small"
                  disabled={!selected || assignment.isPending}
                  onClick={() => assignment.mutate()}
                >
                  {assignment.isPending
                    ? 'Asignando...'
                    : 'Asignar Líder Creativo'}
                </button>
              </>
            )}
            {assignment.isError && (
              <p role="alert" className="jf-error">
                {assignment.error.message}
              </p>
            )}
          </div>
        )}
        <Link
          className="jf-link-button"
          to={`/proyectos/${r.proyectoId}/ficha-trazabilidad`}
        >
          {r.requiereJefatura ? 'Consultar expediente' : 'Ver para supervisión'}
          <RrppIcon nombre="externo" className="h-3 w-3" />
        </Link>
      </div>
    </li>
  );
}
export function RequestsList({
  requests,
  empty = 'No tienes solicitudes pendientes.',
}: {
  requests?: SolicitudJefatura[];
  empty?: string;
}) {
  return !requests ? (
    <p className="jf-empty">Las solicitudes no están disponibles.</p>
  ) : !requests.length ? (
    <p className="jf-empty">{empty}</p>
  ) : (
    <ul className="jf-requests">
      {requests.map((r) => (
        <RequestPreview key={r.id} request={r} />
      ))}
    </ul>
  );
}
