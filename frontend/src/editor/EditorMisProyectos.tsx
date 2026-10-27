import './editor.css';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
import { EditorialCover } from '../jefeEdicion/EditorialParts';
import { EditorEmpty,EditorPanel,editorialDate } from './EditorParts';
import { EditorDetail,EditorKpis,EditorPagination,EditorSearch,EditorSelect,EditorSkeleton,EditorStatus,useEditorFilters } from './EditorUi';
import { editorKey,fetchMiProyectoDetalle,fetchMisProyectos } from './editorApi';
export function EditorMisProyectos(){
 const {params,setParams,update,search,setSearch}=useEditorFilters();
 const selected=params.get('project'),view=params.get('view')??'cards';
 const queryParams=new URLSearchParams({search:params.get('search')??'',page:params.get('page')??'1',pageSize:'25',sort:params.get('sort')??'activity'});
 for(const k of ['state','service','specialist','participation'])if(params.get(k))queryParams.set(k,params.get(k)!);
 const q=useQuery({queryKey:[...editorKey,'mis-proyectos',queryParams.toString()],queryFn:()=>fetchMisProyectos(queryParams),placeholderData:p=>p});
 const items=q.data?.items??[],overview=q.data?.editorOverview;
 return <>
  <EditorKpis items={[
   {label:'Proyectos activos',value:q.data?.counts.inEditing??'—',sub:'En los que participas actualmente',icon:'proyectos',color:'blue',onClick:()=>update('participation','active')},
   {label:'Con entrega próxima',value:q.data?.counts.upcomingDeliveries??'—',sub:'Fechas objetivo registradas',icon:'calendario',color:'amber',onClick:()=>update('sort','delivery')},
   {label:'Esperando autor',value:q.data?.counts.waitingAuthor??'—',sub:'A la espera de su respuesta',icon:'actividad',color:'red',onClick:()=>update('state','Esperando autor')},
   {label:'Intervenciones acumuladas',value:overview?.interventionCount??'—',sub:'En tus proyectos editoriales',icon:'comentarios',color:'violet'}
  ]}/>
  <div className="eo-toolbar"><EditorSearch value={search} onChange={setSearch} placeholder="Buscar proyecto o autor…"/>
   <EditorSelect label="Estado editorial" value={params.get('state')??''} onChange={v=>update('state',v)} options={(q.data?.options.states??[]).map(s=>({id:s,name:s}))}/>
   <EditorSelect label="Servicio" value={params.get('service')??''} onChange={v=>update('service',v)} options={q.data?.options.services??[]}/>
   <EditorSelect label="Especialista" value={params.get('specialist')??''} onChange={v=>update('specialist',v)} options={q.data?.options.specialists??[]}/>
   <EditorSelect label="Participación" value={params.get('participation')??''} onChange={v=>update('participation',v)} options={[{id:'active',name:'Participación activa'},{id:'history',name:'Participación histórica'}]}/>
   <div className="eo-view-toggle" aria-label="Vista de proyectos"><button aria-pressed={view==='cards'} onClick={()=>update('view','cards')}><RrppIcon nombre="capas"/>Tarjetas</button><button aria-pressed={view==='table'} onClick={()=>update('view','table')}><RrppIcon nombre="proceso"/>Tabla</button></div>
  </div>
  {['search','state','service','specialist','participation'].some(k=>params.has(k))&&<button className="eo-text-button eo-clear" onClick={()=>{setSearch('');setParams({vista:'mis-proyectos'});}}>Limpiar filtros</button>}
  <div className={'eo-project-workspace'+(selected?' has-detail':'')}><div className="eo-main">
   {q.isError?<EditorPanel title="Mis proyectos"><EditorEmpty><span role="alert">No se pudieron cargar tus proyectos.</span> <button onClick={()=>q.refetch()}>Reintentar</button></EditorEmpty></EditorPanel>:q.isPending?<EditorSkeleton/>:items.length?view==='cards'?<div className="eo-project-grid">{items.map(p=><article key={p.projectId} className="eo-project-card">
    <div className="eo-project-card-main"><EditorialCover url={p.coverUrl}/><div className="eo-project-card-copy"><div className="eo-project-card-title"><button onClick={()=>update('project',p.projectId)}><h2>{p.title}</h2></button><span className="eo-service-badge">{p.serviceCode||p.service}</span></div><small>#{p.code}</small><small>{p.authors}</small><p><span>Mi participación</span> {p.currentIntervention??p.interventionSummary}</p><EditorStatus state={p.editorialState}/></div></div>
    <p className="eo-project-units">{p.interventionSummary}</p>
    <dl className="eo-facts"><div><dt><RrppIcon nombre="persona"/>Especialista</dt><dd>{p.specialist??'Sin asignar'}</dd></div><div><dt><RrppIcon nombre="calendario"/>Entrega objetivo</dt><dd className={p.overdue?'ec-deadline-overdue':''}>{p.nextDelivery?editorialDate(p.nextDelivery.date):'Sin fecha'}</dd></div><div><dt><RrppIcon nombre="actividad"/>Última actualización</dt><dd>{p.lastActivity?editorialDate(p.lastActivity.at):'Sin actividad'}</dd></div></dl>
    <footer><button onClick={()=>update('project',p.projectId)}><RrppIcon nombre="libro"/>Ver proyecto</button>{p.editingDriveUrl?<a href={p.editingDriveUrl} target="_blank" rel="noreferrer"><RrppIcon nombre="proyectos"/>Abrir Drive</a>:<button onClick={()=>{update({project:p.projectId,detailTab:'files'});}}><RrppIcon nombre="proyectos"/>Material</button>}<button onClick={()=>{update({project:p.projectId,detailTab:'history'});}}><RrppIcon nombre="actividad"/>Historial</button></footer>
   </article>)}</div>:<EditorPanel title="Mis proyectos" icon="proyectos"><div className="eo-table-wrap"><table className="eo-table"><thead><tr>{['Proyecto','Servicio','Estado editorial','Mi participación','Especialista','Próxima entrega','Acción'].map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{items.map(p=><tr key={p.projectId}><td data-label="Proyecto"><strong>{p.title}</strong><small>{p.authors} · #{p.code}</small></td><td data-label="Servicio">{p.service}</td><td data-label="Estado editorial"><EditorStatus state={p.editorialState}/></td><td data-label="Mi participación">{p.currentIntervention??p.interventionSummary}</td><td data-label="Especialista">{p.specialist??'Sin asignar'}</td><td data-label="Próxima entrega">{editorialDate(p.nextDelivery?.date??null)}</td><td data-label="Acción"><button className="eo-row-action" onClick={()=>update('project',p.projectId)}>Ver proyecto</button></td></tr>)}</tbody></table></div></EditorPanel>:<EditorPanel title="Mis proyectos"><EditorEmpty>No tienes proyectos editoriales activos.</EditorEmpty></EditorPanel>}
   {q.data&&<EditorPagination data={q.data} onPage={p=>setParams(current=>{current.set('page',String(p));return current;})}/>}
   {overview&&<div className="eo-project-insights"><EditorPanel title="Mi trabajo por proyecto" icon="indicadores"><ul className="eo-project-load">{overview.loads.map(p=><li key={p.projectId}><button onClick={()=>update('project',p.projectId)}>{p.title}</button><strong>{p.active}</strong><small>intervenciones activas</small></li>)}</ul>{!overview.loads.length&&<EditorEmpty>No hay trabajo activo.</EditorEmpty>}</EditorPanel><EditorPanel title="Próximas entregas" icon="calendario"><ul className="eo-compact-list">{overview.upcoming.map(i=><li key={i.id}><time>{editorialDate(i.dueDate)}</time><Link to={'/?vista=mis-proyectos&project='+i.id}><strong>{i.title}</strong><small>{i.label}</small></Link><RrppIcon nombre="flecha"/></li>)}</ul>{!overview.upcoming.length&&<EditorEmpty>No hay entregas próximas.</EditorEmpty>}</EditorPanel></div>}
  </div>{selected&&<ProyectoDetail key={selected} id={selected} tab={params.get('detailTab')??'summary'} onTab={v=>update('detailTab',v)} onClose={()=>update('project','')}/>}</div>
 </>;
}
function ProyectoDetail({id,tab,onTab,onClose}:{id:string;tab:string;onTab:(s:string)=>void;onClose:()=>void}){
 const q=useQuery({queryKey:[...editorKey,'mi-proyecto-detalle',id],queryFn:()=>fetchMiProyectoDetalle(id)}),d=q.data;
 return <EditorDetail title="Detalle del proyecto" open onClose={onClose}>{q.isPending?<EditorSkeleton/>:q.isError?<EditorEmpty><span role="alert">No se pudo cargar el proyecto.</span> <button onClick={()=>q.refetch()}>Reintentar</button></EditorEmpty>:d&&<>
  <div className="eo-detail-body"><div className="eo-detail-project"><EditorialCover url={d.summary.coverUrl}/><div><h3>{d.summary.title}</h3><small>#{d.summary.code} · {d.summary.authors}</small><span>{d.summary.service}</span></div></div><EditorStatus state={d.summary.editorialState}/></div>
  <div className="eo-tabs" role="tablist" aria-label="Detalle del proyecto">{[['summary','Resumen'],['work','Mi participación'],['files','Archivos'],['history','Historial']].map(([key,label])=><button key={key} role="tab" aria-selected={tab===key} onClick={()=>onTab(key)}>{label}</button>)}</div>
  <div className="eo-detail-body">
   {tab==='summary'&&<><dl className="eo-facts"><div><dt>Especialista</dt><dd>{d.summary.specialist??'Sin asignar'}</dd></div><div><dt>Mi participación</dt><dd>{d.summary.interventionSummary}</dd></div></dl><p className="eo-notice">{d.nextStep}</p></>}
   {(tab==='work'||tab==='summary')&&<><h4>Mis intervenciones en este proyecto</h4><ul className="eo-history">{d.interventions.map(i=><li key={i.id}><Link to={'/?vista=mis-proyectos&project='+i.id}><strong>{i.label} →</strong></Link><small><EditorStatus state={i.state}/> · {editorialDate(i.dueDate)}</small></li>)}</ul>{d.interventionsTotal>d.interventions.length&&<Link className="eo-text-button" to={'/?vista=mi-trabajo&project='+id}>Ver todas las intervenciones →</Link>}</>}
   {tab==='files'&&<div className="eo-drive-links">{d.drive.rootUrl&&<a href={d.drive.rootUrl} target="_blank" rel="noreferrer"><RrppIcon nombre="proyectos"/>Abrir carpeta de Edición<RrppIcon nombre="externo"/></a>}{d.drive.links.map(l=><a key={l.key} href={l.url} target="_blank" rel="noreferrer"><RrppIcon nombre="ingreso"/>{l.label}<RrppIcon nombre="externo"/></a>)}{!d.drive.rootUrl&&!d.drive.links.length&&<EditorEmpty>El material de este proyecto aún no está vinculado.</EditorEmpty>}</div>}
   {tab==='history'&&(d.history.length?<ul className="eo-history">{d.history.map(h=><li key={h.id}><strong>{h.label}</strong><small>{h.actor} · {editorialDate(h.at,true)}</small></li>)}</ul>:<EditorEmpty>Sin actividad registrada.</EditorEmpty>)}
  </div>
 </>}</EditorDetail>;
}
