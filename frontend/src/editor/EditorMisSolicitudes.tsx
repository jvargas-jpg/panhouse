import './editor.css';
import './misSolicitudes.css';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { RrppIcon } from '../rrpp/RrppIcons';
import { EditorialCover } from '../jefeEdicion/EditorialParts';
import { fechaActividad } from '../rrpp/RrppDashboardCards';
import { EDITOR_REQUEST_LABELS, EDITOR_REQUEST_TYPES, type EditorRequestType } from '../../../shared/editorOwn';
import { EditorEmpty, editorialDate } from './EditorParts';
import { EditorDetail, EditorSearch, EditorSelect, EditorSkeleton, useEditorFilters, useEditorDesktop } from './EditorUi';
import { cancelarSolicitud, crearSolicitud, responderSolicitud, editorKey, fetchMiSolicitudDetalle, fetchMiTrabajo, fetchMisSolicitudes } from './editorApi';

const TABS = [['all', 'Todas'], ['pending', 'Pendientes'], ['returned', 'Devueltas'], ['resolved', 'Resueltas'], ['cancelled', 'Canceladas'], ['rejected', 'Rechazadas']] as const;
const STATUS: Record<string, string> = { pendiente: 'Pendiente', en_revision: 'En revisión', devuelta: 'Devuelta', resuelta: 'Resuelta', rechazada: 'Rechazada', cancelada: 'Cancelada' };
const LABEL: Record<EditorRequestType, string> = { editor_apoyo: 'Solicitud de apoyo', editor_reasignacion: 'Solicitud de reasignación', editor_aclaracion: 'Solicitud de aclaración' };
const FILTERS = ['type', 'project', 'from', 'to', 'target'];
function RequestIcon({ type }: { type: EditorRequestType }) {
  return <span className="ms-type-icon"><RrppIcon nombre={type === 'editor_reasignacion' ? 'reasignar' : type === 'editor_aclaracion' ? 'comentarios' : 'equipo'} /></span>;
}
function RequestStatus({ status }: { status: string }) {
  return <span className={'ec-status ec-' + (status === 'devuelta' ? 'violet' : status === 'resuelta' ? 'green' : status === 'rechazada' ? 'red' : status === 'cancelada' ? 'neutral' : 'amber')}><i aria-hidden="true" />{STATUS[status]}</span>;
}
export function EditorMisSolicitudes() {
  const { params, setParams, search, setSearch } = useEditorFilters();
  const selected = params.get('request'), creating = params.get('create') === '1', desktop = useEditorDesktop();
  const tab = TABS.find(([id]) => id === params.get('tab'))?.[0] ?? 'all';
  const pageSize = ['10', '25', '50'].includes(params.get('pageSize') ?? '') ? params.get('pageSize')! : '25';
  const queryParams = new URLSearchParams({ tab, page: params.get('page') ?? '1', pageSize });
  for (const key of ['search', ...FILTERS, 'sort']) if (params.get(key)) queryParams.set(key, params.get(key)!);
  const q = useQuery({ queryKey: [...editorKey, 'mis-solicitudes', queryParams.toString()], queryFn: () => fetchMisSolicitudes(queryParams), placeholderData: p => p });
  const items = q.data?.items ?? [];
  const detailId = selected ?? (desktop && params.get('detailClosed') !== '1' ? items[0]?.id : undefined);
  const activeFilters = !!search || FILTERS.some(k => params.has(k));
  const change = (key: string, value: string) => setParams(current => {
    const p = new URLSearchParams(current); value ? p.set(key, value) : p.delete(key);
    if (!['request', 'detailTab', 'create', 'detailClosed'].includes(key)) {
      for (const k of ['request', 'detailTab', 'detailClosed']) p.delete(k);
      if (key !== 'page') p.delete('page');
    }
    if (key === 'request') { p.delete('create'); p.delete('detailTab'); }
    return p;
  });
  const close = () => setParams(current => { const p = new URLSearchParams(current); for (const k of ['request', 'detailTab', 'create']) p.delete(k); p.set('detailClosed', '1'); return p; });
  const clear = () => { setSearch(''); setParams(p => { for (const k of ['search', ...FILTERS, 'page', 'request', 'detailTab', 'detailClosed']) p.delete(k); return p; }); };
  return <section className="ms-page" aria-label="Solicitudes enviadas por el Editor">
    <div className="ms-workspace"><div className="ms-main">
      <div className="ms-controls">
        <div className="ms-tabs" role="group" aria-label="Estado de mis solicitudes">{TABS.filter(([id]) => id !== 'rejected' || !!q.data?.counts.rejected || tab === id).map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => change('tab', id)}>{label} <span>({q.data?.counts[id] ?? '—'})</span></button>)}</div>
        <div className="ms-searchbar"><EditorSearch value={search} onChange={setSearch} placeholder="Buscar solicitud, proyecto o motivo…" /><button className="ec-primary ms-new" onClick={() => change('create', '1')}>+ Nueva solicitud</button>
          <details className="ms-filters"><summary><RrppIcon nombre="lista" />Filtros{FILTERS.some(k => params.has(k)) && <span> · {FILTERS.filter(k => params.has(k)).length}</span>}</summary><div>
            <EditorSelect label="Tipo de solicitud" value={params.get('type') ?? ''} onChange={v => change('type', v)} options={EDITOR_REQUEST_TYPES.map(t => ({ id: t, name: LABEL[t].replace('Solicitud de ', '') }))} />
            <EditorSelect label="Proyecto" value={params.get('project') ?? ''} onChange={v => change('project', v)} options={q.data?.options?.projects ?? []} />
            <EditorSelect label="Destino" value={params.get('target') ?? ''} onChange={v => change('target', v)} options={[{ id: 'chief', name: 'Jefe de Edición' }, { id: 'specialist', name: 'Especialista' }]} />
            <label>Desde<input aria-label="Fecha de envío desde" type="date" value={params.get('from') ?? ''} max={params.get('to') ?? undefined} onChange={e => change('from', e.target.value)} /></label>
            <label>Hasta<input aria-label="Fecha de envío hasta" type="date" min={params.get('from') ?? undefined} value={params.get('to') ?? ''} onChange={e => change('to', e.target.value)} /></label>
          </div></details>{activeFilters && <button className="eo-text-button" onClick={clear}>Limpiar filtros</button>}</div>
      </div>
      <section className="ms-list" aria-label="Historial de solicitudes enviadas" aria-busy={q.isFetching}>
        <header className="ms-list-heading"><h2>Tus solicitudes enviadas</h2><label>Ordenar por <select aria-label="Ordenar solicitudes" value={params.get('sort') ?? 'priority'} onChange={e => change('sort', e.target.value)}><option value="priority">Requieren tu atención</option><option value="newest">Más recientes</option><option value="activity">Última actualización</option></select></label></header>
        {q.isError ? <EditorEmpty><span role="alert">No se pudieron cargar tus solicitudes.</span> <button onClick={() => q.refetch()}>Reintentar solicitudes</button></EditorEmpty> : q.isPending ? <EditorSkeleton label="Cargando solicitudes enviadas" /> : items.length ? <table className="ms-table"><caption className="sr-only">Una fila por solicitud enviada. Selecciona una para ver su respuesta y seguimiento.</caption><thead><tr>{['Solicitud', 'Proyecto / Intervención', 'Estado', 'Enviada', 'Última actualización', ''].map(c => <th key={c} scope="col">{c || <span className="sr-only">Abrir solicitud</span>}</th>)}</tr></thead><tbody>{items.map(r => <tr key={r.id} aria-selected={detailId === r.id && !creating} className={detailId === r.id && !creating ? 'is-selected' : ''} tabIndex={0} onClick={() => change('request', r.id)} onKeyDown={e => { if (e.target === e.currentTarget && ['Enter', ' '].includes(e.key)) { e.preventDefault(); change('request', r.id); } }}>
          <td><div className="ms-request-identity"><RequestIcon type={r.type} /><span><strong>{LABEL[r.type]}</strong><small title={r.motivo}>{r.motivo}</small></span></div></td>
          <td data-label="Proyecto / Intervención"><div className="ms-project-identity"><EditorialCover url={r.coverUrl ?? null} /><span><strong title={r.title}>{r.title}</strong><small>{r.interventionLabel}</small></span></div></td>
          <td data-label="Estado"><RequestStatus status={r.status} /></td><td data-label="Enviada"><time dateTime={r.requestedAt}>{editorialDate(r.requestedAt)}</time></td>
          <td data-label="Última actualización"><strong title={editorialDate(r.updatedAt ?? r.requestedAt, true)}>{fechaActividad(r.updatedAt ?? r.requestedAt)}</strong><small>{r.lastEventLabel ?? 'Solicitud enviada'}</small></td>
          <td><button className="ms-open" aria-label={'Ver ' + LABEL[r.type].toLowerCase() + ': ' + r.title} onClick={e => { e.stopPropagation(); change('request', r.id); }}><span>Ver solicitud</span><RrppIcon nombre="flecha" /></button></td>
        </tr>)}</tbody></table> : <div className="ms-empty"><RrppIcon nombre="comentarios" /><EditorEmpty>{activeFilters ? 'No hay solicitudes que coincidan con estos filtros.' : tab === 'all' ? 'Aún no has enviado solicitudes.' : 'No tienes solicitudes en este estado.'}</EditorEmpty>{activeFilters ? <button className="ec-secondary" onClick={clear}>Limpiar filtros</button> : <p>Las solicitudes que envíes desde Mi trabajo o desde aquí aparecerán con su respuesta y seguimiento.</p>}</div>}
        {q.data && <footer className="ms-pagination"><span aria-live="polite">{q.data.total ? `${(q.data.page - 1) * Number(pageSize) + 1}–${Math.min(q.data.page * Number(pageSize), q.data.total)} de ${q.data.total}` : '0'} solicitudes</span><div><button aria-label="Página anterior" disabled={q.data.page <= 1 || q.isFetching} onClick={() => change('page', String(q.data!.page - 1))}>‹</button><span>{q.data.page} / {q.data.pages}</span><button aria-label="Página siguiente" disabled={q.data.page >= q.data.pages || q.isFetching} onClick={() => change('page', String(q.data!.page + 1))}>›</button><select aria-label="Solicitudes por página" value={pageSize} onChange={e => change('pageSize', e.target.value)}>{[10, 25, 50].map(n => <option key={n} value={n}>Mostrar {n}</option>)}</select></div></footer>}
      </section>
    </div>{creating ? <NuevaSolicitudPicker onClose={close} onCreated={id => { setSearch(''); setParams({ vista: 'mis-solicitudes', request: id }); }} /> : detailId ? <SolicitudDetail key={detailId} id={detailId} tab={params.get('detailTab') ?? 'detail'} onTab={v => change('detailTab', v)} onClose={close} /> : <div className="ms-placeholder"><RrppIcon nombre="comentarios" /><p>Selecciona una solicitud para consultar su respuesta y seguimiento.</p></div>}</div>
  </section>;
}

