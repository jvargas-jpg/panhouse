import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import { apiFetch } from '../lib/api';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { SpecialistSidebarNav } from '../layout/RoleProjectNavigation';


import { RrppIcon } from '../rrpp/RrppIcons';
import type { ItemTrabajoEspecialista, MiTrabajo, TabMiTrabajo } from '../../../shared/especialistaMiTrabajo';
import './miTrabajo.css';

const TABS: { id: TabMiTrabajo; label: string }[] = [
  { id: 'pendientes', label: 'Pendientes' }, { id: 'hoy', label: 'Hoy' }, { id: 'vencidas', label: 'Vencidas' },
  { id: 'proximas', label: 'Próximas' }, { id: 'esperando', label: 'Esperando' }, { id: 'bloqueadas', label: 'Bloqueadas' },
];
function fecha(s: string | null) {
  if (!s) return null;
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', ...(/^\d{4}-\d{2}-\d{2}$/.test(s) ? { timeZone: 'UTC' } : { timeZone: 'America/Caracas' }) }).format(new Date(s.length === 10 ? s+'T12:00:00Z' : s));
}
function icono(estado: ItemTrabajoEspecialista['estado']): Parameters<typeof RrppIcon>[0]['nombre'] {
  return estado === 'vencida' ? 'riesgo' : estado === 'esperando' ? 'persona' : estado === 'bloqueada' ? 'proceso' : 'actividad';
}
function tono(estado: ItemTrabajoEspecialista['estado']) {
  return estado === 'vencida' ? 'mt-red' : estado === 'esperando' ? 'mt-blue' : estado === 'bloqueada' ? 'mt-gray' : '';
}
function plazo(item:ItemTrabajoEspecialista,ahora:string){
  if(!item.fecha)return 'Sin plazo registrado';
  const local=(s:string)=>s.length===10?s:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));
  const dias=Math.round((Date.parse(local(item.fecha)+'T12:00:00Z')-Date.parse(local(ahora)+'T12:00:00Z'))/86400000);
  if(item.estado==='vencida')return dias===0?'Vencida hoy':'Vencida hace '+Math.abs(dias)+' días';
  return dias===0?'Vence hoy':dias===1?'Mañana':dias>1?'En '+dias+' días':fecha(item.fecha)!;
}
function Row({ item, to, origen,ahora }: { item: ItemTrabajoEspecialista; to: string; origen: string;ahora:string }) {
  const accionable = item.estado !== 'esperando' && item.estado !== 'bloqueada';
  return <div className="mt-row">
    <span className={'mt-row-icon '+tono(item.estado)}><RrppIcon nombre={icono(item.estado)} className="h-4 w-4"/></span>
    <span className="mt-row-project"><strong>{item.proyectoTitulo}</strong><small>{item.proyectoAutores} · #{item.proyectoCodigo}</small><span className="mt-chip">{item.procesoNombre}</span></span>
    <span className="mt-row-action"><strong title={item.accion}>{item.accion}</strong><small title={item.blockedBy ?? item.detalle}>{item.blockedBy ?? item.detalle}</small></span>
    <span className="mt-row-status">{item.estado === 'esperando' ? <span className="mt-row-badge mt-badge-esperando">Esperando {item.waitingOn}</span>
      : item.estado === 'bloqueada' ? <span className="mt-row-badge mt-badge-bloqueada">Bloqueada</span>
      : <span className={'mt-row-date '+(item.estado === 'vencida' ? 'mt-red' : '')} title={item.fecha ? new Date(item.fecha.length===10?item.fecha+'T12:00:00Z':item.fecha).toLocaleString('es',{timeZone:item.fecha.length===10?'UTC':'America/Caracas'}) : undefined}>{item.fecha?plazo(item,ahora):'Pendiente'}</span>}
      {item.estado==='esperando'&&<small title={item.fecha ?? undefined}>{item.fecha?plazo(item,ahora):item.waitingSince?'Desde '+fecha(item.waitingSince):'Sin plazo registrado'}</small>}
    </span>
    <span className="mt-row-cta">
      {accionable && item.ctaLabel && <Link className="mt-cta-button" to={to}>{item.ctaLabel}</Link>}
      {item.estado === 'esperando' && item.href && <Link className="mt-open-link" to={to}>Ver solicitud</Link>}
      {item.estado === 'bloqueada' && item.href && <Link className="mt-open-link" to={item.href+(item.href.includes('?') ? '&' : '?')+new URLSearchParams({ volver: origen })}>Ver solicitud a Jefatura</Link>}
      <Link className="mt-open-link" to={'/proyectos/'+item.proyectoId+'?'+new URLSearchParams({ volver: origen })}>Abrir proyecto ↗</Link>
    </span>
  </div>;
}
function Skeleton() {
  return <div className="mt-loading" role="status" aria-label="Cargando tu trabajo"><div className="mt-summary">{Array.from({ length: 4 }, (_, i) => <div className="mt-skeleton" key={i}/>)}</div>{Array.from({ length: 6 }, (_, i) => <div className="mt-skeleton" key={'r'+i}/>)}</div>;
}
const EMPTY: Record<TabMiTrabajo, { title: string; text: string }> = {
  pendientes: {title:'Sin acciones propias pendientes',text:'Las acciones disponibles aparecerán cuando su workflow lo habilite.'},
  hoy: { title: 'Todo está al día', text: 'No tienes acciones que requieran tu intervención hoy.' },
  vencidas: { title: 'Sin vencidas', text: 'No tienes acciones vencidas en tu cartera activa.' },
  proximas: { title: 'Sin próximas acciones', text: 'No hay acciones con fecha límite pautada por delante.' },
  esperando: { title: 'Sin esperas pendientes', text: 'No estás esperando respuestas pendientes.' },
  bloqueadas: { title: 'Sin bloqueos', text: 'No tienes acciones bloqueadas.' },
};

