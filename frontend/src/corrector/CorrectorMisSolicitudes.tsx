import '../editor/editor.css';
import '../editor/miTrabajo.css';
import '../editor/misSolicitudes.css';
import './correctorHome.css';
import './correctorMiTrabajo.css';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { TopBar } from '../layout/TopBar';
import { PRODUCTION_LOGO } from '../layout/RoleProjectNavigation';
import { ApiError } from '../lib/api';
import { RrppIcon } from '../rrpp/RrppIcons';
import { EditorDetail, EditorSearch, EditorSelect, EditorSkeleton, useEditorFilters, useEditorDesktop } from '../editor/EditorUi';
import { EditorEmpty } from '../editor/EditorParts';
import { fechaActividad } from '../rrpp/RrppDashboardCards';
import { CORRECTOR_REQUEST_LABELS, CORRECTOR_REQUEST_TYPES, type CorrectorRequestType } from '../../../shared/correctorRequests';
import { CorrectorCover, CorrectorMobileNavigation, CorrectorNavigation, correctorDate } from './CorrectorUi';
import { fetchMiTrabajoCorrector } from './correctorWorkApi';
import { cancelarSolicitudCorrector, correctorRequestsKey, crearSolicitudCorrector, fetchMiSolicitudCorrectorDetalle, fetchMisSolicitudesCorrector, responderSolicitudCorrector } from './correctorRequestsApi';

const TABS = [['all', 'Todas'], ['pending', 'Pendientes'], ['returned', 'Devueltas'], ['resolved', 'Resueltas'], ['cancelled', 'Canceladas'], ['rejected', 'Rechazadas']] as const;
const STATUS: Record<string, string> = { pendiente: 'Pendiente', en_revision: 'En revisión', devuelta: 'Devuelta', resuelta: 'Resuelta', rechazada: 'Rechazada', cancelada: 'Cancelada' };
const FILTERS = ['type', 'project', 'from', 'to'];
function RequestIcon({ type }: { type: CorrectorRequestType }) {
  return <span className="ms-type-icon"><RrppIcon nombre={type === 'corrector_material' ? 'riesgo' : type === 'corrector_tecnico' ? 'externo' : 'comentarios'} /></span>;
}
function RequestStatus({ status }: { status: string }) {
  return <span className={'ec-status ec-' + (status === 'devuelta' ? 'violet' : status === 'resuelta' ? 'green' : status === 'rechazada' ? 'red' : status === 'cancelada' ? 'neutral' : 'amber')}><i aria-hidden="true" />{STATUS[status]}</span>;
}

