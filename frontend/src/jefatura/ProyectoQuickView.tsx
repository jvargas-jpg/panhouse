import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import type { QuickViewJefatura } from '../../../shared/jefatura';
import {
  ETIQUETAS_ESTADO,
  estadoPortafolio,
} from '../../../shared/portafolioJefatura';
import { RrppIcon } from '../rrpp/RrppIcons';
import { ErrorJefatura, fechaJefatura } from './JefaturaCards';
import { fetchQuickView, fetchActividadProyecto } from './portafolioApi';
import {
  AvatarProyecto,
  EstadoProyecto,
  PortadaProyecto,
  PrioridadProyecto,
} from './PortafolioElements';

const detalleTabs = [
  'Resumen',
  'Información',
  'Equipo',
  'Hitos',
  'Actividad',
] as const;
const roles: Record<string, string> = {
  especialista: 'Especialista',
  editor: 'Editor',
  corrector: 'Corrector',
  validador: 'Validador',
  lider_creativo: 'Líder Creativo',
  disenador: 'Diseñador',
  jefe_area: 'Jefatura',
};
const estadosTrabajo: Record<string, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En curso',
  bloqueado: 'Bloqueado',
  completado: 'Completado',
  cancelado: 'Cancelado',
};
function Dato({
  nombre,
  valor,
  icono = 'ingreso',
}: {
  nombre: string;
  valor: ReactNode;
  icono?: Parameters<typeof RrppIcon>[0]['nombre'];
}) {
  return (
    <div className="jp-detail-data">
      <RrppIcon nombre={icono} />
      <div>
        <span>{nombre}</span>
        <strong>{valor ?? 'Sin registrar'}</strong>
      </div>
    </div>
  );
}
function EstadoContexto({ d }: { d: QuickViewJefatura }) {
  const p = d.proyecto;
  const estado = estadoPortafolio(p);
  const texto =
    p.estado === 'culminado'
      ? 'El proyecto está registrado como culminado. Consulta su historial y expediente.'
      : p.estado === 'pausado'
        ? `La producción está pausada.${p.especialista ? ' El equipo asignado conserva la responsabilidad del proyecto.' : ' Sigue pendiente de Especialista y pertenece al área.'}`
        : p.estado === 'stand_by'
          ? `El proyecto está en stand-by y continúa bajo responsabilidad del área.${!p.especialista ? ' Pendiente de Especialista.' : ''}`
          : p.porAsignar
            ? 'Entregado por RRPP a Jefatura. Pendiente de Especialista.'
            : p.riesgo.atencion
              ? p.riesgo.causas.join(' · ')
              : `El proyecto está bajo coordinación de ${p.especialista?.nombre ?? 'Producción'}.${p.procesos.length ? ` ${p.procesos.length} procesos abiertos.` : ' Sin procesos editoriales abiertos registrados.'}`;
  return (
    <section className="jp-context">
      <div>
        <h3>Estado del proyecto</h3>
        <EstadoProyecto p={p} />
      </div>
      <p>{texto}</p>
      {p.riesgo.atencion && estado !== 'enRiesgo' && (
        <p className="jp-risk-note">Atención: {p.riesgo.causas.join(' · ')}</p>
      )}
    </section>
  );
}
function Ingresos({ d }: { d: QuickViewJefatura }) {
  return (
    <section className="jp-intake">
      <h3>Información de ingresos</h3>
      {[
        ['Información comercial', d.contexto.comercial],
        ['Ingreso RRPP', d.contexto.rrpp],
      ].map(([label, value]) => (
        <div key={label}>
          <span className={value === 'Completo' ? 'jp-check' : 'jp-incomplete'}>
            <RrppIcon
              nombre={value === 'Completo' ? 'check' : 'riesgo'}
              className="h-3 w-3"
            />
          </span>
          <span>{label}</span>
          <span
            className={`jp-badge ${value === 'Completo' ? 'jp-state-enProduccion' : 'jp-state-porAsignar'}`}
          >
            {value}
          </span>
        </div>
      ))}
    </section>
  );
}

