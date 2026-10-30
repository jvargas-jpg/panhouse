import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import { apiFetch } from '../lib/api';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { SpecialistSidebarNav } from '../layout/RoleProjectNavigation';


import { RrppIcon } from '../rrpp/RrppIcons';
import { MetricasEspecialista } from './MetricasEspecialista';
import { actualizarUrlCartera } from './carteraUrlState';
import type { EspecialistaCartera, ProyectoCartera, TabCartera } from '../../../shared/especialistaCartera';
import './misProyectos.css';

const tabs: { id: TabCartera; label: string }[] = [
  { id: 'todos', label: 'Todos' }, { id: 'accion', label: 'Requieren acción' }, { id: 'riesgo', label: 'En riesgo' },
  { id: 'express', label: 'Express' }, { id: 'pausados', label: 'Pausados' }, { id: 'por-iniciar', label: 'Por iniciar' }, { id: 'cerrados', label: 'Cerrados' },
];
const estados: Record<string, string> = { en_proceso: 'En proceso', retrasado: 'Retrasado', stand_by: 'Stand-by', pausado: 'Pausado', culminado: 'Cerrado' };
function fecha(value: string | null) {
  if (!value) return 'Sin fecha definida';
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric', timeZone: value.length === 10 ? 'UTC' : 'America/Caracas' }).format(new Date(value.length === 10 ? value+'T12:00:00Z' : value));
}
function Procesos({ proyecto }: { proyecto: ProyectoCartera }) {
  const procesos = [...new Map(proyecto.procesos.map(p => [p.tipo, p.nombre])).entries()];
  if (!procesos.length) return <span className="pc-muted">Sin procesos abiertos</span>;
  return <div className="pc-processes">{procesos.slice(0,2).map(([tipo,nombre]) => <span className="pc-process" key={tipo}>{nombre}</span>)}
    <details className="pc-popover"><summary aria-label={'Consultar '+proyecto.procesos.length+' intervenciones de '+(proyecto.titulo ?? proyecto.codigo)}>{procesos.length > 2 ? '+'+(procesos.length-2) : 'ⓘ'}</summary>
      <div role="group" aria-label="Procesos abiertos">{proyecto.procesos.map(p => <p key={p.id}><strong>{p.nombre}</strong><span>{p.estado === 'en_progreso' ? 'En curso' : p.estado === 'bloqueado' ? 'Bloqueado' : 'Pendiente'} · {p.responsable ?? 'Sin responsable individual'}</span><small>{p.vence ? 'Entrega: '+fecha(p.vence) : 'Sin fecha pautada'}{p.entregado ? ' · Entregado' : p.vencido ? ' · Vencido' : ''}</small></p>)}</div>
    </details></div>;
}
function Riesgo({ proyecto }: { proyecto: ProyectoCartera }) {
  return proyecto.riesgo.atencion ? <details className="pc-popover pc-risk"><summary><span aria-hidden="true">△</span> En riesgo</summary><div role="group" aria-label="Motivos de riesgo"><strong>Requiere atención</strong><ul>{proyecto.riesgo.causas.map(c => <li key={c}>{c}</li>)}</ul></div></details> : <span className={'pc-risk-normal '+(proyecto.estado === 'culminado' ? 'pc-muted' : '')}>{proyecto.estado === 'culminado' ? '—' : 'Normal'}</span>;
}
function Estado({ proyecto }: { proyecto: ProyectoCartera }) {
  return <span className={'pc-state pc-state-'+proyecto.estado}><i aria-hidden="true"/>{estados[proyecto.estado] ?? proyecto.estado}</span>;
}
function ProximaAccion({ proyecto, to }: { proyecto: ProyectoCartera; to: string }) {
  const accion = proyecto.proximaAccion;
  return accion ? <Link className="pc-next" to={to}><strong>{accion.titulo}</strong><small className={accion.prioridad === 'vencida' ? 'pc-late' : ''}>{accion.prioridad === 'vencida' ? 'Vencida · ' : ''}{accion.fecha ? fecha(accion.fecha) : accion.detalle}</small></Link> : <span className="pc-wait">{proyecto.espera ?? 'Sin acciones pendientes'}</span>;
}
function DialogFiltros({ data, params, onApply, onClose }: { data?: EspecialistaCartera; params: URLSearchParams; onApply: (values: Record<string,string>) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [values,setValues] = useState(Object.fromEntries(['servicio','subtipo','estado','proceso','riesgo'].map(k => [k,params.get(k) ?? ''])));
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); previous?.focus(); }; }, []);
  const select = (key: string, label: string, options: {value:string;label:string}[]) => <label className="pc-filter-field">{label}<select value={values[key]} onChange={e => setValues(v => ({ ...v, [key]: e.target.value, ...(key==='servicio' ? {subtipo:''} : {}) }))}><option value="">Todos</option>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
  return <dialog ref={ref} className="pc-dialog" aria-labelledby="pc-filter-title" onCancel={onClose}>
    <form onSubmit={e => { e.preventDefault(); onApply(values); onClose(); }}><header><div><span className="pc-kicker">TU CARTERA</span><h2 id="pc-filter-title">Filtrar proyectos</h2></div><button type="button" className="pc-icon-button" aria-label="Cerrar filtros" onClick={onClose}>×</button></header>
      <div className="pc-dialog-fields">{select('servicio','Servicio', data?.catalogos.servicios.map(s => ({value:s.id,label:s.nombre})) ?? [])}
        {(!values.servicio || data?.catalogos.servicios.find(s => s.id === values.servicio)?.codigo === 'CR') && select('subtipo','Subtipo Crudo',[{value:'Tripa',label:'Crudo · Tripa'},{value:'Capítulo',label:'Crudo · Capítulo'}])}
        {select('estado','Estado',data?.catalogos.estados.map(s => ({value:s.valor,label:s.nombre})) ?? [])}
        {select('proceso','Proceso activo',data?.catalogos.procesos.map(p => ({value:p.tipo,label:p.nombre})) ?? [])}
        {select('riesgo','Riesgo',[{value:'si',label:'En riesgo'},{value:'no',label:'Sin riesgo'}])}
        <p className="pc-filter-note">Los objetivos del mes aún no están disponibles en el sistema.</p>
      </div><footer><button type="button" className="pc-button" onClick={() => setValues(Object.fromEntries(Object.keys(values).map(k => [k,''])))}>Limpiar</button><button className="pc-button pc-button-primary" type="submit">Aplicar filtros</button></footer></form>
  </dialog>;
}
function Skeleton() {
  return <div className="pc-loading" role="status" aria-label="Cargando cartera"><div className="pc-summary">{Array.from({length:5},(_,i) => <div className="pc-skeleton" key={i}/>)}</div><div className="pc-skeleton pc-skeleton-toolbar"/>{Array.from({length:8},(_,i) => <div className="pc-skeleton pc-skeleton-row" key={i}/>)}</div>;
}

