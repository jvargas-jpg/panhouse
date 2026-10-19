import {useEffect,useRef,useState} from 'react';
import type {CreativeTask,CreativeWorkDetail} from '../../../shared/creativeLeader';
import {useCreativeCommand,useCreativeDetail} from './creativeApi';
import {creativeDate} from './CreativeDashboardParts';
import {Estado} from '../proyectos/fichaViva/FichaElements';

type Command=ReturnType<typeof useCreativeCommand>;
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function DocumentLink({href,children}:{href:string|null;children:React.ReactNode}){return href?<a href={href} target="_blank" rel="noopener noreferrer">{children} ↗</a>:null;}
function BriefForm({data,command}:{data:CreativeWorkDetail;command:Command}){
  return <><p className="cl-form-help">Registra el documento del brief. El Especialista gestiona el envío y la aprobación del autor.</p>
    {!data.reunionRealizada&&<details className="cl-meeting"><summary>Contexto de la reunión creativa</summary><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);command.mutate({path:'/direccion-creativa/'+data.id+'/reunion',body:{fecha:f.get('fecha'),enlaceGrabacion:f.get('grabacion')||null,realizada:true}});}}>
      <label>Fecha de reunión<input name="fecha" type="date" required defaultValue={data.fechaReunion??today()}/></label><label>Grabación o transcripción<input name="grabacion" type="url" defaultValue={data.enlaceGrabacion??''}/></label><button className="fv-button" disabled={command.isPending}>Registrar reunión realizada</button></form></details>}
    {data.briefFeedback&&<p className="cl-feedback">{data.briefFeedback}</p>}
    <form className="cl-work-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);command.mutate({path:'/direccion-creativa/'+data.id+'/brief',body:{briefEnlace:f.get('brief'),fechaBriefEnviadoEspecialista:today()}});}}>
      <label>Enlace del brief creativo<input type="url" name="brief" required defaultValue={data.briefEnlace??''} placeholder="https://…"/></label><button className="fv-button fv-primary" disabled={command.isPending}>Entregar brief al Especialista</button>
    </form></>;
}
function ConceptsForm({data,command}:{data:CreativeWorkDetail;command:Command}){
  const [count,setCount]=useState(Math.max(2,data.concepts.length));
  return <form className="cl-work-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);command.mutate({path:'/direccion-creativa/'+data.id+'/conceptos/entregar',method:'POST',body:{conceptos:Array.from({length:count},(_,i)=>({descripcion:f.get('descripcion'+i),enlace:f.get('enlace'+i)}))}});}}>
    <p className="cl-form-help">Entrega de 2 a 3 propuestas. RRPP revisa los conceptos antes del envío al autor.</p>
    {Array.from({length:count},(_,i)=><fieldset key={i}><legend>Concepto {i+1}</legend><label>Descripción<input name={'descripcion'+i} required maxLength={3000} defaultValue={data.concepts[i]?.descripcion??''}/></label><label>Enlace de la propuesta<input name={'enlace'+i} type="url" required defaultValue={data.concepts[i]?.enlace??''} placeholder="https://…"/></label></fieldset>)}
    {count===2&&<button type="button" className="fv-button" onClick={()=>setCount(3)}>Añadir tercer concepto</button>}<button className="fv-button fv-primary" disabled={command.isPending}>Entregar conceptos a RRPP</button>
  </form>;
}
function AdjustmentForm({data,action,command}:{data:CreativeWorkDetail;action:CreativeTask;command:Command}){
  const concept=data.concepts.find(c=>c.id===action.conceptId);
  if(!concept)return null;
  return <form className="cl-work-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);command.mutate({path:'/direccion-creativa/'+data.id+'/conceptos/'+concept.id,body:{descripcion:f.get('descripcion'),enlace:f.get('enlace')}});}}>
    <p className="cl-feedback">{action.context}</p><DocumentLink href={concept.enlace}>Consultar concepto actual</DocumentLink>
    <label>Descripción del concepto ajustado<input name="descripcion" required maxLength={3000} defaultValue={concept.descripcion??''}/></label><label>Enlace del concepto ajustado<input name="enlace" type="url" required defaultValue={concept.enlace??''}/></label>
    <button className="fv-button fv-primary" disabled={command.isPending}>{concept.estado==='Devuelta por RRPP'?'Entregar ajuste a RRPP':'Entregar ajuste al Especialista'}</button>
  </form>;
}
function ResourcesForm({data,command}:{data:CreativeWorkDetail;command:Command}){
  const approved=data.concepts.find(c=>c.fechaAprobadaAutor);
  return <form className="cl-work-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);command.mutate({path:'/direccion-creativa/'+data.id+'/recursos',body:{recursoImagenUrl:f.get('imagen'),recursoConceptoPdfUrl:f.get('pdf')}});}}>
    <p className="cl-form-help">Recursos del concepto aprobado por el autor. Se completa tu intervención al entregar ambos archivos.</p><DocumentLink href={approved?.enlace??null}>Consultar concepto aprobado</DocumentLink>
    <label>Imagen utilizada / Freepik<input type="url" name="imagen" required defaultValue={data.recursoImagenUrl??''}/></label><label>Concepto de portada en PDF<input type="url" name="pdf" required defaultValue={data.recursoConceptoPdfUrl??''}/></label><button className="fv-button fv-primary" disabled={command.isPending}>Entregar recursos</button>
  </form>;
}
function CoverForm({data,command}:{data:CreativeWorkDetail;command:Command}){
  const [feedback,setFeedback]=useState(''),cover=data.cover;
  if(!cover)return <p>Esta versión ya no requiere tu intervención.</p>;
  const submit=(aprobar:boolean)=>command.mutate({path:`/diseno/${cover.designId}/versiones/${cover.versionId}/revision-creativa`,body:{aprobar,...(feedback.trim()?{feedback:feedback.trim()}:{})}});
  return <div className="cl-work-form"><p className="cl-form-help">Verifica que la cubierta corresponde al concepto aprobado y a los requerimientos. La revisión interna de Edición continúa por separado.</p>
    <div className="cl-source-links"><DocumentLink href={cover.url}>Abrir cubierta V{cover.number}</DocumentLink><DocumentLink href={cover.briefUrl}>Brief aprobado</DocumentLink><DocumentLink href={cover.conceptPdfUrl}>Concepto aprobado</DocumentLink><DocumentLink href={cover.imageUrl}>Imagen del concepto</DocumentLink></div>
    <label>Observaciones (obligatorias para solicitar ajustes)<textarea value={feedback} onChange={e=>setFeedback(e.target.value)} rows={3} maxLength={5000}/></label>
    <div className="cl-form-actions"><button className="fv-button fv-primary" disabled={command.isPending} onClick={()=>submit(true)}>Aprobar verificación</button><button className="fv-button" disabled={command.isPending||!feedback.trim()} onClick={()=>submit(false)}>Solicitar ajustes a Diseño</button></div>
  </div>;
}
function WorkContent({data,actionType,conceptId}:{data:CreativeWorkDetail;actionType?:string|null;conceptId?:string|null}){
  const command=useCreativeCommand(),action=data.actions.find(a=>a.type===actionType&&(!conceptId||a.conceptId===conceptId))??data.actions[0];
  return <><div className="cl-work-context"><div><span>Proyecto</span><strong>{data.project.title}</strong><p>{data.project.authors} · {data.project.service}</p></div><Estado state={action?.state??data.state}/><p>Especialista: {data.project.specialist??'Sin responsable registrado'}</p>
    <div className="cl-source-links"><DocumentLink href={data.workspace.rootUrl}>Carpeta del proyecto</DocumentLink><DocumentLink href={data.workspace.designUrl}>Carpeta de Diseño</DocumentLink><DocumentLink href={data.enlaceGrabacion}>Reunión creativa</DocumentLink></div></div>
    {action?<section className="cl-action-form" key={action.id}><h3>{action.label}</h3><p className="cl-work-due">{creativeDate(action.dueAt)}</p>
      {(action.type==='BRIEF'||action.type==='BRIEF_ADJUSTMENT')&&<BriefForm data={data} command={command}/>}
      {action.type==='CONCEPTS'&&<ConceptsForm data={data} command={command}/>}
      {action.type==='CONCEPT_ADJUSTMENT'&&<AdjustmentForm data={data} action={action} command={command}/>}
      {action.type==='RESOURCES'&&<ResourcesForm data={data} command={command}/>}
      {action.type==='COVER_REVIEW'&&<CoverForm data={data} command={command}/>}
    </section>:<div className="cl-work-waiting"><strong>{data.state}</strong><p>{data.state==='Completado'?'Tu trabajo creativo está completo.':'Esta intervención está esperando el siguiente paso de su responsable.'}</p><DocumentLink href={data.briefEnlace}>Consultar brief</DocumentLink></div>}
    {command.isPending&&<p role="status">Registrando entrega…</p>}{command.isError&&<p role="alert" className="cl-form-error">{command.error.message}</p>}{command.isSuccess&&<p role="status" className="cl-form-success">Acción registrada correctamente.</p>}
    {data.concepts.length>0&&<details className="cl-concept-context"><summary>Conceptos del proyecto · {data.concepts.length}</summary>{data.concepts.map(c=><div key={c.id}><strong>{c.descripcion??'Concepto de portada'}</strong><span>{c.fechaAprobadaAutor?'Aprobado por autor':c.estado??(c.fechaAprobadaRrpp?'Aprobado por RRPP':'Esperando RRPP')}</span><DocumentLink href={c.enlace}>Abrir concepto</DocumentLink>{(c.feedbackRrpp||c.feedbackAutor)&&<p>{c.feedbackAutor??c.feedbackRrpp}</p>}</div>)}</details>}
  </>;
}
export function CreativeWorkDialog({id,actionType,conceptId,onClose}:{id:string;actionType?:string|null;conceptId?:string|null;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null),query=useCreativeDetail(id);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>{ref.current?.close();previous?.focus();};},[]);
  return <dialog ref={ref} className="cl-work-dialog" aria-label="Trabajo creativo" onCancel={onClose}><header><div><span>DIRECCIÓN CREATIVA</span><h2>Trabajo creativo</h2></div><button className="cl-close" aria-label="Cerrar trabajo creativo" onClick={onClose}>×</button></header><div className="cl-work-dialog-body">{query.isPending?<p role="status">Consultando trabajo…</p>:query.isError?<div role="alert"><p>{query.error.message}</p><button className="fv-button" onClick={()=>query.refetch()}>Reintentar consulta</button></div>:<WorkContent data={query.data} actionType={actionType} conceptId={conceptId}/>}</div></dialog>;
}
