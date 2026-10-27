import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { EditorRequestSummary } from '../../../shared/editorOwn';
import { EditorRequestDecision } from './EditorRequestDecision';
export function EditorIncomingClarifications(){
 const q=useQuery({queryKey:['editor-incoming'],queryFn:()=>apiFetch<{items:EditorRequestSummary[]}>('/editores/aclaraciones-recibidas'),refetchInterval:15000});
 return <section className="sr-card" style={{margin:'16px 0',padding:16,border:'1px solid #e1e6ec',borderRadius:8,background:'#fff'}}><h2 style={{fontFamily:'Georgia,serif',fontSize:20,marginBottom:12}}>Aclaraciones recibidas del Editor</h2>
 {q.isPending?<p role="status">Consultando solicitudes recibidas…</p>:q.isError?<p role="alert">No se pudieron consultar las aclaraciones. <button onClick={()=>q.refetch()}>Reintentar</button></p>:q.data.items.length?q.data.items.map(r=><details key={r.id} style={{borderTop:'1px solid #e8ebef',padding:'12px 0'}}><summary style={{cursor:'pointer'}}>{r.title} · {r.interventionLabel} · {r.status==='devuelta'?'Esperando información del Editor':'Pendiente de respuesta'}</summary><p style={{margin:'12px 0',fontSize:13}}>{r.motivo}</p>{r.status!=='devuelta'&&<EditorRequestDecision id={r.id} version={r.version}/>}</details>):<p style={{color:'#73829a',fontSize:12}}>No hay aclaraciones del Editor pendientes de respuesta.</p>}
 </section>;
}