export function MisProyectosPage() {
  const {data:user}=useMe(), location=useLocation(), [params,setParams]=useSearchParams();
  const [filtersOpen,setFiltersOpen]=useState(false), [search,setSearch]=useState(params.get('search') ?? params.get('q') ?? '');
  const queryParams=new URLSearchParams(params); queryParams.delete('vista'); queryParams.delete('q'); queryParams.set('search',params.get('search') ?? params.get('q') ?? '');
  const signature=queryParams.toString(), identity=user?.id;
  const query=useQuery({queryKey:['especialista-cartera',identity,signature],queryFn:() => apiFetch<EspecialistaCartera>('/especialistas/cartera?'+signature),enabled:user?.rol==='especialista' && params.get('vista')!=='metricas',staleTime:0,refetchOnMount:'always',refetchInterval:15000,placeholderData:(previous,previousQuery) => previousQuery?.queryKey[1] === identity ? previous : undefined});
  useEffect(() => { setSearch(params.get('search') ?? params.get('q') ?? ''); },[params]);
  const update=(values: Record<string,string>, resetPage=true) => setParams(current => actualizarUrlCartera(current,values,resetPage));
  useEffect(() => { const saved=params.get('search') ?? params.get('q') ?? ''; if(search===saved)return; const timer=window.setTimeout(() => update({search:search.trim()}),300);return () => window.clearTimeout(timer); },[search,params]);
  const data=query.data, tab=params.get('tab') ?? 'todos';
  const activeFilters=['servicio','subtipo','estado','proceso','riesgo'].filter(k => params.has(k));
  const clear=() => { setSearch('');setParams({vista:'mis-proyectos'}); };
  const origin=location.pathname+location.search;
  const toProject=(p:ProyectoCartera) => '/proyectos/'+p.id+'?'+new URLSearchParams({volver:origin});
  const toAction=(p:ProyectoCartera) => p.proximaAccion?.href ? p.proximaAccion.href+(p.proximaAccion.href.includes('?') ? '&' : '?')+new URLSearchParams({volver:origin}) : '/proyectos/'+p.id+(p.proximaAccion?.editarContexto ? '' : '/operacion')+'?'+new URLSearchParams({volver:origin,...(p.proximaAccion?.editarContexto ? {modo:'titulos'} : {proceso:p.proximaAccion?.proceso ?? ''})});
  const summary=[{key:'asignados',label:'Proyectos asignados',icon:'proyectos',tab:'todos',tone:'navy'}, {key:'ejecucion',label:'En ejecución',icon:'proceso',tone:'blue'}, {key:'atencion',label:'Requieren atención',icon:'actividad',tab:'accion',tone:'amber'}, {key:'riesgo',label:'En riesgo',icon:'actividad',tab:'riesgo',tone:'red'}, {key:'express',label:'Express',icon:'calendario',tab:'express',tone:'gold'}] as const;
  return <CrmSidebarLayout    nav={<SpecialistSidebarNav/>}   contentMaxWidth="max-w-[1760px]" contentClassName="pc-page">
    {params.get('vista')==='metricas' ? <MetricasEspecialista/> : <>
      <header className="pc-header"><div><span className="pc-kicker">ESPECIALISTA · OPERACIÓN EDITORIAL</span><h1>Mis proyectos</h1><p>Consulta todos los proyectos que tienes asignados, su situación operativa y próximos hitos.</p></div></header>

      {query.isPending ? <Skeleton/> : <>
        {data && <section className="pc-summary" aria-label="Resumen de cartera">{summary.map(s => <button key={s.key} className={'pc-summary-item pc-tone-'+s.tone} disabled={!('tab' in s)} onClick={() => 'tab' in s && update({tab:s.tab})}><span className="pc-summary-label">{s.label}</span><div><strong>{data.resumen[s.key]}</strong><span className="pc-summary-icon"><RrppIcon nombre={s.icon} className="h-[18px] w-[18px]"/></span></div></button>)}</section>}
        <section className="pc-panel" aria-label="Cartera de proyectos" aria-busy={query.isFetching}>
          <nav className="pc-tabs" aria-label="Vistas de cartera">{tabs.map(t => <button key={t.id} aria-current={tab===t.id ? 'page' : undefined} onClick={() => update({tab:t.id,estado:''})}>{t.label}<span>{data?.contadores[t.id] ?? '—'}</span></button>)}</nav>
          <div className="pc-toolbar"><form role="search" className="pc-search" onSubmit={e => {e.preventDefault();update({search:search.trim()});}}><RrppIcon nombre="buscar" className="h-4 w-4"/><input aria-label="Buscar proyecto, autor o código" placeholder="Buscar proyecto, autor o código…" value={search} onChange={e => setSearch(e.target.value)}/>{search && <button type="button" aria-label="Limpiar búsqueda" onClick={() => {setSearch('');update({search:''});}}>×</button>}</form>
            <select className="pc-inline-filter" aria-label="Servicio" value={params.get('servicio') ?? ''} onChange={e => update({servicio:e.target.value,subtipo:''})}><option value="">Todos los servicios</option>{data?.catalogos.servicios.map(s => <option value={s.id} key={s.id}>{s.nombre}</option>)}</select>
            <button className={'pc-button pc-filter-button '+(activeFilters.length ? 'pc-filter-active' : '')} onClick={() => setFiltersOpen(true)}><RrppIcon nombre="proyectos" className="h-4 w-4"/>Filtros{activeFilters.length > 0 && <span>{activeFilters.length}</span>}</button>
            <label className="pc-sort"><span>Ordenar por</span><select aria-label="Ordenar por" value={params.get('orden') ?? 'prioridad'} onChange={e => update({orden:e.target.value})}><option value="prioridad">Prioridad operativa</option><option value="fecha">Fecha objetivo</option><option value="recientes">Más recientes</option><option value="autor">Autor A–Z</option></select></label>
          </div>
          {activeFilters.length > 0 && <div className="pc-applied" aria-label="Filtros aplicados">{activeFilters.map(k => <button key={k} onClick={() => update({[k]:''})}>{k==='servicio' ? data?.catalogos.servicios.find(s => s.id===params.get(k))?.nombre ?? 'Servicio' : k==='proceso' ? data?.catalogos.procesos.find(p => p.tipo===params.get(k))?.nombre ?? 'Proceso' : k==='estado' ? estados[params.get(k)!] : k==='riesgo' ? params.get(k)==='si' ? 'En riesgo' : 'Sin riesgo' : 'Crudo · '+params.get(k)} <span aria-hidden="true">×</span></button>)}<button className="pc-clear" onClick={clear}>Limpiar filtros</button></div>}
          {query.isError ? <div className="pc-empty pc-error" role="alert"><RrppIcon nombre="proyectos" className="h-8 w-8"/><h2>No pudimos consultar tu cartera</h2><p>{query.error.message === 'Failed to fetch' ? 'No se pudo conectar con el servidor. Vuelve a intentarlo.' : query.error.message}</p><button className="pc-button pc-button-primary" onClick={() => query.refetch()}>Reintentar</button></div> : data && !data.proyectos.length ? <div className="pc-empty"><span className="pc-empty-icon"><RrppIcon nombre="proyectos" className="h-7 w-7"/></span><h2>{data.resumen.asignados===0 && data.contadores.cerrados===0 ? 'No tienes proyectos asignados.' : 'No encontramos proyectos con estos filtros.'}</h2><p>{data.resumen.asignados===0 && data.contadores.cerrados===0 ? 'Los proyectos aparecerán aquí cuando Jefatura te los asigne.' : 'Prueba otra búsqueda o ajusta los filtros de tu cartera.'}</p>{(activeFilters.length > 0 || search || tab!=='todos') && <button className="pc-button" onClick={clear}>Limpiar filtros</button>}</div> : data && <>
            <div className="pc-table-wrap"><table className="pc-table"><caption className="sr-only">Proyectos asignados al Especialista, con estado, procesos y próxima acción</caption><colgroup><col className="pc-col-project"/><col className="pc-col-service"/><col className="pc-col-state"/><col className="pc-col-process"/><col className="pc-col-date"/><col className="pc-col-risk"/><col className="pc-col-next"/><col className="pc-col-action"/></colgroup><thead><tr><th scope="col">Proyecto / Autor</th><th scope="col">Servicio</th><th scope="col">Estado</th><th scope="col">Procesos activos</th><th scope="col">Fecha objetivo</th><th scope="col">Riesgo</th><th scope="col">Próxima acción para ti</th><th scope="col"><span className="sr-only">Gestionar</span></th></tr></thead><tbody>{data.proyectos.map(p => <tr key={p.id}>
              <td><Link to={toProject(p)} className="pc-project-title">{p.titulo ?? 'Sin título registrado'}</Link><span className="pc-author" title={p.autores}>{p.autores}</span><span className="pc-code">#{p.codigo}</span></td>
              <td><span className="pc-service">{p.servicio.nombre}</span>{p.express && <span className="pc-express">Express</span>}</td><td><Estado proyecto={p}/>{p.porIniciar && <small className="pc-muted">Sin inicio registrado</small>}</td>
              <td><Procesos proyecto={p}/></td><td><span className="pc-date">{fecha(p.fechaObjetivo)}</span>{p.pausado && <small className="pc-muted">Plazo suspendido</small>}</td><td><Riesgo proyecto={p}/></td><td><ProximaAccion proyecto={p} to={toAction(p)}/></td><td><Link className="pc-manage" to={toProject(p)}>Gestionar <span aria-hidden="true">↗</span></Link></td>
            </tr>)}</tbody></table></div>
            <div className="pc-cards">{data.proyectos.map(p => <article className="pc-project-card" key={p.id}><header><div><Link className="pc-project-title" to={toProject(p)}>{p.titulo ?? 'Sin título registrado'}</Link><span className="pc-author">{p.autores}</span><span className="pc-code">#{p.codigo}</span></div><Estado proyecto={p}/></header><div className="pc-card-service">{p.servicio.nombre}{p.express && <span className="pc-express">Express</span>}</div><Procesos proyecto={p}/><dl><div><dt>Fecha objetivo</dt><dd>{fecha(p.fechaObjetivo)}{p.pausado && <small>Plazo suspendido</small>}</dd></div><div><dt>Riesgo</dt><dd><Riesgo proyecto={p}/></dd></div></dl><footer><div><span className="pc-card-label">Próxima acción para ti</span><ProximaAccion proyecto={p} to={toAction(p)}/></div><Link className="pc-manage" to={toProject(p)}>Gestionar <span aria-hidden="true">↗</span></Link></footer></article>)}</div>
          </>}
          {data && !query.isError && data.total > 0 && <footer className="pc-pagination"><span>Mostrando {(data.page-1)*data.pageSize+1}–{Math.min(data.page*data.pageSize,data.total)} de {data.total} proyectos</span><label>Por página <select aria-label="Proyectos por página" value={params.get('pageSize') ?? '20'} onChange={e => update({pageSize:e.target.value})}>{[10,20,50].map(n => <option key={n} value={n}>{n}</option>)}</select></label><div><button aria-label="Página anterior" disabled={data.page===1 || query.isFetching} onClick={() => update({page:String(data.page-1)},false)}>‹</button><span>{data.page} / {data.pages}</span><button aria-label="Página siguiente" disabled={data.page===data.pages || query.isFetching} onClick={() => update({page:String(data.page+1)},false)}>›</button></div></footer>}
        </section>
        <div className="pc-footnote"><span>{data ? 'Actualizado '+new Intl.DateTimeFormat('es',{hour:'2-digit',minute:'2-digit',timeZone:'America/Caracas'}).format(new Date(data.actualizadoEn)) : 'Cartera asignada por Jefatura'}{query.isFetching ? ' · Actualizando…' : ''}</span><span>Objetivos mensuales: aún no disponibles</span></div>
      </>}
      {filtersOpen && <DialogFiltros data={data} params={params} onApply={update} onClose={() => setFiltersOpen(false)}/>}
    </>}
  </CrmSidebarLayout>;
}
