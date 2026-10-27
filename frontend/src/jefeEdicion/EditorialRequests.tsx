import { EditorRequestDecision } from '../editor/EditorRequestDecision';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import type { EditorialRequestDetail, EditorialRequestStatus } from '../../../shared/editorialChief';
import { editorialKey, fetchEditorialActivity, fetchEditorialRequestDetail, fetchEditorialRequests, returnEditorialRequest } from './jefeEdicionApi';
import { EditorialCover, EditorialEmpty, editorialDate } from './EditorialParts';
import { EditorialDrawer, useInvalidateEditorial } from './EditorialDrawers';
import { EditorialRowsSkeleton } from './EditorialAssignments';
import { RrppIcon } from '../rrpp/RrppIcons';
import './editorialChief.css';
import './editorialProjects.css';
import './editorialRequests.css';

const requestTypeLabel=(type:string)=>type==='editor_apoyo'?'Apoyo editorial':type==='editor_reasignacion'?'Reasignación de Editor':'Asignación de Editor';
const TABS = [['pending', 'Pendientes'], ['resolved', 'Resueltas'], ['returned', 'Devueltas'], ['all', 'Todas']] as const;
const DETAIL_TABS = [['resumen', 'Resumen'], ['contexto', 'Contexto'], ['archivos', 'Archivos'], ['historial', 'Historial']] as const;
const STATUS:Record<EditorialRequestStatus,string>={pendiente:'Pendiente',resuelta:'Resuelta',devuelta:'Devuelta',cancelada:'Cancelada'};
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('');
const roleName=(role:string|null)=>role==='especialista'?'Especialista':role==='jefe_edicion'?'Jefe de Edición':role==='editor'?'Editor':role??'';
export function requestDate(value:string,now=new Date()) {
 const day=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
 const date=new Date(value),today=day(now),yesterday=day(new Date(now.getTime()-86400000));
 const time=new Intl.DateTimeFormat('es-VE',{timeZone:'America/Caracas',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
 return day(date)===today?`Hoy · ${time}`:day(date)===yesterday?`Ayer · ${time}`:editorialDate(value);
}
function RequestStatus({status}:{status:EditorialRequestStatus}){return <span className={'ec-status '+(status==='pendiente'?'ec-amber':status==='resuelta'?'ec-green':'ec-gray')}>{STATUS[status]}</span>;}
function Requester({name,role}:{name:string|null;role:string|null}){return <span className="er-person">{name&&<i className="ec-avatar">{initials(name)}</i>}<span>{name??'Sin registrar'}{role&&<small>{roleName(role)}</small>}</span></span>;}

export function EditorialRequests({ onOpen:_onOpen }: { onOpen: (id: string) => void }) {
 const [params,setParams]=useSearchParams();
 const [search,setSearch]=useState(params.get('search')??''),[filtersOpen,setFiltersOpen]=useState(false);
 const tab=TABS.find(([id])=>id===params.get('tab'))?.[0]??'pending',selected=params.get('selectedRequest');
 const update=(key:string,value:string)=>setParams(p=>{value?p.set(key,value):p.delete(key);if(!['selectedRequest','detailTab'].includes(key))p.delete('page');return p;});
 const urlSearch=params.get('search')??'';
 useEffect(()=>setSearch(urlSearch),[urlSearch]);
 useEffect(()=>{if(search===urlSearch)return;const timer=setTimeout(()=>update('search',search),300);return()=>clearTimeout(timer);},[search,urlSearch]);
 const queryParams=new URLSearchParams({tab,page:params.get('page')??'1',pageSize:params.get('pageSize')??'10',sort:params.get('sort')??(tab==='resolved'?'newest':'oldest')});
 for(const key of ['search','service','requester','from','to'])if(params.get(key))queryParams.set(key,params.get(key)!);
 const q=useQuery({queryKey:[...editorialKey,'requests',queryParams.toString()],queryFn:()=>fetchEditorialRequests(queryParams),placeholderData:previous=>previous});
 const activity=useQuery({queryKey:[...editorialKey,'activity'],queryFn:fetchEditorialActivity});
 const options=q.data?.options,rows=q.data?.items??[];
 const hasFilters=['search','service','requester','from','to'].some(key=>params.has(key));
 const clear=()=>{setSearch('');setParams(p=>{for(const key of ['search','service','requester','from','to','page'])p.delete(key);return p;});};
 const openCentral=(data:EditorialRequestDetail)=>setParams({vista:'asignaciones',request:data.summary.workItemId,originRequest:data.summary.id});
 return <div className={'ep-module er-module'+(selected?' has-detail':'')}>
  <div className="ep-main">
   <div className="er-overview">
    <button className="ec-kpi er-kpi-pending" onClick={()=>{setSearch('');setParams(p=>{for(const key of ['search','service','requester','from','to','page'])p.delete(key);p.set('tab','pending');return p;});}}><span className="ec-kpi-icon"><RrppIcon nombre="ingreso"/></span><span><strong>{q.isPending?'—':q.data?.pendingTotal??'—'}</strong><b>Pendientes</b><small>Requieren tu decisión</small></span><RrppIcon nombre="flecha"/></button>
    <details className="er-guide"><summary><RrppIcon nombre="libro"/>Guía de solicitudes</summary><p>Revisa quién solicita una decisión y qué intervención afecta. La asignación se realiza en el panel central de Asignaciones y carga. Si falta información, devuelve la solicitud con un motivo.</p></details>
   </div>
   <div className="ea-filterbar">
    <label className="ea-search"><span className="sr-only">Buscar solicitudes</span><RrppIcon nombre="buscar"/><input type="search" placeholder="Buscar por proyecto, autor o solicitante…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <button className="ea-filter-toggle ec-secondary" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(true)}>Filtros</button>
    <div className={'ea-filters '+(filtersOpen?'is-open':'')}>{filtersOpen&&<button className="ea-filter-close" onClick={()=>setFiltersOpen(false)}>Cerrar filtros ×</button>}
     <label>Servicio<select value={params.get('service')??''} onChange={e=>update('service',e.target.value)}><option value="">Todos</option>{options?.services.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
     <label>Solicitado por<select value={params.get('requester')??''} onChange={e=>update('requester',e.target.value)}><option value="">Todos</option>{options?.requesters.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
     <label>Desde<input type="date" value={params.get('from')??''} max={params.get('to')??undefined} onChange={e=>update('from',e.target.value)}/></label>
     <label>Hasta<input type="date" value={params.get('to')??''} min={params.get('from')??undefined} onChange={e=>update('to',e.target.value)}/></label>
     <button className="ea-clear" onClick={clear}>Limpiar filtros</button>{filtersOpen&&<button className="ec-primary ea-filter-done" onClick={()=>setFiltersOpen(false)}>Ver resultados</button>}
    </div>
   </div>
   <section className="ec-panel ep-table-panel" aria-label="Bandeja de solicitudes" aria-busy={q.isFetching}>
    <div className="ea-tabs er-tabs" role="tablist" aria-label="Estado de solicitudes">{TABS.filter(([id])=>id!=='returned'||!!q.data?.counts.returned||tab==='returned').map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} onClick={()=>update('tab',id)}>{label} <span>{q.data?.counts[id]??'—'}</span></button>)}</div>
    {q.isError?<p className="ec-empty" role="alert">No se pudieron cargar las solicitudes. <button className="ea-link" onClick={()=>q.refetch()}>Reintentar</button></p>:q.isPending?<EditorialRowsSkeleton/>:rows.length?<div className="ea-table-wrap"><table className="ea-table er-table"><thead><tr>{['Proyecto / Autor','Tipo de solicitud','Descripción','Solicitado por','Fecha','Estado','Acción'].map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id} aria-selected={selected===r.id} className={selected===r.id?'is-selected':''} onClick={()=>update('selectedRequest',r.id)} tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();update('selectedRequest',r.id);}}}>
     <td data-label="Proyecto / Autor"><div className="ec-project"><EditorialCover url={r.coverUrl}/><span><strong>{r.title}</strong><small>{r.authors}</small></span></div></td>
     <td data-label="Tipo de solicitud"><span className="er-type">{requestTypeLabel(r.requestType)}</span></td>
     <td data-label="Descripción"><span className="er-description">{r.description}</span></td>
     <td data-label="Solicitado por"><Requester name={r.requester} role={r.requesterRole}/></td>
     <td data-label="Fecha"><time dateTime={r.requestedAt} title={new Intl.DateTimeFormat('es-VE',{timeZone:'America/Caracas',dateStyle:'long',timeStyle:'short'}).format(new Date(r.requestedAt))}>{requestDate(r.requestedAt)}</time></td>
     <td data-label="Estado"><RequestStatus status={r.status}/></td>
     <td data-label="Acción"><button className="ec-secondary" onClick={e=>{e.stopPropagation();update('selectedRequest',r.id);}}>{r.status==='pendiente'?'Revisar':'Ver detalle'}</button></td>
    </tr>)}</tbody></table></div>:<EditorialEmpty>{hasFilters?<>No hay solicitudes con estos filtros.<br/><button className="ea-link" onClick={clear}>Limpiar filtros</button></>:tab==='pending'?<>No tienes solicitudes pendientes.<br/>Las nuevas solicitudes que requieran tu decisión aparecerán aquí.</>:'No hay solicitudes en este estado.'}</EditorialEmpty>}
    {q.data&&!q.isError&&<div className="ea-list-footer"><span>{q.data.total?`${(q.data.page-1)*Number(params.get('pageSize')??10)+1}–${Math.min(q.data.page*Number(params.get('pageSize')??10),q.data.total)} de ${q.data.total}`:'0'} solicitudes</span>
     <label>Ordenar<select value={params.get('sort')??(tab==='resolved'?'newest':'oldest')} onChange={e=>update('sort',e.target.value)}><option value="oldest">Más antigua primero</option><option value="newest">Más reciente primero</option><option value="project">Proyecto</option></select></label>
     <button aria-label="Página anterior" disabled={q.isFetching||q.data.page<=1} onClick={()=>setParams(p=>{p.set('page',String(q.data!.page-1));return p;})}>‹</button><span>{q.data.page} / {q.data.pages}</span><button aria-label="Página siguiente" disabled={q.isFetching||q.data.page>=q.data.pages} onClick={()=>setParams(p=>{p.set('page',String(q.data!.page+1));return p;})}>›</button>
     <label>Mostrar<select value={params.get('pageSize')??'10'} onChange={e=>update('pageSize',e.target.value)}>{[10,25,50].map(n=><option key={n} value={n}>{n}</option>)}</select>por página</label></div>}
   </section>
   <section className="ec-panel er-activity"><header><RrppIcon nombre="actividad"/><h2>Actividad reciente de edición</h2></header>{activity.isPending?<EditorialRowsSkeleton label="Cargando actividad"/>:activity.isError?<p role="alert" className="ec-empty">No se pudo cargar la actividad. <button className="ea-link" onClick={()=>activity.refetch()}>Reintentar actividad</button></p>:activity.data?.items.length?<ol>{activity.data.items.slice(0,4).map(a=><li key={a.id}><strong>{a.actor} · {a.text}</strong><span>{a.title} · {requestDate(a.at)}</span></li>)}</ol>:<EditorialEmpty>No hay actividad registrada.</EditorialEmpty>}</section>
  </div>
  {selected&&<EditorialRequestQuickView key={selected} id={selected} onClose={()=>update('selectedRequest','')} onOpen={openCentral}/>}
 </div>;
}

