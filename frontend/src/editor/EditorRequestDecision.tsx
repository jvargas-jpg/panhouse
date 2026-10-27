import { useState } from 'react';
import { useMutation,useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
export function EditorRequestDecision({id,version,reassignment,workItemId}:{id:string;version:number;reassignment?:boolean;workItemId?:string}){
 const [action,setAction]=useState<'review'|'return'|'resolve'>('resolve'),[text,setText]=useState('');
 const cache=useQueryClient();
 const mutation=useMutation({mutationFn:()=>apiFetch('/editores/solicitudes-editor/'+id+'/decidir',{method:'POST',body:JSON.stringify({expectedVersion:version,action,text})}),onSuccess:async()=>{setText('');await cache.invalidateQueries({predicate:q=>['editor','editorial-chief','solicitudes','notificaciones','editor-incoming'].includes(String(q.queryKey[0]))});}});
 return <form className="er-return-form" onSubmit={e=>{e.preventDefault();if(!mutation.isPending)mutation.mutate();}} style={{padding:'14px',border:'1px solid #e4e7ed',borderRadius:8,display:'grid',gap:10}}>
  <h4>Responder al Editor</h4>{reassignment&&<p>La reasignación se realiza desde <Link className="ea-link" to={'/?vista=asignaciones&request='+workItemId}>Asignaciones y carga →</Link>. Después registra aquí el resultado.</p>}
  <label>Decisión<select aria-label="Decisión" value={action} onChange={e=>setAction(e.target.value as typeof action)}><option value="resolve">Resolver con respuesta</option><option value="review">Marcar en revisión</option><option value="return">Pedir información</option></select></label>
  <label>Respuesta<textarea required minLength={5} maxLength={1000} value={text} onChange={e=>setText(e.target.value)}/></label>
  {mutation.isError&&<p role="alert">{mutation.error.message}</p>}
  <button className="ec-primary" disabled={mutation.isPending||text.trim().length<5}>{mutation.isPending?'Guardando…':'Registrar decisión'}</button>
 </form>;
}