function NuevaSolicitudPicker({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const desktop = useEditorDesktop(), cache = useQueryClient();
  const [projectId, setProjectId] = useState(''), [workItemId, setWorkItemId] = useState(''), [page, setPage] = useState(1), [type, setType] = useState<EditorRequestType>('editor_apoyo');
  const [motivo, setMotivo] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const sending = useRef(false);
  const q = useQuery({ queryKey: [...editorKey, 'request-picker', projectId, page], queryFn: () => fetchMiTrabajo(new URLSearchParams({ tab: 'all', page: String(page), pageSize: '50', ...(projectId ? { project: projectId } : {}) })) });
  const projects = q.data?.options?.projects ?? [], items = (q.data?.items ?? []).filter(i => i.workItemId && i.actionable && i.state !== 'Completadas' && i.projectId === projectId);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (sending.current || !items.some(i => i.workItemId === workItemId)) return;
    sending.current = true; setBusy(true); setError('');
    try { const result = await crearSolicitud(workItemId, type, motivo); await cache.invalidateQueries({ queryKey: editorKey }); onCreated(result.id); }
    catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? 'No se pudo enviar. Revisa si ya tienes una solicitud de este tipo sin resolver o si la intervención sigue disponible.' : e instanceof ApiError && e.status === 403 ? 'Esta intervención ya no está asignada a tu cuenta.' : e instanceof Error ? e.message : 'No se pudo enviar la solicitud.');
      await cache.invalidateQueries({ queryKey: editorKey });
    }
    finally { sending.current = false; setBusy(false); }
  }
  return <EditorDetail title="Nueva solicitud" open modal={!desktop} onClose={onClose}><div className="ms-create-content">
    <p>Solicita una decisión sobre una intervención que tienes asignada. También puedes hacerlo desde Mi trabajo.</p>
    <form className="ep-form" onSubmit={submit}>
      <label>Tipo de solicitud<select aria-label="Tipo de solicitud" value={type} onChange={e => setType(e.target.value as EditorRequestType)} disabled={busy}>{EDITOR_REQUEST_TYPES.map(t => <option key={t} value={t}>{EDITOR_REQUEST_LABELS[t]}</option>)}</select></label>
      <p className="ms-target">Destino: <strong>{type === 'editor_aclaracion' ? 'Especialista del proyecto' : 'Jefe de Edición'}</strong></p>
      {q.isPending ? <EditorSkeleton label="Cargando tus intervenciones" /> : q.isError ? <p role="alert">No se pudo cargar tu trabajo. <button type="button" onClick={() => q.refetch()}>Reintentar</button></p> : <>
        <label>Proyecto<select aria-label="Proyecto" required value={projectId} onChange={e => { setProjectId(e.target.value); setWorkItemId(''); setPage(1); }} disabled={busy}><option value="">Selecciona un proyecto</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        {projectId && <><label>Intervención<select aria-label="Intervención" required value={workItemId} onChange={e => setWorkItemId(e.target.value)} disabled={busy}><option value="">Selecciona una intervención</option>{items.map(i => <option key={i.id} value={i.workItemId!}>{i.label}</option>)}</select></label>{!items.length && <p>No hay intervenciones operativas disponibles en esta página.</p>}</>}
        {projectId && q.data && q.data.pages > 1 && <div className="ms-picker-pages"><button type="button" disabled={page <= 1 || busy} onClick={() => { setPage(page - 1); setWorkItemId(''); }}>Anterior</button><span>{q.data.page} / {q.data.pages}</span><button type="button" disabled={page >= q.data.pages || busy} onClick={() => { setPage(page + 1); setWorkItemId(''); }}>Siguiente</button></div>}
      </>}
      <label>Motivo<textarea required minLength={5} maxLength={1000} value={motivo} onChange={e => setMotivo(e.target.value)} disabled={busy} placeholder="Explica qué necesitas y por qué." /></label>
      {error && <p role="alert" className="eo-error">{error}</p>}
      <div className="ms-form-actions"><button className="ec-primary" disabled={busy || !workItemId || q.isFetching}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button><button type="button" className="ec-secondary" disabled={busy} onClick={onClose}>Volver</button></div>
    </form>
  </div></EditorDetail>;
}

