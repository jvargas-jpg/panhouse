import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useMutation,useQuery} from '@tanstack/react-query';
import type {EditorialIntervention} from '../../../shared/editorialChief';
import {apiFetch} from '../lib/api';
import {useMe} from '../auth/useAuth';
import {EditorialPanel,EditorialEmpty,editorialDate} from '../jefeEdicion/EditorialParts';
import {useInvalidateEditorial} from '../jefeEdicion/EditorialDrawers';
import '../jefeEdicion/editorialChief.css';
function EditorAction({item}:{item:EditorialIntervention}){
 const [mode,setMode]=useState(''),invalidate=useInvalidateEditorial();
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const mutation=useMutation({mutationFn:async(form:FormData)=>{
   if(mode==='chapter')return apiFetch('/capitulos',{method:'POST',body:JSON.stringify({proyectoId:item.projectId,numero:Number(form.get('numero'))})});
   if(mode==='start')return apiFetch(`/capitulos/${item.projectId}/${item.chapter}/editor`,{method:'PATCH',body:JSON.stringify({fechaInicioEditor:form.get('date')})});
   return apiFetch('/editores/mi-trabajo/'+item.id+'/entrega',{method:'PATCH',body:JSON.stringify({date:form.get('date')})});
 },onSuccess:async()=>{await invalidate();setMode('');}});
 return <div className="ec-editor-action">{item.actionable&&<div>{!item.chapter?<button className="ec-primary" onClick={()=>setMode('chapter')}>Registrar capítulo recibido</button>:<><button className="ec-secondary" onClick={()=>setMode('start')}>Registrar inicio</button><button className="ec-primary" onClick={()=>setMode('delivery')}>Registrar entrega</button></>}</div>}
 {mode&&<form onSubmit={e=>{e.preventDefault();mutation.mutate(new FormData(e.currentTarget));}}>{mode==='chapter'?<label>Número del capítulo recibido<input type="number" name="numero" min="1" required/></label>:<label>{mode==='start'?'Fecha de inicio':'Fecha de entrega'}<input type="date" name="date" required defaultValue={today}/></label>}<button className="ec-primary" disabled={mutation.isPending}>Guardar</button><button type="button" onClick={()=>setMode('')}>Cancelar</button></form>}{mutation.isError&&<p role="alert">{mutation.error.message}</p>}</div>;
}
export function EditorialWorkQueue(){
 const {data:user}=useMe();
 const q=useQuery({queryKey:['editorial-chief','my-work',user?.id],queryFn:()=>apiFetch<{items:EditorialIntervention[]}>('/editores/mi-trabajo'),enabled:user?.rol==='editor',refetchInterval:30000});
 return <div className="ec-shell ec-editor-page"><div className="ec-body"><header className="ec-page-header"><div><span>ÁREA DE EDICIÓN</span><h1>Mi trabajo</h1><p>Intervenciones asignadas, entregas y feedback por aplicar.</p></div></header><EditorialPanel title="Intervenciones asignadas">{q.isPending?<p className="ec-empty" role="status">Cargando trabajo…</p>:q.isError?<p className="ec-empty" role="alert">{q.error.message}</p>:q.data.items.length?<div className="ec-editor-work">{q.data.items.map(i=><article key={i.id}><div><h3>{i.label}</h3><Link to={'/proyectos/'+i.projectId}><strong>{i.title} ↗</strong></Link><p>{i.authors} · {i.service}</p><span>{i.state} · {editorialDate(i.dueDate)}</span></div><EditorAction item={i}/></article>)}</div>:<EditorialEmpty>No tienes intervenciones asignadas.</EditorialEmpty>}</EditorialPanel></div></div>;
}
