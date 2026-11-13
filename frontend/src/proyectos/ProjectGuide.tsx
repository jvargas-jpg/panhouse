import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import type { ProjectCommandCenter } from '../../../shared/projectCommandCenter';
import type { GuidePath, GuideRequirement, GuideStep } from '../../../shared/projectGuide';
import { apiFetch } from '../lib/api';
import { CommandCenterProceso } from './CommandCenterProceso';
import { ValidationManagement } from '../validaciones/ValidationManagement';
import { ProjectWorkspaceCard } from './ProjectWorkspaceCard';
import { invalidarOperacion } from './operacionQueries';
import './projectGuide.css';

export function Requirements({ items }: { items: GuideRequirement[] }) {
 return <ul className="pg-requirements">{items.map(r => <li key={r.id} className={r.satisfied ? 'pg-done' : ''}><span aria-hidden="true">{r.satisfied ? '✓' : '○'}</span>{r.label}</li>)}</ul>;
}
function PreparationStep({ id, data, step }: { id: string; data: ProjectCommandCenter; step: GuideStep }) {
 const p = data.preparacion, cache = useQueryClient();
 const [values, setValues] = useState<Record<string, string | boolean | null>>({});
 const save = useMutation({ mutationFn: () => apiFetch('/proyectos/'+id+'/preparacion-inicial', { method: 'PATCH', body: JSON.stringify(values) }), onSuccess: () => { setValues({}); invalidarOperacion(cache,id); void cache.invalidateQueries({ queryKey: ['proyecto',id] }); } });
 const check = (key: 'recibidoEn'|'expedienteRevisadoEn'|'primerContactoEn', label: string) => <label><input type="checkbox" checked={key in values ? !!values[key] : !!p[key]} onChange={e=>setValues(v=>({...v,[key]: e.target.checked ? new Date().toISOString() : null}))}/>{label}</label>;
 return <form className="pg-form" onSubmit={e=>{e.preventDefault();save.mutate();}}>
  {step.id==='recepcion' && <>{check('recibidoEn','Proyecto recibido')}{check('expedienteRevisadoEn','Expediente revisado')}</>}
  {step.id==='contacto' && <>{check('primerContactoEn','Primer contacto realizado')}{p.primerContactoDueAt && <p>Plazo: {new Date(p.primerContactoDueAt).toLocaleString('es-VE')}</p>}</>}
  {step.id==='reunion' && <><label>Fecha y hora de la reunión<input type="datetime-local" required onChange={e=>setValues(v=>({...v,reunionOperativaFecha:e.target.value ? new Date(e.target.value+'-04:00').toISOString() : null}))}/></label><label><input type="checkbox" checked={!!(values.reunionOperativaRealizada ?? p.reunionOperativaRealizada)} onChange={e=>setValues(v=>({...v,reunionOperativaRealizada:e.target.checked}))}/>Reunión operativa realizada</label></>}
  {step.id==='documentos' && <><ProjectWorkspaceCard id={id} editable initial={p.workspace}/>{(['minutaUrl','cronogramaUrl','grabacionUrl','transcripcionUrl'] as const).map((key,i)=><label key={key}>{['Minuta operativa','Cronograma','Grabación','Transcripción'][i]}<input type="url" placeholder="https://…" value={String(values[key] ?? p[key] ?? '')} onChange={e=>setValues(v=>({...v,[key]:e.target.value || null}))}/></label>)}</>}
  <button className="pg-primary" disabled={save.isPending || !Object.keys(values).length}>{save.isPending ? 'Guardando…' : 'Guardar y seguir'}</button>{save.error && <p role="alert">{save.error.message}</p>}
 </form>;
}
function PathDetail({ id, data, path, onSelect }: { id: string; data: ProjectCommandCenter; path: GuidePath; onSelect: (id?: string) => void }) {
 const cache = useQueryClient(), [manage,setManage] = useState(false), [past,setPast] = useState<string | null>(null);
 const guide = data.guide!;
 const refresh = () => { invalidarOperacion(cache,id); void cache.invalidateQueries({ queryKey: ['proyecto',id] }); void cache.invalidateQueries({ queryKey: ['solicitudes'] }); };
 const request = useMutation({ mutationFn: () => apiFetch('/proyectos/'+id+'/solicitar-editor',{method:'POST'}), onSuccess: refresh });
 const next = useMutation({ mutationFn: () => apiFetch<{nextProcess:string}>('/proyectos/'+id+'/workflow/continue',{method:'POST',body:JSON.stringify({path:path.id})}), onSuccess: result=>{refresh();onSelect(result.nextProcess);} });
 const selectedStep = path.steps.find(s=>s.id===past) ?? path.steps.find(s=>!s.completed) ?? path.steps.at(-1)!;
 const currentProcess = data.procesos.find(p=>p.tipo===path.id)!;
 return <section className="pg-detail" aria-label={path.label}>
  <button className="pg-back" onClick={()=>onSelect()}>← Volver a procesos disponibles</button>
  <p className="pg-eyebrow">{guide.mode==='supervise' ? 'Supervisión del proceso' : 'Estás aquí'} · {path.label}</p>
  <h2>{past ? selectedStep.label : path.currentStep}</h2><span className={'pg-state pg-'+(path.waitingFor?'waiting':path.state==='Completado'?'done':'active')}>{path.waitingFor ? `Esperando a ${path.waitingFor}` : path.state}</span>
  <p>{path.instruction}</p><p className="pg-owner">Responsable ahora: <strong>{path.responsible}</strong></p>
  {path.requirements.length>0 && <><h3>Para continuar necesitas</h3><Requirements items={past ? selectedStep.requirements : path.requirements}/></>}
  {path.editWarning && <p className="pg-warning" role="status">{path.editWarning}</p>}
  {path.waitingFor && <div className="pg-wait"><strong>No necesitas hacer nada aquí por ahora.</strong><p>La guía se actualizará cuando se registre la respuesta o el entregable esperado.</p><button className="pg-secondary" onClick={()=>onSelect()}>Trabajar en otro proceso</button></div>}
  {path.id==='preparacion_inicial' && !path.historicalReadOnly && guide.editable && <PreparationStep key={selectedStep.id} id={id} data={data} step={selectedStep}/>}
  {path.action?.kind==='request_editor' && !path.waitingFor && <button className="pg-primary" disabled={request.isPending || request.isSuccess} onClick={()=>request.mutate()}>Solicitar Editor</button>}
  {['calidad','validacion_cubierta'].includes(path.id) && <ValidationManagement projectId={id} context={path.id==='calidad'?'CALIDAD':'SOPORTE_EDITORIAL'}/>}
  {path.canOperate && path.action?.kind!=='request_editor' && path.id!=='preparacion_inicial' && <button className="pg-primary" onClick={()=>setManage(true)}>{path.action?.label ?? 'Completar este paso'}</button>}
  {(manage || guide.mode==='supervise' || path.state==='Completado' || path.historicalReadOnly && !path.waitingFor) && path.id!=='preparacion_inicial' && <details open={manage} className="pg-native"><summary>{guide.mode==='supervise'?'Consultar participantes y operaciones registradas':'Gestión del paso'}</summary><CommandCenterProceso id={id} tipo={path.id} especialista={guide.editable && !path.historicalReadOnly} rrpp={false} data={data} proceso={currentProcess}/></details>}
  {path.id==='preparacion_inicial' && path.historicalReadOnly && <details><summary>Consultar preparación registrada</summary><Requirements items={path.steps.flatMap(s=>s.requirements)}/><p>Los documentos y fechas originales permanecen disponibles en Información del proyecto.</p></details>}
  {path.steps.length>1 && <nav className="pg-step-history" aria-label="Pasos anteriores">{path.steps.map(s=><button key={s.id} disabled={!s.completed && s.id!==selectedStep.id} onClick={()=>setPast(s.id)}>{s.completed?'✓':'○'} {s.label}</button>)}{past && <button onClick={()=>setPast(null)}>Volver al paso actual</button>}</nav>}
  {guide.editable && <button className="pg-secondary" disabled={!path.canContinue || next.isPending} onClick={()=>next.mutate()}>Continuar</button>}
  {(request.error || next.error) && <p role="alert">{request.error?.message ?? next.error?.message}</p>}
 </section>;
}
function FinalPackage({ id, data }: { id: string; data: ProjectCommandCenter }) {
 const gate = data.guide!.finalPackage, cache = useQueryClient();
 const mutation = useMutation({ mutationFn: (release: boolean) => apiFetch('/fichas-trazabilidad/'+id+'/documental/diseno', { method: 'PATCH', body: JSON.stringify(release ? {paqueteFinalEntrega:new Date().toISOString().slice(0,10)} : {paqueteFinalCargado:true}) }), onSuccess: ()=>{invalidarOperacion(cache,id);void cache.invalidateQueries({queryKey:['proyecto',id]});} });
 return <section className="pg-convergence"><h2>Paquete Final</h2><strong>{gate.prepared ? 'Paquete Final listo' : gate.canPrepare ? 'Paquete Final disponible' : 'Paquete Final bloqueado'}</strong><Requirements items={gate.requirements}/><p className={!gate.financialSatisfied?'pg-warning':''}>{gate.financialMessage}</p>{data.guide!.editable && <><button className="pg-primary" disabled={!gate.canPrepare || gate.prepared || mutation.isPending} onClick={()=>mutation.mutate(false)}>Registrar paquete preparado</button><button className="pg-secondary" disabled={!gate.canRelease || mutation.isPending} onClick={()=>mutation.mutate(true)}>Liberar paquete</button></>}{mutation.error && <p role="alert">{mutation.error.message}</p>}</section>;
}
export function ProjectGuide({ id, data }: { id: string; data: ProjectCommandCenter }) {
 const [params,setParams] = useSearchParams(), guide=data.guide!;
 const selected = params.get('procesos')==='1' ? null : params.get('proceso') ?? guide.currentPath;
 const path=guide.paths.find(p=>p.id===selected);
 const select = (id?: string) => setParams(old=>{const p=new URLSearchParams(old);p.delete('modo');if(id){p.set('proceso',id);p.delete('procesos');}else{p.delete('proceso');p.set('procesos','1');}return p;});
 return <main className="project-guide"><section className="pg-position"><p className="pg-eyebrow">Posición actual del proyecto</p><h2>{guide.position}</h2><p>Especialista: <strong>{data.salud?.especialista?.nombre ?? 'Pendiente de asignación'}</strong></p><p>Próximo hito: {guide.nextMilestone}</p>{data.atencion[0] && <p className="pg-warning">{data.atencion[0].titulo} · {data.atencion[0].detalle}</p>}</section>
  {path && <PathDetail key={path.id} id={id} data={data} path={path} onSelect={select}/>}
  <section className="pg-selector" aria-label="Procesos del proyecto"><h2>{guide.mode==='supervise'?'Procesos del proyecto':'Procesos y caminos disponibles'}</h2><p>Abre un proceso para actuar o consultar. Puedes cambiar de camino mientras esperas a otra persona.</p>{(['Disponible','En curso','Esperando tercero','Bloqueado','Completado'] as const).map(state=>{const paths=guide.paths.filter(p=>p.state===state);return paths.length>0 && <div className="pg-path-group" key={state}><h3>{state==='Esperando tercero'?'Esperando terceros':state}</h3>{paths.map(p=><button className="pg-path-row" key={p.id} onClick={()=>select(p.id)} aria-current={selected===p.id?'step':undefined}><span><strong>{p.label}</strong><small>{p.currentStep}</small></span><span>{p.waitingFor ? `Esperando a ${p.waitingFor}` : p.responsible}</span><b aria-hidden="true">→</b></button>)}</div>;})}</section>
  <details className="pg-final-disclosure" open={guide.finalPackage.canPrepare || guide.finalPackage.prepared}><summary>Convergencia y Paquete Final</summary><FinalPackage id={id} data={data}/></details>
 </main>;
}
