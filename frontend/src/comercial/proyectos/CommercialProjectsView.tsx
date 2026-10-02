import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ProjectModal } from '../../autores/ProjectModal';
import { Toast } from '../../autores/Toast';
import { eliminarProyecto } from '../../jefatura/jefaturaApi';
import { CrmSidebarLayout } from '../../layout/CrmSidebarLayout';
import { fetchProyectosActivos } from '../../proyectos/proyectosApi';
import type { ProyectoPendienteSeccion1 } from '../../types/api';
import { COMERCIAL_FOOTER, COMERCIAL_LOGO, ComercialSidebarNav } from '../ComercialSidebarNav';
import { fetchMetricasComercial } from '../metricasApi';
import { ProjectsKpis } from './ProjectsKpis';
import { ProjectsList } from './ProjectsList';
import { ProjectsToolbar } from './ProjectsToolbar';
import { buildProjects, filterProjects, projectName, type CommercialProject, type ProjectsFilter, type ProjectsOrder } from './projectsModel';

export function CommercialProjectsView() {
  const queryClient = useQueryClient();
  const activos = useQuery({ queryKey: ['proyectos', 'activos'], queryFn: fetchProyectosActivos });
  const metricas = useQuery({ queryKey: ['metricas', 'comercial'], queryFn: fetchMetricasComercial });
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<ProjectsFilter>('todos');
  const [orden, setOrden] = useState<ProjectsOrder>('original');
  const [modal, setModal] = useState(false);
  const [edicion, setEdicion] = useState<ProyectoPendienteSeccion1 | null>(null);
  const [aviso, setAviso] = useState<{ mensaje: string; error: boolean } | null>(null);

  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(timer);
  }, [aviso]);

  const lista = useMemo(() => buildProjects(activos.data?.proyectos ?? [], filtro), [activos.data, filtro]);
  const visibles = useMemo(() => filterProjects(lista, busqueda, orden), [lista, busqueda, orden]);
  const fuente = activos;
  const totalPendientes = activos.data?.proyectos.filter((p) => !p.listoParaRrpp).length;
  const totalListos = activos.data?.proyectos.filter((p) => p.listoParaRrpp).length;
  const cargando = fuente.isLoading;

  function invalidar() {
    void queryClient.invalidateQueries({ queryKey: ['proyectos'] });
    void queryClient.invalidateQueries({ queryKey: ['fichas-trazabilidad', 'pendientes', 'contrato'] });
    void queryClient.invalidateQueries({ queryKey: ['metricas', 'comercial'] });
  }
  const borrar = useMutation({ mutationFn: eliminarProyecto, onSuccess: () => { invalidar(); setAviso({ mensaje: 'Proyecto eliminado exitosamente', error: false }); }, onError: () => setAviso({ mensaje: 'No se pudo eliminar el proyecto. Inténtalo nuevamente.', error: true }) });
  function nuevo() { setEdicion(null); setModal(true); }
  function editar(p: CommercialProject) { if (p.datosEdicion) { setEdicion(p.datosEdicion); setModal(true); } }
  function eliminar(p: CommercialProject) {
    if (window.confirm(`¿Eliminar "${projectName(p)}"? Esta acción no se puede deshacer.`)) borrar.mutate(p.id);
  }

  return <CrmSidebarLayout logo={COMERCIAL_LOGO} footer={COMERCIAL_FOOTER} contentMaxWidth="max-w-[1440px]" nav={<ComercialSidebarNav activo="proyectos" />} overlays={<>
    {modal && <ProjectModal onClose={() => setModal(false)} proyectoEnEdicion={edicion} onGuardado={(mensaje) => { setModal(false); invalidar(); setAviso({ mensaje, error: false }); }} />}
    {aviso && <Toast mensaje={aviso.mensaje} variante={aviso.error ? 'error' : undefined} />}
  </>}>
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0"><h1 className="text-2xl font-bold tracking-tight text-gray-900">Proyectos</h1><p className="mt-1 text-sm leading-6 text-gray-500">Gestiona los proyectos editoriales y completa la información comercial pendiente.</p></div>
      <button type="button" onClick={nuevo} className="min-h-11 shrink-0 rounded-lg bg-dorado px-4 py-2.5 text-sm font-semibold text-tinta shadow-sm transition-all hover:brightness-95 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2">+ Nuevo proyecto</button>
    </div>
    <div className="mb-5"><ProjectsToolbar busqueda={busqueda} onBusqueda={setBusqueda} filtro={filtro} onFiltro={setFiltro} orden={orden} onOrden={setOrden} total={activos.data?.proyectos.length} pendientes={totalPendientes} listos={totalListos} /></div>
    <div className="mb-6"><ProjectsKpis indicadores={[
      { etiqueta: 'Proyectos activos', ayuda: 'En el flujo editorial', valor: activos.data?.proyectos.length, cargando: activos.isLoading, error: activos.isError, reintentar: () => { void activos.refetch(); } },
      { etiqueta: 'Datos contractuales pendientes', ayuda: 'Información comercial por completar', valor: totalPendientes, cargando: activos.isLoading, error: activos.isError, reintentar: () => { void activos.refetch(); } },
      { etiqueta: 'Listos para RRPP', ayuda: 'Completos por Comercial', valor: totalListos, cargando: activos.isLoading, error: activos.isError, reintentar: () => { void activos.refetch(); } },
      { etiqueta: 'Proyectos iniciados este mes', ayuda: 'Ingresos del mes actual', valor: metricas.data?.kpis.proyectosMesActual, cargando: metricas.isLoading, error: metricas.isError, reintentar: () => { void metricas.refetch(); } },
    ]} /></div>

    <ProjectsList proyectos={visibles} total={lista.length} cargando={cargando} error={fuente.isError} filtrado={busqueda.trim().length > 0 || filtro !== 'todos'} pendientes={filtro === 'pendientes'} onReintentar={() => { void fuente.refetch(); }} onNuevo={nuevo} onEditar={editar} onEliminar={eliminar} ocupado={borrar.isPending} />
  </CrmSidebarLayout>;
}