export function CorrectorMisSolicitudes() {
  const { params, setParams, search, setSearch } = useEditorFilters();
  const selected = params.get('request'), creating = params.get('create') === '1', desktop = useEditorDesktop();
  const tab = TABS.find(([id]) => id === params.get('tab'))?.[0] ?? 'all';
  const pageSize = ['10', '25', '50'].includes(params.get('pageSize') ?? '') ? params.get('pageSize')! : '25';
  const queryParams = new URLSearchParams({ tab, page: params.get('page') ?? '1', pageSize });
  for (const key of ['search', ...FILTERS]) if (params.get(key)) queryParams.set(key, params.get(key)!);
  const q = useQuery({ queryKey: [...correctorRequestsKey, queryParams.toString()], queryFn: () => fetchMisSolicitudesCorrector(queryParams), placeholderData: p => p });
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
  return <CrmSidebarLayout nav={<CorrectorNavigation active="mis-solicitudes" />} logo={PRODUCTION_LOGO} sidebarWidth={224} sidebarBreakpoint="lg" contentMaxWidth="max-w-none" shellClassName="corrector-layout" contentClassName="corrector-home editor-shell" footer={<p className="coh-footer">Historias que conectan.</p>}>
    <div className="coh-topbar"><div><RrppIcon nombre="libro" /><strong>Corrector</strong></div><TopBar compacto roleLabel="Corrector" /></div><CorrectorMobileNavigation active="mis-solicitudes" />
    <div className="coh-body">
      <nav className="coh-breadcrumb" aria-label="Ruta de navegación"><span>Corrector</span><RrppIcon nombre="flecha" /><strong>Mis solicitudes</strong></nav>
      <header className="coh-page-header"><div><h1>Mis solicitudes</h1><p>Consulta los problemas y solicitudes relacionados con tus correcciones y revisa su estado.</p></div></header>
      <section className="ms-page" aria-label="Solicitudes enviadas por el Corrector">
        <div className="ms-workspace"><div className="ms-main">
          <div className="ms-controls">
            <div className="ms-tabs" role="group" aria-label="Estado de mis solicitudes">{TABS.filter(([id]) => id !== 'rejected' || !!q.data?.counts.rejected || tab === id).map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => change('tab', id)}>{label} <span>({q.data?.counts[id] ?? '—'})</span></button>)}</div>
            <div className="ms-searchbar"><EditorSearch value={search} onChange={setSearch} placeholder="Buscar solicitud, proyecto o motivo…" /><button className="ec-primary ms-new" onClick={() => change('create', '1')}>+ Nueva solicitud</button>
              <details className="ms-filters"><summary><RrppIcon nombre="lista" />Filtros{FILTERS.some(k => params.has(k)) && <span> · {FILTERS.filter(k => params.has(k)).length}</span>}</summary><div>
                <EditorSelect label="Tipo de solicitud" value={params.get('type') ?? ''} onChange={v => change('type', v)} options={CORRECTOR_REQUEST_TYPES.map(t => ({ id: t, name: CORRECTOR_REQUEST_LABELS[t] }))} />
                <EditorSelect label="Proyecto" value={params.get('project') ?? ''} onChange={v => change('project', v)} options={q.data?.options?.projects ?? []} />
                <label>Desde<input aria-label="Fecha de envío desde" type="date" value={params.get('from') ?? ''} max={params.get('to') ?? undefined} onChange={e => change('from', e.target.value)} /></label>
                <label>Hasta<input aria-label="Fecha de envío hasta" type="date" min={params.get('from') ?? undefined} value={params.get('to') ?? ''} onChange={e => change('to', e.target.value)} /></label>
              </div></details>{activeFilters && <button className="eo-text-button" onClick={clear}>Limpiar filtros</button>}</div>
          </div>
          <section className="ms-list" aria-label="Historial de solicitudes enviadas" aria-busy={q.isFetching}>
            <header className="ms-list-heading"><h2>Tus solicitudes enviadas</h2></header>
            {q.isError ? <EditorEmpty><span role="alert">No se pudieron cargar tus solicitudes.</span> <button onClick={() => q.refetch()}>Reintentar solicitudes</button></EditorEmpty> : q.isPending ? <EditorSkeleton label="Cargando solicitudes enviadas" /> : items.length ? <table className="ms-table"><caption className="sr-only">Una fila por solicitud enviada. Selecciona una para ver su respuesta y seguimiento.</caption><thead><tr>{['Solicitud', 'Proyecto / Corrección', 'Estado', 'Enviada', 'Última actualización', ''].map(c => <th key={c} scope="col">{c || <span className="sr-only">Abrir solicitud</span>}</th>)}</tr></thead><tbody>{items.map(r => <tr key={r.id} aria-selected={detailId === r.id && !creating} className={detailId === r.id && !creating ? 'is-selected' : ''} tabIndex={0} onClick={() => change('request', r.id)} onKeyDown={e => { if (e.target === e.currentTarget && ['Enter', ' '].includes(e.key)) { e.preventDefault(); change('request', r.id); } }}>
              <td><div className="ms-request-identity"><RequestIcon type={r.type} /><span><strong>{CORRECTOR_REQUEST_LABELS[r.type]}</strong><small title={r.motivo}>{r.motivo}</small></span></div></td>
              <td data-label="Proyecto / Corrección"><div className="ms-project-identity"><CorrectorCover url={r.coverUrl} /><span><strong title={r.title}>{r.title}</strong><small>{r.interventionLabel}</small></span></div></td>
              <td data-label="Estado"><RequestStatus status={r.status} /></td><td data-label="Enviada"><time dateTime={r.requestedAt}>{correctorDate(r.requestedAt)}</time></td>
              <td data-label="Última actualización"><strong title={correctorDate(r.updatedAt ?? r.requestedAt, true)}>{fechaActividad(r.updatedAt ?? r.requestedAt)}</strong><small>{r.lastEventLabel ?? 'Solicitud enviada'}</small></td>
              <td><button className="ms-open" aria-label={'Ver ' + CORRECTOR_REQUEST_LABELS[r.type].toLowerCase() + ': ' + r.title} onClick={e => { e.stopPropagation(); change('request', r.id); }}><span>Ver solicitud</span><RrppIcon nombre="flecha" /></button></td>
            </tr>)}</tbody></table> : <div className="ms-empty"><RrppIcon nombre="comentarios" /><EditorEmpty>{activeFilters ? 'No hay solicitudes que coincidan con estos filtros.' : tab === 'all' ? 'Aún no has enviado solicitudes.' : 'No tienes solicitudes en este estado.'}</EditorEmpty>{activeFilters ? <button className="ec-secondary" onClick={clear}>Limpiar filtros</button> : <p>Los problemas o aclaraciones que reportes desde tus correcciones aparecerán aquí.</p>}</div>}
            {q.data && <footer className="ms-pagination"><span aria-live="polite">{q.data.total ? `${(q.data.page - 1) * Number(pageSize) + 1}–${Math.min(q.data.page * Number(pageSize), q.data.total)} de ${q.data.total}` : '0'} solicitudes</span><div><button aria-label="Página anterior" disabled={q.data.page <= 1 || q.isFetching} onClick={() => change('page', String(q.data!.page - 1))}>‹</button><span>{q.data.page} / {q.data.pages}</span><button aria-label="Página siguiente" disabled={q.data.page >= q.data.pages || q.isFetching} onClick={() => change('page', String(q.data!.page + 1))}>›</button><select aria-label="Solicitudes por página" value={pageSize} onChange={e => change('pageSize', e.target.value)}>{[10, 25, 50].map(n => <option key={n} value={n}>Mostrar {n}</option>)}</select></div></footer>}
          </section>
        </div>{creating ? <NuevaSolicitudPicker onClose={close} onCreated={id => { setSearch(''); setParams({ vista: 'mis-solicitudes', request: id }); }} /> : detailId ? <SolicitudDetail key={detailId} id={detailId} tab={params.get('detailTab') ?? 'detail'} onTab={v => change('detailTab', v)} onClose={close} /> : <div className="ms-placeholder"><RrppIcon nombre="comentarios" /><p>Selecciona una solicitud para consultar su respuesta y seguimiento.</p></div>}</div>
      </section>
    </div>
  </CrmSidebarLayout>;
}

