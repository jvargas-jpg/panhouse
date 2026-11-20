import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import type { ProjectCommandCenter } from '../../../shared/projectCommandCenter';
import type { GuidePath, GuideRequirement, GuideStep } from '../../../shared/projectGuide';
import type { ReunionExtraccion } from '../../../shared/extraccion';
import { apiFetch } from '../lib/api';
import { CommandCenterProceso } from './CommandCenterProceso';
import { ValidationManagement } from '../validaciones/ValidationManagement';
import { ProjectWorkspaceCard } from './ProjectWorkspaceCard';
import { useProjectWorkspace } from './useProjectWorkspace';
import type { ProjectWorkspaceSummary } from '../../../shared/projectWorkspace';
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
  <button className="pg-primary" disabled={save.isPending || !Object.keys(values).length}>{save.isPending ? 'Guardando…' : 'Guardar y seguir'}</button>
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
// Pantalla completa, un paso a la vez — bienvenida, crear carpetas, primer
// contacto (24h) y subir archivos. El resto de Preparación Inicial (reuniones
// de extracción, etc.) sigue con la vista habitual una vez estos terminan.
function WizardCarpetas({ id, initialRequested, onContinue }: { id: string; initialRequested: boolean; onContinue: () => void }) {
 // "requested" exige el clic real del Especialista: aunque el espacio ya
 // esté listo (p. ej. creación automática previa), no se salta directo a
 // "Carpetas creadas" sin que la persona haya presionado el botón. Al
 // volver a entrar con una solicitud ya en curso (PENDING/PROVISIONING/
 // ERROR), initialRequested llega en true para reflejar ese estado real
 // en vez de mostrar "Crear carpetas" como si nada hubiera pasado.
 const [requested, setRequested] = useState(initialRequested);
 const cache = useQueryClient();
 const workspace = useProjectWorkspace(id);
 const recovery = useMutation({
  mutationFn: () => apiFetch<ProjectWorkspaceSummary>('/proyectos/'+id+'/workspace/retry', { method: 'POST', body: '{}' }),
  onSuccess: result => { cache.setQueryData(workspace.queryKey, result); invalidarOperacion(cache, id); },
  onError: () => { void cache.invalidateQueries({ queryKey: workspace.queryKey }); invalidarOperacion(cache, id); },
 });
 const w = workspace.data;
 const pending = requested && (recovery.isPending || !!w && ['PENDING','PROVISIONING'].includes(w.status));
 const ready = requested && !!w && w.status === 'READY' && !w.contextChanged;
 const falló = requested && !pending && !ready && (recovery.isError || w?.status === 'ERROR');
 return <div className="pg-wizard">
  <div className="pg-wizard-card">
   <p className="pg-eyebrow">Paso 1</p>
   <h2>{ready ? 'Carpetas creadas' : 'Creemos las carpetas primero'}</h2>
   {ready
    ? <>
       <p className="pg-wizard-status"><span aria-hidden="true">✓</span>Tus carpetas se crearon correctamente.</p>
       {w.rootFolderUrl && <p>Las encuentras en el siguiente enlace: <a href={w.rootFolderUrl} target="_blank" rel="noopener noreferrer">Abrir carpetas en Drive ↗</a></p>}
      </>
    : <p>Vamos a crear la estructura de carpetas en Google Drive para este proyecto.</p>}
   {!ready && <button type="button" className="pg-primary pg-wizard-cta" disabled={pending} onClick={()=>{setRequested(true);recovery.mutate();}}>{pending ? 'Creando carpetas…' : falló ? 'Reintentar crear carpetas' : 'Crear carpetas'}</button>}
   {ready && <button type="button" className="pg-primary pg-wizard-cta pg-wizard-done" onClick={onContinue}>Continuar →</button>}
   {(recovery.isError || falló) && <p role="alert">{recovery.error?.message ?? 'No se pudieron crear las carpetas. Intenta de nuevo.'}</p>}
  </div>
 </div>;
}
function cuentaRegresiva(ms: number) {
 const total = Math.max(0, Math.floor(ms / 1000));
 const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
 return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}