function EditorialRequestQuickView({id,onClose,onOpen}:{id:string;onClose:()=>void;onOpen:(data:EditorialRequestDetail)=>void}) {
 const [params,setParams]=useSearchParams();
 const tab=DETAIL_TABS.find(([tid])=>tid===params.get('detailTab'))?.[0]??'resumen';
 const ref=useRef<HTMLElement>(null);
 const q=useQuery({queryKey:[...editorialKey,'request-detail',id],queryFn:()=>fetchEditorialRequestDetail(id)});
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const mobile=window.matchMedia('(max-width: 1199px)').matches;if(mobile)ref.current?.focus();const close=(e:KeyboardEvent)=>{if(document.querySelector('dialog[open]'))return;if(e.key==='Escape')onClose();if(e.key==='Tab'&&mobile){const controls=Array.from(ref.current?.querySelectorAll<HTMLElement>('button,a[href],input,textarea,select,[tabindex="0"]')??[]).filter(el=>!el.hasAttribute('disabled'));const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',close);const before=document.body.style.overflow;if(mobile)document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',close);document.body.style.overflow=before;previous?.focus();};},[id]);
 return <><button className="er-detail-backdrop" aria-label="Cerrar detalle de solicitud" onClick={onClose}/><aside ref={ref} tabIndex={-1} className="ep-detail er-detail" aria-label="Detalle de la solicitud">
  <header className="ep-detail-head"><button className="ep-close" aria-label="Cerrar detalle" onClick={onClose}>×</button>{q.data&&<><EditorialCover url={q.data.summary.coverUrl}/><div><h3>{q.data.summary.title}</h3><p>{q.data.summary.authors}</p><span className="er-type">{requestTypeLabel(q.data.summary.requestType)}</span></div></>}</header>
  {q.isPending?<EditorialRowsSkeleton label="Cargando solicitud"/>:q.isError?<p role="alert" className="ec-empty">No se pudo cargar la solicitud. <button className="ea-link" onClick={()=>q.refetch()}>Reintentar</button></p>:q.data&&<>
   <div className="ep-tabs" role="tablist" aria-label="Detalle de solicitud">{DETAIL_TABS.map(([tid,label])=><button key={tid} role="tab" aria-selected={tab===tid} onClick={()=>setParams(p=>{p.set('detailTab',tid);return p;})}>{label}</button>)}</div>
   <div className="ep-tab-body" role="tabpanel">
    {tab==='resumen'&&<ResumenTab data={q.data} onOpen={()=>onOpen(q.data!)}/>}
    {tab==='contexto'&&(q.data.context?<ContextoTab data={q.data}/>:<EditorialEmpty>La intervención original ya no tiene contexto operativo activo. Consulta el proyecto para ver las intervenciones actuales.</EditorialEmpty>)}
    {tab==='archivos'&&(q.data.files.length?<ul className="er-files">{q.data.files.map(f=><li key={f.url}><RrppIcon nombre="ingreso"/><a href={f.url} target="_blank" rel="noopener noreferrer">{f.label}<RrppIcon nombre="externo"/></a></li>)}</ul>:<EditorialEmpty>No hay archivos relacionados con esta solicitud.</EditorialEmpty>)}
    {tab==='historial'&&(q.data.history.length?<ul className="ep-history">{q.data.history.map(h=><li key={h.id}><strong>{h.label}</strong><small>{h.actor} · {requestDate(h.at)}</small></li>)}</ul>:<EditorialEmpty>No hay actividad registrada para esta solicitud.</EditorialEmpty>)}
    {tab!=='resumen'&&q.data.summary.projectActive&&<Link className="ec-secondary er-project-link" to={`/?vista=proyectos-edicion&project=${q.data.summary.projectId}`}>Ver en proyecto →</Link>}
   </div>
  </>}
 </aside></>;
}

