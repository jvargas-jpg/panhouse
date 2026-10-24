import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { editorialKey, fetchEditorialCandidates, fetchEditorialIntervention, fetchEditorialList, decideEditor } from './jefeEdicionApi';
import { EditorialCover, EditorialEmpty, editorialDate } from './EditorialParts';
import type { EditorialIntervention } from '../../../shared/editorialChief';
import {ApiError} from '../lib/api';
import {EditorialRowsSkeleton} from './EditorialAssignments';
import {Link} from 'react-router-dom';
export function EditorialDrawer({title,onClose,children,className=''}:{title:string;onClose:()=>void;children:ReactNode;className?:string}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>{ref.current?.close();previous?.focus();};},[]);
  return <dialog ref={ref} className={'ec-drawer '+className} onCancel={e=>{e.preventDefault();onClose();}} aria-label={title}><header><div><small>ÁREA DE EDICIÓN</small><h2>{title}</h2></div><button aria-label="Cerrar panel" onClick={onClose}>×</button></header><div className="ec-drawer-body">{children}</div></dialog>;
}
export function useInvalidateEditorial(){
  const client=useQueryClient();
  return ()=>Promise.all([editorialKey,['editores'],['capitulos'],['proyectos'],['proyecto'],['especialista-inicio'],['especialista-solicitudes'],['especialista-cartera'],['solicitudes'],['solicitud'],['mi-trabajo'],['project-workspace'],['ficha'],['ficha-viva'],['project-command-center'],['notificaciones']].map(queryKey=>client.invalidateQueries({queryKey})));
}
export function AsignarEditorCard({item,onAssigned,onCancel=()=>{},onConflict=()=>{}}:{item:EditorialIntervention;onAssigned:()=>void;onCancel?:()=>void;onConflict?:(message:string)=>void}){
  const team=useQuery({queryKey:[...editorialKey,'candidates',item.id],queryFn:()=>fetchEditorialCandidates(item.id)});
  const [editor,setEditor]=useState(''),[reason,setReason]=useState(''),[sort,setSort]=useState('load');
  const submitting=useRef(false);
  const invalidate=useInvalidateEditorial();
  const mutation=useMutation({mutationFn:()=>decideEditor(item.id,editor,reason||undefined,item.editorId,item.assignmentId??null,item.requestVersion),onSuccess:async()=>{await invalidate();onAssigned();},onError:async(error)=>{if(error instanceof ApiError&&error.status===409)onConflict(error.message);await invalidate();setEditor('');},onSettled:()=>{submitting.current=false;}});
  const candidates=[...(team.data?.candidates??[])].sort((a,b)=>sort==='overdue'?a.overdue-b.overdue||a.rank-b.rank:sort==='name'?a.name.localeCompare(b.name,'es'):a.rank-b.rank);
  const selected=candidates.find(e=>e.id===editor),recommended=team.data?.candidates.filter(e=>team.data!.recommendedIds.includes(e.id))??[];
  return <form className="ec-assign-form ea-assign-form" onSubmit={e=>{e.preventDefault();if(!submitting.current&&selected){submitting.current=true;mutation.mutate();}}}>
    <div className="ea-selector-header"><h3>Selecciona un Editor</h3><label>Ordenar por<select value={sort} onChange={e=>setSort(e.target.value)}><option value="load">Menor carga accionable</option><option value="overdue">Menos vencidas</option><option value="name">Nombre</option></select></label></div>
    {team.isPending?<EditorialRowsSkeleton label="Cargando candidatos"/>:team.isError?<p role="alert">No se pudo cargar el equipo. <button type="button" onClick={()=>team.refetch()}>Reintentar candidatos</button></p>:candidates.length?<fieldset><legend className="sr-only">Editores elegibles</legend>{candidates.map((e,n)=><label className={'ec-editor-choice '+(editor===e.id?'selected':'')} key={e.id}><input type="radio" required name="editor" value={e.id} checked={editor===e.id} disabled={mutation.isPending||e.id===item.editorId} onChange={()=>setEditor(e.id)}/><i className={'ec-avatar ec-avatar-'+n%4}>{e.name.split(/\s+/).slice(0,2).map(w=>w[0]).join('')}</i><span><strong>{e.name}{e.id===item.editorId&&<em> · Editor actual</em>}</strong><small>{e.actionableNow} accionables · {e.dueThisWeek} esta semana · <b className={e.overdue?'ec-deadline-overdue':''}>{e.overdue} vencidas</b></small><small>{e.activeAssigned} asignadas · {e.waitingThirdParty} en espera</small></span></label>)}</fieldset>:<EditorialEmpty>No hay Editores elegibles.</EditorialEmpty>}
    {team.data&&<aside className="ea-recommendation"><small>✧ Recomendación del sistema</small>{recommended.length?<><h4>{recommended.map(e=>e.name).join(' / ')}</h4><p>{recommended.length>1?'Empate según los datos disponibles.':'Menor carga accionable según los datos disponibles.'}</p><ul>{recommended[0]!.reasons.map(r=><li key={r}>{r}</li>)}</ul></>:<p>No hay una recomendación automática con los datos disponibles.</p>}<details><summary>Cómo se compara</summary><p>{team.data.explanation}</p><p>{team.data.limitations}</p></details></aside>}
    {item.editorId&&<label className="ec-reason">Motivo de reasignación<textarea name="motivo" required minLength={5} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>}
    {selected&&team.data&&!team.data.recommendedIds.includes(selected.id)&&<p className="ea-manual-choice">Has elegido a {selected.name}. Puedes confirmar esta decisión aunque la sugerencia sea otra.</p>}
    {mutation.isError&&<p role="alert">{mutation.error.message}{mutation.error instanceof ApiError&&mutation.error.status===409?' El contexto se actualizó; revisa la asignación vigente.':''}</p>}
    <footer className="ea-decision-footer"><button type="button" className="ec-secondary" disabled={mutation.isPending} onClick={onCancel}>Cancelar</button><button className="ec-primary" disabled={!selected||mutation.isPending||team.isError}>{mutation.isPending?'Confirmando…':selected?`${item.editorId?'Reasignar':'Asignar'} a ${selected.name}`:'Selecciona un Editor'}</button></footer>
  </form>;
}
export function EditorialDecisionDrawer({id,onClose,onAssigned=onClose}:{id:string;onClose:()=>void;onAssigned?:()=>void}){
 const q=useQuery({queryKey:[...editorialKey,'detail',id],queryFn:()=>fetchEditorialIntervention(id)}),[reassign,setReassign]=useState(false),[conflict,setConflict]=useState('');const item=q.data;
 return <EditorialDrawer className="ea-decision-drawer" title={item?.needsAssignment?'Asignar Editor':reassign?'Reasignar Editor':'Asignación de Edición'} onClose={onClose}>
   {q.isPending?<EditorialRowsSkeleton label="Consultando intervención"/>:q.isError?<p role="alert">{q.error.message} <button onClick={()=>q.refetch()}>Reintentar</button></p>:item&&<><div className="ea-decision-project"><EditorialCover/><div><h3>{item.title}</h3><p>{item.authors}</p></div><span className="ea-service">{item.serviceCode??item.service}</span></div><dl className="ec-detail-grid ea-context"><div><dt>Intervención</dt><dd>{item.label}</dd></div><div><dt>Volumen</dt><dd>{item.volume??'Sin volumen registrado'}</dd></div><div><dt>Fecha requerida</dt><dd className={item.overdue?'ec-deadline-overdue':''}>{editorialDate(item.dueDate)}</dd></div><div><dt>Solicitado por</dt><dd>{item.requestedBy??'Sin solicitante registrado'}{item.requestedByRole==='especialista'&&<small>Especialista</small>}</dd></div><div><dt>Situación</dt><dd>{item.situation??item.state}</dd></div>{item.editorId&&<div><dt>Editor actual</dt><dd>{item.editor}</dd></div>}{item.notes&&<div><dt>Notas</dt><dd>{item.notes}</dd></div>}</dl>
   <p className="ea-assignment-scope">La asignación es por proyecto: incluye sus intervenciones de Edición vigentes.</p><Link className="ea-context-link" onClick={onClose} to={`/?vista=proyectos-edicion&search=${encodeURIComponent(item.code)}`}>Ver proyecto de edición →</Link>
   {item.block&&<p className="ec-block"><strong>Bloqueo</strong> · {item.block}</p>}{item.state.startsWith('Esperando')&&<p className="ec-info">{item.state}. Esta espera no se atribuye como atraso del Editor.</p>}
   {item.state==='En pausa'&&<p className="ec-info">El proyecto está en pausa o stand-by. No se atribuye atraso al Editor durante esta espera.</p>}
   {conflict&&<p role="alert">{conflict} El contexto se actualizó; revisa la asignación vigente.</p>}
   {item.needsAssignment||reassign?<AsignarEditorCard key={item.id} item={item} onAssigned={onAssigned} onCancel={onClose} onConflict={setConflict}/>:item.editorId&&item.state!=='Completadas'&&<button className="ec-secondary" onClick={()=>setReassign(true)}>Reasignar Editor del proyecto</button>}</>}
 </EditorialDrawer>;
}
export function EditorialLoadDrawer({id,onClose,onOpen}:{id:string;onClose:()=>void;onOpen:(id:string)=>void}){
 const [page,setPage]=useState(1);const q=useQuery({queryKey:[...editorialKey,'load',id,page],queryFn:()=>fetchEditorialList(new URLSearchParams({editor:id,page:String(page)}))});
 return <EditorialDrawer title="Carga del Editor" onClose={onClose}>{q.isPending?<p role="status">Cargando intervenciones…</p>:q.isError?<p role="alert">{q.error.message}</p>:q.data.items.length?<><h3>{q.data.items[0].editor}</h3><p>{q.data.total} intervenciones registradas</p><ul className="ec-load-details">{q.data.items.map(i=><li key={i.id}><button onClick={()=>onOpen(i.id)}><strong>{i.label}</strong><span>{i.title} · {i.service}</span><small>{i.state} · {editorialDate(i.dueDate)}</small>{i.deliveredAt&&<small>Última entrega: {editorialDate(i.deliveredAt)}</small>}</button></li>)}</ul><div className="ec-pagination"><button disabled={page===1} onClick={()=>setPage(page-1)}>Anterior</button><span>{q.data.page} / {q.data.pages}</span><button disabled={page>=q.data.pages} onClick={()=>setPage(page+1)}>Siguiente</button></div></>:<EditorialEmpty>No hay intervenciones de este Editor.</EditorialEmpty>}</EditorialDrawer>;
}
