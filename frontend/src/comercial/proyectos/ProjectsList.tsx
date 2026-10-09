import { RrppHandoffAction } from '../RrppHandoffAction';
import { Link, useNavigate } from 'react-router-dom';
import { resumenFaltantes } from '../../trazabilidad/preparacionComercial';
import { ProjectActionsMenu } from './ProjectActionsMenu';
import { projectName, type CommercialProject } from './projectsModel';

const GRID = 'xl:grid xl:grid-cols-[minmax(0,2fr)_90px_minmax(0,1.5fr)_minmax(0,1.4fr)_180px] xl:items-center xl:gap-5';

function ProjectRow({ proyecto: p, onEditar, onEliminar, ocupado, onEnviado }: {
  proyecto: CommercialProject; onEditar: (p: CommercialProject) => void; onEliminar: (p: CommercialProject) => void; ocupado: boolean; onEnviado: () => void;
}) {
  const navigate = useNavigate();
  const nombre = projectName(p);
  const iniciales = p.autorPrincipal.trim().split(/\s+/).slice(0, 2).map((v) => v[0]).join('').toLocaleUpperCase('es');
  return <li className={`${GRID} relative flex flex-wrap gap-x-3 gap-y-4 px-5 py-5 transition-colors hover:bg-gray-50/60 sm:px-6`}>
    <div className="flex min-w-0 basis-full items-center gap-3 xl:basis-auto">
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dorado/10 bg-dorado/10 text-xs font-semibold text-amber-800">{iniciales}</span>
      <div className="min-w-0"><p className="break-words text-sm font-semibold leading-5 text-gray-900">{nombre}</p><p className="mt-1 break-words text-xs leading-5 text-gray-500">{p.titulo?.trim() ? `Autor${p.autores.length > 1 ? 'es' : ''}: ${p.autores.map((a) => a.nombre).join(', ')}` : `Autor principal: ${p.autorPrincipal}`}</p></div>
    </div>
    <div className="shrink-0 xl:min-w-0"><span className="sr-only">Código: </span><span className="inline-flex rounded-md border border-gray-100 bg-gray-50 px-2.5 py-1.5 font-mono text-xs font-medium text-gray-700">{p.codigo ?? '—'}</span></div>
    <div className="min-w-0 flex-1 xl:flex-none"><span className="sr-only">Servicio: </span><span className="inline-block max-w-full break-words rounded-md bg-gray-50 px-2.5 py-1.5 text-xs leading-5 text-gray-600"><span className="font-semibold text-gray-800">{p.servicio.codigo}</span> — {p.servicio.nombre}</span></div>
    <div className="min-w-0 basis-full xl:basis-auto">
      {p.notificadoRrpp ? <><span className="inline-flex rounded-md bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-800">Enviado a RRPP</span><p className="mt-1.5 text-xs leading-5 text-gray-500">RRPP ya recibió el proyecto</p></> : p.pendiente ? <><span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-500" />Datos pendientes</span><p className="mt-1.5 text-xs leading-5 text-gray-500">{resumenFaltantes(p.faltantesComercial)}</p></> : <><span className="inline-flex items-center gap-1.5 rounded-md bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-800"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-green-500" />Listo para RRPP</span><p className="mt-1.5 text-xs leading-5 text-gray-500">Ingreso comercial completo</p></>}
    </div>
    <div className="flex basis-full items-center justify-between gap-2 xl:basis-auto xl:justify-end">
      {!p.notificadoRrpp && !p.pendiente ? <RrppHandoffAction proyectoId={p.id} disabled={ocupado} onEnviado={onEnviado} /> : <Link to={`/proyectos/${p.id}/ficha-trazabilidad`} className={`inline-flex min-h-10 flex-1 items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado/50 xl:flex-none ${p.pendiente ? 'border border-dorado/30 bg-dorado/15 text-tinta hover:bg-dorado/25' : 'border border-gray-200 bg-white text-gray-800 hover:bg-gray-50'}`}>{!p.notificadoRrpp && p.pendiente ? 'Continuar ficha' : 'Ver ficha'}</Link>}
      <ProjectActionsMenu onVerFicha={() => navigate(`/proyectos/${p.id}/ficha-trazabilidad`)} nombre={p.codigo ?? nombre} onEditar={p.datosEdicion ? () => onEditar(p) : undefined} onEliminar={() => onEliminar(p)} ocupado={ocupado} />
    </div>
  </li>;
}

export function ProjectsList({ proyectos, total, cargando, error, filtrado, pendientes, onReintentar, onNuevo, onEditar, onEliminar, ocupado, onEnviado }: {
  proyectos: CommercialProject[]; total: number; cargando: boolean; error: boolean; filtrado: boolean; pendientes: boolean;
  onReintentar: () => void; onNuevo: () => void; onEditar: (p: CommercialProject) => void; onEliminar: (p: CommercialProject) => void; ocupado: boolean; onEnviado: () => void;
}) {
  return <section aria-label="Listado de proyectos" aria-busy={cargando} className="rounded-xl border border-gray-100 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4 sm:px-6"><h2 className="text-sm font-semibold text-gray-900">{cargando ? 'Cargando proyectos…' : error ? 'Proyectos' : `${proyectos.length} proyecto${proyectos.length === 1 ? '' : 's'}`}</h2><p className="text-xs text-gray-500">{pendientes ? 'Datos contractuales pendientes' : 'Proyectos activos'}</p></div>
    {!error && (cargando || proyectos.length > 0) && <div aria-hidden="true" className={`${GRID} hidden border-b border-gray-100 bg-gray-50/70 px-6 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500`}><span>Proyecto / Autor</span><span>Código</span><span>Servicio</span><span>Estado / Pendiente</span><span className="text-right">Acciones</span></div>}
    {cargando ? <div aria-label="Cargando listado" className="divide-y divide-gray-100">{[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-4 px-5 py-6 sm:px-6"><div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-gray-100" /><div className="min-w-0 flex-1 space-y-2"><div className="h-4 w-2/3 max-w-48 animate-pulse rounded bg-gray-100" /><div className="h-3 w-1/2 max-w-36 animate-pulse rounded bg-gray-50" /></div><div className="hidden h-9 w-32 animate-pulse rounded-lg bg-gray-100 sm:block" /></div>)}</div> : error ? <div className="space-y-3 px-6 py-10 text-center"><p role="alert" className="text-sm text-gray-700">No se pudieron cargar los proyectos.</p><button type="button" onClick={onReintentar} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-dorado">Reintentar</button></div> : proyectos.length > 0 ? <>
      <ul className="divide-y divide-gray-100">{proyectos.map((p) => <ProjectRow key={p.id} proyecto={p} onEditar={onEditar} onEliminar={onEliminar} ocupado={ocupado} onEnviado={onEnviado} />)}</ul>
      <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500 sm:px-6">Mostrando {proyectos.length} de {total} proyectos{pendientes ? ' con datos pendientes' : ' activos'}</p>
    </> : <div className="flex flex-col items-center gap-3 px-6 py-12 text-center"><span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-gray-400"><svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7h7l2 2h9v11H3zM3 7V4h7l2 3" /></svg></span><p className="text-sm font-medium text-gray-800">{filtrado ? 'No encontramos proyectos con este filtro.' : 'No hay proyectos registrados.'}</p>{!filtrado && <button type="button" onClick={onNuevo} className="rounded-lg bg-dorado px-4 py-2 text-sm font-semibold text-tinta hover:brightness-95 focus-visible:ring-2 focus-visible:ring-dorado">+ Crear proyecto</button>}</div>}
  </section>;
}
