import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ProjectModal } from '../autores/ProjectModal';
import { fetchAutores } from '../autores/autoresApi';
import { Toast } from '../autores/Toast';
import { useMe } from '../auth/useAuth';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { fetchProyectosPendientesContrato } from '../proyectos/proyectosPendientesApi';
import { fetchProyectosActivos } from '../proyectos/proyectosApi';
import { AttentionProjects } from './AttentionProjects';
import { ComercialKpis } from './ComercialKpis';
import { COMERCIAL_FOOTER, COMERCIAL_LOGO, ComercialSidebarNav } from './ComercialSidebarNav';
import { fetchMetricasComercial } from './metricasApi';
import { QuickActions } from './QuickActions';
import { RecentAuthors } from './RecentAuthors';

// Inicio/Dashboard de comercial — a pedido explícito del negocio, deja
// de compartir pantalla con dirección (que sigue en AutoresPage.tsx tal
// cual). Responde una sola pregunta: "¿qué proyectos necesitan una
// acción mía para poder continuar al siguiente paso?" — el resto del
// dashboard (KPIs, accesos rápidos, autores recientes) es contexto de
// apoyo, no el centro de la pantalla.
//
// Métricas mensuales del endpoint existente; preparación comercial derivada
// del mismo evaluador backend para /activos y /pendientes/contrato.
// Conserva las query keys compartidas con Proyectos y la ficha.
export function ComercialDashboardPage() {
  const { data: usuario } = useMe();

  const metricasQuery = useQuery({ queryKey: ['metricas', 'comercial'], queryFn: fetchMetricasComercial });
  const pendientesContratoQuery = useQuery({
    queryKey: ['fichas-trazabilidad', 'pendientes', 'contrato'],
    queryFn: fetchProyectosPendientesContrato,
  });
  const proyectosActivosQuery = useQuery({ queryKey: ['proyectos', 'activos'], queryFn: fetchProyectosActivos });
  const autoresQuery = useQuery({ queryKey: ['autores'], queryFn: fetchAutores });

  const [modalProyectoOpen, setModalProyectoOpen] = useState(false);
  const [toastMensaje, setToastMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMensaje) return;
    const id = setTimeout(() => setToastMensaje(null), 3000);
    return () => clearTimeout(id);
  }, [toastMensaje]);

  return (
    <CrmSidebarLayout
      logo={COMERCIAL_LOGO}
      footer={COMERCIAL_FOOTER}
      contentMaxWidth="max-w-[1440px]"
      nav={<ComercialSidebarNav activo="inicio" />}
      overlays={
        <>
          {modalProyectoOpen && (
            <ProjectModal onClose={() => setModalProyectoOpen(false)}
                proyectoEnEdicion={null}
                onGuardado={(mensaje) => {
                  setModalProyectoOpen(false);
                  setToastMensaje(mensaje);
                }}
            />
          )}
          {toastMensaje && <Toast mensaje={toastMensaje} />}
        </>
      }
    >
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Bienvenido, {usuario?.nombre ?? ''}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona el ingreso de autores, completa las fichas comerciales y deja los proyectos listos para RRPP.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalProyectoOpen(true)}
          className="flex-shrink-0 rounded-lg bg-dorado px-4 py-2.5 text-sm font-semibold text-tinta shadow-sm transition-all hover:brightness-95 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado/40"
        >
          + Nuevo proyecto
        </button>
      </div>

      <div className="mb-6">
        <ComercialKpis
          autoresMes={metricasQuery.data?.kpis.clientesMesActual}
          crecimientoAutoresPorcentaje={metricasQuery.data?.kpis.crecimientoClientesPorcentaje}
          autoresMesError={metricasQuery.isError}
          proyectosIniciadosMes={metricasQuery.data?.kpis.proyectosMesActual}
          proyectosIniciadosMesError={metricasQuery.isError}
          datosContractualesPendientes={pendientesContratoQuery.data?.proyectos.length}
          datosContractualesPendientesError={pendientesContratoQuery.isError}
          listosParaRrpp={proyectosActivosQuery.data?.proyectos.filter((p) => p.listoParaRrpp).length}
          listosParaRrppError={proyectosActivosQuery.isError}
          cargando={metricasQuery.isLoading || pendientesContratoQuery.isLoading || proyectosActivosQuery.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <AttentionProjects
          proyectos={pendientesContratoQuery.data?.proyectos ?? []}
          cargando={pendientesContratoQuery.isLoading}
          huboError={pendientesContratoQuery.isError}
          onReintentar={() => pendientesContratoQuery.refetch()}
        />

        <div className="flex flex-col gap-6">
          <QuickActions onNuevoProyecto={() => setModalProyectoOpen(true)} />
          <RecentAuthors
            autores={autoresQuery.data?.autores ?? []}
            proyectosActivos={proyectosActivosQuery.data?.proyectos ?? []}
            cargando={autoresQuery.isLoading || proyectosActivosQuery.isLoading}
            huboError={autoresQuery.isError}
            onReintentar={() => autoresQuery.refetch()}
          />
        </div>
      </div>
    </CrmSidebarLayout>
  );
}