function FiltrosTrabajo({params,data,onApply,onClose}:{params:URLSearchParams;data:MiTrabajo;onApply:(v:Record<string,string>)=>void;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null),[v,setV]=useState(Object.fromEntries(['proceso','proyectoId','dependencia','orden'].map(k=>[k,params.get(k) ?? ''])));
  useEffect(()=>{const prev=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>{ref.current?.close();prev?.focus();};},[]);
  const field=(key:string,label:string,options:{id:string;label:string}[])=><label>{label}<select value={v[key]} onChange={e=>setV({...v,[key]:e.target.value})}><option value="">Todos</option>{options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>;
  return <dialog ref={ref} className="mt-filter-dialog" aria-labelledby="mt-filter-heading" onCancel={onClose}><form onSubmit={e=>{e.preventDefault();onApply(v);onClose();}}><header><h2 id="mt-filter-heading">Filtrar mi trabajo</h2><button type="button" aria-label="Cerrar filtros" onClick={onClose}>×</button></header>{field('proceso','Proceso',data.catalogos.procesos.map(p=>({id:p.tipo,label:p.nombre})))}{field('proyectoId','Proyecto',data.catalogos.proyectos.map(p=>({id:p.id,label:p.titulo})))}{field('dependencia','Dependencia',data.dependencias.map(d=>({id:d.tipo,label:d.destino})))}{field('orden','Orden',[{id:'prioridad',label:'Vencidas primero'},{id:'fecha',label:'Fecha límite'}])}<footer><button type="button" onClick={()=>setV({proceso:'',proyectoId:'',dependencia:'',orden:''})}>Limpiar</button><button className="mt-cta-button">Aplicar filtros</button></footer></form></dialog>;
}

export function MiTrabajoPage() {
  const { data: user } = useMe(), location = useLocation(), [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [filtersOpen,setFiltersOpen]=useState(false);
  // Default 'pendientes' (todo lo accionable, con o sin fecha), no
  // 'hoy' (solo lo fechado para hoy/vencido) -- ver nota en
  // especialistaMiTrabajo.routes.ts.
  const tab = (params.get('tab') as TabMiTrabajo) ?? 'pendientes';
  const queryParams = new URLSearchParams(); queryParams.set('tab', tab);
  if (params.get('proceso')) queryParams.set('proceso', params.get('proceso')!);
  if (params.get('proyectoId')) queryParams.set('proyectoId', params.get('proyectoId')!);
  if (params.get('search')) queryParams.set('search', params.get('search')!);
  if (params.get('page')) queryParams.set('page', params.get('page')!);
  for(const key of ['dependencia','orden','pageSize'])if(params.get(key))queryParams.set(key,params.get(key)!);
  const signature = queryParams.toString(), identity = user?.id;
  const query = useQuery({ queryKey: ['mi-trabajo', identity, signature], queryFn: () => apiFetch<MiTrabajo>('/especialistas/mi-trabajo?'+signature), enabled: user?.rol === 'especialista', staleTime: 15000, refetchInterval: 30000, placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === identity ? previous : undefined });
  useEffect(() => { setSearch(params.get('search') ?? ''); }, [params]);
  const update = (values: Record<string, string>, resetPage = true) => setParams(current => { const next = new URLSearchParams(current); for (const [k, v] of Object.entries(values)) v ? next.set(k, v) : next.delete(k); if (resetPage) next.delete('page'); return next; });
  useEffect(() => { const saved = params.get('search') ?? ''; if (search === saved) return; const timer = window.setTimeout(() => update({ search: search.trim() }), 300); return () => window.clearTimeout(timer); }, [search, params]);
  const data = query.data, origen = location.pathname+location.search;
  const toProject = (item: ItemTrabajoEspecialista) => item.href ? item.href+(item.href.includes('?') ? '&' : '?')+new URLSearchParams({ volver: origen }) : '/proyectos/'+item.proyectoId+(item.editarContexto ? '' : '/operacion')+'?'+new URLSearchParams({ volver: origen, ...(item.editarContexto ? { modo: 'titulos' } : { proceso: item.proceso }),...(item.context.capitulo?{capitulo:String(item.context.capitulo)}:{}) });
  const page = query.data?.page ?? 1;

  const summary = data ? [
    { key: 'pendientes', label: 'Pendientes', value: data.resumen.pendientes, tone: '', tab: 'pendientes' as TabMiTrabajo },
    { key: 'vencidas', label: 'Vencidas', value: data.resumen.vencidas, tone: 'mt-tone-red', tab: 'vencidas' as TabMiTrabajo },
    { key: 'esperando', label: 'Esperando respuesta', value: data.resumen.esperando, tone: 'mt-tone-blue', tab: 'esperando' as TabMiTrabajo },
    { key: 'bloqueadas', label: 'Bloqueadas', value: data.resumen.bloqueadas, tone: 'mt-tone-gray', tab: 'bloqueadas' as TabMiTrabajo },
  ] : [];

  const grouped = tab === 'hoy' && data ? { vencidas: data.items.filter(i => i.estado === 'vencida'), hoy: data.items.filter(i => i.estado === 'hoy') } : null;
  const vacio = EMPTY[tab];

  return <CrmSidebarLayout    nav={<SpecialistSidebarNav/>}   contentMaxWidth="max-w-[1760px]" contentClassName="mt-page">
    <header className="mt-header"><div><span className="mt-kicker">ESPECIALISTA · OPERACIÓN EDITORIAL</span><h1>Mi trabajo</h1><p>Acciones, entregas y seguimientos que requieren tu intervención directa.</p></div></header>

    {query.isPending ? <Skeleton/> : query.isError ? <div className="mt-main"><div className="mt-empty"><h2>No se pudo consultar tu trabajo</h2><p>{(query.error as Error).message}</p><button className="mt-cta-button" onClick={() => query.refetch()}>Reintentar</button></div></div> : data && <>
      <section className="mt-summary" aria-label="Resumen de trabajo">{summary.map(s => <button key={s.key} className={'mt-summary-item '+s.tone} aria-current={tab === s.tab ? 'page' : undefined} onClick={() => update({ tab: s.tab })}><span className="mt-summary-label">{s.label}</span><div><strong>{s.value}</strong></div></button>)}</section>
      <div className="mt-panel">
        <section className="mt-main" aria-busy={query.isFetching}>
          <nav className="mt-tabs" aria-label="Estados de trabajo">{TABS.map(t => <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} onClick={() => update({ tab: t.id, dependencia:'' })}>{t.label}<span>{data.contadores[t.id] ?? 0}</span></button>)}</nav>
          <div className="mt-toolbar">
            <form role="search" className="mt-search" onSubmit={e => { e.preventDefault(); update({ search: search.trim() }); }}><RrppIcon nombre="buscar" className="h-4 w-4"/><input aria-label="Buscar proyecto, autor o acción" placeholder="Buscar proyecto, autor o acción…" value={search} onChange={e => setSearch(e.target.value)}/>{search && <button type="button" aria-label="Limpiar búsqueda" onClick={() => { setSearch(''); update({ search: '' }); }}>×</button>}</form>
            <button className="mt-filter-button" onClick={()=>setFiltersOpen(true)}>Filtros</button>
            <select aria-label="Proceso" value={params.get('proceso') ?? ''} onChange={e => update({ proceso: e.target.value })}><option value="">Todos los procesos</option>{data.catalogos.procesos.map(p => <option key={p.tipo} value={p.tipo}>{p.nombre}</option>)}</select>
            <select aria-label="Proyecto" value={params.get('proyectoId') ?? ''} onChange={e => update({ proyectoId: e.target.value })}><option value="">Todos los proyectos</option>{data.catalogos.proyectos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}</select>
          </div>
          {!data.items.length ? <div className="mt-empty"><span className="mt-empty-icon"><RrppIcon nombre="check" className="h-6 w-6"/></span><h2>{vacio.title}</h2><p>{vacio.text}</p></div> : grouped ? <>
            {grouped.vencidas.length > 0 && <><p className="mt-section mt-section-late">Vencidas<span>{grouped.vencidas.length}</span></p><div className="mt-list">{grouped.vencidas.map(i => <Row key={i.id} item={i} to={toProject(i)} origen={origen} ahora={data.actualizadoEn}/>)}</div></>}
            {grouped.hoy.length > 0 && <><p className="mt-section">Hoy<span>{grouped.hoy.length}</span></p><div className="mt-list">{grouped.hoy.map(i => <Row key={i.id} item={i} to={toProject(i)} origen={origen} ahora={data.actualizadoEn}/>)}</div></>}
          </> : <div className="mt-list">{data.items.map(i => <Row key={i.id} item={i} to={toProject(i)} origen={origen} ahora={data.actualizadoEn}/>)}</div>}
          {data.pages > 1 && <div className="mt-pagination"><span>{data.total} resultados</span><div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}><button disabled={page <= 1} onClick={() => update({ page: String(page-1) }, false)} aria-label="Página anterior">‹</button><span>Página {data.page} de {data.pages}</span><button disabled={page >= data.pages} onClick={() => update({ page: String(page+1) }, false)} aria-label="Página siguiente">›</button></div></div>}
        </section>
        <aside className="mt-side">
          <div className="mt-card"><h2><RrppIcon nombre="calendario" className="h-4 w-4"/>Resumen del día</h2>
            <button className="mt-card-row" onClick={() => update({ tab: 'hoy' })}><span>Acciones hoy</span><strong>{data.resumenDia.accionesHoy}</strong></button>
            <button className="mt-card-row" onClick={() => update({ tab: 'vencidas' })}><span>Vencidas</span><strong>{data.resumenDia.vencidas}</strong></button>
            <button className="mt-card-row" onClick={() => update({ tab: 'hoy' })}><span>Entregas recibidas</span><strong>{data.resumenDia.entregasRecibidas}</strong></button>
          </div>
          <div className="mt-card"><h2><RrppIcon nombre="equipo" className="h-4 w-4"/>Dependencias</h2>
            {data.dependencias.length ? data.dependencias.map(d => <button key={d.tipo} className="mt-card-row" onClick={() => update({ tab: 'esperando', dependencia:d.tipo, search:'' })}><span>{d.destino}</span><strong>{d.cantidad}</strong></button>) : <p className="mt-card-empty">No hay dependencias abiertas en tu cartera.</p>}
          </div>
        </aside>
      </div>
      <p className="mt-footnote" style={{ marginTop: 12, fontSize: 10, color: '#9da7b2' }}>Actualizado {new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' }).format(new Date(data.actualizadoEn))} <button onClick={() => query.refetch()}>Actualizar</button></p>
      {filtersOpen&&<FiltrosTrabajo params={params} data={data} onApply={update} onClose={()=>setFiltersOpen(false)}/>}
    </>}
  </CrmSidebarLayout>;
}