function NuevaSolicitudPicker({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const desktop = useEditorDesktop(), cache = useQueryClient();
  const [projectId, setProjectId] = useState(''), [workItemId, setWorkItemId] = useState(''), [page, setPage] = useState(1), [type, setType] = useState<CorrectorRequestType>('corrector_material');
  const [motivo, setMotivo] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const sending = useRef(false);
  // Sin filtro de proyecto en la consulta: traemos las activas propias
  // una sola vez y derivamos tanto la lista de proyectos elegibles como
  // las correcciones de cada uno en cliente -- así el selector de
  // Proyecto solo ofrece proyectos con algo realmente accionable (master
  // prompt §24-25), en vez de repetir options.projects del backend (que
  // incluye proyectos con corrección ya completada).
  const q = useQuery({ queryKey: [...correctorRequestsKey, 'picker', page], queryFn: () => fetchMiTrabajoCorrector(new URLSearchParams({ tab: 'active', page: String(page), pageSize: '50' })) });
  const active = (q.data?.items ?? []).filter(r => r.actionable);
  const projects = [...new Map(active.map(r => [r.projectId, { id: r.projectId, name: r.title }])).values()];
  const items = active.filter(r => r.projectId === projectId);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (sending.current || !items.some(i => i.id === workItemId)) return;
    sending.current = true; setBusy(true); setError('');
    try { const result = await crearSolicitudCorrector(workItemId, type, motivo); await cache.invalidateQueries({ queryKey: correctorRequestsKey }); onCreated(result.id); }
    catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? 'No se pudo enviar. Revisa si ya tienes una solicitud de este tipo sin resolver para esta corrección.' : e instanceof ApiError && e.status === 403 ? 'Esta corrección ya no está asignada a tu cuenta.' : e instanceof Error ? e.message : 'No se pudo enviar la solicitud.');
      await cache.invalidateQueries({ queryKey: correctorRequestsKey });
    }
    finally { sending.current = false; setBusy(false); }
  }
  return <EditorDetail title="Nueva solicitud" open modal={!desktop} onClose={onClose}><div className="ms-create-content">
    <p>Reporta un problema o pide una aclaración sobre una corrección que tienes asignada. También puedes hacerlo desde Mi trabajo.</p>
    <form className="ep-form" onSubmit={submit}>
      <label>Tipo de solicitud<select aria-label="Tipo de solicitud" value={type} onChange={e => setType(e.target.value as CorrectorRequestType)} disabled={busy}>{CORRECTOR_REQUEST_TYPES.map(t => <option key={t} value={t}>{CORRECTOR_REQUEST_LABELS[t]}</option>)}</select></label>
      <p className="ms-target">Destino: <strong>Especialista del proyecto</strong></p>
      {q.isPending ? <EditorSkeleton label="Cargando tus correcciones" /> : q.isError ? <p role="alert">No se pudo cargar tu trabajo. <button type="button" onClick={() => q.refetch()}>Reintentar</button></p> : <>
        <label>Proyecto<select aria-label="Proyecto" required value={projectId} onChange={e => { setProjectId(e.target.value); setWorkItemId(''); setPage(1); }} disabled={busy}><option value="">Selecciona un proyecto</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        {projectId && <><label>Corrección<select aria-label="Corrección" required value={workItemId} onChange={e => setWorkItemId(e.target.value)} disabled={busy}><option value="">Selecciona una corrección</option>{items.map(i => <option key={i.id} value={i.id}>{i.intervention}</option>)}</select></label>{!items.length && <p>No hay correcciones activas disponibles en esta página.</p>}</>}
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
  const q = useQuery({ queryKey: [...correctorRequestsKey, 'detalle', id], queryFn: () => fetchMiSolicitudCorrectorDetalle(id) });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(''), [response, setResponse] = useState(''), [responding, setResponding] = useState(false), [canceling, setCanceling] = useState(false);
  const sending = useRef(false), dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLTextAreaElement>(null);
  const d = q.data, r = d?.summary;
  const tab = ['detail', 'responses', 'history'].includes(rawTab) ? rawTab : 'detail';
  useEffect(() => { if (responding) input.current?.focus(); }, [responding]);
  useEffect(() => { if (canceling) dialog.current?.showModal(); else dialog.current?.close(); }, [canceling]);
  async function run(action: () => Promise<unknown>, message: string) {
    if (sending.current) return; sending.current = true; setBusy(true); setError(''); setSuccess('');
    try { await action(); setResponding(false); setCanceling(false); setResponse(''); setSuccess(message); }
    catch (e) { setError(e instanceof ApiError && e.status === 409 ? 'La solicitud cambió o ya no admite esta acción. Se actualizó su estado.' : e instanceof ApiError && e.status === 403 ? 'La corrección ya no está asignada a tu cuenta. Se actualizó la solicitud.' : e instanceof Error ? e.message : 'No se pudo guardar la acción.'); setCanceling(false); }
    finally { await cache.invalidateQueries({ queryKey: correctorRequestsKey }); sending.current = false; setBusy(false); }
  }
  const canRespond = r?.status === 'devuelta' && r.canRespond !== false;
  return <EditorDetail title="Detalle de solicitud" open modal={!desktop} onClose={onClose}>
    {q.isPending ? <EditorSkeleton label="Cargando detalle de solicitud" /> : q.isError ? <EditorEmpty><span role="alert">No se pudo cargar la solicitud.</span> <button onClick={() => q.refetch()}>Reintentar solicitud</button></EditorEmpty> : d && r && <>
      <header className="ms-detail-header"><RequestIcon type={r.type} /><div><h3>{CORRECTOR_REQUEST_LABELS[r.type]}</h3><p>{r.title}</p><RequestStatus status={r.status} /></div><time dateTime={r.requestedAt}>{correctorDate(r.requestedAt)}</time></header>
      <div className="ms-detail-tabs" role="group" aria-label="Contenido de la solicitud">{[['detail', 'Detalle'], ...(d.observations?.length ? [['responses', 'Respuestas']] : []), ['history', 'Historial']].map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => { setResponding(false); onTab(key); }}>{label}</button>)}</div>
      <div className="ms-detail-content">
        {error && <p role="alert" className="eo-error">{error}</p>}{success && <p role="status" className="eo-success">{success}</p>}
        {tab === 'detail' && <>
          <section className="ms-context"><h4>Proyecto y corrección</h4><div className="ms-detail-project"><CorrectorCover url={r.coverUrl} /><div><strong>{r.title}</strong><span>{r.interventionLabel}</span><small>{r.authors}</small><small>{r.code}</small></div></div></section>
          <section><h4>Motivo de la solicitud</h4><p className="ms-description">{d.description || 'No se registró una descripción.'}</p></section>
          {r.status === 'devuelta' && <section className="ms-returned"><h4>Necesitamos más información</h4><p>{r.returnReason ?? d.observations?.filter(o => !o.answer).at(-1)?.question ?? 'Revisa la respuesta recibida antes de reenviar.'}</p>{!canRespond && <small>Tu corrección ya no está disponible para completar esta solicitud.</small>}</section>}
          {['resuelta', 'rechazada'].includes(r.status) && <section className="ms-result"><h4>Resultado</h4><p>{r.outcome || 'No se registró una descripción del resultado.'}</p><small>{r.resolvedBy ?? r.target} · {correctorDate(r.resolvedAt, true)}</small></section>}
          {r.status === 'cancelada' && <section className="ms-cancelled"><h4>Solicitud retirada</h4><p>Esta solicitud fue cancelada. Su historial se conserva.</p><small>{r.resolvedBy ?? r.requestedBy} · {correctorDate(r.resolvedAt, true)}</small></section>}
          <dl className="ms-facts"><div><dt>Enviada por</dt><dd>{r.requestedBy ?? 'Tú'}</dd></div><div><dt>Destino</dt><dd>{r.target}</dd></div><div><dt>Fecha de envío</dt><dd>{correctorDate(r.requestedAt, true)}</dd></div><div><dt>Última actualización</dt><dd>{correctorDate(r.updatedAt ?? r.requestedAt, true)}<small>{r.lastEventLabel ?? 'Solicitud enviada'}</small></dd></div></dl>
        </>}
        {tab === 'responses' && <section><h4>Información y respuestas</h4>{d.observations?.length ? <ol className="ms-responses">{d.observations.map(o => <li key={o.id}><strong>{o.askedBy ?? r.target}</strong><time>{correctorDate(o.at, true)}</time><p>{o.question}</p>{o.answer ? <div><strong>{o.answeredBy ?? r.requestedBy ?? 'Tú'}</strong><time>{correctorDate(o.answeredAt ?? null, true)}</time><p>{o.answer}</p></div> : <small>Pendiente de completar</small>}</li>)}</ol> : <EditorEmpty>No hay respuestas registradas.</EditorEmpty>}</section>}
        {tab === 'history' && <section><h4>Historial de la solicitud</h4>{d.history.length ? <ol className="ms-timeline">{d.history.map(h => <li key={h.id}><i aria-hidden="true" /><strong>{h.label}</strong><span>{h.actor}</span><time>{correctorDate(h.at, true)}</time></li>)}</ol> : <EditorEmpty>Sin eventos registrados todavía.</EditorEmpty>}</section>}
        {responding && canRespond && <form className="ep-form ms-response-form" onSubmit={e => { e.preventDefault(); void run(() => responderSolicitudCorrector(id, r.version, response), 'Información enviada. La solicitud vuelve a estar pendiente.'); }}><label>Completar información<textarea ref={input} required minLength={5} maxLength={1000} value={response} onChange={e => setResponse(e.target.value)} disabled={busy} /></label><div className="ms-form-actions"><button className="ec-primary" disabled={busy}>{busy ? 'Enviando…' : 'Responder y reenviar'}</button><button type="button" disabled={busy} onClick={() => setResponding(false)}>Volver</button></div></form>}
      </div>
      <footer className="ms-detail-actions">
        {canRespond && !responding && <button className="ec-primary" onClick={() => setResponding(true)}>Completar información</button>}
        {r.workAccessible !== false && <Link className="ec-secondary" to={'/?' + new URLSearchParams({ vista: 'mi-trabajo', workItem: r.workItemId })}><RrppIcon nombre="libro" />Ver en Mi trabajo</Link>}
        {['pendiente', 'en_revision'].includes(r.status) && <button className="eo-text-button ms-cancel" disabled={busy} onClick={() => setCanceling(true)}>Cancelar solicitud</button>}
      </footer>
      <dialog onKeyDown={e => { if (e.key === 'Escape') e.stopPropagation(); }} ref={dialog} className="ms-confirm" onCancel={e => { e.preventDefault(); setCanceling(false); }} aria-labelledby="cms-cancel-title"><h3 id="cms-cancel-title">¿Cancelar esta solicitud?</h3><p>Se retirará de las solicitudes pendientes. Su historial se conservará.</p><div><button className="ec-secondary" disabled={busy} onClick={() => setCanceling(false)}>Volver</button><button className="ec-primary" disabled={busy} onClick={() => void run(() => cancelarSolicitudCorrector(id, r.version), 'Solicitud cancelada. Su historial se conserva.')}>{busy ? 'Cancelando…' : 'Confirmar cancelación'}</button></div></dialog>
    </>}
  </EditorDetail>;
}
