import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMe } from '../auth/useAuth';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { RrppIcon } from '../rrpp/RrppIcons';
import { AssignmentCandidateDrawer } from './AssignmentCandidateDrawer';
import {
  fetchActividadJefatura,
  fetchDashboardJefatura,
  fetchComparacionAsignacion,
} from './commandCenterApi';
import {
  DecisionQueue,
  ErrorJefatura,
  JefaturaKpis,
  PriorityTracking,
  RequestsList,
  TeamCapacityCard,
  fechaJefatura,
  type TabDecision,
} from './JefaturaCards';
import {
  JefaturaSidebar,
  VISTAS_JEFATURA,
  type VistaJefatura,
} from './JefaturaSidebar';
import { SeguimientoPage } from './SeguimientoPage';
import { DecisionesPage } from './DecisionesPage';
import './jefatura.css';
import { AsignacionesCargaPage } from './AsignacionesCargaPage';
import { ProyectosJefaturaPage } from './ProyectosJefaturaPage';
import { TopBar } from '../layout/TopBar';
import type { ProyectoJefatura } from '../../../shared/jefatura';

export function PanelJefaturaPage() {
  const { data: user } = useMe();
  const [params, setParams] = useSearchParams();
  const vistaParam = params.get('vista');
  const vista: VistaJefatura = VISTAS_JEFATURA.includes(
    vistaParam as VistaJefatura,
  )
    ? (vistaParam as VistaJefatura)
    : 'inicio';
  const tabParam = params.get('tab');
  const tab: TabDecision =
    vista === 'solicitudes'
      ? 'solicitudes'
      : tabParam === 'express' ||
          tabParam === 'solicitudes' || tabParam === 'decisiones' ||
          tabParam === 'enRiesgo'
        ? tabParam
        : 'porAsignar';
  const [search, setSearch] = useState('');
  const [proyectoId, setProyectoId] = useState<string | null>(null);
  const [proyectoAsignacion, setProyectoAsignacion] =
    useState<ProyectoJefatura | null>(null);
  const [aviso, setAviso] = useState('');
  const cache = useQueryClient();
  const seleccionado = vista === 'asignaciones' ? params.get('proyecto') : null;
  const seleccionadoQuery = useQuery({
    queryKey: ['jefatura', 'candidatos', seleccionado],
    queryFn: () => fetchComparacionAsignacion(seleccionado!),
    enabled: !!seleccionado && user?.rol === 'jefe_area',
    staleTime: 0,
  });
  const dashboard = useQuery({
    queryKey: ['jefatura', 'dashboard'],
    queryFn: fetchDashboardJefatura,
    enabled: user?.rol === 'jefe_area' && vista !== 'asignaciones' && vista !== 'proyectos' && vista !== 'seguimiento' && vista !== 'decisiones',
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 60000,
  });
  const actividad = useQuery({
    queryKey: ['jefatura', 'actividad'],
    queryFn: fetchActividadJefatura,
    enabled: user?.rol === 'jefe_area' && vista === 'inicio',
    refetchInterval: 60000,
  });
  const close = useCallback(() => {
    setProyectoId(null);
    setProyectoAsignacion(null);
    setParams(previous => { const next = new URLSearchParams(previous); next.delete('proyecto'); next.delete('decision'); return next; }, { replace: true });
  }, [setParams]);
  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(''), 5000);
    return () => clearTimeout(timer);
  }, [aviso]);
  async function cambio(mensaje: string, cerrar = false) {
    await Promise.all(
      [
        ['jefatura'],
        ['proyectos'],
        ['especialistas'],
        ['mis-proyectos'],
        ['proyecto'],
        ['ficha'],
        ['ficha-viva'],
        ['notificaciones'],
      ].map((queryKey) => cache.invalidateQueries({ queryKey })),
    );
    setAviso(mensaje);
    if (cerrar) close();
  }
  function seleccionar(t: TabDecision) {
    setParams({ tab: t });
    setSearch('');
  }
  const proyecto =
    vista === 'asignaciones'
      ? seleccionado ? (seleccionadoQuery.data?.proyecto ?? (proyectoAsignacion?.id === seleccionado ? proyectoAsignacion : null)) : null
      : dashboard.data?.proyectos.find((p) => p.id === proyectoId);
  if (user && user.rol !== 'jefe_area')
    return <p role="alert">No tienes acceso a Jefatura.</p>;
  const titulos: Record<VistaJefatura, string> = {
    inicio: `Hola, ${user?.nombre ?? '…'}`,
    asignaciones: 'Asignaciones y carga',
    proyectos: 'Proyectos',
    seguimiento: 'Seguimiento',
    solicitudes: 'Solicitudes',
    decisiones: 'Decisiones y escalaciones',
    indicadores: 'Indicadores de Jefatura',
  };
  return (
    <CrmSidebarLayout
      nav={<JefaturaSidebar vista={vista} />}
      logo={
        <img
          src="/brand/panhouse-logo.webp"
          alt="PanHouse Casa Editorial"
          className={`h-auto object-contain ${vista === 'asignaciones' || vista === 'proyectos' || vista === 'seguimiento' || vista === 'decisiones' ? 'w-[176px]' : 'w-[132px]'}`}
        />
      }
      footer={
        <div className="border-t border-gray-800/80 px-6 py-5">
          <p
            className={`${vista === 'asignaciones' ? 'text-sm' : 'text-xs'} italic text-gray-500`}
          >
            Historias que conectan
          </p>
        </div>
      }
      contentMaxWidth="max-w-[1760px]"
      contentClassName={vista === 'proyectos' || vista === 'seguimiento' || vista === 'decisiones' ? 'p-4 sm:px-6 sm:py-4' : 'p-4 sm:p-7'}
      sidebarBreakpoint="lg"
      sidebarCompact={vista === 'proyectos' || vista === 'seguimiento' || vista === 'decisiones'}
      overlays={
        <>
          {proyecto && (
            <AssignmentCandidateDrawer
              key={proyecto.id}
              proyecto={proyecto}
              onClose={close}
              onCambio={cambio}
              modoInicial={params.get('decision') === 'candidatos' ? 'candidatos' : 'contexto'}
            />
          )}
          {aviso && (
            <div role="status" className="jf-toast">
              {aviso}
            </div>
          )}
        </>
      }
    >
      <div className={`jefatura ${vista === 'proyectos' || vista === 'seguimiento' || vista === 'decisiones' ? 'jp-page' : ''} ${vista === 'seguimiento' ? 'js-page' : ''} ${vista === 'decisiones' ? 'jd-page' : ''}`}>
        <JefaturaSidebar vista={vista} mobile />
        {vista !== 'asignaciones' && (
          <header className="jf-page-header">
            <div>
              <p className="jf-eyebrow">JEFATURA · OPERACIÓN EDITORIAL</p>
              <h1>{titulos[vista]}</h1>
              <p>
                {vista === 'inicio'
                  ? 'Supervisa la operación editorial, distribuye la carga del equipo y atiende los proyectos que requieren decisión.'
                  : vista === 'seguimiento' ? 'Supervisa los procesos editoriales, sus tiempos y los asuntos que requieren atención.' : vista === 'proyectos' ? 'Vista global de los proyectos de Producción. Consulta su estado, equipo asignado y próximos hitos.' : vista === 'decisiones' ? 'Resuelve excepciones, revisiones y casos que necesitan la intervención de Jefatura para que el proceso pueda continuar.' : 'Revisa el contexto operativo y continúa desde el expediente del proyecto.'}
              </p>
            </div>
            {vista === 'inicio' && (
              <span className="jf-snapshot">
                <span />
                Estado actual
              </span>
            )}
            {(vista === 'proyectos' || vista === 'seguimiento' || vista === 'decisiones') && <TopBar compacto />}
          </header>
        )}
        {vista === 'asignaciones' ? (
          <>
            {seleccionadoQuery.isError && seleccionado && <ErrorJefatura texto="No pudimos abrir el proyecto seleccionado." retry={() => { void seleccionadoQuery.refetch(); }} />}
            <AsignacionesCargaPage onCompare={(p, modo = 'contexto') => {
              setProyectoAsignacion(p);
              setParams(previous => { const next = new URLSearchParams(previous); next.set('proyecto', p.id); next.set('decision', modo); return next; });
            }} />
          </>
        ) : vista === 'proyectos' ? (
          <ProyectosJefaturaPage />
        ) : vista === 'indicadores' ? (
          <section className="jf-card jf-placeholder">
            <RrppIcon nombre="indicadores" className="h-8 w-8" />
            <h2>Un espacio para medir Producción</h2>
            <p>
              Los indicadores históricos de Jefatura se implementarán en una
              etapa posterior.
            </p>
            <Link className="jf-button" to="/">
              Volver al Inicio
            </Link>
          </section>
        ) : vista === 'seguimiento' ? (
          <SeguimientoPage />
        ) : vista === 'decisiones' ? (
          <DecisionesPage />
        ) : (
          <>
            {vista === 'inicio' && (
              <JefaturaKpis
                summary={dashboard.data?.summary}
                loading={dashboard.isLoading}
                onSelect={seleccionar}
              />
            )}
            {dashboard.isError && (
              <ErrorJefatura
                retry={() => {
                  void dashboard.refetch();
                }}
                texto="No pudimos actualizar los pendientes y la carga del equipo."
              />
            )}
            {vista === 'inicio' || vista === 'solicitudes' ? (
              <>
                <div className="jf-main-grid">
                  <div className="jf-column">
                    <DecisionQueue
                      data={dashboard.data}
                      tab={tab}
                      onTab={seleccionar}
                      onCompare={(p) => setProyectoId(p.id)}
                      search={search}
                      onSearch={setSearch}
                      loading={dashboard.isLoading}
                    />
                    {vista === 'inicio' && (
                      <PriorityTracking
                        proyectos={dashboard.data?.priorityTracking}
                        loading={dashboard.isLoading}
                      />
                    )}
                  </div>
                  <div className="jf-column">
                    <TeamCapacityCard
                      equipo={dashboard.data?.teamCapacity}
                      loading={dashboard.isLoading}
                    />
                    {vista === 'inicio' && (
                      <section className="jf-card">
                        <div className="jf-card-head">
                          <div>
                            <h2>Solicitudes recientes</h2>
                            <p>Revisión y destino de cada solicitud</p>
                          </div>
                        </div>
                        {dashboard.isLoading ? (
                          <div className="jf-list-skeleton">
                            <div className="jf-skeleton" />
                          </div>
                        ) : (
                          <RequestsList
                            requests={dashboard.data?.requests.slice(0, 4)}
                          />
                        )}
                      </section>
                    )}
                  </div>
                </div>
                {vista === 'inicio' && (
                  <>
                    <section className="jf-card jf-activity">
                      <div className="jf-card-head">
                        <div>
                          <h2>Actividad reciente</h2>
                          <p>Últimos movimientos del equipo</p>
                        </div>
                        <RrppIcon nombre="actividad" className="h-4 w-4" />
                      </div>
                      {actividad.isError ? (
                        <ErrorJefatura
                          retry={() => {
                            void actividad.refetch();
                          }}
                        />
                      ) : actividad.isLoading ? (
                        <div className="jf-list-skeleton">
                          <div className="jf-skeleton" />
                        </div>
                      ) : !actividad.data?.actividad.length ? (
                        <p className="jf-empty">
                          Los próximos movimientos aparecerán aquí.
                        </p>
                      ) : (
                        <ul>
                          {actividad.data.actividad.map((a) => (
                            <li key={a.id}>
                              <span className="jf-activity-dot" />
                              <p>
                                <strong>{a.actor}</strong> {a.texto}{' '}
                                <Link
                                  to={`/proyectos/${a.proyectoId}/ficha-trazabilidad`}
                                >
                                  #{a.codigo}
                                </Link>
                              </p>
                              <time dateTime={a.fecha}>
                                {fechaJefatura(a.fecha)}
                              </time>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </>
                )}
              </>
            ) : null}
          </>
        )}
      </div>
    </CrmSidebarLayout>
  );
}
