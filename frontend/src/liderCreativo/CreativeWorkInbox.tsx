import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import type {CreativeWorkItem,CreativeWorkStatus,CreativeWorkGroup} from '../../../shared/creativeLeader';
import {RrppIcon} from '../rrpp/RrppIcons';
import {creativeDate} from './CreativeDashboardParts';
import {useCreativeWork} from './creativeApi';
import {creativeWorkFilters,creativeWorkRoute} from './creativeWorkRoutes';
import './creativeWork.css';
const groups:{id:CreativeWorkGroup|'';label:string;icon:'capas'|'ingreso'|'conceptos'|'proyectos'|'libro'}[]=[
 {id:'',label:'Todos',icon:'capas'},{id:'BRIEF',label:'Brief',icon:'ingreso'},{id:'CONCEPT',label:'Conceptos',icon:'conceptos'},{id:'RESOURCES',label:'Recursos',icon:'proyectos'},{id:'COVER_REVIEW',label:'Cubiertas',icon:'libro'}];
const statuses:CreativeWorkStatus[]=['Pendiente','En curso','Requiere ajustes','Esperando RRPP','Esperando autor','Esperando Especialista','Esperando Diseño','Bloqueada','Completada'];
function Due({item}:{item:CreativeWorkItem}){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const diff=item.dueAt?Math.round((Date.parse(item.dueAt+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000):null;
 return <span className={'cw-due '+(item.overdue?'cw-late':'')}><RrppIcon nombre="calendario" className="h-4 w-4"/>{item.overdue?`Vencida hace ${Math.abs(diff!)} ${diff===-1?'día':'días'}`:diff===0?'Hoy':diff===1?'Mañana':creativeDate(item.dueAt)}</span>;
}
function Status({item}:{item:CreativeWorkItem}){
 const tone=item.state==='Requiere ajustes'?'adjust':item.state==='Completada'?'done':item.state==='En curso'?'progress':item.state.startsWith('Esperando')?'waiting':'pending';
 return <span className={'cw-status '+tone}>{item.state==='Esperando RRPP'?'Esperando revisión de RRPP':item.state}</span>;
}
function Cover({item}:{item:CreativeWorkItem}){return item.project.coverUrl?<img className="cw-cover" src={item.project.coverUrl} alt=""/>:<span className="cw-cover cw-cover-empty" aria-label="Sin portada"><RrppIcon nombre="libro"/><small>PH</small></span>;}
export function CreativeWorkInbox(){
 const [params,setParams]=useSearchParams(),navigate=useNavigate(),query=useCreativeWork(creativeWorkFilters(params));
 const [search,setSearch]=useState(params.get('search')??''),[filtersOpen,setFiltersOpen]=useState(false),dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>setSearch(params.get('search')??''),[params.get('search')]);
 useEffect(()=>{const timeout=setTimeout(()=>{if(search!==(params.get('search')??''))change('search',search);},300);return()=>clearTimeout(timeout);},[search,params]);
 useEffect(()=>{if(filtersOpen)dialog.current?.showModal();else dialog.current?.close();},[filtersOpen]);
 function change(key:string,value:string){setParams(p=>{p.delete('pagina');if(value)p.set(key,value);else p.delete(key);if(key==='estado'){if(value==='Completada')p.set('alcance','completadas');else p.delete('alcance');}return p;});}
 const clear=()=>{setSearch('');setParams({vista:'mi-trabajo'});};
 const data=query.data,counts=data?.counts,hasFilters=['tipo','estado','servicio','fecha','search','alcance'].some(k=>params.has(k));
 const returnParams=new URLSearchParams(params);for(const key of ['trabajo','proyecto','workItem','accion','concepto','volver'])returnParams.delete(key);
 const returnTo='/?'+returnParams,route=(item:CreativeWorkItem)=>creativeWorkRoute(item,returnTo);
 const filters=<><div className="cw-filter-heading"><RrppIcon nombre="capas"/><h2>Filtros rápidos</h2></div>
 <fieldset><legend>Estado</legend>{statuses.filter(s=>!!counts?.states[s]||params.get('estado')===s||['Pendiente','En curso','Requiere ajustes','Completada'].includes(s)).map(s=><label key={s}><input type="radio" name={filtersOpen?'drawer-status':'status'} checked={params.get('estado')===s} onClick={()=>{if(params.get('estado')===s)change('estado','');}} onChange={()=>change('estado',s)}/><span>{s}</span><small>{counts?.states[s]??0}</small></label>)}</fieldset>
 <fieldset><legend>Servicio</legend><label><input type="radio" name={filtersOpen?'drawer-service':'service'} checked={!params.has('servicio')} onChange={()=>change('servicio','')}/><span>Todos los servicios</span></label>{counts?.services.map(s=><label key={s.id}><input type="radio" name={filtersOpen?'drawer-service':'service'} checked={params.get('servicio')===s.id} onChange={()=>change('servicio',s.id)}/><span>{s.label}</span><small>{s.count}</small></label>)}</fieldset>
 <p className="cw-scope-note">«Todos» muestra trabajo sin cerrar, incluidas las esperas. Consulta las completadas para ver el historial.</p>
 <button className="cw-history" aria-pressed={params.get('alcance')==='todas'} onClick={()=>setParams(p=>{p.delete('pagina');p.delete('estado');if(p.get('alcance')==='todas')p.delete('alcance');else p.set('alcance','todas');return p;})}> {params.get('alcance')==='todas'?'Ver solo trabajo sin cerrar':'Incluir historial completo'}</button>
 <div className={'cw-overdue '+(counts?.overdue?'has-overdue':'')}><RrppIcon nombre="actividad"/>{counts?.overdue?<button onClick={()=>change('fecha','vencidos')}>{counts.overdue} {counts.overdue===1?'tarea vencida':'tareas vencidas'}</button>:<span>{counts?'No tienes tareas vencidas.':'Consulta de vencimientos pendiente.'}</span>}</div></>;
 return <section className="cw-inbox" aria-label="Bandeja de trabajo creativo">
 <div className="cw-categories" aria-label="Tipo de intervención">{groups.map(g=><button key={g.id} aria-pressed={(params.get('tipo')??'')===g.id} onClick={()=>change('tipo',g.id)}><span className={'cw-category-icon '+g.id}><RrppIcon nombre={g.icon}/></span><span>{g.label}<strong>{counts?(g.id?counts.types[g.id]:counts.all):'—'}</strong></span></button>)}</div>
 <div className="cw-grid"><div className="cw-main"><div className="cw-toolbar"><label className="cw-search"><RrppIcon nombre="buscar"/><input aria-label="Buscar por proyecto, autor o tarea" placeholder="Buscar por proyecto, autor o tarea…" value={search} maxLength={200} onChange={e=>setSearch(e.target.value)}/></label>
 <select aria-label="Filtrar por fecha" value={params.get('fecha')??''} onChange={e=>change('fecha',e.target.value)}><option value="">Fecha</option><option value="hoy">Hoy</option><option value="semana">Esta semana</option><option value="proximos">Próximos</option><option value="vencidos">Vencidos</option><option value="sin-fecha">Sin fecha</option></select>
 <select aria-label="Ordenar trabajo" value={params.get('orden')??'accion'} onChange={e=>change('orden',e.target.value)}><option value="accion">Atención</option><option value="fecha">Fecha límite</option></select>
 <button className="cw-open-filters" onClick={()=>setFiltersOpen(true)}><RrppIcon nombre="capas"/>Filtros</button><button className="cw-clear" onClick={clear}>Limpiar filtros</button></div>
 <div aria-live="polite" aria-busy={query.isFetching}>
 {query.isPending?<div className="cw-skeleton" role="status" aria-label="Cargando tareas creativas">{Array.from({length:8},(_,i)=><div key={i}/>)}</div>:
 query.isError?<div className="cw-empty" role="alert"><strong>No se pudo cargar tu trabajo.</strong><p>{query.error.message}</p><button onClick={()=>query.refetch()}>Reintentar</button></div>:
 !data?.items.length?<div className="cw-empty"><RrppIcon nombre="libro" className="h-9 w-9"/><strong>{hasFilters?'Sin resultados con estos filtros.':'No tienes trabajo creativo pendiente.'}</strong><p>{hasFilters?'Prueba con otros criterios de búsqueda.':'Las nuevas intervenciones aparecerán aquí cuando un proyecto requiera tu participación.'}</p>{hasFilters&&<button onClick={clear}>Limpiar filtros</button>}</div>:
 <><table className="cw-table"><thead><tr><th>Proyecto / Autor</th><th>Tarea</th><th>Estado</th><th>Fecha límite</th><th>Acción</th></tr></thead><tbody>{data.items.map(item=><tr key={item.id} onClick={e=>{if(!(e.target as HTMLElement).closest('a,button'))navigate(route(item));}}><td><div className="cw-project"><Cover item={item}/><div><Link to={route(item)}>{item.project.title}</Link><small>{item.project.authors} · {item.project.service}</small></div></div></td><td><div className="cw-task"><RrppIcon nombre={item.group==='BRIEF'?'ingreso':item.group==='CONCEPT'?'conceptos':item.group==='RESOURCES'?'proyectos':'libro'}/><div><strong>{item.label}</strong><p title={item.context}>{item.context}</p></div></div></td><td><Status item={item}/></td><td><Due item={item}/></td><td><Link className={item.actionable?'cw-action':'cw-view-process'} to={route(item)}>{item.cta}{!item.actionable&&' →'}</Link></td></tr>)}</tbody></table>
 <div className="cw-mobile-cards">{data.items.map(item=><article key={item.id}><div className="cw-project"><Cover item={item}/><div><Link to={route(item)}>{item.project.title}</Link><small>{item.project.authors} · {item.project.service}</small></div></div><h2>{item.label}</h2><p>{item.context}</p><div className="cw-card-meta"><Status item={item}/><Due item={item}/></div><Link className={item.actionable?'cw-action':'cw-view-process'} to={route(item)}>{item.cta}</Link></article>)}</div></>}
 </div>
 {data&&<footer className="cw-pagination"><span>{data.total?`Mostrando ${(data.page-1)*data.pageSize+1} a ${Math.min(data.page*data.pageSize,data.total)} de ${data.total} tareas`:'0 tareas'}</span><nav aria-label="Paginación de tareas"><button aria-label="Página anterior" disabled={data.page<=1||query.isFetching} onClick={()=>setParams(p=>{p.set('pagina',String(data.page-1));return p;})}>‹</button><span>{data.page}</span><button aria-label="Página siguiente" disabled={data.page*data.pageSize>=data.total||query.isFetching} onClick={()=>setParams(p=>{p.set('pagina',String(data.page+1));return p;})}>›</button></nav><label>Filas por página<select value={data.pageSize} onChange={e=>change('pageSize',e.target.value)}>{[10,25,50].map(n=><option key={n}>{n}</option>)}</select></label></footer>}
 </div><aside className="cw-filter-rail">{!filtersOpen&&filters}</aside></div>
 {filtersOpen&&<dialog ref={dialog} className="cw-filter-drawer" onCancel={()=>setFiltersOpen(false)} aria-label="Filtros de trabajo creativo"><button className="cw-close-filters" onClick={()=>setFiltersOpen(false)} aria-label="Cerrar filtros">×</button>{filters}<button className="cw-action" onClick={()=>setFiltersOpen(false)}>Ver resultados</button></dialog>}
 </section>;
}