function ResumenTab({data,onOpen}:{data:EditorialRequestDetail;onOpen:()=>void}) {
 const s=data.summary,rec=data.recommendationSummary;
 const [returning,setReturning]=useState(false),[reason,setReason]=useState('');
 const invalidate=useInvalidateEditorial();
 const mutation=useMutation({mutationFn:()=>returnEditorialRequest(s.id,reason,s.version),onSuccess:async()=>{setReturning(false);setReason('');await invalidate();},onError:async()=>{await invalidate();}});
 return <div className="ep-resumen er-summary">
  <section className="er-info"><h4>Información de la solicitud</h4><dl className="ec-detail-grid">
   <div><dt>Tipo de solicitud</dt><dd><span className="er-type">{requestTypeLabel(s.requestType)}</span></dd></div><div><dt>Estado</dt><dd><RequestStatus status={s.status}/></dd></div>
   <div><dt>Solicitado por</dt><dd><Requester name={s.requester} role={s.requesterRole}/></dd></div><div><dt>Fecha de solicitud</dt><dd>{editorialDate(s.requestedAt,true)} · {new Intl.DateTimeFormat('es-VE',{timeZone:'America/Caracas',hour:'2-digit',minute:'2-digit'}).format(new Date(s.requestedAt))}</dd></div>
   <div><dt>Proyecto</dt><dd>{s.title}</dd></div><div><dt>Autor</dt><dd>{s.authors}</dd></div><div><dt>Servicio</dt><dd>{s.service}</dd></div><div><dt>Intervención</dt><dd>{s.interventionLabel}</dd></div>
   {s.volume&&<div><dt>Volumen</dt><dd>{s.volume}</dd></div>}{s.requestedDate&&<div><dt>Fecha requerida</dt><dd>{editorialDate(s.requestedDate)}</dd></div>}
   {s.notes&&<div><dt>Notas registradas</dt><dd className="er-notes">{s.notes}</dd></div>}
  </dl></section>
  {s.status==='devuelta'&&<section className="er-result"><h4>Devuelta al solicitante</h4><p>{s.returnReason}</p><small>El solicitante debe completar el contexto y reenviar la solicitud.</small></section>}
  {s.status==='resuelta'&&<section className="er-result"><h4>Resultado de la decisión</h4>{s.requestType==='ASSIGN_EDITOR'?<p><strong>Editor asignado:</strong> {s.resultEditor??'Sin registrar'}</p>:<p>{s.outcome??'Decisión registrada'}</p>}<p><strong>Resuelto por:</strong> {s.resolvedBy??'Sin registrar'} · {editorialDate(s.resolvedAt,true)}</p>{s.resultWorkItemId&&s.projectActive&&<Link className="ea-link" to={`/?vista=seguimiento-edicion&search=${encodeURIComponent(s.code)}&tab=all${data.context?'&workItem='+s.resultWorkItemId:''}`}>{data.context?'Ver trabajo en Seguimiento':'Ver intervenciones en Seguimiento'} →</Link>}{!s.projectActive&&<small>Proyecto cerrado. El resultado se conserva como histórico.</small>}</section>}
  {s.assignmentReady&&rec&&<section className="er-recommendation"><h4>✧ Recomendación del sistema</h4>{rec.editor?<><div className="er-person"><i className="ec-avatar">{initials(rec.editor.name)}</i><strong>{rec.editor.name}</strong></div><p>{rec.tied>1?`${rec.tied} Editores comparten la menor carga accionable.`:'Menor carga accionable entre Editores elegibles.'}</p><small>{rec.editor.actionableNow} accionables · {rec.editor.overdue} vencidas · {rec.editor.dueThisWeek} entregas esta semana</small></>:<p>No hay Editores elegibles actualmente.</p>}<button className="ec-secondary" onClick={onOpen}>Ver comparación completa ↗</button></section>}
  {s.status==='pendiente'&&s.requestType==='ASSIGN_EDITOR'&&<section className="er-next"><h4>Siguientes pasos</h4><p>{s.assignmentReady?'Esta acción se realiza desde Asignaciones y carga.':'La solicitud espera que se habilite el contexto operativo del proyecto.'}</p>{s.assignmentReady&&<button className="ec-primary" onClick={onOpen}><RrppIcon nombre="equipo"/>Revisar y asignar Editor →</button>}
   {s.actionable&&s.requesterId&&!returning&&<button className="ea-link er-return-link" onClick={()=>setReturning(true)}>Devolver para completar</button>}
   {s.actionable&&returning&&<EditorialDrawer title="Devolver para completar" onClose={()=>{if(!mutation.isPending)setReturning(false);}}><form className="er-return-form" onSubmit={e=>{e.preventDefault();if(!mutation.isPending)mutation.mutate();}}><p>Indica qué información necesita completar el solicitante.</p><label>Motivo de devolución<textarea autoFocus required minLength={5} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>{mutation.isError&&<p role="alert">{mutation.error.message}</p>}<div><button className="ec-secondary" type="button" disabled={mutation.isPending} onClick={()=>setReturning(false)}>Cancelar</button><button className="ec-primary" disabled={mutation.isPending||reason.trim().length<5}>{mutation.isPending?'Devolviendo…':'Devolver solicitud'}</button></div></form></EditorialDrawer>}
  </section>}
  {s.requestType!=='ASSIGN_EDITOR'&&s.status==='pendiente'&&s.actionable&&<EditorRequestDecision id={s.id} version={s.version} reassignment={s.requestType==='editor_reasignacion'} workItemId={s.workItemId}/>}
  {mutation.isError&&<p role="alert" className="er-mutation-error">{mutation.error.message} Revisa el contexto actualizado.</p>}
  {s.projectActive&&<Link className="ec-secondary er-project-link" to={`/?vista=proyectos-edicion&project=${s.projectId}`}><RrppIcon nombre="proyectos"/>Ver en proyecto</Link>}
 </div>;
}
function ContextoTab({data}:{data:EditorialRequestDetail}) {
 const c=data.context!;return <dl className="ec-detail-grid"><div><dt>Estado de edición</dt><dd>{c.editorialState}</dd></div><div><dt>Editor actual</dt><dd>{c.currentEditor??'Por asignar'}</dd></div><div><dt>Especialista</dt><dd>{c.specialist??'Sin asignar'}</dd></div><div><dt>Fecha límite</dt><dd>{editorialDate(c.deadline)}</dd></div>{c.blocker&&<div><dt>Bloqueo</dt><dd>{c.blocker}</dd></div>}{c.waitingOn&&<div><dt>Esperando</dt><dd>{c.waitingOn==='author'?'Autor':c.waitingOn==='specialist'?'Especialista':'Reanudación'}</dd></div>}</dl>;
}
