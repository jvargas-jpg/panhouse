import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMe } from '../auth/useAuth';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import {
  fetchDashboardRrpp,
  iniciarDiagnostico,
  type ConceptosRrpp,
} from './rrppDashboardApi';
import {
  RRPP_FOOTER,
  RRPP_LOGO,
  RrppSidebarNav,
  type VistaRrpp,
} from './RrppSidebarNav';
import {
  ActivityPanel,
  ErrorRrpp,
  fechaActividad,
  LaunchPanel,
  RrppKpis,
} from './RrppDashboardCards';
import { RrppInbox, type TabRrpp } from './RrppInbox';
import { ReviewConceptsModal } from './ReviewConceptsModal';

export function RrppHomePage() {
  const { data: usuario } = useMe();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['rrpp', 'dashboard'],
    queryFn: fetchDashboardRrpp,
    enabled: usuario?.rol === 'rrpp',
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });
  const vistaParam = params.get('vista');
  const vista: VistaRrpp =
    vistaParam === 'ingresos' ||
    vistaParam === 'proyectos' ||
    vistaParam === 'lanzamientos' ||
    vistaParam === 'actividad'
      ? vistaParam
      : 'inicio';
  const tabParam = params.get('tab');
  const tab: TabRrpp =
    vista === 'lanzamientos'
      ? 'lanzamientos'
      : vista === 'ingresos'
        ? 'ingresos'
        : tabParam === 'conceptos' ||
            tabParam === 'lanzamientos' ||
            tabParam === 'todos'
          ? tabParam
          : 'ingresos';
  const estadoParam = params.get('estado');
  const estado =
    vista !== 'proyectos' &&
    tab === 'ingresos' &&
    (estadoParam === 'nuevo' || estadoParam === 'diagnostico')
      ? estadoParam
      : undefined;
  const [revision, setRevision] = useState<ConceptosRrpp | null>(null);
  const [aviso, setAviso] = useState('');
  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(''), 4000);
    return () => clearTimeout(timer);
  }, [aviso]);
  const inicio = useMutation({
    mutationFn: iniciarDiagnostico,
    onSuccess: async (_, id) => {
      await Promise.all(
        [
          ['rrpp', 'dashboard'],
          ['fichas-trazabilidad', 'enviados-a-rrpp'],
          ['ficha', id],
          ['proyecto', id],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
      navigate(`/proyectos/${id}/ficha-trazabilidad`);
    },
  });
  function seleccionar(
    tabSeleccionado: TabRrpp,
    filtro?: 'nuevo' | 'diagnostico',
  ) {
    setParams({ tab: tabSeleccionado, ...(filtro ? { estado: filtro } : {}) });
  }
  const reintentar = () => {
    void query.refetch();
  };
  if (usuario && usuario.rol !== 'rrpp')
    return (
      <p role="alert" className="p-6">
        No tienes acceso al inicio de RRPP.
      </p>
    );
  return (
    <CrmSidebarLayout
      nav={<RrppSidebarNav vista={vista} />}
      logo={RRPP_LOGO}
      footer={RRPP_FOOTER}
      contentMaxWidth="max-w-[1600px]"
      contentClassName="px-4 py-8 sm:px-7"
      overlays={
        <>
          {revision && (
            <ReviewConceptsModal
              grupo={revision}
              onClose={() => setRevision(null)}
              onGuardado={(mensaje) => {
                setRevision(null);
                setAviso(mensaje);
              }}
            />
          )}
          {aviso && (
            <div
              role="status"
              className="fixed bottom-6 right-4 z-50 max-w-[calc(100%-2rem)] rounded-lg bg-gray-900 px-5 py-3 text-sm text-white shadow-lg"
            >
              {aviso}
            </div>
          )}
        </>
      }
    >
      <header className="mb-5">
        <h1 className="text-[26px] font-bold leading-8 tracking-tight text-gray-900">
          Bienvenido, {usuario?.nombre ?? '…'}
        </h1>
        <p className="mt-2 text-base leading-6 text-slate-500">
          Gestiona nuevos ingresos, aprobaciones y acciones de RRPP para los
          proyectos editoriales.
        </p>
        <nav
          aria-label="Navegación RRPP"
          className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600 md:hidden"
        >
          <Link to="/">Inicio</Link>
          <Link to="/?vista=ingresos">Ingresos</Link>
          <Link to="/?vista=proyectos">Proyectos</Link>
          <Link to="/?vista=lanzamientos">Lanzamientos y eventos</Link>
          <Link to="/rrpp/metricas">Indicadores</Link>
        </nav>
      </header>
      <RrppKpis
        kpis={query.data?.kpis}
        loading={query.isLoading}
        error={query.isError}
        onRetry={reintentar}
        onSelect={(t, proceso) =>
          seleccionar(
            t,
            t === 'ingresos' ? (proceso ? 'diagnostico' : 'nuevo') : undefined,
          )
        }
      />
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 min-[1440px]:grid-cols-[minmax(0,1fr)_300px]">
        {vista === 'actividad' ? (
          <section className="min-w-0 rounded-xl border border-gray-200/70 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-gray-900">
              Actividad reciente
            </h2>
            {query.isLoading ? (
              <div
                aria-label="Cargando actividad"
                className="h-48 animate-pulse rounded bg-gray-50"
              />
            ) : query.isError ? (
              <ErrorRrpp onRetry={reintentar} />
            ) : !query.data?.actividad.length ? (
              <p className="text-sm text-slate-500">
                No hay actividad reciente registrada.
              </p>
            ) : (
              <ol className="divide-y divide-gray-100">
                {query.data.actividad.map((a) => (
                  <li key={a.id} className="py-3">
                    <Link
                      to={`/proyectos/${a.proyecto.id}/ficha-trazabilidad`}
                      className="text-sm font-semibold text-gray-900 hover:underline"
                    >
                      {a.titulo}
                    </Link>
                    <p className="mt-1 break-words text-xs text-slate-500">
                      {a.proyecto.nombre} — #{a.proyecto.codigo} ·{' '}
                      {fechaActividad(a.fecha)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ) : (
          <RrppInbox
            datos={query.data}
            tab={tab}
            estado={estado}
            proyectos={vista === 'proyectos'}
            loading={query.isLoading}
            error={query.isError}
            onRetry={reintentar}
            onTab={(t) => seleccionar(t)}
            onQuitarFiltro={() => seleccionar(tab)}
            iniciar={(id) => inicio.mutate(id)}
            iniciandoId={inicio.isPending ? inicio.variables : undefined}
            errorInicio={
              inicio.isError
                ? {
                    id: inicio.variables!,
                    mensaje:
                      inicio.error instanceof Error
                        ? inicio.error.message
                        : 'No se pudo iniciar el diagnóstico. Intenta de nuevo.',
                  }
                : undefined
            }
            revisar={setRevision}
          />
        )}
        <aside className="grid min-w-0 gap-4 sm:grid-cols-2 min-[1440px]:grid-cols-1">
          <LaunchPanel
            datos={query.data?.lanzamientos ?? []}
            loading={query.isLoading}
            error={query.isError}
            onRetry={reintentar}
          />
          <ActivityPanel
            datos={query.data?.actividad ?? []}
            loading={query.isLoading}
            error={query.isError}
            onRetry={reintentar}
          />
        </aside>
      </div>
    </CrmSidebarLayout>
  );
}
