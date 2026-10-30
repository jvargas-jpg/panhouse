import { Dialog } from '../design-system/Dialog';
import './editor.css';
import './miTrabajo.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
import { EditorialCover } from '../jefeEdicion/EditorialParts';
import { EditorEmpty, editorialDate } from './EditorParts';
import { EditorDetail, EditorSearch, EditorSelect, EditorSkeleton, currentOwner, interventionType, useEditorFilters, useEditorDesktop } from './EditorUi';
import { fechaActividad } from '../rrpp/RrppDashboardCards';
import { editorKey, fetchMiTrabajo, fetchMiTrabajoDetalle, iniciarTrabajo, registrarAvance, registrarEntrega, reportarBloqueo, resolverBloqueo, fetchArchivosEntrega, cargarArchivoEditorial } from './editorApi';
import { NuevaSolicitudForm } from './EditorSolicitudForm';
import type { EditorialIntervention } from '../../../shared/editorialChief';

const TABS = [['all', 'Todos'], ['pending', 'Pendientes'], ['inProgress', 'En edición'], ['feedback', 'Feedback por aplicar'], ['blocked', 'Bloqueadas'], ['waiting', 'En espera'], ['completed', 'Completadas']] as const;
const FILTERS = ['status', 'service', 'interventionType', 'project', 'date', 'risk'];
const EMPTY: Record<string, string> = { feedback: 'No tienes feedback pendiente de aplicar.', blocked: 'No tienes trabajos bloqueados.', completed: 'Aún no tienes intervenciones completadas con estos filtros.' };
const stateLabel = (i: EditorialIntervention) => i.state === 'Bloqueadas' ? 'Bloqueada' : i.overdue && !i.waitingOn ? 'Vencida' : i.state === 'Completadas' ? 'Completada' : !i.startedAt && i.actionable && i.state !== 'Requiere ajustes' ? 'Por iniciar' : i.state;
function WorkStatus({ item }: { item: EditorialIntervention }) {
  const label = stateLabel(item);
  const color = /Vencida|Bloqueada/.test(label) ? 'red' : label === 'En edición' ? 'amber' : label === 'Requiere ajustes' ? 'violet' : label === 'Completada' ? 'green' : 'neutral';
  return <span className={'ec-status ec-' + color}><i aria-hidden="true" />{label}</span>;
}
function Deadline({ item }: { item: EditorialIntervention }) {
  return <span className={item.overdue && !item.waitingOn ? 'ec-deadline-overdue' : ''}>{item.waitingOn ? 'SLA en pausa' : item.dueDate ? new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(item.dueDate + 'T12:00:00Z')) : 'Sin fecha límite'}</span>;
}
export function EditorMiTrabajo() {
  const { params, setParams, update, search, setSearch } = useEditorFilters();
  const requestedTab = params.get('tab');
  const tab = requestedTab === 'today' ? 'today' : TABS.find(([id]) => id === requestedTab)?.[0] ?? 'all';
  const tabs = tab === 'today' ? [...TABS, ['today', 'Para hoy'] as const] : TABS;
  const selected = params.get('workItem');
  const pageSize = ['10', '25', '50'].includes(params.get('pageSize') ?? '') ? params.get('pageSize')! : '10';
  const queryParams = new URLSearchParams({ tab, search: params.get('search') ?? '', page: params.get('page') ?? '1', pageSize });
  for (const key of [...FILTERS, 'sort']) if (params.get(key)) queryParams.set(key, params.get(key)!);
  const q = useQuery({ queryKey: [...editorKey, 'mi-trabajo', queryParams.toString()], queryFn: () => fetchMiTrabajo(queryParams), placeholderData: p => p });
  const rows = q.data?.items ?? [], options = q.data?.options;
  const desktop = useEditorDesktop();
  const detailId = selected ?? (desktop && params.get('detailClosed') !== '1' ? rows[0]?.id : undefined);
  const filterCount = FILTERS.filter(k => params.has(k)).length;
  const hasFilters = filterCount > 0 || !!search;
  const clear = () => { setSearch(''); setParams({ vista: 'mi-trabajo' }); };
  const changeView = (key: string, value: string) => setParams(current => {
    const next = new URLSearchParams(current);
    value ? next.set(key, value) : next.delete(key);
    for (const field of ['workItem', 'action', 'detailClosed']) next.delete(field);
    if (key !== 'page') next.delete('page');
    return next;
  });
  const filterRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (e: PointerEvent) => { if (filterRef.current && !filterRef.current.contains(e.target as Node)) filterRef.current.open = false; };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape' && filterRef.current?.open) { e.stopPropagation(); filterRef.current.open = false; filterRef.current.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape, true); };
  }, []);
  return <section className="mw-page" aria-label="Bandeja de trabajo editorial">
    <div className="mw-controls">
      <nav className="mw-views" aria-label="Filtrar intervenciones por estado">{tabs.map(([id, label]) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => changeView('tab', id)}>{label}<span>{q.data?.counts[id] ?? '—'}</span></button>)}</nav>
      <div className="mw-tools">
        <EditorSearch value={search} onChange={setSearch} placeholder="Buscar por proyecto, autor o trabajo…" />
        <details className="mw-filters" ref={filterRef}><summary><RrppIcon nombre="lista" />Filtros{filterCount > 0 && <span>{filterCount}</span>}</summary><div className="mw-filter-panel">
          <header><strong>Filtrar intervenciones</strong><button type="button" aria-label="Cerrar filtros" onClick={() => { if (filterRef.current) filterRef.current.open = false; }}>×</button></header>
          <div className="mw-field"><span>Estado</span><EditorSelect label="Estado" value={params.get('status') ?? ''} onChange={v => changeView('status', v)} options={(options?.states ?? []).map(s => ({ id: s, name: s }))} /></div>
          <div className="mw-field"><span>Intervención</span><EditorSelect label="Tipo de intervención" value={params.get('interventionType') ?? ''} onChange={v => changeView('interventionType', v)} options={options?.types ?? []} /></div>
          <div className="mw-field"><span>Servicio</span><EditorSelect label="Servicio" value={params.get('service') ?? ''} onChange={v => changeView('service', v)} options={options?.services ?? []} /></div>
          <div className="mw-field"><span>Proyecto</span><EditorSelect label="Proyecto" value={params.get('project') ?? ''} onChange={v => changeView('project', v)} options={options?.projects ?? []} /></div>
          <label>Fecha límite<input type="date" value={params.get('date') ?? ''} onChange={e => changeView('date', e.target.value)} /></label>
          <div className="mw-field"><span>Vencimiento</span><EditorSelect label="Vencimiento" value={params.get('risk') ?? ''} onChange={v => changeView('risk', v)} options={[{ id: 'overdue', name: 'Vencidas' }, { id: 'dueSoon', name: 'Vencen hoy' }]} /></div>
          <footer><button type="button" className="eo-text-button" disabled={!hasFilters} onClick={clear}>Limpiar filtros</button><button type="button" className="ec-primary" onClick={() => { if (filterRef.current) filterRef.current.open = false; }}>Ver resultados</button></footer>
        </div></details>
      </div>
    </div>
    {hasFilters && <div className="mw-active-filters"><span>{q.data?.total ?? '—'} intervenciones encontradas</span><button className="eo-text-button" onClick={clear}>Limpiar filtros</button></div>}
    <div className="eo-workspace mw-workspace"><div className="eo-main">
      <section className="mw-list" aria-label="Intervenciones asignadas" aria-busy={q.isFetching}>
        <div className="mw-list-heading"><h2>Intervenciones asignadas</h2><label>Ordenar por <select aria-label="Ordenar intervenciones" value={params.get('sort') ?? 'priority'} onChange={e => changeView('sort', e.target.value)}><option value="priority">Atención primero</option><option value="due">Vencimiento</option><option value="project">Proyecto</option></select></label></div>
        {q.isError ? <EditorEmpty><span role="alert">No se pudieron cargar tus intervenciones.</span> <button onClick={() => q.refetch()}>Reintentar</button></EditorEmpty> : q.isPending ? <EditorSkeleton label="Cargando intervenciones" /> : rows.length ? <div className="eo-table-wrap"><table className="eo-table eo-work-table"><caption className="sr-only">Una fila por intervención editorial. Selecciona una para consultar su detalle.</caption><thead><tr>{['Proyecto / Autor', 'Intervención', 'Estado', 'Vencimiento', 'Última actividad', ''].map(c => <th scope="col" key={c}>{c || <span className="sr-only">Abrir detalle</span>}</th>)}</tr></thead><tbody>{rows.map(i => <tr key={i.id} aria-selected={detailId === i.id} className={detailId === i.id ? 'is-selected' : ''} tabIndex={0} onClick={() => update('workItem', i.id)} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); update('workItem', i.id); } }}>
          <td data-label="Proyecto / Autor"><div className="ec-project"><EditorialCover url={i.coverUrl} /><span><strong>{i.title}</strong><small>{i.authors}</small></span></div></td>
          <td data-label="Intervención"><strong>{i.label}</strong>{interventionType(i) !== i.label && <small>{interventionType(i)}</small>}</td>
          <td data-label="Estado"><WorkStatus item={i} />{i.waitingOn && <small>{currentOwner(i)} tiene el siguiente paso</small>}</td>
          <td data-label="Vencimiento"><Deadline item={i} /></td>
          <td data-label="Última actividad">{i.lastActivity ? <><strong>{fechaActividad(i.lastActivity.at)}</strong><small>{i.lastActivity.label}</small></> : <span className="eo-muted">Sin actividad</span>}</td>
          <td className="eo-chevron-cell"><button type="button" className="eo-row-action" aria-label={'Abrir ' + i.label + ' de ' + i.title} onClick={e => { e.stopPropagation(); update('workItem', i.id); }}><span className="mw-mobile-open">Ver detalle</span><RrppIcon nombre="flecha" className="eo-row-chevron" /></button></td>
        </tr>)}</tbody></table></div> : <div className="mw-empty"><RrppIcon nombre={tab === 'blocked' ? 'check' : 'libro'} /><EditorEmpty>{EMPTY[tab] ?? 'No tienes intervenciones asignadas con estos filtros.'}</EditorEmpty>{hasFilters && <button className="ec-secondary" onClick={clear}>Limpiar filtros</button>}</div>}
        {q.data && <footer className="mw-pagination"><span aria-live="polite">{q.data.total ? `${(q.data.page - 1) * Number(pageSize) + 1}–${Math.min(q.data.page * Number(pageSize), q.data.total)} de ${q.data.total}` : '0'} intervenciones</span><div><button aria-label="Página anterior" disabled={q.data.page <= 1 || q.isFetching} onClick={() => changeView('page', String(q.data!.page - 1))}>‹</button><span>{q.data.page} / {q.data.pages}</span><button aria-label="Página siguiente" disabled={q.data.page >= q.data.pages || q.isFetching} onClick={() => changeView('page', String(q.data!.page + 1))}>›</button><select aria-label="Intervenciones por página" value={pageSize} onChange={e => changeView('pageSize', e.target.value)}>{[10, 25, 50].map(n => <option key={n} value={n}>Mostrar {n}</option>)}</select></div></footer>}
      </section>
    </div>{detailId ? <MiTrabajoDetail key={detailId} id={detailId} open={!!selected} initialAction={selected ? params.get('action') : null} onClose={() => update({ workItem: '', action: '', detailClosed: '1' })} /> : <div className="eo-detail-placeholder"><RrppIcon nombre="libro" /><p>Elige una intervención</p><small>Consulta el siguiente paso, el material y las entregas de tu trabajo.</small></div>}</div>
  </section>;
}

function WorkDialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){return <Dialog title={title} onClose={onClose} className="mw-dialog">{children}</Dialog>;}
function MiTrabajoDetail({ id, open, onClose, initialAction }: { id: string; open: boolean; onClose: () => void; initialAction: string | null }) {
  const cache = useQueryClient();
  const desktop = useEditorDesktop();
  const q = useQuery({ queryKey: [...editorKey, 'mi-trabajo-detalle', id], queryFn: () => fetchMiTrabajoDetalle(id) });
  const [mode, setMode] = useState(initialAction === 'entrega' ? 'entrega' : ''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const [form, setForm] = useState({ driveUrl: '', observaciones: '', reason: '', note: '', resolution: '' });
  const [tab, setTab] = useState('resumen');
  const running = useRef(false);
  async function invalidate() { await cache.invalidateQueries({ predicate: q => ['editor', 'editorial-chief', 'notificaciones', 'solicitudes', 'proyectos', 'especialista-inicio', 'especialista-mi-trabajo'].includes(String(q.queryKey[0])) }); }
  async function run(action: () => Promise<unknown>, message: string) {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setSuccess('');
    try { await action(); await invalidate(); setMode(''); setSuccess(message); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la acción.'); } finally { running.current = false; setBusy(false); }
  }
  const d = q.data, item = d?.item;
  const canExecute = !!item?.actionable && item.state !== 'Bloqueadas' && !d?.blocker;
  useEffect(() => { setError(''); }, [mode]);
  const feedback = d?.history.filter(h => /feedback/i.test(h.label)) ?? [];
  const nextStep = !item ? '' : d?.blocker || item.state === 'Bloqueadas' ? 'Resuelve el bloqueo o solicita apoyo para continuar.' : item.waitingOn === 'author' ? 'Esperando la respuesta del autor. Te avisaremos cuando puedas continuar.' : item.waitingOn === 'specialist' ? 'Tu entrega está con el Especialista. Espera su revisión antes de continuar.' : item.waitingOn ? 'El proyecto está en pausa. Podrás continuar cuando se reactive.' : item.state === 'Completadas' ? 'Esta intervención está completada. Puedes consultar su entrega y su historial.' : item.state === 'Requiere ajustes' ? 'Revisa el feedback recibido y registra la versión con los comentarios aplicados.' : !item.startedAt ? 'Revisa el material disponible e inicia esta intervención cuando estés listo.' : 'Continúa la edición y registra la entrega cuando tu archivo esté listo.';
  const changeTab = (value: string) => { setTab(value); setMode(''); setError(''); };
  return <EditorDetail title="Detalle de la intervención" modal={!desktop} open={open || desktop} onClose={onClose}>
    {q.isPending ? <EditorSkeleton label="Cargando intervención" /> : q.isError ? <EditorEmpty><span role="alert">No se pudo cargar la intervención.</span> <button onClick={() => q.refetch()}>Reintentar</button></EditorEmpty> : item && d && <>
      <div className="mw-detail-header eo-detail-project"><EditorialCover url={item.coverUrl} /><div><h3>{item.title}</h3><span>{item.authors}</span><small>{item.code}</small></div></div>
      <nav className="mw-detail-tabs" aria-label="Contenido de la intervención">{[['resumen', 'Resumen'], ['material', 'Material'], ['entregas', 'Entregas'], ['feedback', 'Feedback'], ['historial', 'Historial']].map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => changeTab(key)}>{label}</button>)}</nav>
      <div className="mw-detail-content">
        {tab === 'resumen' && <>
          <section className="mw-current"><h4><RrppIcon nombre="libro" />Intervención actual</h4><div className="mw-intervention"><div><strong>{item.label}</strong>{interventionType(item) !== item.label && <small>{interventionType(item)}</small>}</div><WorkStatus item={item} /></div><dl className="mw-key-facts"><div><dt>Vencimiento</dt><dd><Deadline item={item} /></dd></div><div><dt>Responsable actual</dt><dd>{currentOwner(item) === 'Tú' ? 'A tu cargo' : currentOwner(item)}</dd></div></dl></section>
          <section className="mw-next-step"><span>Siguiente paso</span><p>{nextStep}</p></section>
          {item.notes && <section className="mw-description"><h4>Descripción</h4><p>{item.notes}</p></section>}

          {item.waitingOn && <p className="eo-notice">Esta espera no se cuenta como atraso tuyo.</p>}
          {d.blocker && <div className="eo-blocker"><RrppIcon nombre="riesgo" /><div><strong>Bloqueo abierto</strong><p>{d.blocker.reason}</p><small>{editorialDate(d.blocker.createdAt, true)}</small></div></div>}
        </>}
        {tab === 'material' && <section><h4>Material de la intervención</h4><p className="mw-caption">Carpetas vinculadas al trabajo de edición de este proyecto.</p>{d.materialUnavailable ? <EditorEmpty><span role="alert">No se pudo consultar el material.</span> <button onClick={() => q.refetch()}>Reintentar material</button></EditorEmpty> : d.folders.some(f => f.driveUrl) ? <div className="eo-drive-links">{d.folders.filter(f => f.driveUrl).map(f => <a href={f.driveUrl!} key={f.key} target="_blank" rel="noreferrer"><RrppIcon nombre="proyectos" /><span>{f.label}</span><RrppIcon nombre="externo" /></a>)}</div> : <EditorEmpty>El material de Drive aún no está vinculado a esta intervención.</EditorEmpty>}</section>}
        {tab === 'entregas' && <section><h4>Entregas registradas</h4>{d.deliveries.length ? <ul className="eo-history mw-history">{d.deliveries.map(del => <li key={del.id}><a href={del.driveUrl} target="_blank" rel="noreferrer">Ver archivo entregado ↗</a><small>{editorialDate(del.submittedAt, true)}</small>{del.observaciones && <p>{del.observaciones}</p>}</li>)}</ul> : <EditorEmpty>Aún no registras entregas para esta intervención.</EditorEmpty>}</section>}
        {tab === 'feedback' && <section><h4>Feedback de la intervención</h4>{feedback.length ? <><ul className="eo-history mw-history">{feedback.map(h => <li key={h.id}><strong>{h.label}</strong><small>{h.actor} · {editorialDate(h.at, true)}</small></li>)}</ul>{d.folders.filter(f => f.key === 'EDITING_FEEDBACK' && f.driveUrl).map(f => <a className="ec-secondary" key={f.key} href={f.driveUrl!} target="_blank" rel="noreferrer">Abrir feedback en Drive ↗</a>)}</> : <EditorEmpty>No tienes feedback registrado para esta intervención.</EditorEmpty>}</section>}
        {tab === 'historial' && <section><h4>Historial de esta intervención</h4>{d.history.length ? <ul className="eo-history mw-history">{d.history.map(h => <li key={h.id}><strong>{h.label}</strong><small>{h.actor} · {editorialDate(h.at, true)}</small></li>)}</ul> : <EditorEmpty>Sin actividad registrada.</EditorEmpty>}</section>}
        {error && !mode && <p role="alert" className="eo-error">{error}</p>}{success && <p role="status" className="eo-success">{success}</p>}
        {!mode && <div className="mw-work-actions"><h4>Acciones</h4>
          {d.blocker ? <button className="ec-primary" disabled={busy} onClick={() => setMode('resolver')}>Registrar resolución</button> : canExecute ? !item.startedAt ? <button className="ec-primary" disabled={busy} onClick={() => run(() => iniciarTrabajo(id), 'Trabajo iniciado.')}>{busy ? 'Iniciando…' : 'Iniciar trabajo'}</button> : <button className="ec-primary" disabled={busy} onClick={() => item.state === 'Requiere ajustes' ? setMode('entrega') : changeTab(tab === 'material' ? 'resumen' : 'material')}><RrppIcon nombre={item.state === 'Requiere ajustes' ? 'comentarios' : 'flecha'} />{item.state === 'Requiere ajustes' ? 'Aplicar feedback' : tab === 'material' ? 'Ver resumen' : 'Continuar trabajo'}</button> : <button className="ec-primary" onClick={() => changeTab(item.state === 'Completadas' ? 'entregas' : tab === 'material' ? 'resumen' : 'material')}>{item.state === 'Completadas' ? 'Ver entrega' : tab === 'material' ? 'Ver resumen' : 'Ver material'}</button>}
          <div className="mw-secondary-actions">{canExecute && <>
            {item.startedAt && <button className="ec-secondary" onClick={() => setMode('entrega')}><RrppIcon nombre="externo" />Registrar entrega</button>}
            <button className="ec-secondary" onClick={() => setMode('bloqueo')}><RrppIcon nombre="riesgo" />Reportar bloqueo</button>
            {item.startedAt && <button className="ec-secondary" onClick={() => setMode('avance')}><RrppIcon nombre="ingreso" />Registrar avance</button>}
          </>}{item.actionable && <button className="ec-secondary" onClick={() => setMode('solicitud')}><RrppIcon nombre="comentarios" />Solicitar apoyo</button>}</div>
        </div>}
        {mode === 'entrega' && canExecute && <form className="ep-form mw-delivery" onSubmit={e => { e.preventDefault(); void run(() => registrarEntrega(id, form.driveUrl, form.observaciones), 'Entrega registrada y enviada al Especialista.'); }}><h4>{item.state === 'Requiere ajustes' ? 'Entregar feedback aplicado' : 'Registrar entrega'}</h4><DriveFilePicker id={id} folders={d.folders} onSelect={url => setForm({ ...form, driveUrl: url })} /><label>Enlace del archivo en Drive<input type="url" required placeholder="https://drive.google.com/file/d/…" value={form.driveUrl} onChange={e => setForm({ ...form, driveUrl: e.target.value })} /></label><p className="mw-caption">Selecciona o pega el enlace de un archivo del espacio documental del proyecto.</p><label>Observaciones (opcional)<textarea maxLength={1000} value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} /></label>{error && <p role="alert" className="eo-error">{error}</p>}<div className="eo-actions"><button className="ec-primary" disabled={busy}>{busy ? 'Registrando…' : 'Confirmar entrega'}</button><button type="button" disabled={busy} onClick={() => setMode('')}>Cancelar</button></div></form>}
        {['avance', 'bloqueo', 'resolver', 'solicitud'].includes(mode) && <WorkDialog title={mode === 'solicitud' ? 'Solicitar apoyo o reasignación' : mode === 'avance' ? 'Registrar avance' : mode === 'bloqueo' ? 'Reportar bloqueo' : 'Resolver bloqueo'} onClose={() => { if (!busy) setMode(''); }}>
          <p className="mw-dialog-context">{item.title} · {item.label}</p>
          {mode === 'solicitud' && item.workItemId ? <NuevaSolicitudForm workItemId={item.workItemId} onDone={() => { setMode(''); setSuccess('Solicitud enviada.'); void invalidate(); }} onCancel={() => setMode('')} /> : <form className="ep-form" onSubmit={e => { e.preventDefault(); void run(mode === 'avance' ? () => registrarAvance(id, form.note) : mode === 'bloqueo' ? () => reportarBloqueo(id, form.reason) : () => resolverBloqueo(id, form.resolution), mode === 'avance' ? 'Avance registrado.' : mode === 'bloqueo' ? 'Bloqueo reportado.' : 'Bloqueo resuelto.'); }}><label>{mode === 'avance' ? 'Observación del avance' : mode === 'bloqueo' ? 'Motivo del bloqueo' : 'Resolución del bloqueo'}<textarea autoFocus required minLength={5} maxLength={1000} value={mode === 'avance' ? form.note : mode === 'bloqueo' ? form.reason : form.resolution} onChange={e => setForm({ ...form, [mode === 'avance' ? 'note' : mode === 'bloqueo' ? 'reason' : 'resolution']: e.target.value })} /></label>{error && <p role="alert" className="eo-error">{error}</p>}<div className="eo-actions"><button className="ec-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button><button type="button" disabled={busy} onClick={() => setMode('')}>Cancelar</button></div></form>}
        </WorkDialog>}
        {tab === 'resumen' && <details className="mw-extra-context"><summary>Contexto de la intervención</summary><dl className="eo-facts mw-context"><div><dt>Editor asignado</dt><dd>{item.editor ?? 'Sin asignar'}</dd></div><div><dt>Especialista</dt><dd>{d.specialist ?? 'Sin asignar'}</dd></div><div><dt>Asignación</dt><dd>{d.assignedAt ? editorialDate(d.assignedAt) : 'Sin fecha registrada'}</dd></div><div><dt>Inicio</dt><dd>{item.startedAt ? editorialDate(item.startedAt) : 'Por iniciar'}</dd></div>{d.slaLabel && <div><dt>Plazo de edición</dt><dd>{d.slaLabel}</dd></div>}{d.history[0] && <div><dt>Última actividad</dt><dd>{d.history[0].label}<small>{fechaActividad(d.history[0].at)}</small></dd></div>}</dl></details>}
        <Link className="eo-project-link" to={'/?vista=mis-proyectos&project=' + item.projectId}><RrppIcon nombre="libro" />Ver proyecto relacionado<RrppIcon nombre="flecha" /></Link>
      </div>
    </>}
  </EditorDetail>;
}
function DriveFilePicker({id,folders,onSelect}:{id:string;folders:{key:string;label:string;driveUrl:string|null}[];onSelect:(url:string)=>void}){
 const [folder,setFolder]=useState(''),[token,setToken]=useState(''),[uploading,setUploading]=useState(false),[uploadError,setUploadError]=useState('');
 const cache=useQueryClient();
 async function upload(file?:File){if(!file||uploading)return;setUploading(true);setUploadError('');try{const uploaded=await cargarArchivoEditorial(id,folder,file);onSelect(uploaded.url);await cache.invalidateQueries({queryKey:[...editorKey,'drive-files',id]});}catch(e){setUploadError(e instanceof Error?e.message:'No se pudo cargar el archivo.');}finally{setUploading(false);}}
 const q=useQuery({queryKey:[...editorKey,'drive-files',id,folder,token],queryFn:()=>fetchArchivosEntrega(id,folder,token||undefined),enabled:!!folder,retry:false});
 return <div className="eo-file-picker">{['EDITING','EDITING_OUTPUT','EDITING_FEEDBACK_APPLIED'].includes(folder)&&<label className="eo-upload-label">{uploading?'Cargando documento…':'Añadir un documento a esta carpeta'}<input type="file" accept=".doc,.docx,.pdf,.odt,.rtf,.txt" disabled={uploading} onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/><small>Word, PDF, ODT, RTF o TXT · Hasta 8 MB</small></label>}{uploadError&&<p role="alert">{uploadError}</p>}<EditorSelect label="Seleccionar archivo del proyecto" value={folder} onChange={v=>{setFolder(v);setToken('');}} options={folders.filter(f=>f.driveUrl).map(f=>({id:f.key,name:f.label}))}/>{folder&&(q.isPending?<EditorSkeleton/>:q.isError?<p role="alert">No pudimos consultar los archivos. Verifica que estén disponibles para PanHouse. <button type="button" onClick={()=>q.refetch()}>Reintentar</button></p>:<><ul>{q.data?.items.map(f=><li key={f.id}><button type="button" onClick={()=>onSelect(f.url)}><RrppIcon nombre="ingreso"/>{f.name}<span>Seleccionar</span></button></li>)}</ul>{!q.data?.items.length&&<p>No hay archivos accesibles en esta carpeta.</p>}{q.data?.nextPageToken&&<button type="button" onClick={()=>setToken(q.data!.nextPageToken!)}>Más archivos</button>}</>)}</div>;
}
