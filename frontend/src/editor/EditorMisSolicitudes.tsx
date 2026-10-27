import './editor.css';
import { useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
import { EDITOR_REQUEST_LABELS,EDITOR_REQUEST_TYPES } from '../../../shared/editorOwn';
import { EditorEmpty,EditorPanel,editorialDate } from './EditorParts';
import { EditorDetail,EditorKpis,EditorPagination,EditorSearch,EditorSelect,EditorSkeleton,EditorStatus,useEditorFilters,useEditorDesktop } from './EditorUi';
import { cancelarSolicitud,responderSolicitud,editorKey,fetchMiSolicitudDetalle,fetchMiTrabajo,fetchMisSolicitudes } from './editorApi';
import { NuevaSolicitudForm } from './EditorSolicitudForm';
const TABS=[['all','Todas'],['pending','Pendientes'],['resolved','Resueltas'],['returned','Devueltas'],['cancelled','Canceladas']] as const;
const STATUS:Record<string,string>={pendiente:'Pendiente',en_revision:'En revisión',devuelta:'Devuelta',resuelta:'Resuelta',cancelada:'Cancelada'};
export function EditorMisSolicitudes(){
 const {params,setParams,update,search,setSearch}=useEditorFilters();
 const tab=TABS.find(([id])=>id===params.get('tab'))?.[0]??'all',selected=params.get('request'),creating=params.get('create')==='1';
 const queryParams=new URLSearchParams({tab,page:params.get('page')??'1',pageSize:'25'});
 for(const k of ['search','type','project'])if(params.get(k))queryParams.set(k,params.get(k)!);
 const q=useQuery({queryKey:[...editorKey,'mis-solicitudes',queryParams.toString()],queryFn:()=>fetchMisSolicitudes(queryParams),placeholderData:p=>p});
 const desktop=useEditorDesktop();
 const items=q.data?.items??[],detailId=selected??(desktop&&params.get('detailClosed')!=='1'?items[0]?.id:undefined);
 return <>
  <EditorKpis items={[
   {label:'Totales',value:q.data?.counts.all??'—',sub:'Todas tus solicitudes enviadas',icon:'lista',color:'blue',onClick:()=>update('tab','all')},
   {label:'Pendientes',value:q.data?.counts.pending??'—',sub:'En espera de atención',icon:'actividad',color:'amber',onClick:()=>update('tab','pending')},
   {label:'Devueltas',value:q.data?.counts.returned??'—',sub:'Requieren más información',icon:'reasignar',color:'violet',onClick:()=>update('tab','returned')},
   {label:'Resueltas',value:q.data?.counts.resolved??'—',sub:'Con respuesta final',icon:'check',color:'green',onClick:()=>update('tab','resolved')}
  ]}/>
  <div className="eo-workspace eo-requests-workspace"><div className="eo-main"><EditorPanel title="Bandeja de solicitudes enviadas" icon="capas">
   <div className="eo-toolbar eo-in-panel"><EditorSearch value={search} onChange={setSearch} placeholder="Buscar solicitud…"/><EditorSelect label="Tipo" value={params.get('type')??''} onChange={v=>update('type',v)} options={EDITOR_REQUEST_TYPES.map(t=>({id:t,name:EDITOR_REQUEST_LABELS[t]}))}/><button className="ec-primary eo-new-request" onClick={()=>{update({create:'1',request:''});}}>+ Nueva solicitud</button></div>
   <div className="eo-tabs" role="tablist" aria-label="Estado de mis solicitudes">{TABS.map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} onClick={()=>update('tab',id)}>{label}<span>{q.data?.counts[id]??'—'}</span></button>)}</div>
   {q.isError?<EditorEmpty><span role="alert">No se pudieron cargar tus solicitudes.</span> <button onClick={()=>q.refetch()}>Reintentar</button></EditorEmpty>:q.isPending?<EditorSkeleton/>:items.length?<div className="eo-table-wrap"><table className="eo-table eo-requests-table"><thead><tr>{['Tipo','Proyecto / Intervención','Motivo','Fecha','Estado','Destino','Acción'].map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{items.map(r=><tr key={r.id} className={detailId===r.id&&!creating?'is-selected':''} aria-selected={detailId===r.id&&!creating} tabIndex={0} onClick={()=>{update({create:'',request:r.id});}} onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();update({create:'',request:r.id});}}}>
    <td data-label="Tipo"><span className="eo-request-type"><RrppIcon nombre={r.type==='editor_reasignacion'?'reasignar':r.type==='editor_aclaracion'?'comentarios':'equipo'}/>{EDITOR_REQUEST_LABELS[r.type]}</span></td>
    <td data-label="Proyecto / Intervención"><strong>{r.title}</strong><small>{r.interventionLabel}</small></td><td data-label="Motivo"><p className="eo-request-reason">{r.motivo}</p></td><td data-label="Fecha">{editorialDate(r.requestedAt)}</td><td data-label="Estado"><EditorStatus state={STATUS[r.status]}/></td><td data-label="Destino">{r.target}</td><td data-label="Acción"><button className="eo-row-action" onClick={e=>{e.stopPropagation();update({create:'',request:r.id});}}>Ver</button></td>
   </tr>)}</tbody></table></div>:<EditorEmpty>{['search','type','project'].some(k=>params.has(k))?'No hay solicitudes con estos filtros.':'Aún no has enviado solicitudes.'}</EditorEmpty>}
   {q.data&&<EditorPagination data={q.data} onPage={p=>setParams(current=>{current.set('page',String(p));return current;})}/>}
  </EditorPanel><div className="eo-request-guidance"><RrppIcon nombre="libro"/><div><strong>Tu equipo, al tanto</strong><p>Envía solicitudes desde una intervención para conservar su contexto. Aquí podrás consultar las respuestas y completar la información que te pidan.</p></div></div></div>
  {creating?<NuevaSolicitudPicker onClose={()=>update('create','')}/>:detailId?<SolicitudDetail key={detailId} id={detailId} open={!!selected} onClose={()=>update({request:'',detailClosed:'1'})}/>:<div className="eo-detail-placeholder"><RrppIcon nombre="conceptos"/><p>El recorrido de tu solicitud</p><small>Selecciona una solicitud para consultar su estado, historial y respuesta.</small></div>}
  </div>
 </>;
}
function NuevaSolicitudPicker({onClose}:{onClose:()=>void}){
 const [projectId,setProjectId]=useState(''),[workItemId,setWorkItemId]=useState(''),[page,setPage]=useState(1);
 const q=useQuery({queryKey:[...editorKey,'request-picker',projectId,page],queryFn:()=>fetchMiTrabajo(new URLSearchParams({tab:'all',page:String(page),pageSize:'50',...(projectId?{project:projectId}:{})}))});
 const projects=q.data?.options?.projects??[],items=(q.data?.items??[]).filter(i=>i.workItemId&&i.state!=='Completadas'&&(!projectId||i.projectId===projectId));
 return <EditorDetail title="Nueva solicitud" open onClose={onClose}><div className="eo-detail-body"><p className="eo-muted">Selecciona el proyecto y la intervención sobre la que necesitas apoyo.</p>{q.isPending?<EditorSkeleton/>:q.isError?<p role="alert">No se pudo cargar tu trabajo. <button onClick={()=>q.refetch()}>Reintentar</button></p>:<>
  <label className="eo-form-label">Proyecto<select value={projectId} onChange={e=>{setProjectId(e.target.value);setWorkItemId('');setPage(1);}}><option value="">Selecciona un proyecto</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
  {projectId&&<label className="eo-form-label">Intervención<select value={workItemId} onChange={e=>setWorkItemId(e.target.value)}><option value="">Selecciona una intervención</option>{items.map(i=><option key={i.id} value={i.workItemId!}>{i.label}</option>)}</select></label>}
  {q.data&&q.data.pages>1&&<EditorPagination data={q.data} onPage={setPage}/>}
  {workItemId&&<NuevaSolicitudForm workItemId={workItemId} onDone={onClose} onCancel={onClose}/>}
  {!q.data?.total&&<EditorEmpty>No tienes intervenciones para crear una solicitud.</EditorEmpty>}
 </>}</div></EditorDetail>;
}
function SolicitudDetail({id,open,onClose}:{id:string;open:boolean;onClose:()=>void}){
 const cache=useQueryClient(),q=useQuery({queryKey:[...editorKey,'mi-solicitud-detalle',id],queryFn:()=>fetchMiSolicitudDetalle(id)});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[response,setResponse]=useState(''),[canceling,setCanceling]=useState(false),d=q.data;
 async function run(action:()=>Promise<unknown>){if(busy)return;setBusy(true);setError('');try{await action();await cache.invalidateQueries({queryKey:editorKey});setCanceling(false);}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar la acción.');}finally{setBusy(false);}}
 return <EditorDetail title="Detalle de solicitud" open={open} onClose={onClose}>{q.isPending?<EditorSkeleton/>:q.isError?<EditorEmpty><span role="alert">No se pudo cargar la solicitud.</span> <button onClick={()=>q.refetch()}>Reintentar</button></EditorEmpty>:d&&<>
  <div className="eo-detail-body"><div className="eo-request-heading"><span className="eo-request-icon"><RrppIcon nombre={d.summary.type==='editor_reasignacion'?'reasignar':'comentarios'}/></span><div><h3>{EDITOR_REQUEST_LABELS[d.summary.type]}</h3><p>{d.summary.title}</p><small>{d.summary.interventionLabel}</small></div><EditorStatus state={STATUS[d.summary.status]}/></div>
   <dl className="eo-facts"><div><dt>Destino</dt><dd>{d.summary.target}</dd></div><div><dt>Enviada</dt><dd>{editorialDate(d.summary.requestedAt,true)}</dd></div></dl>
   <h4>Motivo de la solicitud</h4><p className="eo-body-copy">{d.description}</p>
   {d.summary.returnReason&&d.summary.status==='devuelta'&&<p className="eo-notice"><strong>Información solicitada</strong><br/>{d.summary.returnReason}</p>}
   {d.summary.outcome&&<div className="eo-resolution"><RrppIcon nombre="check"/><div><h4>Resultado</h4><p>{d.summary.outcome}</p><small>{d.summary.resolvedBy??d.summary.target} · {editorialDate(d.summary.resolvedAt,true)}</small></div></div>}
   {d.summary.reassignment&&<dl className="eo-facts"><div><dt>Editor anterior</dt><dd>{d.summary.reassignment.previousEditor}</dd></div><div><dt>Nuevo Editor</dt><dd>{d.summary.reassignment.nextEditor}</dd></div><div><dt>Reasignación realizada</dt><dd>{editorialDate(d.summary.reassignment.assignedAt,true)}</dd></div></dl>}
   <h4>Recorrido de la solicitud</h4>{d.history.length?<ol className="eo-request-timeline">{d.history.map(h=><li key={h.id}><i/><strong>{h.label}</strong><small>{h.actor}</small><time>{editorialDate(h.at,true)}</time></li>)}</ol>:<EditorEmpty>Sin eventos registrados todavía.</EditorEmpty>}
   {!!d.observations?.length&&<><h4>Observaciones</h4><div className="eo-observations">{d.observations.map(o=><article key={o.id}><strong>{o.question}</strong><small>{editorialDate(o.at,true)}</small>{o.answer&&<p>{o.answer}</p>}</article>)}</div></>}
   {d.summary.status==='devuelta'&&<form className="ep-form" onSubmit={e=>{e.preventDefault();void run(()=>responderSolicitud(id,d.summary.version,response));}}><label>Completar información<textarea required minLength={5} maxLength={1000} value={response} onChange={e=>setResponse(e.target.value)}/></label><button className="ec-primary" disabled={busy}>Responder y reenviar</button></form>}
   <Link className="eo-project-link" to={'/?vista=mis-proyectos&project='+d.summary.projectId}><RrppIcon nombre="libro"/>Ver proyecto relacionado<RrppIcon nombre="flecha"/></Link>
   {['pendiente','en_revision'].includes(d.summary.status)&&(canceling?<div className="eo-cancel-confirm"><p>¿Cancelar esta solicitud? Se conservará su historial.</p><button className="ec-secondary" disabled={busy} onClick={()=>setCanceling(false)}>Volver</button><button className="ec-primary" disabled={busy} onClick={()=>run(()=>cancelarSolicitud(id,d.summary.version))}>Confirmar cancelación</button></div>:<button className="ec-secondary eo-cancel-request" onClick={()=>setCanceling(true)}>Cancelar solicitud</button>)}
   {error&&<p role="alert" className="eo-error">{error}</p>}
  </div>
 </>}</EditorDetail>;
}
