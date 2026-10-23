import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { editorialKey, fetchEditorialDashboard, fetchEditorialIntervention, fetchEditorialList, decideEditor } from './jefeEdicionApi';
import { EditorialEmpty, editorialDate } from './EditorialParts';
import type { EditorialIntervention } from '../../../shared/editorialChief';
export function EditorialDrawer({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>{ref.current?.close();previous?.focus();};},[]);
  return <dialog ref={ref} className="ec-drawer" onCancel={onClose} aria-label={title}><header><div><small>ÁREA DE EDICIÓN</small><h2>{title}</h2></div><button aria-label="Cerrar panel" onClick={onClose}>×</button></header><div className="ec-drawer-body">{children}</div></dialog>;
}
export function useInvalidateEditorial(){
  const client=useQueryClient();
  return ()=>Promise.all([editorialKey,['editores'],['capitulos'],['proyectos'],['proyecto'],['especialista-inicio'],['especialista-solicitudes'],['project-command-center']].map(queryKey=>client.invalidateQueries({queryKey})));
}
export function AsignarEditorCard({item,onAssigned}:{item:EditorialIntervention;onAssigned:()=>void}){
  const team=useQuery({queryKey:[...editorialKey,'dashboard'],queryFn:fetchEditorialDashboard});
  const [editor,setEditor]=useState(''),[reason,setReason]=useState('');
  const invalidate=useInvalidateEditorial();
  const mutation=useMutation({mutationFn:()=>decideEditor(item.id,editor,reason||undefined),onSuccess:async()=>{await invalidate();onAssigned();}});
  return <form className="ec-assign-form" onSubmit={e=>{e.preventDefault();if(!mutation.isPending)mutation.mutate();}}><h3>{item.editorId?'Reasignar Editor':'Asignar Editor'}</h3><p>Compara las intervenciones actuales. Las cifras describen trabajo; no representan capacidad máxima.</p>
    {team.isPending?<p role="status">Cargando equipo…</p>:team.isError?<p role="alert">No se pudo cargar el equipo. <button type="button" onClick={()=>team.refetch()}>Reintentar</button></p>:team.data.editorLoads.length?<fieldset><legend>Selecciona un Editor</legend>{team.data.editorLoads.map(e=><label className={'ec-editor-choice '+(editor===e.id?'selected':'')} key={e.id}><input type="radio" required name="editor" value={e.id} checked={editor===e.id} onChange={()=>setEditor(e.id)}/><span><strong>{e.name}</strong><small>{e.active} activas · {e.upcoming} vencen esta semana · {e.overdue} vencidas · {e.waiting} esperando</small></span></label>)}</fieldset>:<EditorialEmpty>No hay Editores disponibles en el equipo.</EditorialEmpty>}
    {item.editorId&&<label className="ec-reason">Motivo de reasignación<textarea name="motivo" required minLength={5} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>}
    <button className="ec-primary" disabled={!editor||mutation.isPending}>{mutation.isPending?'Confirmando…':item.editorId?'Confirmar reasignación':'Confirmar asignación'}</button>{mutation.isError&&<p role="alert">{mutation.error.message}</p>}
  </form>;
}
export function EditorialDecisionDrawer({id,onClose}:{id:string;onClose:()=>void}){
 const q=useQuery({queryKey:[...editorialKey,'detail',id],queryFn:()=>fetchEditorialIntervention(id)}),[reassign,setReassign]=useState(false);const item=q.data;
 return <EditorialDrawer title={item?.needsAssignment?'Decidir asignación':'Seguimiento de intervención'} onClose={onClose}>
   {q.isPending?<p role="status">Consultando intervención…</p>:q.isError?<p role="alert">{q.error.message} <button onClick={()=>q.refetch()}>Reintentar</button></p>:item&&<><h3>{item.title}</h3><p>{item.authors} · {item.service}</p><dl className="ec-detail-grid"><div><dt>Intervención</dt><dd>{item.label}</dd></div><div><dt>Situación</dt><dd>{item.situation??item.state}</dd></div><div><dt>Editor actual</dt><dd>{item.editor??'Por asignar'}</dd></div><div><dt>Fecha límite</dt><dd>{editorialDate(item.dueDate)}</dd></div><div><dt>Última entrega</dt><dd>{editorialDate(item.deliveredAt)}</dd></div>{item.requestedAt&&<div><dt>Solicitado</dt><dd>{editorialDate(item.requestedAt)}</dd></div>}</dl>
   {item.block&&<p className="ec-block"><strong>Bloqueo</strong> · {item.block}</p>}{item.state.startsWith('Esperando')&&<p className="ec-info">{item.state}. Esta espera no se atribuye como atraso del Editor.</p>}
   {item.needsAssignment||reassign?<AsignarEditorCard item={item} onAssigned={onClose}/>:item.editorId&&<button className="ec-secondary" onClick={()=>setReassign(true)}>Reasignar Editor del proyecto</button>}</>}
 </EditorialDrawer>;
}
export function EditorialLoadDrawer({id,onClose,onOpen}:{id:string;onClose:()=>void;onOpen:(id:string)=>void}){
 const [page,setPage]=useState(1);const q=useQuery({queryKey:[...editorialKey,'load',id,page],queryFn:()=>fetchEditorialList(new URLSearchParams({editor:id,page:String(page)}))});
 return <EditorialDrawer title="Carga del Editor" onClose={onClose}>{q.isPending?<p role="status">Cargando intervenciones…</p>:q.isError?<p role="alert">{q.error.message}</p>:q.data.items.length?<><h3>{q.data.items[0].editor}</h3><p>{q.data.total} intervenciones registradas</p><ul className="ec-load-details">{q.data.items.map(i=><li key={i.id}><button onClick={()=>onOpen(i.id)}><strong>{i.label}</strong><span>{i.title} · {i.service}</span><small>{i.state} · {editorialDate(i.dueDate)}</small>{i.deliveredAt&&<small>Última entrega: {editorialDate(i.deliveredAt)}</small>}</button></li>)}</ul><div className="ec-pagination"><button disabled={page===1} onClick={()=>setPage(page-1)}>Anterior</button><span>{q.data.page} / {q.data.pages}</span><button disabled={page>=q.data.pages} onClick={()=>setPage(page+1)}>Siguiente</button></div></>:<EditorialEmpty>No hay intervenciones de este Editor.</EditorialEmpty>}</EditorialDrawer>;
}