// Datos de contacto registrados por Comercial al alta del autor (autores.email/telefono) —
// ya expuestos al Especialista vía ResumenFichaViva.authors, no se inventa un campo nuevo.
function WizardContacto({ id, data, onContinue }: { id: string; data: ProjectCommandCenter; onContinue: () => void }) {
 const cache = useQueryClient();
 const p = data.preparacion;
 const [now, setNow] = useState(() => Date.now());
 useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
 const stop = useMutation({
  mutationFn: () => apiFetch('/proyectos/'+id+'/preparacion-inicial', { method: 'PATCH', body: JSON.stringify({ primerContactoEn: new Date().toISOString() }) }),
  onSuccess: () => { invalidarOperacion(cache, id); void cache.invalidateQueries({ queryKey: ['proyecto', id] }); },
 });
 const parado = !!p.primerContactoEn;
 const due = p.primerContactoDueAt ? new Date(p.primerContactoDueAt).getTime() : null;
 const vencido = !parado && due !== null && due - now <= 0;
 return <div className="pg-wizard">
  <div className="pg-wizard-card">
   <p className="pg-eyebrow">Paso 2</p>
   <h2>Tienes 24 horas para contactar al Autor</h2>
   {!parado && due !== null && <p className={'pg-wizard-timer'+(vencido?' pg-wizard-timer-late':'')}>{vencido ? 'Plazo vencido' : cuentaRegresiva(due-now)}</p>}
   {data.ficha.authors.length>0 && <div className="pg-wizard-contact">
    {data.ficha.authors.map(a => <p key={a.id}><strong>{a.name}</strong>{a.telefono ? ' · Tel: '+a.telefono : ''}{a.email?.length ? ' · '+a.email.join(', ') : ''}{!a.telefono && !a.email?.length ? ' · Comercial no registró teléfono ni correo' : ''}</p>)}
   </div>}
   {!parado
    ? <button type="button" className="pg-primary pg-wizard-cta" disabled={stop.isPending} onClick={()=>stop.mutate()}>{stop.isPending ? 'Guardando…' : 'Parar'}</button>
    : <>
       <p className="pg-wizard-status"><span aria-hidden="true">✓</span>Contacto registrado.</p>
       <button type="button" className="pg-primary pg-wizard-cta pg-wizard-done" onClick={onContinue}>Continuar →</button>
      </>}
   {stop.error && <p role="alert">{stop.error.message}</p>}
  </div>
 </div>;
}
type DocCampo = 'minuta'|'cronograma'|'cronogramaEntrevistasEf'|'estructuraPreliminares'|'solicitudInformacionAutor';
function DocumentoUploadSlot({ id, campo, label, url, onUploaded }: { id: string; campo: DocCampo; label: string; url: string | null; onUploaded: () => void }) {
 const [busy, setBusy] = useState(false), [error, setError] = useState('');
 async function receive(file?: File) {
  if (!file || busy) return;
  setError('');
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!['pdf','doc','docx','xlsx'].includes(ext) || file.size === 0 || file.size > 20*1024*1024) { setError('Selecciona un PDF, Word o Excel de hasta 20 MB.'); return; }
  setBusy(true);
  try {
   const contentBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]!); reader.onerror = () => reject(new Error('No se pudo leer el archivo')); reader.readAsDataURL(file); });
   await apiFetch('/proyectos/'+id+'/preparacion-inicial/documentos', { method: 'POST', body: JSON.stringify({ campo, name: file.name, contentBase64 }) });
   onUploaded();
  } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
 }
 return <div className="pg-upload-slot">
  <p className="pg-upload-label">{label}</p>
  {url
   ? <p className="pg-wizard-status"><span aria-hidden="true">✓</span>Subido · <a href={url} target="_blank" rel="noopener noreferrer">Abrir en Drive ↗</a></p>
   : <label className={'pg-dropzone'+(busy?' pg-dropzone-busy':'')} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void receive(e.dataTransfer.files[0]);}}>
      <span>{busy ? 'Subiendo…' : 'Arrastra el archivo aquí o'}</span><span className="pg-dropzone-button">Seleccionar archivo</span>
      <input aria-label={'Subir '+label} type="file" accept=".pdf,.doc,.docx,.xlsx" disabled={busy} onChange={e=>void receive(e.target.files?.[0])}/>
     </label>}
  {error && <p role="alert">{error}</p>}
 </div>;
}
function WizardDocumentos({ id, data, requiereExtraccion, onContinue }: { id: string; data: ProjectCommandCenter; requiereExtraccion: boolean; onContinue: () => void }) {
 const cache = useQueryClient();
 const p = data.preparacion;
 const refresh = () => { invalidarOperacion(cache, id); void cache.invalidateQueries({ queryKey: ['proyecto', id] }); };
 const campos: { campo: DocCampo; label: string; url: string | null }[] = [
  { campo: 'minuta', label: 'Minuta operativa', url: p.minutaUrl },
  { campo: 'cronograma', label: 'Cronograma general', url: p.cronogramaUrl },
  ...(requiereExtraccion ? [
   { campo: 'cronogramaEntrevistasEf' as const, label: 'Cronograma de entrevistas para EF', url: p.cronogramaEntrevistasEfUrl },
   { campo: 'estructuraPreliminares' as const, label: 'Estructura de preliminares', url: p.estructuraPreliminaresUrl },
   { campo: 'solicitudInformacionAutor' as const, label: 'Solicitud de información para "Sobre el autor"', url: p.solicitudInformacionAutorUrl },
  ] : []),
 ];
 const todoListo = campos.every(c => c.url);
 return <div className="pg-wizard">
  <div className="pg-wizard-card pg-wizard-card-wide">
   <p className="pg-eyebrow">Paso 3</p>
   <h2>Subir archivos</h2>
   <p>Sube estos documentos a la carpeta del proyecto.</p>
   <div className="pg-upload-list">{campos.map(c => <DocumentoUploadSlot key={c.campo} id={id} campo={c.campo} label={c.label} url={c.url} onUploaded={refresh}/>)}</div>
   <button type="button" className={'pg-primary pg-wizard-cta'+(todoListo?' pg-wizard-done':'')} disabled={!todoListo} onClick={onContinue}>Continuar →</button>
  </div>
 </div>;
}
function formatFechaHora(iso: string) {
 const d = new Date(iso);
 return {
  fecha: new Intl.DateTimeFormat('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Caracas' }).format(d),
  hora: new Intl.DateTimeFormat('es-VE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' }).format(d),
 };
}
// El Editor NO se guarda por sesión — se deriva de quien esté asignado al
// proyecto en Edición (path 'edicion'.assignee), un único editor por
// proyecto. Antes de esa asignación, todas las sesiones dicen "Sin asignar".
function fechaHoraCaracasInput(fecha: string | null) {
 return fecha ? new Date(new Date(fecha).getTime()-4*3600000).toISOString().slice(0,16) : '';
}
function ScheduledExtractionSession({id, sesion, editor}:{id:string;sesion:ReunionExtraccion;editor:string|null}) {
 const cache=useQueryClient();
 const [editando,setEditando]=useState(false);
 const [fechaHora,setFechaHora]=useState(()=>fechaHoraCaracasInput(sesion.fechaHora));
 const [duracion,setDuracion]=useState(()=>String(sesion.duracionMinutos??90));
 const guardar=useMutation({
  mutationFn:()=>apiFetch<{reunion:ReunionExtraccion}>('/proyectos/'+id+'/extraccion/'+sesion.id,{method:'PATCH',body:JSON.stringify({fechaHora:new Date(fechaHora+'-04:00').toISOString(),duracionMinutos:Number(duracion)})}),
  onSuccess:result=>{
   cache.setQueryData<{reuniones:ReunionExtraccion[]}>(['extraccion',id],prev=>prev?{reuniones:prev.reuniones.map(s=>s.id===result.reunion.id?result.reunion:s)}:prev);
   setEditando(false);void cache.invalidateQueries({queryKey:['extraccion',id]});invalidarOperacion(cache,id);
  },
 });
 return <li className="pg-schedule-item">
  <strong>Extracción {sesion.numero}</strong>
  {editando ? <form className="pg-form" onSubmit={e=>{e.preventDefault();guardar.mutate();}}>
   <label>Fecha y hora · Caracas<input type="datetime-local" required value={fechaHora} onChange={e=>setFechaHora(e.target.value)}/></label>
   <label>Duración (minutos)<input type="number" required min="1" max="600" value={duracion} onChange={e=>setDuracion(e.target.value)}/></label>
   <div className="pg-wizard-actions"><button type="submit" className="pg-primary" disabled={guardar.isPending}>{guardar.isPending?'Guardando…':'Guardar cambios'}</button><button type="button" className="pg-secondary" disabled={guardar.isPending} onClick={()=>setEditando(false)}>Cancelar</button></div>
   {guardar.error&&<p role="alert">{guardar.error.message}</p>}
  </form> : <>
   <span>Fecha: {sesion.fechaHora ? formatFechaHora(sesion.fechaHora).fecha : '—'} · Hora: {sesion.fechaHora ? formatFechaHora(sesion.fechaHora).hora : '—'}{sesion.duracionMinutos ? ' · Duración: '+sesion.duracionMinutos+' min' : ''}</span>
   <span>Editor: {editor ?? 'Sin asignar aún'} · Estado: {sesion.realizada ? 'Realizada' : 'Programada'}</span>
   {!sesion.realizada&&<button type="button" className="pg-secondary" aria-label={'Editar reunión '+sesion.numero} onClick={()=>{setFechaHora(fechaHoraCaracasInput(sesion.fechaHora));setDuracion(String(sesion.duracionMinutos??90));guardar.reset();setEditando(true);}}>Editar fecha y hora</button>}
  </>}
 </li>;
}
export function WizardCronograma({ id, data, onContinue }: { id: string; data: ProjectCommandCenter; onContinue: () => void }) {
 const cache = useQueryClient();
 const query = useQuery({ queryKey: ['extraccion', id], queryFn: () => apiFetch<{ reuniones: ReunionExtraccion[] }>('/proyectos/'+id+'/extraccion') });
 const edicion = data.guide?.paths.find(p => p.id === 'edicion');
 const editor = edicion?.assignee ?? null;
 const [filas, setFilas] = useState<{ fechaHora: string; duracion: string }[]>([{ fechaHora: '', duracion: '90' }]);
 const programar = useMutation({
  mutationFn: () => apiFetch('/proyectos/'+id+'/extraccion', { method: 'POST', body: JSON.stringify({ sesiones: filas.filter(f => f.fechaHora).map(f => ({ fechaHora: new Date(f.fechaHora+'-04:00').toISOString(), duracionMinutos: Number(f.duracion) })) }) }),
  onSuccess: () => { setFilas([{ fechaHora: '', duracion: '90' }]); void cache.invalidateQueries({ queryKey: ['extraccion', id] }); invalidarOperacion(cache, id); void cache.invalidateQueries({ queryKey: ['proyecto', id] }); },
 });
 const sesiones = query.data?.reuniones ?? [];
 return <div className="pg-wizard">
  <div className="pg-wizard-card pg-wizard-card-wide">
   <p className="pg-eyebrow">Paso 4</p>
   <h2>Cronograma de extracciones</h2>
   <p>Registra las sesiones según la disponibilidad que te dio el Autor.</p>
   {query.isPending&&<p role="status">Cargando sesiones…</p>}
   {query.error&&<p role="alert">{query.error.message}</p>}
   {sesiones.length > 0 && <ul className="pg-schedule-list">{sesiones.map(s => <ScheduledExtractionSession key={s.id} id={id} sesion={s} editor={editor}/>)}</ul>}
   <form className="pg-schedule-form" onSubmit={e=>{e.preventDefault();programar.mutate();}}>
   <div className="pg-upload-list">{filas.map((f, i) => <div key={i} className="pg-upload-slot">
    <p className="pg-upload-label">Sesión {sesiones.length+i+1}</p>
    <label>Fecha y hora · Caracas<input type="datetime-local" value={f.fechaHora} onChange={e=>setFilas(v=>v.map((x,j)=>j===i?{...x,fechaHora:e.target.value}:x))}/></label>
    <label>Duración (minutos)<input type="number" required min="1" max="600" value={f.duracion} onChange={e=>setFilas(v=>v.map((x,j)=>j===i?{...x,duracion:e.target.value}:x))}/></label>
   </div>)}</div>
   <div className="pg-wizard-actions">
    <button type="button" className="pg-secondary" onClick={()=>setFilas(v=>[...v,{fechaHora:'',duracion:'90'}])}>Añadir otra sesión</button>
    <button type="submit" className="pg-primary" disabled={programar.isPending || !filas.some(f=>f.fechaHora)}>{programar.isPending ? 'Guardando…' : 'Programar sesiones'}</button>
   </div>
   </form>
   {programar.error && <p role="alert">{programar.error.message}</p>}
   {sesiones.length > 0 && <button type="button" className="pg-primary pg-wizard-cta pg-wizard-done" disabled={programar.isPending} onClick={onContinue}>Continuar →</button>}
  </div>
 </div>;
}
export function WizardSolicitarEditor({id,data,onContinue,onBack}:{id:string;data:ProjectCommandCenter;onContinue:()=>void;onBack:()=>void}) {
 const cache=useQueryClient();
 const edicion=data.guide?.paths.find(p=>p.id==='edicion');
 const asignado=edicion?.requirements.some(r=>r.id==='editor'&&r.satisfied)??false;
 const reenviar=edicion?.action?.label==='Reenviar solicitud de Editor';
 const solicitar=useMutation({mutationFn:()=>apiFetch('/proyectos/'+id+'/solicitar-editor',{method:'POST'}),onSuccess:()=>{invalidarOperacion(cache,id);void cache.invalidateQueries({queryKey:['notificaciones']});}});
 const enviado=!asignado&&(edicion?.waitingFor==='Jefatura de Edición'||solicitar.isSuccess&&!reenviar);
 return <div className="pg-wizard"><div className="pg-wizard-card">
  <button type="button" className="pg-back" onClick={onBack}>← Volver al cronograma</button>
  <p className="pg-eyebrow">Paso 5</p>
  <h2>{asignado?'Editor asignado':enviado?'Solicitud enviada':'Solicitar Editor'}</h2>
  {asignado ? <p className="pg-editor-name" role="status">{edicion?.assignee??'Editor asignado al proyecto'}</p>
   : enviado ? <p role="status">Esperando a que Jefatura de Edición asigne un Editor.</p>
   : <><p>Las reuniones están programadas. Solicita un Editor para continuar.</p>{reenviar&&<p>{edicion?.instruction}</p>}<button type="button" className="pg-primary pg-wizard-cta" disabled={solicitar.isPending} onClick={()=>solicitar.mutate()}>{solicitar.isPending?'Enviando solicitud…':reenviar?'Reenviar solicitud de Editor':'Solicitar Editor'}</button></>}
  {solicitar.error&&<p role="alert">{solicitar.error.message}</p>}
  <button type="button" className="pg-primary pg-wizard-cta pg-wizard-done" disabled={!asignado} onClick={()=>{if(asignado)onContinue();}}>Continuar →</button>
 </div></div>;
}
function PreparacionWizard({ id, data, path, title, onContinue }: { id: string; data: ProjectCommandCenter; path: GuidePath; title: string; onContinue: () => void }) {
 const retomarEditor=!!path.steps.find(s=>s.id==='editor_extraccion'&&!s.completed)&&!!path.steps.find(s=>s.id==='reuniones_extraccion'&&s.completed)&&!!path.steps.find(s=>s.id==='documentos'&&s.completed)&&data.preparacion.workspace?.status==='READY'&&!data.preparacion.workspace.contextChanged;
 const ws=data.preparacion.workspace;
 // "Crear carpetas" siempre nace de un clic real (ver WizardCarpetas): el
 // workspace solo deja NOT_CONFIGURED cuando alguien ya pidió crearlo, así
 // que ese estado es una señal confiable de avance real, no de
 // aprovisionamiento silencioso.
 const carpetasYaListas=retomarEditor||(!!ws&&ws.status==='READY'&&!ws.contextChanged);
 const carpetasYaIniciadas=carpetasYaListas||(!!ws&&ws.status!=='NOT_CONFIGURED');
 const contactoYaListo=!!data.preparacion.primerContactoEn;
 const documentosYaListos=path.steps.find(s=>s.id==='documentos')?.completed??false;
 const cronogramaYaListo=path.steps.find(s=>s.id==='reuniones_extraccion')?.completed??false;
 const editorYaListo=path.steps.find(s=>s.id==='editor_extraccion')?.completed??false;
 // Retomar donde quedó: si hay cualquier señal real de avance, no repetir
 // la Bienvenida al volver a entrar — ir directo a la pantalla del
 // siguiente paso pendiente.
 const [started, setStarted] = useState(carpetasYaIniciadas||contactoYaListo||documentosYaListos||cronogramaYaListo||editorYaListo);
 const [carpetasListas, setCarpetasListas] = useState(carpetasYaListas);
 // Cada pantalla avanza SOLO cuando la persona pulsa su propio "Continuar" —
 // nunca porque el dato real ya cambió de fondo (si no, el refetch tras
 // "Parar" saltaría la confirmación directo a la siguiente pantalla antes
 // de que la persona alcance a verla).
 const [contactoListo, setContactoListo] = useState(contactoYaListo);
 const [documentosListos, setDocumentosListos] = useState(() => path.steps.find(s=>s.id==='documentos')?.completed ?? true);
 const [cronogramaListo, setCronogramaListo] = useState(() => path.steps.find(s=>s.id==='reuniones_extraccion')?.completed ?? true);
 const [editorListo,setEditorListo]=useState(()=>path.steps.find(s=>s.id==='editor_extraccion')?.completed??!path.steps.some(s=>s.id==='reuniones_extraccion'));
 useEffect(() => {
  // Nada gamificado queda pendiente (ya estaba todo hecho antes de entrar,
  // o la persona ya pasó por las cuatro pantallas) — cede el control a la
  // vista habitual en vez de quedarse sin pantalla que mostrar.
  if (started && carpetasListas && contactoListo && documentosListos && cronogramaListo && editorListo) onContinue();
 }, [started, carpetasListas, contactoListo, documentosListos, cronogramaListo, editorListo, onContinue]);
 if (!started) return <div className="pg-wizard">
  <div className="pg-wizard-card">
   <p className="pg-eyebrow">Nuevo proyecto</p>
   <h2>Bienvenido al proyecto {title}</h2>
   <p>Vamos a preparar todo lo necesario para comenzar, un paso a la vez.</p>
   <button type="button" className="pg-primary pg-wizard-cta" onClick={()=>setStarted(true)}>Comencemos →</button>
  </div>
 </div>;
 if (!carpetasListas) return <WizardCarpetas id={id} initialRequested={carpetasYaIniciadas} onContinue={()=>setCarpetasListas(true)}/>;
 if (!contactoListo) return <WizardContacto id={id} data={data} onContinue={()=>setContactoListo(true)}/>;
 if (!documentosListos) return <WizardDocumentos id={id} data={data} requiereExtraccion={path.steps.some(s=>s.id==='reuniones_extraccion')} onContinue={()=>setDocumentosListos(true)}/>;
 if (!cronogramaListo) return <WizardCronograma id={id} data={data} onContinue={()=>setCronogramaListo(true)}/>;
 if (!editorListo) return <WizardSolicitarEditor id={id} data={data} onBack={()=>setCronogramaListo(false)} onContinue={()=>setEditorListo(true)}/>;
 return null;
}
function PathDetail({ id, data, path, onSelect }: { id: string; data: ProjectCommandCenter; path: GuidePath; onSelect: (id?: string) => void }) {
 const cache = useQueryClient(), [past,setPast] = useState<string | null>(null);
 const [wizardDone, setWizardDone] = useState(() => {
  const ws = data.preparacion.workspace;
  const carpetasListas = !!ws && ws.status === 'READY' && !ws.contextChanged;
  const contactoListo = !!data.preparacion.primerContactoEn;
  const documentosListos = path.steps.find(s=>s.id==='documentos')?.completed ?? true;
  const cronogramaListo = path.steps.find(s=>s.id==='reuniones_extraccion')?.completed ?? true;
  const editorListo = path.steps.find(s=>s.id==='editor_extraccion')?.completed ?? true;
  return carpetasListas && contactoListo && documentosListos && cronogramaListo && editorListo;
 });
 const guide = data.guide!;
 const refresh = () => { invalidarOperacion(cache,id); void cache.invalidateQueries({ queryKey: ['proyecto',id] }); void cache.invalidateQueries({ queryKey: ['solicitudes'] }); };
 const request = useMutation({ mutationFn: () => apiFetch('/proyectos/'+id+'/solicitar-editor',{method:'POST'}), onSuccess: refresh });
 const creativeRequest=useMutation({mutationFn:()=>solicitarDireccionCreativa(id),onSuccess:refresh});
 const next = useMutation({ mutationFn: () => apiFetch<{nextProcess:string}>('/proyectos/'+id+'/workflow/continue',{method:'POST',body:JSON.stringify({path:path.id})}), onSuccess: result=>{refresh();onSelect(result.nextProcess);} });
 const selectedStep = path.steps.find(s=>s.id===past) ?? path.steps.find(s=>!s.completed) ?? path.steps.at(-1)!;
 const editorExtraccionPendiente = path.id==='preparacion_inicial' && path.steps.some(s=>s.requirements.some(r=>r.id==='extraction-editor'&&!r.satisfied));
 const currentProcess = data.procesos.find(p=>p.tipo===path.id) ?? {tipo:path.id,nombre:path.label,estado:path.state,detalle:path.instruction,trabajos:[]};
 if (path.id==='preparacion_inicial' && guide.editable && !path.historicalReadOnly && (path.state!=='Completado'||path.steps.some(s=>s.id==='editor_extraccion')) && !wizardDone)
  return <section className="pg-detail" aria-label={path.label}>
   <button className="pg-back" onClick={()=>onSelect()}>← Volver a procesos disponibles</button>
   <PreparacionWizard id={id} data={data} path={path} title={data.ficha.project.title} onContinue={()=>setWizardDone(true)}/>
  </section>;
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
  {path.id==='preparacion_inicial' && guide.editable && selectedStep.id==='reuniones_extraccion' && <WizardCronograma id={id} data={data} onContinue={()=>setPast(path.steps.some(s=>s.id==='editor_extraccion')?'editor_extraccion':null)}/>}
  {path.id==='preparacion_inicial' && !path.historicalReadOnly && guide.editable && selectedStep.id!=='reuniones_extraccion' && (selectedStep.id==='editor_extraccion'
   ? <WizardSolicitarEditor id={id} data={data} onBack={()=>setPast('reuniones_extraccion')} onContinue={()=>setPast(null)}/>
   : <PreparationStep key={selectedStep.id} id={id} data={data} step={selectedStep}/>)}
  {path.id!=='preparacion_inicial' && path.action?.kind==='request_editor' && !path.waitingFor && <button className="pg-primary" disabled={request.isPending} onClick={()=>request.mutate()}>{path.action.label}</button>}
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
  {guide.editable && !editorExtraccionPendiente && (path.state==='Completado'||path.waitingFor) && <button className="pg-secondary" disabled={!path.canContinue || next.isPending} onClick={()=>next.mutate()}>Continuar</button>}
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
