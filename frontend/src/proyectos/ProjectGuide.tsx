import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import type { ProjectCommandCenter } from '../../../shared/projectCommandCenter';
import type { GuidePath, GuideRequirement, GuideStep } from '../../../shared/projectGuide';
import type { ReunionExtraccion } from '../../../shared/extraccion';
import { apiFetch } from '../lib/api';
import { CommandCenterProceso } from './CommandCenterProceso';
import { ValidationManagement } from '../validaciones/ValidationManagement';
import { ProjectWorkspaceCard } from './ProjectWorkspaceCard';
import { invalidarOperacion } from './operacionQueries';
import { AuthorWorkflowPanel } from '../portalAutor/AuthorWorkflowPanel';
import './projectGuide.css';
import './operationExperience.css';
import { operationalDate } from './OperationHomePage';
import { registrarBriefAutor, registrarConceptoAutor, solicitarDireccionCreativa } from './direccionCreativaApi';
import { CorrectionGuideStep } from './SeccionCorreccionOperativa';
import { fetchDecision, responderInfoDecision } from '../jefatura/decisionesApi';

export function Requirements({ items }: { items: GuideRequirement[] }) {
 return <ul className="pg-requirements">{items.map(r => <li key={r.id} className={r.satisfied ? 'pg-done' : ''}><span aria-hidden="true">{r.satisfied ? '✓' : '○'}</span>{r.label}</li>)}</ul>;
}
// Reuniones de extracción (Escritura Fantasma) — tabla propia, distinta de
// preparaciones_proyecto, con su propia mutation (ver server/helpers/extraccion.ts).
function ReunionesExtraccionPanel({ id }: { id: string }) {
 const cache = useQueryClient(), [fecha, setFecha] = useState('');
 const query = useQuery({ queryKey: ['extraccion', id], queryFn: () => apiFetch<{ reuniones: ReunionExtraccion[] }>('/proyectos/'+id+'/extraccion') });
 const siguienteNumero = (query.data?.reuniones.length ?? 0) + 1;
 const registrar = useMutation({ mutationFn: () => apiFetch('/proyectos/'+id+'/extraccion', { method: 'POST', body: JSON.stringify({ numero: siguienteNumero, fecha, realizada: true }) }),
  onSuccess: () => { setFecha(''); void cache.invalidateQueries({ queryKey: ['extraccion', id] }); invalidarOperacion(cache,id); void cache.invalidateQueries({ queryKey: ['proyecto',id] }); } });
 return <div className="pg-form">
  <p>Registra la fecha de cada reunión de extracción realizada con el Autor. Puedes registrar varias.</p>
  {!!query.data?.reuniones.length && <ul className="pg-requirements">{query.data.reuniones.map(r => <li key={r.id} className={r.realizada ? 'pg-done' : ''}><span aria-hidden="true">{r.realizada ? '✓' : '○'}</span>Reunión {r.numero}{r.fecha ? ' · '+r.fecha : ''}</li>)}</ul>}
  <label>Fecha de la reunión<input type="date" required value={fecha} max={new Date().toISOString().slice(0,10)} onChange={e=>setFecha(e.target.value)}/></label>
  <button type="button" className="pg-primary" disabled={!fecha || registrar.isPending} onClick={()=>registrar.mutate()}>{registrar.isPending ? 'Registrando…' : 'Registrar reunión realizada'}</button>
  {registrar.error && <p role="alert">{registrar.error.message}</p>}
 </div>;
}
// Mismo patrón de lista repetible que ConceptsForm (CreativeWorkDialog.tsx):
// N enlaces, "Añadir otro" — no un único campo, puede haber varios archivos.
function ExtraccionArchivosForm({ initial, onChange }: { initial: string[] | null; onChange: (enlaces: string[]) => void }) {
 const [enlaces, setEnlaces] = useState<string[]>(initial?.length ? initial : ['']);
 const commit = (next: string[]) => { setEnlaces(next); onChange(next.filter(u => u.trim())); };
 return <>
  <p>Sube los enlaces de Drive de los documentos producidos en las reuniones de extracción.</p>
  {enlaces.map((url, i) => <label key={i}>{'Archivo '+(i+1)}<input type="url" placeholder="https://…" value={url} onChange={e=>commit(enlaces.map((u,j)=>j===i?e.target.value:u))}/></label>)}
  <button type="button" className="pg-secondary" onClick={()=>commit([...enlaces,''])}>Añadir otro archivo</button>
 </>;
}
function PreparationStep({ id, data, step }: { id: string; data: ProjectCommandCenter; step: GuideStep }) {
 const p = data.preparacion, cache = useQueryClient();
 const [values, setValues] = useState<Record<string, string | boolean | null | string[]>>({});
 const save = useMutation({ mutationFn: () => apiFetch('/proyectos/'+id+'/preparacion-inicial', { method: 'PATCH', body: JSON.stringify(values) }), onSuccess: () => { setValues({}); invalidarOperacion(cache,id); void cache.invalidateQueries({ queryKey: ['proyecto',id] }); } });
 const check = (key: 'recibidoEn'|'expedienteRevisadoEn'|'primerContactoEn', label: string) => <label><input type="checkbox" checked={key in values ? !!values[key] : !!p[key]} onChange={e=>setValues(v=>({...v,[key]: e.target.checked ? new Date().toISOString() : null}))}/>{label}</label>;
 const requiereExtraccion = step.requirements.some(r => r.id === 'estructuraPreliminaresUrl');
 return <form className="pg-form" onSubmit={e=>{e.preventDefault();save.mutate();}}>
  {step.id==='recepcion' && <>{check('recibidoEn','Proyecto recibido')}{check('expedienteRevisadoEn','Expediente revisado')}</>}
  {step.id==='contacto' && <>{check('primerContactoEn','Primer contacto realizado')}{p.primerContactoDueAt && <p>Plazo: {new Date(p.primerContactoDueAt).toLocaleString('es-VE')}</p>}</>}
  {step.id==='reunion' && <><label>Fecha y hora de la reunión (Caracas)<input type="datetime-local" required defaultValue={p.reunionOperativaFecha ? new Date(new Date(p.reunionOperativaFecha).getTime()-4*3600000).toISOString().slice(0,16) : ''} onChange={e=>setValues(v=>({...v,reunionOperativaFecha:e.target.value ? new Date(e.target.value+'-04:00').toISOString() : null}))}/></label><label><input type="checkbox" checked={!!(values.reunionOperativaRealizada ?? p.reunionOperativaRealizada)} onChange={e=>setValues(v=>({...v,reunionOperativaRealizada:e.target.checked}))}/>Reunión operativa realizada</label></>}
  {step.id==='documentos' && <><ProjectWorkspaceCard id={id} editable initial={p.workspace}/>{(['minutaUrl','cronogramaUrl','grabacionUrl','transcripcionUrl'] as const).map((key,i)=><label key={key}>{['Minuta operativa','Cronograma','Grabación','Transcripción'][i]}<input type="url" placeholder="https://…" value={String(values[key] ?? p[key] ?? '')} onChange={e=>setValues(v=>({...v,[key]:e.target.value || null}))}/></label>)}
   {requiereExtraccion && (['estructuraPreliminaresUrl','solicitudInformacionAutorUrl'] as const).map((key,i)=><label key={key}>{['Estructura de preliminares','Solicitud de información para "Sobre el autor"'][i]}<input type="url" placeholder="https://…" value={String(values[key] ?? p[key] ?? '')} onChange={e=>setValues(v=>({...v,[key]:e.target.value || null}))}/></label>)}
  </>}
  {step.id==='reuniones_extraccion' && <ReunionesExtraccionPanel id={id}/>}
  {step.id==='archivos_extraccion' && <ExtraccionArchivosForm initial={p.extraccionEnlaces} onChange={enlaces=>setValues(v=>({...v,extraccionEnlaces:enlaces}))}/>}
  {step.id!=='reuniones_extraccion' && <button className="pg-primary" disabled={save.isPending || !Object.keys(values).length}>{save.isPending ? 'Guardando…' : 'Guardar y seguir'}</button>}
  {save.error && <p role="alert">{save.error.message}</p>}
 </form>;
}
function EditorialTitles({ id, data }: { id: string; data: ProjectCommandCenter }) {
 const cache=useQueryClient(),[title,setTitle]=useState(data.datosEditoriales.titulo??''),[subtitle,setSubtitle]=useState(data.datosEditoriales.subtitulo??'');
 const locked=data.procesos.some(p=>['direccion_creativa','diseno','calidad','validacion_cubierta'].includes(p.tipo)&&p.trabajos.length);
 const save=useMutation({mutationFn:()=>apiFetch('/proyectos/'+id+'/datos-editoriales',{method:'PATCH',body:JSON.stringify({titulo:title.trim()||null,subtitulo:subtitle.trim()||null})}),onSuccess:()=>{void cache.invalidateQueries({queryKey:['proyecto',id]});}});
 return <details className="pg-native" open={!title || !subtitle}><summary>Título y subtítulo definitivos</summary>{locked || !data.guide?.editable ? <><p>{data.datosEditoriales.titulo??'Título pendiente'} · {data.datosEditoriales.subtitulo??'Subtítulo pendiente'}</p>{locked&&<p className="pg-warning">Este cambio puede afectar procesos posteriores. Los títulos son de solo lectura desde el inicio de Creativa o Diseño.</p>}</> : <form className="pg-form" onSubmit={e=>{e.preventDefault();save.mutate();}}><p>Registra los títulos acordados con el Autor para habilitar la reunión creativa.</p><label>Título definitivo<input required maxLength={300} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Subtítulo definitivo<input required maxLength={300} value={subtitle} onChange={e=>setSubtitle(e.target.value)}/></label><button className="pg-primary" disabled={save.isPending}>Guardar títulos</button>{save.error&&<p role="alert">{save.error.message}</p>}{save.isSuccess&&<p role="status">Títulos registrados en el proyecto.</p>}</form>}</details>;
}
function AuthorHandoff({id,path,onSaved}:{id:string;path:GuidePath;onSaved:()=>void}) {
 const [date,setDate]=useState('');
 const action=path.action!;
 const save=useMutation({mutationFn:()=>action.kind==='chapter_author'?apiFetch('/capitulos/'+id+'/'+action.chapter+'/autor',{method:'PATCH',body:JSON.stringify({fechaEnvioAutor:date})}):action.kind==='brief_author'?registrarBriefAutor(action.targetId!,{fechaBriefEnviadoAutor:date}):registrarConceptoAutor(action.targetId!,{fechaEnviadaAutor:date}),onSuccess:onSaved});
 return <form className="pg-form" onSubmit={e=>{e.preventDefault();save.mutate();}}><p>Comparte el documento con el Autor y registra la fecha del envío para iniciar el seguimiento de su respuesta.</p><label>Fecha de envío al Autor<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button className="pg-primary" disabled={!date||save.isPending}>{save.isPending?'Guardando…':'Guardar y seguir'}</button>{save.error&&<p role="alert">{save.error.message}</p>}</form>;
}
function DecisionResponse({id,onSaved}:{id:string;onSaved:()=>void}) {
 const [message,setMessage]=useState('');
 const query=useQuery({queryKey:['decisiones','detalle',id],queryFn:()=>fetchDecision(id)});
 const save=useMutation({mutationFn:()=>responderInfoDecision(id,message.trim(),query.data?.version),onSuccess:onSaved});
 return <form className="pg-form" onSubmit={e=>{e.preventDefault();save.mutate();}}><label>Información para Jefatura<textarea required maxLength={2000} value={message} onChange={e=>setMessage(e.target.value)}/></label><button className="pg-primary" disabled={!message.trim()||!query.data||save.isPending}>Guardar y reenviar a Jefatura</button>{(query.error||save.error)&&<p role="alert">{query.error?.message??save.error?.message}</p>}</form>;
}
function PathDetail({ id, data, path, onSelect }: { id: string; data: ProjectCommandCenter; path: GuidePath; onSelect: (id?: string) => void }) {
 const cache = useQueryClient(), [past,setPast] = useState<string | null>(null);
 const guide = data.guide!;
 const refresh = () => { invalidarOperacion(cache,id); void cache.invalidateQueries({ queryKey: ['proyecto',id] }); void cache.invalidateQueries({ queryKey: ['solicitudes'] }); };
 const request = useMutation({ mutationFn: () => apiFetch('/proyectos/'+id+'/solicitar-editor',{method:'POST'}), onSuccess: refresh });
 const creativeRequest=useMutation({mutationFn:()=>solicitarDireccionCreativa(id),onSuccess:refresh});
 const next = useMutation({ mutationFn: () => apiFetch<{nextProcess:string}>('/proyectos/'+id+'/workflow/continue',{method:'POST',body:JSON.stringify({path:path.id})}), onSuccess: result=>{refresh();onSelect(result.nextProcess);} });
 const selectedStep = path.steps.find(s=>s.id===past) ?? path.steps.find(s=>!s.completed) ?? path.steps.at(-1)!;
 const currentProcess = data.procesos.find(p=>p.tipo===path.id) ?? {tipo:path.id,nombre:path.label,estado:path.state,detalle:path.instruction,trabajos:[]};
 return <section className="pg-detail" aria-label={path.label}>
  <button className="pg-back" onClick={()=>onSelect()}>← Volver a procesos disponibles</button>
  <p className="pg-eyebrow">{guide.mode==='supervise' ? 'Supervisión del proceso' : 'Estás aquí'} · {path.label}</p>
  <h2>{past ? selectedStep.label : path.currentStep}</h2><span className={'pg-state pg-'+(path.waitingFor?'waiting':path.state==='Completado'?'done':'active')}>{path.waitingFor ? `Esperando a ${path.waitingFor}` : path.state}</span>
  <p>{path.instruction}</p>
  {(path.assignee||path.requestedAt||path.assignedAt)&&<dl className="pg-facts">{path.requestedAt&&<div><dt>Solicitado</dt><dd>{operationalDate(path.requestedAt)}</dd></div>}{path.assignee&&<div><dt>Asignado a</dt><dd>{path.assignee}</dd></div>}{path.assignedAt&&<div><dt>Asignación</dt><dd>{operationalDate(path.assignedAt)}</dd></div>}</dl>}
  {path.delivery&&<div className="pg-evidence"><strong>Entrega recibida</strong><p>{path.delivery.label} · {operationalDate(path.delivery.receivedAt)}</p><a href={path.delivery.url} target="_blank" rel="noopener noreferrer">Abrir documento ↗</a></div>}
  {path.requirements.length>0 && <><h3>Para continuar necesitas</h3><Requirements items={past ? selectedStep.requirements : path.requirements}/></>}
  {path.editWarning && <p className="pg-warning" role="status">{path.editWarning}</p>}
  {path.waitingFor && <div className="pg-wait"><strong>{guide.mode==='supervise' ? 'La respuesta depende de '+path.waitingFor+'.' : 'No necesitas hacer nada aquí por ahora.'}</strong><p>Esperando desde: {operationalDate(path.waitingSince)}{path.dueAt?' · Plazo: '+operationalDate(path.dueAt):' · Sin plazo confirmado'}</p><p>{guide.availableProcesses?.filter(p=>p!==path.id).length??0} procesos disponibles mientras esperas.</p><button className="pg-secondary" onClick={()=>onSelect()}>{guide.mode==='supervise'?'Consultar otros procesos':'Trabajar en otro proceso'}</button></div>}
  {path.id==='preparacion_inicial' && !path.historicalReadOnly && guide.editable && <PreparationStep key={selectedStep.id} id={id} data={data} step={selectedStep}/>}
  {path.action?.kind==='request_editor' && !path.waitingFor && <button className="pg-primary" disabled={request.isPending} onClick={()=>request.mutate()}>{path.action.label}</button>}
  {path.action?.kind==='creative_request' && path.canOperate && <button className="pg-primary" disabled={creativeRequest.isPending} onClick={()=>creativeRequest.mutate()}>{path.action.label}</button>}
  {path.action?.kind.startsWith('correction_')&&path.canOperate&&<CorrectionGuideStep key={path.action.kind+path.action.targetId} id={id} action={path.action}/>}
  {path.action?.kind==='decision_response'&&path.canOperate&&<DecisionResponse id={path.action.targetId!} onSaved={refresh}/>}
  {guide.mode==='supervise'&&guide.supervisionActions?.filter(a=>a.processId===path.id&&a.kind==='decision').map(a=><p key={a.id} className="pg-warning"><Link to={a.href}>{a.label} · Revisar decisión →</Link></p>)}
  {(path.id==='direccion_creativa'||path.id==='edicion'&&!path.waitingFor&&path.action?.kind==='native') && <EditorialTitles key={data.datosEditoriales.titulo+'|'+data.datosEditoriales.subtitulo} id={id} data={data}/>}
  {['calidad','validacion_cubierta'].includes(path.id) && (path.canOperate&&path.action?.kind==='validation'||guide.mode==='supervise'&&path.waitingFor==='Jefatura') && <ValidationManagement projectId={id} context={path.id==='calidad'?'CALIDAD':'SOPORTE_EDITORIAL'}/>}
  {path.canOperate&&path.action&&['chapter_author','brief_author','concept_author'].includes(path.action.kind)&&<AuthorHandoff key={path.action.kind+path.action.targetId+path.action.chapter} id={id} path={path} onSaved={refresh}/>}
  {path.canOperate && path.action?.kind==='native' && path.id!=='preparacion_inicial' && <div className="pg-native"><CommandCenterProceso id={id} tipo={path.id} especialista={guide.editable && !path.historicalReadOnly} rrpp={false} data={data} proceso={currentProcess}/></div>}
  {path.state==='Completado'&&path.id!=='preparacion_inicial'&&<details className="pg-native"><summary>Consultar registro de este proceso</summary><CommandCenterProceso id={id} tipo={path.id} especialista={false} rrpp={false} data={data} proceso={currentProcess}/></details>}
  {guide.editable && ['edicion','direccion_creativa','diseno','calidad'].includes(path.id) && <details className="pg-native"><summary>Documentos y aprobaciones del Autor</summary><AuthorWorkflowPanel projectId={id}/></details>}
  {path.id==='preparacion_inicial' && path.historicalReadOnly && <details><summary>Consultar preparación registrada</summary><Requirements items={path.steps.flatMap(s=>s.requirements)}/><p>Los documentos y fechas originales permanecen disponibles en Información del proyecto.</p></details>}
  {path.steps.length>1 && <nav className="pg-step-history" aria-label="Pasos anteriores">{path.steps.map(s=><button key={s.id} disabled={!s.completed && s.id!==selectedStep.id} onClick={()=>setPast(s.id)}>{s.completed?'✓':'○'} {s.label}</button>)}{past && <button onClick={()=>setPast(null)}>Volver al paso actual</button>}</nav>}
  {guide.editable && (path.state==='Completado'||path.waitingFor) && <button className="pg-secondary" disabled={!path.canContinue || next.isPending} onClick={()=>next.mutate()}>Continuar</button>}
  {(request.error || next.error || creativeRequest.error) && <p role="alert">{request.error?.message ?? next.error?.message ?? creativeRequest.error?.message}</p>}
 </section>;
}
function FinalPackage({ id, data }: { id: string; data: ProjectCommandCenter }) {
 const gate = data.guide!.finalPackage, cache = useQueryClient();
 const mutation = useMutation({ mutationFn: (release: boolean) => apiFetch('/fichas-trazabilidad/'+id+'/documental/diseno', { method: 'PATCH', body: JSON.stringify({datos:release ? {paqueteFinalEntrega:new Date().toISOString().slice(0,10)} : {paqueteFinalCargado:true}}) }), onSuccess: ()=>{invalidarOperacion(cache,id);void cache.invalidateQueries({queryKey:['proyecto',id]});} });
 return <section className="pg-convergence"><h2>Paquete Final</h2><strong>{gate.prepared ? 'Paquete Final listo' : gate.canPrepare ? 'Paquete Final disponible' : 'Paquete Final bloqueado'}</strong><Requirements items={gate.requirements}/><p className={!gate.financialSatisfied?'pg-warning':''}>{gate.financialMessage}</p>{data.guide!.editable && <><button className="pg-primary" disabled={!gate.canPrepare || gate.prepared || mutation.isPending} onClick={()=>mutation.mutate(false)}>Registrar paquete preparado</button><button className="pg-secondary" disabled={!gate.canRelease || mutation.isPending} onClick={()=>mutation.mutate(true)}>Liberar paquete</button></>}{mutation.error && <p role="alert">{mutation.error.message}</p>}</section>;
}
export function ProjectGuide({ id, data }: { id: string; data: ProjectCommandCenter }) {
 const [params,setParams] = useSearchParams(), guide=data.guide!;
 const selected = params.get('procesos')==='1' ? null : params.get('proceso') ?? (guide.mode==='supervise'?null:guide.currentPath);
 const path=guide.paths.find(p=>p.id===selected);
 const select = (id?: string) => setParams(old=>{const p=new URLSearchParams(old);p.delete('modo');if(id){p.set('proceso',id);p.delete('procesos');}else{p.delete('proceso');p.set('procesos','1');}return p;});
 const main=guide.paths.find(p=>p.id===guide.currentPath);
 return <main className="project-guide"><section className="pg-position"><p className="pg-eyebrow">Estás aquí · Línea principal de producción</p><h2>{main?.label??guide.position}</h2>{main&&<p>{guide.position}</p>}{main?.waitingFor&&<p className="pp-wait">Esperando a {main.waitingFor}</p>}<button className="pg-secondary" onClick={()=>select()}>{path?'Cambiar de proceso':'Elegir un proceso'}</button></section>
  {path && <PathDetail key={path.id} id={id} data={data} path={path} onSelect={select}/>}
  {!path&&guide.mode==='supervise'&&guide.supervisionActions?.length>0&&<section className="oh-section"><h2>Intervenciones en este proyecto</h2>{guide.supervisionActions.map(a=><article className="oh-item" key={a.id}><h3>{a.label}</h3><Link className="pg-primary" to={a.href}>Atender →</Link></article>)}</section>}
  {!path&&<section className="pg-selector" aria-label="Procesos del proyecto"><h2>{guide.mode==='supervise'?'Procesos del proyecto':'Procesos y caminos disponibles'}</h2><p>Elige dónde trabajar. Cada proceso conserva sus requisitos y esperas.</p>{guide.paths.map(p=><button className="pg-path-row" key={p.id} onClick={()=>select(p.id)}><span><strong>{p.label}{p.id===guide.currentPath?' · Principal':''}</strong><small>{p.currentStep}</small>{p.blockingReasons?.length>0&&<small>Falta: {p.blockingReasons.join(' · ')}</small>}</span><span>{p.waitingFor ? `Esperando a ${p.waitingFor}` : p.requiresAction?'Acción disponible':p.state}</span><b aria-hidden="true">→</b></button>)}</section>}
  <details className="pg-final-disclosure" open={guide.finalPackage.canPrepare || guide.finalPackage.prepared}><summary>Convergencia y Paquete Final</summary><FinalPackage id={id} data={data}/></details>
 </main>;
}