export function ProyectoQuickView({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const t = params.get('detalle');
  const tab = detalleTabs.includes(t as (typeof detalleTabs)[number])
    ? (t as (typeof detalleTabs)[number])
    : 'Resumen';
  const query = useQuery({
    queryKey: ['jefatura', 'quick-view', id],
    queryFn: () => fetchQuickView(id),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 30000,
  });
  const actividad = useQuery({
    queryKey: ['jefatura', 'actividad-proyecto', id],
    queryFn: () => fetchActividadProyecto(id),
    enabled: tab === 'Actividad' && !!query.data,
    refetchInterval: 30000,
  });
  const [drawer, setDrawer] = useState(
    () => window.matchMedia('(max-width: 1199px)').matches,
  );
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1199px)');
    const update = () => setDrawer(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (drawer) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [drawer]);
  useEffect(() => {
    if (!drawer) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const nodes = ref.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href],[tabindex="0"]',
      );
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) {
        e.preventDefault();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === ref.current)
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === ref.current)
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      previous?.focus();
    };
  }, [drawer]);
  const d = query.data;
  const p = d?.proyecto;
  const returnUrl = `/?${params}`;
  const fichaHref = `/proyectos/${id}/ficha-trazabilidad?volver=${encodeURIComponent(returnUrl)}`;
  const detalleHref = `/proyectos/${id}?volver=${encodeURIComponent(returnUrl)}`;
  const asignarHref = `/?vista=asignaciones&proyecto=${id}&decision=candidatos`;
  const panel = (
    <aside
      ref={ref}
      tabIndex={drawer ? -1 : undefined}
      className="jp-quick"
      role={drawer ? 'dialog' : undefined}
      aria-modal={drawer || undefined}
      aria-label="Vista rápida del proyecto"
    >
      <button
        className="jp-close"
        aria-label="Cerrar vista rápida"
        onClick={onClose}
      >
        ×
      </button>
      {query.isLoading ? (
        <div className="jp-panel-skeleton">
          <div className="jp-skeleton" />
          <div className="jp-skeleton" />
          <div className="jp-skeleton" />
        </div>
      ) : query.isError || !d || !p ? (
        <ErrorJefatura
          texto="No pudimos abrir este proyecto. Puede no pertenecer al ámbito de Jefatura."
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <header className="jp-quick-header">
            <PortadaProyecto p={p} grande />
            <div>
              <div className="jp-header-badges">
                <EstadoProyecto p={p} />
                <PrioridadProyecto p={p} />
              </div>
              <h2>{p.titulo ?? p.autores}</h2>
              <p>{p.titulo ? p.autores : 'Título por definir'}</p>
              <span>
                #{p.codigo} <i>·</i> {p.servicio.codigo} <i>·</i>{' '}
                {p.servicio.nombre}
              </span>
            </div>
          </header>
          <div
            className="jp-detail-tabs"
            role="tablist"
            aria-label="Detalle del proyecto"
          >
            {detalleTabs.map((label, i) => (
              <button
                key={label}
                role="tab"
                id={`jp-tab-${i}`}
                aria-controls="jp-tab-content"
                aria-selected={tab === label}
                tabIndex={tab === label ? 0 : -1}
                className={tab === label ? 'active' : ''}
                onClick={() =>
                  setParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set('detalle', label);
                    return next;
                  })
                }
                onKeyDown={(e) => {
                  if (
                    !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)
                  )
                    return;
                  e.preventDefault();
                  const nextIndex =
                    e.key === 'Home'
                      ? 0
                      : e.key === 'End'
                        ? 4
                        : (i + (e.key === 'ArrowRight' ? 1 : 4)) % 5;
                  setParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set('detalle', detalleTabs[nextIndex]);
                    return next;
                  });
                  ref.current
                    ?.querySelector<HTMLButtonElement>(`#jp-tab-${nextIndex}`)
                    ?.focus();
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className="jp-quick-content"
            id="jp-tab-content"
            role="tabpanel"
            aria-labelledby={`jp-tab-${detalleTabs.indexOf(tab)}`}
            tabIndex={0}
          >
            {tab === 'Resumen' && (
              <>
                <EstadoContexto d={d} />
                {p.procesos.filter(r=>r.decisionId).map(r=><p className="jp-risk-note" key={r.id}>Decisión pendiente: {r.nombre}. <Link to={`/?vista=decisiones&decision=${r.decisionId}`}>Ver decisión</Link></p>)}
                <div className="jp-detail-grid">
                  <Dato
                    nombre="Servicio"
                    valor={p.servicio.nombre}
                    icono="libro"
                  />
                  <Dato
                    nombre="Ejecución"
                    valor={
                      p.express.estado === 'confirmado'
                        ? 'Express'
                        : p.express.estado === 'posible'
                          ? 'Posible Express'
                          : p.express.estado === 'pendiente_clasificacion'
                            ? 'Por clasificar'
                            : 'Normal'
                    }
                    icono="rapido"
                  />
                  <Dato
                    nombre="Fecha de ingreso"
                    valor={fechaJefatura(d.contexto.ingreso)}
                    icono="calendario"
                  />
                  <Dato
                    nombre="Fecha objetivo"
                    valor={fechaJefatura(p.fechaObjetivo ?? null)}
                    icono="calendario"
                  />
                  <Dato
                    nombre="Plazo estándar"
                    valor={
                      <>
                        {p.express.plazoBaseDias
                          ? `${p.express.plazoBaseDias} días`
                          : 'Clasificación pendiente'}
                        {['confirmado', 'posible'].includes(p.express.estado) &&
                          p.express.compresionDias > 0 && (
                            <small className="jp-compression">
                              Compresión: {p.express.compresionDias} días
                            </small>
                          )}
                      </>
                    }
                    icono="actividad"
                  />
                  <Dato nombre="Páginas pactadas" valor={d.contexto.paginas} />
                </div>
                <Ingresos d={d} />
                {d.contexto.presupuesto && (
                  <p className="jp-plan-line">
                    Presupuesto <strong>{d.contexto.presupuesto}</strong>
                  </p>
                )}
                {p.porAsignar && p.recomendacion && (
                  <section className="jp-recommendation">
                    <h3>Recomendación de asignación</h3>
                    <div>
                      <AvatarProyecto nombre={p.recomendacion.nombre} />
                      <div>
                        <strong>{p.recomendacion.nombre}</strong>
                        <p title={p.recomendacion.razones.join(' ')}>
                          {p.recomendacion.razones[0]}
                        </p>
                      </div>
                    </div>
                  </section>
                )}
                {!p.porAsignar && p.especialista && (
                  <section className="jp-coordinator">
                    <AvatarProyecto nombre={p.especialista.nombre} />
                    <div>
                      <span>Especialista responsable</span>
                      <strong>{p.especialista.nombre}</strong>
                    </div>
                  </section>
                )}
              </>
            )}
            {tab === 'Información' && (
              <>
                <div className="jp-section-head">
                  <h3>Contexto editorial</h3>
                  <p>Información de ingreso y planificación del proyecto.</p>
                </div>
                <div className="jp-detail-grid">
                  <Dato
                    nombre="Servicio / subtipo"
                    valor={p.servicio.nombre}
                    icono="libro"
                  />
                  <Dato
                    nombre="Estado"
                    valor={ETIQUETAS_ESTADO[estadoPortafolio(p)]}
                    icono="actividad"
                  />
                  <Dato
                    nombre="Ejecuci?n comercial"
                    valor={
                      d.contexto.ejecucion === 'Express' &&
                      d.contexto.tiempoExpressMeses
                        ? `Express ? ${d.contexto.tiempoExpressMeses} meses`
                        : d.contexto.ejecucion
                    }
                    icono="rapido"
                  />
                  <Dato
                    nombre="Unidad"
                    valor={d.contexto.unidad}
                    icono="proyectos"
                  />
                  <Dato
                    nombre="Ejecución comercial"
                    valor={
                      d.contexto.ejecucion === 'Express' &&
                      d.contexto.tiempoExpressMeses
                        ? `Express · ${d.contexto.tiempoExpressMeses} meses`
                        : d.contexto.ejecucion
                    }
                    icono="rapido"
                  />
                  <Dato
                    nombre="Presupuesto"
                    valor={d.contexto.presupuesto}
                    icono="capas"
                  />
                  <Dato
                    nombre="Capítulos pactados"
                    valor={d.contexto.capitulos}
                    icono="libro"
                  />
                  <Dato nombre="Páginas pactadas" valor={d.contexto.paginas} />
                  <Dato
                    nombre="Ingreso"
                    valor={fechaJefatura(d.contexto.ingreso)}
                    icono="calendario"
                  />
                  <Dato
                    nombre="Objetivo"
                    valor={fechaJefatura(p.fechaObjetivo ?? null)}
                    icono="calendario"
                  />
                  <Dato
                    nombre="Cierre estándar"
                    valor={fechaJefatura(p.express.fechaEstandar)}
                    icono="calendario"
                  />
                  <Dato
                    nombre="Fecha deseada"
                    valor={fechaJefatura(p.express.fechaDeseada)}
                    icono="calendario"
                  />
                  <Dato
                    nombre="Alianza"
                    valor={
                      d.contexto.alianza === null
                        ? null
                        : d.contexto.alianza
                          ? 'Sí'
                          : 'No'
                    }
                    icono="equipo"
                  />
                </div>
                {p.datoIncompleto && (
                  <p className="jp-risk-note">
                    Crudo · clasificación pendiente. RRPP aún no ha registrado
                    el subtipo.
                  </p>
                )}
                <section className="jp-context">
                  <h3>Resumen RRPP</h3>
                  <p>
                    {d.resumenRrpp ??
                      'Sin observaciones de ingreso registradas.'}
                  </p>
                </section>
                <Ingresos d={d} />
                <Link className="jp-text-link" to={fichaHref}>
                  Ver ficha completa →
                </Link>
              </>
            )}
            {tab === 'Equipo' && (
              <>
                <div className="jp-section-head">
                  <h3>Equipo actual</h3>
                  <p>Responsables del proyecto y de sus procesos activos.</p>
                </div>
                {!p.especialista && (
                  <section className="jp-context">
                    <h3>Especialista</h3>
                    <p>Sin asignar</p>
                    {p.porAsignar && (
                      <Link className="jp-text-link" to={asignarHref}>
                        Ir a asignación →
                      </Link>
                    )}
                  </section>
                )}
                <ul className="jp-team-list">
                  {d.equipo.map((a) => (
                    <li key={a.id}>
                      <AvatarProyecto nombre={a.nombre} />
                      <div>
                        <strong>{a.nombre}</strong>
                        <span>
                          {roles[a.rol] ?? 'Responsable'}
                          {a.proceso ? ` · ${a.proceso}` : ''}
                        </span>
                        {a.asignadoEn && (
                          <small>Desde {fechaJefatura(a.asignadoEn)}</small>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {!d.equipo.length && (
                  <p className="jp-local-empty">
                    No hay otros responsables registrados.
                  </p>
                )}
                <p className="jp-detail-footnote">
                  Las asignaciones anteriores se consultan en el expediente.
                </p>
              </>
            )}
            {tab === 'Hitos' && (
              <>
                <div className="jp-section-head">
                  <h3>Hitos y procesos</h3>
                  <p>Los procesos pueden avanzar en paralelo.</p>
                </div>
                <div className="jp-milestone">
                  <span
                    className={
                      p.entregadoJefatura ? 'jp-check' : 'jp-milestone-pending'
                    }
                  >
                    <RrppIcon
                      nombre={p.entregadoJefatura ? 'check' : 'actividad'}
                      className="h-3 w-3"
                    />
                  </span>
                  <div>
                    <strong>Entrega formal a Jefatura</strong>
                    <p>
                      {p.entregadoJefatura
                        ? 'Registrada por RRPP'
                        : 'Proyecto legacy con Especialista; handoff sin registro'}
                    </p>
                  </div>
                </div>
                <div className="jp-milestone">
                  <span
                    className={
                      p.especialista ? 'jp-check' : 'jp-milestone-pending'
                    }
                  >
                    <RrppIcon nombre="persona" className="h-3 w-3" />
                  </span>
                  <div>
                    <strong>Especialista</strong>
                    <p>{p.especialista?.nombre ?? 'Pendiente de asignación'}</p>
                  </div>
                </div>
                <ul className="jp-milestones">
                  {d.hitos.map((h) => (
                    <li key={h.id}>
                      <span
                        className={
                          h.estado === 'completado'
                            ? 'jp-check'
                            : 'jp-milestone-pending'
                        }
                      >
                        <RrppIcon
                          nombre={
                            h.estado === 'completado' ? 'check' : 'actividad'
                          }
                          className="h-3 w-3"
                        />
                      </span>
                      <div>
                        <strong>{h.nombre}</strong>
                        <p>
                          {h.fase ? `${h.fase} · ` : ''}
                          {estadosTrabajo[h.estado] ?? 'Estado registrado'}
                        </p>
                        {h.fecha && <time>{fechaJefatura(h.fecha)}</time>}
                        {h.gate && h.estado === 'bloqueado' && (
                          <p className="jp-risk-note">
                            Condición pendiente de habilitación
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {!d.hitos.length && (
                  <p className="jp-local-empty">
                    No hay hitos editoriales registrados todavía.
                  </p>
                )}
              </>
            )}
            {tab === 'Actividad' && (
              <>
                <div className="jp-section-head">
                  <h3>Actividad del proyecto</h3>
                  <p>Últimos movimientos registrados por el equipo.</p>
                </div>
                {actividad.isError ? (
                  <ErrorJefatura
                    texto="No pudimos cargar la actividad."
                    retry={() => void actividad.refetch()}
                  />
                ) : actividad.isLoading ? (
                  <div className="jp-panel-skeleton">
                    <div className="jp-skeleton" />
                    <div className="jp-skeleton" />
                  </div>
                ) : !actividad.data?.actividad.length ? (
                  <p className="jp-local-empty">
                    No hay actividad registrada para este proyecto.
                  </p>
                ) : (
                  <ul className="jp-activity-list">
                    {actividad.data.actividad.map((a) => (
                      <li key={a.id}>
                        <span className="jp-activity-dot" />
                        <div>
                          <p>{a.texto}</p>
                          <span className="jp-activity-actor">{a.actor}</span>
                          <time dateTime={a.fecha}>
                            {new Intl.DateTimeFormat('es-VE', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                              timeZone: 'America/Caracas',
                            }).format(new Date(a.fecha))}
                          </time>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <footer className="jp-quick-actions">
            {p.porAsignar && (
              <Link className="jp-primary" to={asignarHref}>
                <RrppIcon nombre="persona" className="h-4 w-4" />
                Asignar Especialista
              </Link>
            )}
            {!p.porAsignar &&
              p.especialista &&
              p.estado !== 'culminado' &&
              p.riesgo.atencion && (
                <Link
                  className="jp-primary"
                  to={`/?vista=seguimiento${p.estado === 'culminado' ? '&modo=correccion' : ''}&proyecto=${id}`}
                >
                  <RrppIcon nombre="actividad" className="h-4 w-4" />
                  Revisar seguimiento
                </Link>
              )}
            <div>
              <Link to={detalleHref}>Abrir proyecto 360°</Link>
              <Link to={fichaHref}>
                <RrppIcon nombre="ingreso" className="h-4 w-4" />
                Ver ficha completa
              </Link>
            </div>
          </footer>
        </>
      )}
    </aside>
  );
  return drawer
    ? createPortal(
        <div
          className="jp-drawer-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {panel}
        </div>,
        document.body,
      )
    : panel;
}
