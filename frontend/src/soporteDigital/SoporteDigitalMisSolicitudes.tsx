import '../editor/editor.css';
import '../editor/miTrabajo.css';
import './soporteDigitalHome.css';
import './soporteDigitalMisSolicitudes.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMe } from '../auth/useAuth';
import { ApiError } from '../lib/api';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';


import { RrppIcon } from '../rrpp/RrppIcons';
import { EditorDetail, EditorSearch, EditorSelect, EditorSkeleton, useEditorDesktop, useEditorFilters } from '../editor/EditorUi';
import { EditorEmpty } from '../editor/EditorParts';
import { DigitalCover, DigitalNavigation, digitalDate, digitalWorkKey, miTrabajoUrl } from './SoporteDigitalUi';
import { DIGITAL_STAGE_LABELS } from '../../../shared/soporteDigitalHome';
import { DIGITAL_REQUEST_LABELS, DIGITAL_REQUEST_STATUSES, DIGITAL_REQUEST_STATUS_LABELS, DIGITAL_REQUEST_TYPES, type DigitalRequestStatus, type DigitalRequestType } from '../../../shared/soporteDigitalRequests';
import { answerDigitalRequest, attachDigitalRequest, cancelDigitalRequest, createDigitalRequest, digitalRequestsKey, fetchDigitalRequest, fetchDigitalRequestContexts, fetchDigitalRequests } from './soporteDigitalRequestsApi';
const TABS = [['all','Todas'],['pending','Pendientes'],['returned','Requieren tu acción'],['resolved','Resueltas'],['cancelled','Canceladas']] as const;
const FILTERS = ['status','type','project','from','to'];
const stamp = (date: string) => new Intl.DateTimeFormat('es-VE', { timeZone:'America/Caracas', day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(new Date(date));
export function DigitalRequestBadge({ status }: { status: DigitalRequestStatus }) {
  const tone = status === 'requiere_informacion' ? 'violet' : status === 'resuelta' ? 'green' : status === 'rechazada' ? 'red' : status === 'cancelada' ? 'neutral' : 'amber';
  return <span className={'ec-status ec-' + tone}><i aria-hidden="true" />{DIGITAL_REQUEST_STATUS_LABELS[status]}</span>;
}
function useInvalidation() {
  const cache = useQueryClient();
  return async () => { await Promise.all([cache.invalidateQueries({ queryKey:digitalRequestsKey }), cache.invalidateQueries({ queryKey:digitalWorkKey }), cache.invalidateQueries({ queryKey:['soporte-digital','inicio'] })]); };
}
function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const prior = document.activeElement as HTMLElement | null; const d = ref.current; d?.showModal(); return () => { d?.close(); prior?.focus(); }; }, []);
  return <dialog ref={ref} className="dr-dialog" aria-label={title} onKeyDown={e => e.stopPropagation()} onCancel={e => { e.preventDefault(); onClose(); }}><header><h2>{title}</h2><button type="button" aria-label="Cerrar formulario" onClick={onClose}>×</button></header>{children}</dialog>;
}
async function fileContent(file: File) {
  if (!/\.(pdf|png|jpe?g)$/i.test(file.name) || file.size < 1 || file.size > 5 * 1024 * 1024) throw new Error('Selecciona una imagen PNG/JPEG o un PDF de hasta 5 MB.');
  return new Promise<string>((resolve,reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = () => reject(new Error('No se pudo leer el archivo.')); r.readAsDataURL(file); });
}
export function SoporteDigitalMisSolicitudes() {
  const { data:user } = useMe(), { params,setParams,search,setSearch } = useEditorFilters();
  const desktop = useEditorDesktop(), invalidate = useInvalidation();
  const tab = TABS.find(([id]) => id === params.get('tab'))?.[0] ?? 'all';
  const pageSize = ['10','25','50'].includes(params.get('pageSize') ?? '') ? params.get('pageSize')! : '25';
  const query = new URLSearchParams({ tab,search:params.get('search') ?? '',page:params.get('page') ?? '1',pageSize });
  for (const k of FILTERS) if (params.get(k)) query.set(k,params.get(k)!);
  const list = useQuery({ queryKey:[...digitalRequestsKey,user?.id,'list',query.toString()],queryFn:() => fetchDigitalRequests(query),enabled:!!user,placeholderData:(previous,query) => query?.queryKey[2]===user?.id ? previous : undefined,refetchInterval:15000 });
  const items = list.data?.items ?? [], detailId = params.get('request') ?? (desktop && params.get('detailClosed') !== '1' ? items[0]?.id : undefined);
  const [notice,setNotice] = useState('');
  const change = (key: string,value: string) => setParams(current => {
    const next = new URLSearchParams(current); value ? next.set(key,value) : next.delete(key);
    if (!['request','detailTab','create'].includes(key)) { for (const k of ['request','detailTab','detailClosed']) next.delete(k); if (key !== 'page') next.delete('page'); }
    if (key === 'request') { next.delete('create'); next.delete('detailTab'); next.delete('detailClosed'); }
    return next;
  });
  const clear = () => { setSearch(''); setParams({ vista:'mis-solicitudes' }); };
  const close = () => setParams(current => { const next = new URLSearchParams(current); for (const k of ['request','detailTab','create','workItemId']) next.delete(k); next.set('detailClosed','1'); return next; });
  const filterRef = useRef<HTMLDetailsElement>(null), filterCount = FILTERS.filter(k => params.has(k)).length, filtered = filterCount > 0 || !!search;
  useEffect(() => {
    const outside = (e:PointerEvent) => { if (filterRef.current && !filterRef.current.contains(e.target as Node)) filterRef.current.open=false; };
    const escape = (e:KeyboardEvent) => { if (e.key==='Escape' && filterRef.current?.open) { e.stopPropagation(); filterRef.current.open=false; filterRef.current.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown',outside); document.addEventListener('keydown',escape,true);
    return () => { document.removeEventListener('pointerdown',outside); document.removeEventListener('keydown',escape,true); };
  },[]);
  return <CrmSidebarLayout nav={<DigitalNavigation active="mis-solicitudes" />}    contentMaxWidth="max-w-none" shellClassName="soporte-digital-layout" contentClassName="soporte-digital-home editor-shell sd-requests" >

    <div className="sd-body dr-workspace"><div className="dr-main"><nav className="sd-breadcrumb" aria-label="Ruta de navegación"><span>Soporte Digital</span><RrppIcon nombre="flecha" /><strong>Mis solicitudes</strong></nav>
      <header className="sd-page-header"><div><h1>Mis solicitudes</h1><p>Consulta las solicitudes que has enviado sobre tus tareas digitales y revisa su estado.</p></div><button className="ec-primary" type="button" onClick={() => change('create','1')}><RrppIcon nombre="ingreso" />Nueva solicitud</button></header>
      {notice && <p className="dr-notice" role="status">{notice}<button aria-label="Cerrar aviso" onClick={() => setNotice('')}>×</button></p>}
      <section aria-label="Solicitudes enviadas por mí"><div className="dr-controls"><nav className="mw-views" aria-label="Estado de mis solicitudes">{TABS.map(([id,label]) => <button type="button" key={id} aria-pressed={tab===id} onClick={() => change('tab',id)}>{label}<span>{list.data?.counts[id] ?? '—'}</span></button>)}</nav>
        <div className="dr-tools"><EditorSearch value={search} onChange={setSearch} placeholder="Buscar por proyecto, autor, tema o tarea…" /><details className="mw-filters" ref={filterRef}><summary><RrppIcon nombre="lista" />Filtros{filterCount>0 && <span>{filterCount}</span>}</summary><div className="mw-filter-panel"><header><strong>Filtrar solicitudes</strong><button type="button" aria-label="Cerrar filtros" onClick={() => { if(filterRef.current) filterRef.current.open=false; }}>×</button></header>
          <EditorSelect label="Estado" value={params.get('status') ?? ''} onChange={v => change('status',v)} options={DIGITAL_REQUEST_STATUSES.map(id => ({ id,name:DIGITAL_REQUEST_STATUS_LABELS[id] }))} />
          <EditorSelect label="Tipo de solicitud" value={params.get('type') ?? ''} onChange={v => change('type',v)} options={DIGITAL_REQUEST_TYPES.map(id => ({ id,name:DIGITAL_REQUEST_LABELS[id] }))} />
          <EditorSelect label="Proyecto" value={params.get('project') ?? ''} onChange={v => change('project',v)} options={list.data?.projects ?? []} />
          <label>Desde<input aria-label="Fecha de creación desde" type="date" value={params.get('from') ?? ''} max={params.get('to') ?? undefined} onChange={e => change('from',e.target.value)} /></label><label>Hasta<input aria-label="Fecha de creación hasta" type="date" value={params.get('to') ?? ''} min={params.get('from') ?? undefined} onChange={e => change('to',e.target.value)} /></label>
          <footer><button className="eo-text-button" type="button" onClick={clear}>Limpiar filtros</button><button className="ec-primary" type="button" onClick={() => { if(filterRef.current) filterRef.current.open=false; }}>Ver resultados</button></footer></div></details></div></div>
        {filtered && <div className="dr-filter-summary"><span>{list.data?.total ?? '—'} solicitudes encontradas</span><button onClick={clear}>Limpiar filtros</button></div>}
        <section className="dr-list" aria-label="Mis solicitudes enviadas" aria-busy={list.isFetching}>{list.isError ? <EditorEmpty><span role="alert">No se pudieron cargar tus solicitudes.</span><button onClick={() => list.refetch()}>Reintentar solicitudes</button></EditorEmpty> : list.isPending ? <EditorSkeleton label="Cargando solicitudes" /> : items.length ? <table className="dr-table"><caption className="sr-only">Una fila por solicitud. Selecciona una para consultar su detalle.</caption><thead><tr>{['Proyecto / Autor','Tipo','Tema / Tarea','Estado','Actualización',''].map(t => <th key={t} scope="col">{t || <span className="sr-only">Abrir detalle</span>}</th>)}</tr></thead><tbody>{items.map(r => <tr key={r.id} className={detailId===r.id?'is-selected':''} aria-selected={detailId===r.id} tabIndex={0} onClick={() => change('request',r.id)} onKeyDown={e => { if(e.target===e.currentTarget && ['Enter',' '].includes(e.key)) { e.preventDefault(); change('request',r.id); } }}>
          <td><div className="sd-identity"><DigitalCover url={r.coverUrl} /><div><strong>{r.projectTitle}</strong><span>{r.authors}</span><small>{r.projectCode}</small></div></div></td><td>{DIGITAL_REQUEST_LABELS[r.type]}</td><td><strong className="dr-clamp">{r.subject}</strong><span className="dr-clamp dr-summary">{r.summary}</span><small className="dr-clamp">{r.taskLabel}</small></td><td><DigitalRequestBadge status={r.status} />{r.blocksWorkItem && <small>Bloquea la tarea</small>}</td><td><time title={r.lastEvent+' · '+stamp(r.updatedAt)} dateTime={r.updatedAt}>{digitalDate(r.updatedAt)}</time></td><td><button type="button" className="dr-open" aria-label={'Abrir solicitud: '+r.subject} onClick={e => { e.stopPropagation(); change('request',r.id); }}><span>Ver detalle</span><RrppIcon nombre="flecha" /></button></td>
        </tr>)}</tbody></table> : <div className="dr-empty"><RrppIcon nombre="comentarios" /><h2>{filtered?'No hay solicitudes que coincidan con estos filtros.':'Aún no has enviado solicitudes.'}</h2><p>{filtered?'Prueba con otro filtro o término de búsqueda.':'Los problemas o aclaraciones que reportes sobre tus tareas digitales aparecerán aquí.'}</p>{filtered?<button className="ec-secondary" onClick={clear}>Limpiar filtros</button>:<Link className="ec-secondary" to={miTrabajoUrl()}>Ir a Mi trabajo</Link>}</div>}
          {list.data && <footer className="mw-pagination"><span>{list.data.total} solicitudes</span><div><button type="button" aria-label="Página anterior" disabled={list.data.page<=1 || list.isFetching} onClick={() => change('page',String(list.data!.page-1))}>‹</button><span>{list.data.page} / {list.data.pages}</span><button type="button" aria-label="Página siguiente" disabled={list.data.page>=list.data.pages || list.isFetching} onClick={() => change('page',String(list.data!.page+1))}>›</button><select aria-label="Solicitudes por página" value={pageSize} onChange={e => change('pageSize',e.target.value)}>{[10,25,50].map(n => <option key={n} value={n}>Mostrar {n}</option>)}</select></div></footer>}
        </section></section></div>
      {detailId ? <RequestDetail key={detailId} id={detailId} open={desktop || !!params.get('request')} tab={params.get('detailTab') ?? 'detail'} onTab={t => change('detailTab',t)} onClose={close} /> : <div className="dr-placeholder"><RrppIcon nombre="comentarios" /><p>Selecciona una solicitud</p><small>Consulta su contexto, evidencia y resultado.</small></div>}
    </div>
    {params.get('create')==='1' && <CreateRequest workItemId={params.get('workItemId')} onClose={() => change('create','')} onDone={async (id,warning) => { await invalidate(); setNotice(warning || 'Solicitud enviada al Especialista coordinador.'); setParams(current => { const next=new URLSearchParams(current); next.delete('create'); next.delete('workItemId'); next.delete('detailClosed'); next.set('request',id); if(warning) next.set('detailTab','files'); return next; }); }} />}
  </CrmSidebarLayout>;
}
function CreateRequest({ workItemId,onClose,onDone }: { workItemId: string | null; onClose: () => void; onDone:(id:string,warning?:string) => Promise<void> }) {
  const { data:user } = useMe();
  const [search,setSearch]=useState(''),[debounced,setDebounced]=useState(''),[page,setPage]=useState(1),[work,setWork]=useState(workItemId ?? ''),[type,setType]=useState<DigitalRequestType>(DIGITAL_REQUEST_TYPES[0]);
  const [subject,setSubject]=useState(''),[description,setDescription]=useState(''),[blocks,setBlocks]=useState(false),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const pending=useRef(false), key=useRef<string|null>(null);
  useEffect(() => { const t=setTimeout(() => { setDebounced(search); setPage(1); },300); return () => clearTimeout(t); },[search]);
  const query=new URLSearchParams({ search:debounced,page:String(page),pageSize:'10' }); if(workItemId) query.set('workItemId',workItemId);
  const q=useQuery({ queryKey:[...digitalRequestsKey,user?.id,'contexts',query.toString()],queryFn:() => fetchDigitalRequestContexts(query),enabled:!!user });
  const selected=q.data?.items.find(c => c.workItemId===work);
  return <Dialog title="Nueva solicitud" onClose={() => { if(!busy) onClose(); }}><form onSubmit={async e => {
    e.preventDefault(); if(pending.current || !selected) return; pending.current=true; setBusy(true); setError('');
    try { const content=file?await fileContent(file):null; key.current ??= crypto.randomUUID();
      const created=await createDigitalRequest({ workItemId:work,type,subject,description,blocksWorkItem:blocks && selected.canBlock,idempotencyKey:key.current });
      let warning: string|undefined;
      if(file && content) try { await attachDigitalRequest(created.id,{ expectedVersion:1,uploadKey:crypto.randomUUID(),name:file.name,contentBase64:content }); } catch { warning='Solicitud enviada. La evidencia no pudo adjuntarse; puedes reintentar desde Archivos.'; }
      await onDone(created.id,warning);
    } catch(e) { setError(e instanceof Error?e.message:'No se pudo enviar la solicitud.'); } finally { pending.current=false; setBusy(false); }
  }}><fieldset disabled={busy}><label>Tipo de solicitud<select value={type} onChange={e => setType(e.target.value as DigitalRequestType)}>{DIGITAL_REQUEST_TYPES.map(t => <option key={t} value={t}>{DIGITAL_REQUEST_LABELS[t]}</option>)}</select></label>
    {!workItemId && <label>Buscar proyecto o tarea<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>}
    {q.isError?<p role="alert">No se pudieron consultar las tareas.<button type="button" onClick={() => q.refetch()}>Reintentar tareas</button></p>:q.isPending?<EditorSkeleton label="Cargando tareas disponibles" />:q.data.items.length?<><label>Tarea digital<select required value={work} onChange={e => { setWork(e.target.value); setBlocks(false); }}><option value="">Selecciona una tarea</option>{q.data.items.map(c => <option key={c.workItemId} value={c.workItemId}>{c.projectCode} · {c.projectTitle} · {c.taskLabel}</option>)}</select></label>{q.data.pages>1 && <nav className="dr-context-pages"><button type="button" disabled={page<=1} onClick={() => setPage(p => p-1)}>Anterior</button><span>{q.data.page} / {q.data.pages}</span><button type="button" disabled={page>=q.data.pages} onClick={() => setPage(p => p+1)}>Siguiente</button></nav>}</>:<p className="dr-muted">No hay tareas disponibles con Especialista coordinador para esta solicitud.</p>}
    <p className="dr-destination">Se enviará a: {selected?.specialist ? 'Especialista coordinador · '+selected.specialist:'selecciona una tarea digital'}</p>
    <label>Tema<input required minLength={5} maxLength={160} value={subject} onChange={e => setSubject(e.target.value)} /></label><label>Descripción<textarea required minLength={10} maxLength={4000} rows={4} value={description} onChange={e => setDescription(e.target.value)} /></label>
    {selected?.canBlock && <label className="dr-checkbox"><input type="checkbox" checked={blocks} onChange={e => setBlocks(e.target.checked)} />Este problema me impide continuar la tarea</label>}{blocks && selected?.canBlock && <p className="dr-muted">Se registrará un bloqueo vinculado. El Especialista deberá revisarlo antes de cancelar la solicitud.</p>}
    <label>Evidencia (opcional)<input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files?.[0] ?? null)} /><small>Imagen o PDF, hasta 5 MB. Se guarda como evidencia de esta solicitud.</small></label>
  </fieldset>{error && <p role="alert" className="eo-error">{error}</p>}<footer><button type="button" className="ec-secondary" disabled={busy} onClick={onClose}>Volver</button><button className="ec-primary" disabled={busy || !selected}>{busy?'Enviando…':'Enviar solicitud'}</button></footer></form></Dialog>;
}
function RequestDetail({ id,open,tab,onTab,onClose }: { id:string; open:boolean; tab:string; onTab:(tab:string) => void; onClose:() => void }) {
  const { data:user }=useMe(),desktop=useEditorDesktop(),invalidate=useInvalidation();
  const q=useQuery({ queryKey:[...digitalRequestsKey,user?.id,'detail',id],queryFn:() => fetchDigitalRequest(id),enabled:!!user,refetchInterval:15000 });
  const [cancel,setCancel]=useState<number|null>(null),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const d=q.data,r=d?.summary,panel=['detail','files','history'].includes(tab)?tab:'detail';
  const conflict=async () => { await invalidate(); setError('La solicitud cambió. Actualizamos el detalle; revisa su estado.'); };
  return <EditorDetail title="Detalle de la solicitud digital" modal={!desktop} open={open} onClose={onClose}>{q.isPending?<EditorSkeleton label="Cargando detalle de solicitud" />:q.isError?<EditorEmpty><span role="alert">No se pudo cargar la solicitud.</span><button onClick={() => q.refetch()}>Reintentar detalle</button></EditorEmpty>:d && r && <>
    <div className="dr-detail-header"><DigitalCover url={r.coverUrl} /><div><h3>{r.projectTitle}</h3><p>{r.authors} · {r.projectCode}</p><DigitalRequestBadge status={r.status} /></div></div>
    <nav className="dr-detail-tabs" aria-label="Contenido de la solicitud">{[['detail','Detalle'],['files','Archivos'],['history','Historial']].map(([key,label]) => <button key={key} type="button" aria-pressed={panel===key} onClick={() => onTab(key)}>{label}</button>)}</nav>
    <div className="dr-detail-content">{panel==='detail' && <><h4>Información de la solicitud</h4><dl className="dr-facts">{[['Tipo',DIGITAL_REQUEST_LABELS[r.type]],['Tema',r.subject],['Estado',DIGITAL_REQUEST_STATUS_LABELS[r.status]],['Etapa al enviar',DIGITAL_STAGE_LABELS[r.stage]],['Tarea relacionada',r.taskLabel],['Destinatario',d.destination],['Coordinación actual',r.specialist ?? 'Sin Especialista vigente'],['Creada',stamp(r.createdAt)],['Última actividad',r.lastEvent+' · '+stamp(r.updatedAt)]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><h4>Descripción</h4><p className="dr-description">{d.description}</p>
      {d.blocker?.active && <div className="dr-blocker"><RrppIcon nombre="riesgo" /><div><strong>Esta solicitud tiene un bloqueo activo en la tarea.</strong><p>{d.blocker.reason}</p></div></div>}
      {d.result && <section className="dr-result"><h4>{r.status==='cancelada'?'Cancelación':'Resultado'}</h4><p className="dr-description">{d.result.text || 'Sin observaciones adicionales.'}</p><small>{d.result.actor ?? 'Actor no disponible'} · {stamp(d.result.at)}</small>{d.result.blockerResolved && <p>El bloqueo vinculado fue resuelto.</p>}{d.result.workItemId && <Link className="ec-secondary" to={miTrabajoUrl(d.result.workItemId)}>Ver tarea de resultado</Link>}{d.result.attachmentId && d.attachments.find(f => f.id===d.result!.attachmentId) && <a href={d.attachments.find(f => f.id===d.result!.attachmentId)!.url} target="_blank" rel="noreferrer">Ver evidencia del resultado</a>}</section>}
      {d.questions.map(question => <section className="dr-question" key={question.id}><h4>Información solicitada</h4><p>{question.text}</p><small>{question.actor} · {stamp(question.at)}</small>{question.answer?<><p>{question.answer}</p><small>{question.answeredBy} · {question.answeredAt?stamp(question.answeredAt):''}</small></>:r.requiresAction && <InformationForm key={r.version} id={id} version={r.version} questionId={question.id} onDone={async () => { await invalidate(); setNotice('Información enviada al Especialista.'); }} onConflict={conflict} />}</section>)}
    </>}{panel==='files' && <><h4>Evidencia de la solicitud</h4><p className="dr-muted">Archivos que documentan el problema reportado. El material de publicación se consulta desde Mi trabajo.</p>{d.attachments.length?<ul className="dr-files">{d.attachments.map(f => <li key={f.id}><RrppIcon nombre="proyectos" /><div><a href={f.url} target="_blank" rel="noreferrer">{f.name}<RrppIcon nombre="externo" /></a><small>{f.mimeType==='application/pdf'?'PDF':'Imagen'} · {(f.size/1024).toFixed(1)} KB · {stamp(f.at)}</small><small>{f.uploadedBy}</small></div></li>)}</ul>:<EditorEmpty>Aún no hay evidencia adjunta.</EditorEmpty>}{d.canAttach && <EvidenceForm key={r.version} id={id} version={r.version} onDone={async () => { await invalidate(); setNotice('Evidencia añadida.'); }} onConflict={conflict} />}</>}
    {panel==='history' && <><h4>Historial de la solicitud</h4>{d.history.length?<ol className="dr-history">{d.history.map(h => <li key={h.id}><strong>{h.label}</strong><small>{h.actor} · {stamp(h.at)}</small>{h.text && <p>{h.text}</p>}</li>)}</ol>:<EditorEmpty>Sin eventos registrados.</EditorEmpty>}</>}
    {notice && <p role="status" className="eo-success">{notice}</p>}{error && <p role="alert" className="eo-error">{error}</p>}</div>
    {(r.workAccessible || r.canCancel || r.requiresAction || d.canAttach) && <footer className="dr-detail-actions">{r.requiresAction && panel!=='detail' && <button className="ec-primary" onClick={() => onTab('detail')}>Completar información</button>}{d.canAttach && panel!=='files' && <button className="ec-secondary" onClick={() => onTab('files')}>Agregar evidencia</button>}{r.workAccessible && <Link className="ec-secondary" to={miTrabajoUrl(r.workItemId)}>Ver tarea relacionada<RrppIcon nombre="flecha" /></Link>}{r.canCancel && <button className="dr-cancel" onClick={() => setCancel(r.version)}>Cancelar solicitud</button>}</footer>}
    {cancel!==null && <CancelRequest id={id} version={cancel} onClose={() => setCancel(null)} onDone={async () => { setCancel(null); await invalidate(); setNotice('Solicitud cancelada.'); }} onConflict={async () => { setCancel(null); await conflict(); }} />}
  </>}</EditorDetail>;
}
function InformationForm({ id,version,questionId,onDone,onConflict }: { id:string; version:number; questionId:string; onDone:() => Promise<void>; onConflict:() => Promise<void> }) {
  const [text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''); const pending=useRef(false);
  return <form className="dr-form" onSubmit={async e => { e.preventDefault(); if(pending.current) return; pending.current=true; setBusy(true); setError(''); try { await answerDigitalRequest(id,version,questionId,text); await onDone(); } catch(e) { if(e instanceof ApiError && e.status===409) await onConflict(); else setError(e instanceof Error?e.message:'No se pudo enviar'); } finally { pending.current=false; setBusy(false); } }}><label>Completar información<textarea required minLength={5} maxLength={2000} rows={4} disabled={busy} value={text} onChange={e => setText(e.target.value)} /></label>{error && <p role="alert">{error}</p>}<button className="ec-primary" disabled={busy}>{busy?'Enviando…':'Enviar información'}</button></form>;
}
function EvidenceForm({ id,version,onDone,onConflict }: { id:string; version:number; onDone:() => Promise<void>; onConflict:() => Promise<void> }) {
  const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''); const pending=useRef(false),key=useRef<string|null>(null);
  return <form className="dr-form" onSubmit={async e => { e.preventDefault(); if(pending.current || !file) return; pending.current=true; setBusy(true); setError(''); try { const content=await fileContent(file); key.current ??= crypto.randomUUID(); await attachDigitalRequest(id,{ expectedVersion:version,uploadKey:key.current,name:file.name,contentBase64:content }); await onDone(); } catch(e) { if(e instanceof ApiError && e.status===409) await onConflict(); else setError(e instanceof Error?e.message:'No se pudo adjuntar'); } finally { pending.current=false; setBusy(false); } }}><label>Agregar evidencia<input type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={busy} onChange={e => { setFile(e.target.files?.[0] ?? null); key.current=null; }} /><small>PNG, JPEG o PDF. Hasta 5 MB.</small></label>{error && <p role="alert">{error}</p>}<button className="ec-primary" disabled={busy || !file}>{busy?'Adjuntando…':'Adjuntar archivo'}</button></form>;
}
function CancelRequest({ id,version,onClose,onDone,onConflict }: { id:string; version:number; onClose:() => void; onDone:() => Promise<void>; onConflict:() => Promise<void> }) {
  const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''); const pending=useRef(false);
  return <Dialog title="Cancelar solicitud" onClose={() => { if(!busy) onClose(); }}><form onSubmit={async e => { e.preventDefault(); if(pending.current) return; pending.current=true; setBusy(true); try { await cancelDigitalRequest(id,version,reason); await onDone(); } catch(e) { if(e instanceof ApiError && e.status===409) await onConflict(); else setError(e instanceof Error?e.message:'No se pudo cancelar'); } finally { pending.current=false; setBusy(false); } }}><p>La solicitud quedará cancelada y conservará sus archivos e historial.</p><label>Motivo (opcional)<textarea maxLength={2000} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} /></label>{error && <p role="alert">{error}</p>}<footer><button type="button" className="ec-secondary" disabled={busy} onClick={onClose}>Volver</button><button className="ec-primary" disabled={busy}>{busy?'Cancelando…':'Confirmar cancelación'}</button></footer></form></Dialog>;
}