function SolicitudDetail({ id, tab: rawTab, onTab, onClose }: { id: string; tab: string; onTab: (s: string) => void; onClose: () => void }) {
  const desktop = useEditorDesktop(), cache = useQueryClient();
  const q = useQuery({ queryKey: [...editorKey, 'mi-solicitud-detalle', id], queryFn: () => fetchMiSolicitudDetalle(id) });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(''), [response, setResponse] = useState(''), [responding, setResponding] = useState(false), [canceling, setCanceling] = useState(false);
  const sending = useRef(false), dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLTextAreaElement>(null);
  const d = q.data, r = d?.summary;
  const tab = ['detail', 'responses', 'history'].includes(rawTab) ? rawTab : 'detail';
  useEffect(() => { if (responding) input.current?.focus(); }, [responding]);
  useEffect(() => { if (canceling) dialog.current?.showModal(); else dialog.current?.close(); }, [canceling]);
  useEffect(() => {
    if (!desktop) return;
    const panel = document.querySelector<HTMLElement>('.ms-workspace .eo-detail'); if (!panel) return;
    const fit = () => { panel.style.maxHeight = `${Math.max(280, innerHeight - Math.max(65, panel.getBoundingClientRect().top) - 16)}px`; };
    fit(); window.addEventListener('resize', fit); window.addEventListener('scroll', fit, true);
    return () => { window.removeEventListener('resize', fit); window.removeEventListener('scroll', fit, true); };
  }, [desktop]);
  async function run(action: () => Promise<unknown>, message: string) {
    if (sending.current) return; sending.current = true; setBusy(true); setError(''); setSuccess('');
    try { await action(); setResponding(false); setCanceling(false); setResponse(''); setSuccess(message); }
    catch (e) { setError(e instanceof ApiError && e.status === 409 ? 'La solicitud cambió o ya no admite esta acción. Se actualizó su estado.' : e instanceof ApiError && e.status === 403 ? 'La intervención ya no está asignada a tu cuenta. Se actualizó la solicitud.' : e instanceof Error ? e.message : 'No se pudo guardar la acción.'); setCanceling(false); }
    finally { await cache.invalidateQueries({ queryKey: editorKey }); sending.current = false; setBusy(false); }
  }
  const canRespond = r?.status === 'devuelta' && r.canRespond !== false;
  return <EditorDetail title="Detalle de solicitud" open modal={!desktop} onClose={onClose}>
    {q.isPending ? <EditorSkeleton label="Cargando detalle de solicitud" /> : q.isError ? <EditorEmpty><span role="alert">No se pudo cargar la solicitud.</span> <button onClick={() => q.refetch()}>Reintentar solicitud</button></EditorEmpty> : d && r && <>
      <header className="ms-detail-header"><RequestIcon type={r.type} /><div><h3>{LABEL[r.type]}</h3><p>{r.title}</p><RequestStatus status={r.status} /></div><time dateTime={r.requestedAt}>{editorialDate(r.requestedAt)}</time></header>
      <div className="ms-detail-tabs" role="group" aria-label="Contenido de la solicitud">{[['detail', 'Detalle'], ...(d.observations?.length ? [['responses', 'Respuestas']] : []), ['history', 'Historial']].map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => { setResponding(false); onTab(key); }}>{label}</button>)}</div>
      <div className="ms-detail-content">
        {error && <p role="alert" className="eo-error">{error}</p>}{success && <p role="status" className="eo-success">{success}</p>}
        {tab === 'detail' && <>
          <section className="ms-context"><h4>Proyecto e intervención</h4><div className="ms-detail-project"><EditorialCover url={r.coverUrl ?? null} /><div><strong>{r.title}</strong><span>{r.interventionLabel}</span><small>{r.authors}</small><small>{r.code}</small></div></div></section>
          <section><h4>Motivo de la solicitud</h4><p className="ms-description">{d.description || 'No se registró una descripción.'}</p></section>
          {r.status === 'devuelta' && <section className="ms-returned"><h4>Información solicitada</h4><p>{r.returnReason ?? d.observations?.filter(o => !o.answer).at(-1)?.question ?? 'Revisa la respuesta recibida antes de reenviar.'}</p>{!canRespond && <small>Tu intervención ya no está disponible para reenviar esta solicitud.</small>}</section>}
          {['resuelta', 'rechazada'].includes(r.status) && <section className="ms-result"><h4>Resultado</h4><p>{r.outcome === 'EDITOR_ASIGNADO' ? 'Editor asignado.' : r.outcome || 'No se registró una descripción del resultado.'}</p><small>{r.resolvedBy ?? r.target} · {editorialDate(r.resolvedAt, true)}</small>{r.reassignment && <dl><div><dt>Editor anterior</dt><dd>{r.reassignment.previousEditor}</dd></div><div><dt>Nuevo Editor</dt><dd>{r.reassignment.nextEditor}</dd></div><div><dt>Asignación realizada</dt><dd>{editorialDate(r.reassignment.assignedAt, true)}</dd></div></dl>}</section>}
          {r.status === 'cancelada' && <section className="ms-cancelled"><h4>Solicitud retirada</h4><p>Esta solicitud fue cancelada. Su historial se conserva.</p><small>{r.resolvedBy ?? r.requestedBy} · {editorialDate(r.resolvedAt, true)}</small></section>}
          <dl className="ms-facts"><div><dt>Enviada por</dt><dd>{r.requestedBy ?? 'Tú'}</dd></div><div><dt>Destino</dt><dd>{r.target}</dd></div><div><dt>Fecha de envío</dt><dd>{editorialDate(r.requestedAt, true)}</dd></div><div><dt>Última actualización</dt><dd>{editorialDate(r.updatedAt ?? r.requestedAt, true)}<small>{r.lastEventLabel ?? 'Solicitud enviada'}</small></dd></div></dl>
        </>}
        {tab === 'responses' && <section><h4>Información y respuestas</h4>{d.observations?.length ? <ol className="ms-responses">{d.observations.map(o => <li key={o.id}><strong>{o.askedBy ?? r.target}</strong><time>{editorialDate(o.at, true)}</time><p>{o.question}</p>{o.answer ? <div><strong>{o.answeredBy ?? r.requestedBy ?? 'Tú'}</strong><time>{editorialDate(o.answeredAt ?? null, true)}</time><p>{o.answer}</p></div> : <small>Pendiente de completar</small>}</li>)}</ol> : <EditorEmpty>No hay respuestas registradas.</EditorEmpty>}</section>}
        {tab === 'history' && <section><h4>Historial de la solicitud</h4>{d.history.length ? <ol className="ms-timeline">{d.history.map(h => <li key={h.id}><i aria-hidden="true" /><strong>{h.label}</strong><span>{h.actor}</span><time>{editorialDate(h.at, true)}</time></li>)}</ol> : <EditorEmpty>Sin eventos registrados todavía.</EditorEmpty>}</section>}
        {responding && canRespond && <form className="ep-form ms-response-form" onSubmit={e => { e.preventDefault(); void run(() => responderSolicitud(id, r.version, response), 'Información enviada. La solicitud vuelve a estar pendiente.'); }}><label>Completar información<textarea ref={input} required minLength={5} maxLength={1000} value={response} onChange={e => setResponse(e.target.value)} disabled={busy} /></label><div className="ms-form-actions"><button className="ec-primary" disabled={busy}>{busy ? 'Enviando…' : 'Responder y reenviar'}</button><button type="button" disabled={busy} onClick={() => setResponding(false)}>Volver</button></div></form>}
      </div>
      <footer className="ms-detail-actions">
        {canRespond && !responding && <button className="ec-primary" onClick={() => { setResponding(true); }}>Completar información</button>}
        {r.workAccessible !== false && <Link className="ec-secondary" to={'/?' + new URLSearchParams({ vista: 'mi-trabajo', project: r.projectId, workItem: r.workItemId })}><RrppIcon nombre="libro" />Ver en Mi trabajo</Link>}
        {['pendiente', 'en_revision'].includes(r.status) && <button className="eo-text-button ms-cancel" disabled={busy} onClick={() => setCanceling(true)}>Cancelar solicitud</button>}
      </footer>
      <dialog onKeyDown={e => { if (e.key === 'Escape') e.stopPropagation(); }} ref={dialog} className="ms-confirm" onCancel={e => { e.preventDefault(); setCanceling(false); }} aria-labelledby="ms-cancel-title"><h3 id="ms-cancel-title">¿Cancelar esta solicitud?</h3><p>Se retirará de las solicitudes pendientes. Su historial se conservará.</p><div><button className="ec-secondary" disabled={busy} onClick={() => setCanceling(false)}>Volver</button><button className="ec-primary" disabled={busy} onClick={() => void run(() => cancelarSolicitud(id, r.version), 'Solicitud cancelada. Su historial se conserva.')}>{busy ? 'Cancelando…' : 'Confirmar cancelación'}</button></div></dialog>
    </>}
  </EditorDetail>;
}
