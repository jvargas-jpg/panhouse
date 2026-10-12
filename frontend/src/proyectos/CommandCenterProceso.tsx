import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchFicha, fetchProyecto } from './proyectoDetalleApi';
import { CommandCenterEdicion } from './CommandCenterEdicion';
const Edicion = lazy(() => import('./SeccionEdicion').then(m => ({ default: m.SeccionEdicion })));
const Correccion = lazy(() => import('./SeccionCorreccionOperativa').then(m => ({ default: m.SeccionCorreccionOperativa })));
const Creativa = lazy(() => import('./SeccionDireccionCreativaOperativa').then(m => ({ default: m.SeccionDireccionCreativaOperativa })));
const Diseno = lazy(() => import('./SeccionDisenoOperativa').then(m => ({ default: m.SeccionDisenoOperativa })));
const Calidad = lazy(() => import('./SeccionCalidadOperativa').then(m => ({ default: m.SeccionCalidadOperativa })));
const Digital = lazy(() => import('./SeccionSoporteDigital').then(m => ({ default: m.SeccionSoporteDigital })));
const Lanzamiento = lazy(() => import('./SeccionLanzamiento').then(m => ({ default: m.SeccionLanzamiento })));
const Impresion = lazy(() => import('./SeccionImpresion').then(m => ({ default: m.SeccionImpresion })));
const Distribucion = lazy(() => import('./SeccionDistribucion').then(m => ({ default: m.SeccionDistribucion })));

export function CommandCenterProceso({ id, tipo, especialista }: { id: string; tipo: string; especialista: boolean }) {
  const requiresFicha = ['edicion', 'soporte_digital', 'lanzamiento', 'impresion', 'distribucion'].includes(tipo);
  const ficha = useQuery({ queryKey: ['ficha', id], queryFn: () => fetchFicha(id), enabled: requiresFicha });
  const proyecto = useQuery({ queryKey: ['proyecto', id], queryFn: () => fetchProyecto(id), enabled: tipo === 'edicion' });
  if (requiresFicha && ficha.isPending || tipo === 'edicion' && proyecto.isPending) return <p role="status">Consultando el proceso…</p>;
  if (requiresFicha && ficha.isError || tipo === 'edicion' && proyecto.isError) return <p role="alert">No se pudo abrir el proceso. <button onClick={() => { ficha.refetch(); if (tipo === 'edicion') proyecto.refetch(); }}>Reintentar</button></p>;
  return <Suspense fallback={<p role="status">Abriendo gestión…</p>}>
    {tipo === 'edicion' && ficha.data && proyecto.data && <><CommandCenterEdicion id={id} canEdit={especialista} editorId={proyecto.data.proyecto.editorId}/><details><summary>Control documental y cierre de Edición</summary><Edicion proyectoId={id} ficha={ficha.data.ficha} puedeEditar={especialista} editorId={proyecto.data.proyecto.editorId} fechaFeedbackTripa={proyecto.data.proyecto.fechaFeedbackTripa} /></details></>}
    {tipo === 'correccion' && <Correccion proyectoId={id} puedeOperar={especialista} />}
    {tipo === 'direccion_creativa' && <Creativa proyectoId={id} puedeOperar={especialista} />}
    {['diseno', 'revision_interna_cubierta'].includes(tipo) && <Diseno proyectoId={id} />}
    {tipo === 'calidad' && <Calidad proyectoId={id} />}
    {tipo === 'soporte_digital' && ficha.data && <Digital proyectoId={id} ficha={ficha.data.ficha} puedeEditar={false} puedeEditarControl={especialista} />}
    {tipo === 'lanzamiento' && ficha.data && <Lanzamiento proyectoId={id} ficha={ficha.data.ficha} puedeEditar={false} puedeEditarControl={especialista} />}
    {tipo === 'impresion' && ficha.data && <Impresion proyectoId={id} ficha={ficha.data.ficha} puedeEditar={false} />}
    {tipo === 'distribucion' && ficha.data && <Distribucion proyectoId={id} ficha={ficha.data.ficha} puedeEditar={false} puedeEditarControl={especialista} />}
  </Suspense>;
}
