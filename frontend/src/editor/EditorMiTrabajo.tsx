import './editor.css';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
import { EditorialCover } from '../jefeEdicion/EditorialParts';
import { EditorEmpty, EditorPanel, editorialDate } from './EditorParts';
import { EditorDetail,EditorPagination,EditorSearch,EditorSelect,EditorSkeleton,EditorStatus,currentOwner,interventionType,useEditorFilters,useEditorDesktop } from './EditorUi';
import { fechaActividad } from '../rrpp/RrppDashboardCards';
import { editorKey,fetchMiTrabajo,fetchMiTrabajoDetalle,iniciarTrabajo,registrarAvance,registrarEntrega,reportarBloqueo,resolverBloqueo,fetchArchivosEntrega,cargarArchivoEditorial } from './editorApi';
import { NuevaSolicitudForm } from './EditorSolicitudForm';
const TABS=[['all','Todos'],['today','Para hoy'],['inProgress','En curso'],['feedback','Feedback'],['waiting','En espera'],['completed','Completados']] as const;
export function EditorMiTrabajo(){
 const {params,setParams,update,search,setSearch}=useEditorFilters();
 const tab=TABS.find(([id])=>id===params.get('tab'))?.[0]??'all';
 const selected=params.get('workItem');
 const queryParams=new URLSearchParams({tab,search:params.get('search')??'',page:params.get('page')??'1',pageSize:'10'});
 for(const k of ['status','service','interventionType','project','date','risk'])if(params.get(k))queryParams.set(k,params.get(k)!);
 const q=useQuery({queryKey:[...editorKey,'mi-trabajo',queryParams.toString()],queryFn:()=>fetchMiTrabajo(queryParams),placeholderData:p=>p});
 const rows=q.data?.items??[],options=q.data?.options;
 const desktop=useEditorDesktop();
 const detailId=selected??(desktop&&params.get('detailClosed')!=='1'?rows[0]?.id:undefined);
 const clear=()=>{setSearch('');setParams({vista:'mi-trabajo'});};
 return <>
  <div className="eo-toolbar"><EditorSearch value={search} onChange={setSearch} placeholder="Buscar por proyecto, autor o trabajo…"/>
   <EditorSelect label="Estado" value={params.get('status')??''} onChange={v=>update('status',v)} options={(options?.states??[]).map(s=>({id:s,name:s}))}/>
   <EditorSelect label="Tipo de intervención" value={params.get('interventionType')??''} onChange={v=>update('interventionType',v)} options={options?.types??[]}/>
   <EditorSelect label="Servicio" value={params.get('service')??''} onChange={v=>update('service',v)} options={options?.services??[]}/>
   <details className="eo-more-filters"><summary>Más filtros</summary><div><EditorSelect label="Proyecto" value={params.get('project')??''} onChange={v=>update('project',v)} options={options?.projects??[]}/><label>Fecha objetivo<input type="date" value={params.get('date')??''} onChange={e=>update('date',e.target.value)}/></label></div></details>
   {['search','status','service','interventionType','project','date','risk'].some(k=>params.has(k))&&<button className="eo-text-button" onClick={clear}>Limpiar filtros</button>}
  </div>
  <div className="eo-workspace"><div className="eo-main">
   <EditorPanel title="Intervenciones asignadas" icon="proceso" action={<span className="eo-result-count">{q.data?.total??'—'} resultados</span>}>
    <div className="eo-tabs" role="tablist" aria-label="Estado de mi trabajo">{TABS.map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} onClick={()=>update('tab',id)}>{label}<span>{q.data?.counts[id]??'—'}</span></button>)}</div>
    {q.isError?<EditorEmpty><span role="alert">No se pudieron cargar tus intervenciones.</span> <button onClick={()=>q.refetch()}>Reintentar</button></EditorEmpty>:q.isPending?<EditorSkeleton/>:rows.length?<div className="eo-table-wrap"><table className="eo-table eo-work-table"><thead><tr>{['Proyecto / Autor','Intervención','Estado','Vencimiento','Última actividad',''].map(c=><th key={c}>{c==''?<span className="sr-only">Seleccionar</span>:c}</th>)}</tr></thead><tbody>{rows.map(i=><tr key={i.id} aria-selected={detailId===i.id} className={detailId===i.id?'is-selected':''} tabIndex={0} onClick={()=>update('workItem',i.id)} onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();update('workItem',i.id);}}}>
     <td data-label="Proyecto / Autor"><div className="ec-project"><EditorialCover url={i.coverUrl}/><span><strong>{i.title}</strong><small>{i.code}</small><small>{i.authors}</small></span></div></td>
     <td data-label="Intervención"><strong>{i.label}</strong><small>{interventionType(i)}</small>{i.state==='Requiere ajustes'&&<small className="eo-feedback-label">Feedback disponible</small>}</td>
     <td data-label="Estado"><EditorStatus state={i.state}/></td>
     <td data-label="Vencimiento"><span className={'eo-date'+(i.overdue?' ec-deadline-overdue':'')}><RrppIcon nombre="calendario"/>{editorialDate(i.dueDate)}</span></td>
     <td data-label="Última actividad">{i.lastActivity?<><strong>{i.lastActivity.label}</strong><small>{fechaActividad(i.lastActivity.at)}</small></>:<span className="eo-muted">Sin actividad</span>}</td>
     <td data-label="" className="eo-chevron-cell"><RrppIcon nombre="flecha" className="eo-row-chevron"/></td>
    </tr>)}</tbody></table></div>:<EditorEmpty>No tienes intervenciones asignadas con estos filtros.</EditorEmpty>}
    {q.data&&<EditorPagination data={q.data} onPage={p=>setParams(current=>{current.set('page',String(p));return current;})}/>}
   </EditorPanel>
   {!!rows.filter(i=>i.state==='Bloqueadas').length&&<EditorPanel title="Bloqueos y alertas" icon="riesgo"><div className="eo-alert-list">{rows.filter(i=>i.state==='Bloqueadas').slice(0,3).map(i=><button key={i.id} onClick={()=>update('workItem',i.id)}><RrppIcon nombre="riesgo"/><span><strong>{i.title}</strong><small>{i.block??'Bloqueo pendiente de resolver'}</small></span><RrppIcon nombre="flecha"/></button>)}</div></EditorPanel>}
  </div>
  {detailId?<MiTrabajoDetail key={detailId} id={detailId} open={!!selected} initialAction={selected?params.get('action'):null} onClose={()=>{update({workItem:'',action:'',detailClosed:'1'});}}/>:<div className="eo-detail-placeholder"><RrppIcon nombre="libro"/><p>Tu espacio de trabajo</p><small>Selecciona una intervención para consultar material, entregas y actividad.</small></div>}
  </div>
 </>;
}
function MiTrabajoDetail({id,open,onClose,initialAction}:{id:string;open:boolean;onClose:()=>void;initialAction:string|null}){
 const cache=useQueryClient();
 const q=useQuery({queryKey:[...editorKey,'mi-trabajo-detalle',id],queryFn:()=>fetchMiTrabajoDetalle(id)});
 const [mode,setMode]=useState(initialAction==='entrega'?'entrega':''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const [form,setForm]=useState({driveUrl:'',observaciones:'',reason:'',note:'',resolution:''});
 const [tab,setTab]=useState<'material'|'entregas'|'feedback'|'historial'>('material');
 async function invalidate(){await cache.invalidateQueries({predicate:q=>['editor','editorial-chief','notificaciones','solicitudes','proyectos','especialista-inicio','especialista-mi-trabajo'].includes(String(q.queryKey[0]))});}
 async function run(action:()=>Promise<unknown>,message:string){if(busy)return;setBusy(true);setError('');setSuccess('');try{await action();await invalidate();setMode('');setSuccess(message);}catch(e){setError(e instanceof Error?e.message:'No se pudo completar la acción.');}finally{setBusy(false);}}
 const d=q.data,item=d?.item;
 useEffect(()=>{setError('');},[mode]);
 return <EditorDetail title="Detalle de la tarea seleccionada" open={open} onClose={onClose}>
  {q.isPending?<EditorSkeleton/>:q.isError?<EditorEmpty><span role="alert">No se pudo cargar la intervención.</span> <button onClick={()=>q.refetch()}>Reintentar</button></EditorEmpty>:item&&d&&<>
   <div className="eo-detail-body"><div className="eo-detail-project"><EditorialCover url={item.coverUrl}/><div><h3>{item.title}</h3><small>{item.code}</small><span>{item.service}</span></div><EditorStatus state={item.state}/></div>
   <dl className="eo-facts"><div><dt>Trabajo asignado</dt><dd>{item.label}</dd></div><div><dt>Autoría</dt><dd>{item.authors}</dd></div><div><dt>Editor</dt><dd>{item.editor??'Sin asignar'}</dd></div><div><dt>Especialista</dt><dd>{d.specialist??'Sin asignar'}</dd></div><div><dt>Asignación</dt><dd>{editorialDate(d.assignedAt??null)}</dd></div><div><dt>Inicio</dt><dd>{item.startedAt?editorialDate(item.startedAt):'Por iniciar'}</dd></div><div><dt>Fecha objetivo</dt><dd className={item.overdue?'ec-deadline-overdue':''}>{editorialDate(item.dueDate)}</dd></div><div><dt>Responsable actual</dt><dd>{currentOwner(item)}</dd></div></dl>
   {item.waitingOn&&<p className="eo-notice">Esta espera no se cuenta como atraso tuyo.</p>}
   {d.blocker?<div className="eo-blocker"><RrppIcon nombre="riesgo"/><div><strong>Bloqueo abierto</strong><p>{d.blocker.reason}</p><small>{editorialDate(d.blocker.createdAt,true)}</small><button className="ec-secondary" disabled={busy} onClick={()=>setMode('resolver')}>Registrar resolución</button><button className="eo-text-button" onClick={()=>setMode('solicitud')}>Solicitar apoyo</button></div></div>:item.actionable&&<div className="eo-actions">
    {!item.startedAt?<button className="ec-primary" disabled={busy} onClick={()=>run(()=>iniciarTrabajo(id),'Trabajo iniciado.')}>Iniciar trabajo</button>:<button className="ec-primary" disabled={busy} onClick={()=>setMode('entrega')}><RrppIcon nombre="externo"/>{item.state==='Requiere ajustes'?'Entregar feedback aplicado':'Registrar entrega'}</button>}
    {item.startedAt&&<button className="ec-secondary" disabled={busy} onClick={()=>setMode('avance')}><RrppIcon nombre="ingreso"/>Registrar avance</button>}
    <button className="ec-secondary eo-danger" disabled={busy} onClick={()=>setMode('bloqueo')}><RrppIcon nombre="riesgo"/>Reportar bloqueo</button>
    <button className="eo-text-button" disabled={busy} onClick={()=>setMode('solicitud')}>Solicitar apoyo o reasignación →</button>
   </div>}
   {mode==='entrega'&&item.actionable&&!d.blocker&&<form className="ep-form" onSubmit={e=>{e.preventDefault();void run(()=>registrarEntrega(id,form.driveUrl,form.observaciones),'Entrega registrada y enviada al Especialista.');}}><h4>Registrar entrega</h4><DriveFilePicker id={id} folders={d.folders} onSelect={url=>setForm({...form,driveUrl:url})}/><label>Enlace del archivo en Drive<input type="url" required placeholder="https://drive.google.com/file/d/…" value={form.driveUrl} onChange={e=>setForm({...form,driveUrl:e.target.value})}/></label><p className="eo-muted">El archivo debe estar en el espacio documental de este proyecto y ser accesible para PanHouse.</p><label>Observaciones (opcional)<textarea maxLength={1000} value={form.observaciones} onChange={e=>setForm({...form,observaciones:e.target.value})}/></label><div className="eo-actions"><button className="ec-primary" disabled={busy}>{busy?'Registrando…':'Confirmar entrega'}</button><button type="button" disabled={busy} onClick={()=>setMode('')}>Cancelar</button></div></form>}
   {['avance','bloqueo','resolver'].includes(mode)&&<form className="ep-form" onSubmit={e=>{e.preventDefault();void run(mode==='avance'?()=>registrarAvance(id,form.note):mode==='bloqueo'?()=>reportarBloqueo(id,form.reason):()=>resolverBloqueo(id,form.resolution),mode==='avance'?'Avance registrado.':mode==='bloqueo'?'Bloqueo reportado.':'Bloqueo resuelto.');}}><label>{mode==='avance'?'Observación del avance':mode==='bloqueo'?'Motivo del bloqueo':'Resolución del bloqueo'}<textarea required minLength={5} maxLength={1000} value={mode==='avance'?form.note:mode==='bloqueo'?form.reason:form.resolution} onChange={e=>setForm({...form,[mode==='avance'?'note':mode==='bloqueo'?'reason':'resolution']:e.target.value})}/></label><div className="eo-actions"><button className="ec-primary" disabled={busy}>{busy?'Guardando…':'Guardar'}</button><button type="button" disabled={busy} onClick={()=>setMode('')}>Cancelar</button></div></form>}
   {mode==='solicitud'&&item.workItemId&&<NuevaSolicitudForm workItemId={item.workItemId} onDone={()=>{setMode('');setSuccess('Solicitud enviada.');void invalidate();}} onCancel={()=>setMode('')}/>}
   {error&&<p role="alert" className="eo-error">{error}</p>}{success&&<p role="status" className="eo-success">{success}</p>}
   <Link className="eo-project-link" to={'/?vista=mis-proyectos&project='+item.projectId}><RrppIcon nombre="libro"/>Ver proyecto relacionado<RrppIcon nombre="flecha"/></Link>
   </div>
   {(()=>{const feedback=d.history.filter(h=>/feedback/i.test(h.label));return <>
    <div className="eo-tabs eo-detail-tabs" role="tablist" aria-label="Contenido de la intervención">
     {([['material','Material',d.folders.filter(f=>f.driveUrl).length],['entregas','Entregas',d.deliveries.length],['feedback','Feedback',feedback.length],['historial','Historial',d.history.length]] as const).map(([id,label,count])=>
      <button key={id} role="tab" aria-selected={tab===id} onClick={()=>setTab(id)}>{label}<span>{count}</span></button>)}
    </div>
    <div className="eo-detail-tab-panel">
     {tab==='material'&&(d.folders.some(f=>f.driveUrl)?<div className="eo-drive-links">{d.folders.filter(f=>f.driveUrl).map(f=><a href={f.driveUrl!} key={f.key} target="_blank" rel="noreferrer"><RrppIcon nombre="proyectos"/>{f.label}<RrppIcon nombre="externo"/></a>)}</div>:<EditorEmpty>El material de Drive aún no está vinculado a esta intervención.</EditorEmpty>)}
     {tab==='entregas'&&(d.deliveries.length?<ul className="eo-history">{d.deliveries.map(del=><li key={del.id}><a href={del.driveUrl} target="_blank" rel="noreferrer">Ver archivo entregado ↗</a><small>{editorialDate(del.submittedAt,true)}</small>{del.observaciones&&<p>{del.observaciones}</p>}</li>)}</ul>:<EditorEmpty>Aún no registras entregas para esta intervención.</EditorEmpty>)}
     {tab==='feedback'&&(feedback.length?<ul className="eo-history">{feedback.map(h=><li key={h.id}><strong>{h.label}</strong><small>{h.actor} · {editorialDate(h.at,true)}</small></li>)}</ul>:<EditorEmpty>No tienes feedback registrado para esta intervención.</EditorEmpty>)}
     {tab==='historial'&&(d.history.length?<ul className="eo-history">{d.history.map(h=><li key={h.id}><strong>{h.label}</strong><small>{h.actor} · {editorialDate(h.at,true)}</small></li>)}</ul>:<EditorEmpty>Sin actividad registrada.</EditorEmpty>)}
    </div>
   </>;})()}
  </>}
 </EditorDetail>;
}
function DriveFilePicker({id,folders,onSelect}:{id:string;folders:{key:string;label:string;driveUrl:string|null}[];onSelect:(url:string)=>void}){
 const [folder,setFolder]=useState(''),[token,setToken]=useState(''),[uploading,setUploading]=useState(false),[uploadError,setUploadError]=useState('');
 const cache=useQueryClient();
 async function upload(file?:File){if(!file||uploading)return;setUploading(true);setUploadError('');try{const uploaded=await cargarArchivoEditorial(id,folder,file);onSelect(uploaded.url);await cache.invalidateQueries({queryKey:[...editorKey,'drive-files',id]});}catch(e){setUploadError(e instanceof Error?e.message:'No se pudo cargar el archivo.');}finally{setUploading(false);}}
 const q=useQuery({queryKey:[...editorKey,'drive-files',id,folder,token],queryFn:()=>fetchArchivosEntrega(id,folder,token||undefined),enabled:!!folder,retry:false});
 return <div className="eo-file-picker">{['EDITING','EDITING_OUTPUT','EDITING_FEEDBACK_APPLIED'].includes(folder)&&<label className="eo-upload-label">{uploading?'Cargando documento…':'Añadir un documento a esta carpeta'}<input type="file" accept=".doc,.docx,.pdf,.odt,.rtf,.txt" disabled={uploading} onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/><small>Word, PDF, ODT, RTF o TXT · Hasta 8 MB</small></label>}{uploadError&&<p role="alert">{uploadError}</p>}<EditorSelect label="Seleccionar archivo del proyecto" value={folder} onChange={v=>{setFolder(v);setToken('');}} options={folders.filter(f=>f.driveUrl).map(f=>({id:f.key,name:f.label}))}/>{folder&&(q.isPending?<EditorSkeleton/>:q.isError?<p role="alert">No pudimos consultar los archivos. Verifica que estén disponibles para PanHouse. <button type="button" onClick={()=>q.refetch()}>Reintentar</button></p>:<><ul>{q.data?.items.map(f=><li key={f.id}><button type="button" onClick={()=>onSelect(f.url)}><RrppIcon nombre="ingreso"/>{f.name}<span>Seleccionar</span></button></li>)}</ul>{!q.data?.items.length&&<p>No hay archivos accesibles en esta carpeta.</p>}{q.data?.nextPageToken&&<button type="button" onClick={()=>setToken(q.data!.nextPageToken!)}>Más archivos</button>}</>)}</div>;
}
