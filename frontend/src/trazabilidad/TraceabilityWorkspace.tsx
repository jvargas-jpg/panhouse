import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { COMERCIAL_FOOTER, COMERCIAL_LOGO, ComercialSidebarNav } from '../comercial/ComercialSidebarNav';
import { fetchFicha, fetchProyecto } from '../proyectos/proyectoDetalleApi';
import { TraceabilityProjectHeader } from './TraceabilityProjectHeader';
import { CommercialTraceabilityNav, type CommercialTraceabilityView } from './CommercialTraceabilityNav';
import { CommercialTraceabilitySummary } from './CommercialTraceabilitySummary';
import { ProjectIntakeSection } from './secciones/ProjectIntakeSection';

export function TraceabilityWorkspace({ proyectoId }: { proyectoId: string }) {
  const [section, setSection] = useState<CommercialTraceabilityView>('ingreso');
  const proyecto = useQuery({ queryKey: ['proyecto', proyectoId], queryFn: () => fetchProyecto(proyectoId) });
  const ficha = useQuery({ queryKey: ['ficha', proyectoId], queryFn: () => fetchFicha(proyectoId) });
  return <CrmSidebarLayout contexto="fullscreen" contentClassName="flex h-full min-h-0 flex-col px-4 py-4 sm:px-6 sm:py-5" contentMaxWidth="max-w-[1600px]" logo={COMERCIAL_LOGO} footer={COMERCIAL_FOOTER} nav={<ComercialSidebarNav activo="proyectos" />}>
    {proyecto.data && <TraceabilityProjectHeader proyecto={proyecto.data.proyecto} />}
    {(proyecto.isLoading || ficha.isLoading) && <div role="status" aria-label="Cargando ficha" className="space-y-4"><div className="h-16 animate-pulse rounded-xl bg-gray-100" /><div className="h-80 animate-pulse rounded-xl bg-white" /><span className="sr-only">Cargando ficha…</span></div>}
    {(proyecto.isError || ficha.isError) && <div role="alert" className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-700"><p>No se pudo cargar {proyecto.isError ? 'el proyecto' : 'la ficha'}.</p><button type="button" onClick={() => { if (proyecto.isError) void proyecto.refetch(); if (ficha.isError) void ficha.refetch(); }} className="mt-3 rounded-lg border border-gray-200 px-4 py-2 font-medium hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-dorado">Reintentar</button>{!proyecto.data && <Link to="/proyectos" className="ml-4 text-xs underline">Volver a Proyectos</Link>}</div>}
    {proyecto.data && ficha.data && !proyecto.isError && !ficha.isError && <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 lg:grid-cols-[208px_minmax(0,1fr)] lg:grid-rows-1 lg:gap-5">
      <CommercialTraceabilityNav active={section} onChange={setSection} />
      <div className="min-h-0 min-w-0 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {/* Keep the single draft mounted when consulting another section. */}
        <div hidden={section !== 'ingreso'} className="h-full min-h-0"><ProjectIntakeSection proyectoId={proyectoId} ficha={ficha.data.ficha} autores={proyecto.data.proyecto.autores} servicio={proyecto.data.proyecto.servicio} puedeEditar puedeEditarContrato puedeEditarComercial puedeNotificarRrpp rrppEnviadoAt={proyecto.data.proyecto.rrppEnviadoAt} actualizando={ficha.isFetching || proyecto.isFetching} notificadoRrpp={proyecto.data.proyecto.notificadoRrpp} /></div>
        {section === 'resumen' && <CommercialTraceabilitySummary ficha={ficha.data.ficha} />}
      </div>
    </div>}
  </CrmSidebarLayout>;
}
