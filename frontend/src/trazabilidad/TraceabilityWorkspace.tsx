import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { ComercialSidebarNav } from '../comercial/ComercialSidebarNav';
import { fetchFicha, fetchProyecto } from '../proyectos/proyectoDetalleApi';
import { TraceabilityProjectHeader } from './TraceabilityProjectHeader';
import { ProjectIntakeSection } from './secciones/ProjectIntakeSection';

// Vista comercial única del proyecto: "Este es mi trabajo comercial
// sobre este proyecto", no un Project 360 con las 9 áreas del
// expediente editorial (ver docs/reportes/comercial-resumen-proyecto.md).
// Comercial edita acá; la Ficha de Trazabilidad sigue siendo la fuente
// canónica que consultan RRPP/Jefatura/Admin (FichaVivaPage.tsx), sin
// duplicar datos: este formulario escribe las mismas entidades que esa
// ficha lee.
export function TraceabilityWorkspace({ proyectoId }: { proyectoId: string }) {
  const proyecto = useQuery({ queryKey: ['proyecto', proyectoId], queryFn: () => fetchProyecto(proyectoId) });
  const ficha = useQuery({ queryKey: ['ficha', proyectoId], queryFn: () => fetchFicha(proyectoId) });
  return <CrmSidebarLayout contexto="fullscreen" contentClassName="flex h-full min-h-0 flex-col px-4 py-4 sm:px-6 sm:py-5" contentMaxWidth="max-w-[1100px]" nav={<ComercialSidebarNav activo="proyectos" />}>
    {proyecto.data && <TraceabilityProjectHeader proyecto={proyecto.data.proyecto} />}
    {(proyecto.isLoading || ficha.isLoading) && <div role="status" aria-label="Cargando resumen comercial" className="space-y-4"><div className="h-16 animate-pulse rounded-xl bg-gray-100" /><div className="h-80 animate-pulse rounded-xl bg-white" /><span className="sr-only">Cargando resumen comercial…</span></div>}
    {(proyecto.isError || ficha.isError) && <div role="alert" className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-700"><p>No se pudo cargar {proyecto.isError ? 'el proyecto' : 'el resumen comercial'}.</p><button type="button" onClick={() => { if (proyecto.isError) void proyecto.refetch(); if (ficha.isError) void ficha.refetch(); }} className="mt-3 rounded-lg border border-gray-200 px-4 py-2 font-medium hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-dorado">Reintentar</button>{!proyecto.data && <Link to="/proyectos" className="ml-4 text-xs underline">Volver a Proyectos</Link>}</div>}
    {proyecto.data && ficha.data && !proyecto.isError && !ficha.isError && <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-sm">
      <ProjectIntakeSection proyectoId={proyectoId} ficha={ficha.data.ficha} autores={proyecto.data.proyecto.autores} servicio={proyecto.data.proyecto.servicio}
        puedeEditar puedeEditarContrato puedeEditarComercial puedeNotificarRrpp
        rrppEnviadoAt={proyecto.data.proyecto.rrppEnviadoAt} notificadoRrpp={proyecto.data.proyecto.notificadoRrpp}
        notificadoJefatura={proyecto.data.proyecto.notificadoJefatura} especialistaAsignado={!!proyecto.data.proyecto.especialistaId} estado={proyecto.data.proyecto.estado}
        actualizando={ficha.isFetching || proyecto.isFetching} />
    </div>}
  </CrmSidebarLayout>;
}
