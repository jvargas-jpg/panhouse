import '../editor/editor.css';
import '../editor/miTrabajo.css';
import './soporteEditorialHome.css';
import './soporteEditorialMisSolicitudes.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMe } from '../auth/useAuth';
import { ApiError } from '../lib/api';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { TopBar } from '../layout/TopBar';
import { PRODUCTION_LOGO } from '../layout/RoleProjectNavigation';
import { EditorDetail, EditorSearch, EditorSelect, EditorSkeleton, useEditorDesktop, useEditorFilters } from '../editor/EditorUi';
import { EditorEmpty } from '../editor/EditorParts';
import { RrppIcon } from '../rrpp/RrppIcons';
import { SoporteEditorialCover, SoporteEditorialMobileNavigation, SoporteEditorialNavigation, miTrabajoUrl, soporteEditorialDate } from './SoporteEditorialUi';
import { QUALITY_REQUEST_LABELS, QUALITY_REQUEST_STATUS_LABELS, QUALITY_REQUEST_TYPES, QUALITY_REQUEST_STATUSES, type QualityRequestContext, type QualityRequestDetail, type QualityRequestType } from '../../../shared/soporteEditorialRequests';
import { answerQualityRequest, cancelQualityRequest, createQualityRequest, fetchQualityRequestContexts, fetchQualityRequestDetail, fetchQualityRequests, qualityRequestsKey } from './soporteEditorialRequestsApi';

const TABS = [['all', 'Todas'], ['pending', 'Pendientes'], ['returned', 'Requieren tu acción'], ['resolved', 'Resueltas'], ['cancelled', 'Canceladas']] as const;
const FILTERS = ['status', 'type', 'project', 'from', 'to'];
const formatRound = (r: QualityRequestContext) => `F${r.phase} · Ronda ${r.round}${r.versionLabel ? ' · ' + r.versionLabel : ''}`;
const shortDate = (value: string) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
export function QualityRequestBadge({ status }: { status: keyof typeof QUALITY_REQUEST_STATUS_LABELS }) {
  const tone = status === 'requiere_informacion' ? 'violet' : status === 'resuelta' ? 'green' : status === 'rechazada' ? 'red' : status === 'cancelada' ? 'neutral' : 'amber';
  return <span className={'ec-status ec-' + tone}><i aria-hidden="true" />{QUALITY_REQUEST_STATUS_LABELS[status]}</span>;
}
function useQualityInvalidation() {
  const cache = useQueryClient();
  return () => cache.invalidateQueries({ queryKey: qualityRequestsKey });
}
function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} className="qr-dialog" aria-label={title} onKeyDown={e => {
    e.stopPropagation();
    if (e.key !== 'Tab') return;
    const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]') ?? []).filter(el => el.getClientRects().length > 0);
    const first = controls[0], last = controls[controls.length - 1];
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
  }} onCancel={e => { e.preventDefault(); onClose(); }}><header><h2>{title}</h2><button type="button" aria-label="Cerrar formulario" onClick={onClose}>×</button></header>{children}</dialog>;
}

export function SoporteEditorialMisSolicitudes() {
  const { data: user } = useMe();
  const { params, setParams, search, setSearch } = useEditorFilters();
  const desktop = useEditorDesktop(), creating = params.get('create') === '1';
  const tab = TABS.find(([id]) => id === params.get('tab'))?.[0] ?? 'all';
  const pageSize = ['10', '25', '50'].includes(params.get('pageSize') ?? '') ? params.get('pageSize')! : '25';
  const query = new URLSearchParams({ tab, search: params.get('search') ?? '', page: params.get('page') ?? '1', pageSize });
  for (const key of FILTERS) if (params.get(key)) query.set(key, params.get(key)!);
  const list = useQuery({ queryKey: [...qualityRequestsKey, user?.id, 'list', query.toString()], queryFn: () => fetchQualityRequests(query), enabled: !!user, placeholderData: p => p, refetchInterval: 15000 });
  const items = list.data?.items ?? [];
  const detailId = params.get('request') ?? (desktop && params.get('detailClosed') !== '1' ? items[0]?.id : undefined);
  const filterCount = FILTERS.filter(k => params.has(k)).length, filtered = !!search || filterCount > 0;
  const change = (key: string, value: string) => setParams(current => {
    const next = new URLSearchParams(current); value ? next.set(key, value) : next.delete(key);
    if (!['request', 'detailTab', 'create', 'detailClosed'].includes(key)) { for (const k of ['request', 'detailTab', 'detailClosed']) next.delete(k); if (key !== 'page') next.delete('page'); }
    if (key === 'request') { next.delete('create'); next.delete('detailTab'); }
    return next;
  });
  const close = () => setParams(current => { const next = new URLSearchParams(current); for (const k of ['request', 'detailTab', 'create', 'workItemId']) next.delete(k); next.set('detailClosed', '1'); return next; });
  const clear = () => { setSearch(''); setParams({ vista: 'mis-solicitudes' }); };
  const filterRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (e: PointerEvent) => { if (filterRef.current && !filterRef.current.contains(e.target as Node)) filterRef.current.open = false; };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape' && filterRef.current?.open) { e.stopPropagation(); filterRef.current.open = false; filterRef.current.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape, true); };
  }, []);
  return <CrmSidebarLayout nav={<SoporteEditorialNavigation active="mis-solicitudes" />} logo={PRODUCTION_LOGO} sidebarWidth={224} sidebarBreakpoint="lg" contentMaxWidth="max-w-none" shellClassName="soporte-editorial-layout" contentClassName="soporte-editorial-home editor-shell se-requests" footer={<p className="se-footer">Historias que conectan.</p>}>
    <div className="se-topbar"><div><RrppIcon nombre="libro" /><strong>Soporte Editorial</strong></div><TopBar compacto roleLabel="Soporte Editorial" /></div><SoporteEditorialMobileNavigation active="mis-solicitudes" />
    <div className="se-body">
      <nav className="se-breadcrumb" aria-label="Ruta de navegación"><span>Soporte Editorial</span><RrppIcon nombre="flecha" /><strong>Mis solicitudes</strong></nav>
      <header className="se-page-header"><div><h1>Mis solicitudes</h1><p>Consulta las solicitudes que has enviado relacionadas con tus validaciones y revisa su estado.</p></div><button type="button" className="ec-primary" onClick={() => change('create', '1')}><RrppIcon nombre="ingreso" />Nueva solicitud</button></header>
      <section className="qr-page" aria-label="Solicitudes enviadas por el Validador">
        <div className="qr-controls"><nav className="mw-views" aria-label="Estado de mis solicitudes">{TABS.map(([id, label]) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => change('tab', id)}>{label}<span>{list.data?.counts[id] ?? '—'}</span></button>)}</nav>
          <div className="qr-tools"><EditorSearch value={search} onChange={setSearch} placeholder="Buscar por proyecto, tema o ronda…" />
            <details className="mw-filters" ref={filterRef}><summary><RrppIcon nombre="lista" />Filtros{filterCount > 0 && <span>{filterCount}</span>}</summary><div className="mw-filter-panel">
              <header><strong>Filtrar solicitudes</strong><button type="button" aria-label="Cerrar filtros" onClick={() => { if (filterRef.current) filterRef.current.open = false; }}>×</button></header>
              <EditorSelect label="Estado" value={params.get('status') ?? ''} onChange={v => change('status', v)} options={QUALITY_REQUEST_STATUSES.map(id => ({ id, name: QUALITY_REQUEST_STATUS_LABELS[id] }))} />
              <EditorSelect label="Tipo de solicitud" value={params.get('type') ?? ''} onChange={v => change('type', v)} options={QUALITY_REQUEST_TYPES.map(id => ({ id, name: QUALITY_REQUEST_LABELS[id] }))} />
              <EditorSelect label="Proyecto" value={params.get('project') ?? ''} onChange={v => change('project', v)} options={list.data?.projects ?? []} />
              <label>Desde<input aria-label="Fecha de creación desde" type="date" value={params.get('from') ?? ''} max={params.get('to') ?? undefined} onChange={e => change('from', e.target.value)} /></label>
              <label>Hasta<input aria-label="Fecha de creación hasta" type="date" value={params.get('to') ?? ''} min={params.get('from') ?? undefined} onChange={e => change('to', e.target.value)} /></label>
              <footer><button type="button" className="eo-text-button" onClick={clear}>Limpiar filtros</button><button type="button" className="ec-primary" onClick={() => { if (filterRef.current) filterRef.current.open = false; }}>Ver resultados</button></footer>
            </div></details>
          </div>
        </div>
        {filtered && <div className="qr-filter-summary"><span>{list.data?.total ?? '—'} solicitudes encontradas</span><button className="eo-text-button" onClick={clear}>Limpiar filtros</button></div>}
        <div className="qr-workspace"><section className="qr-list" aria-label="Historial de solicitudes enviadas" aria-busy={list.isFetching}>
          {list.isError ? <EditorEmpty><span role="alert">No se pudieron cargar tus solicitudes.</span> <button onClick={() => list.refetch()}>Reintentar solicitudes</button></EditorEmpty> : list.isPending ? <EditorSkeleton label="Cargando solicitudes" /> : items.length ? <div className="qr-table-wrap"><table className="qr-table"><caption className="sr-only">Una fila por solicitud enviada, relacionada con una ronda de Calidad.</caption><thead><tr>{['Proyecto / Autor', 'Validación', 'Solicitud', 'Creada', 'Estado', 'Actualización', ''].map(label => <th scope="col" key={label}>{label || <span className="sr-only">Ver solicitud</span>}</th>)}</tr></thead><tbody>{items.map(r => <tr key={r.id} tabIndex={0} aria-selected={detailId === r.id} className={detailId === r.id ? 'is-selected' : ''} onClick={() => change('request', r.id)} onKeyDown={e => { if (e.target === e.currentTarget && ['Enter', ' '].includes(e.key)) { e.preventDefault(); change('request', r.id); } }}>
            <td data-label="Proyecto / Autor"><div className="se-identity"><SoporteEditorialCover url={r.coverUrl} /><div><strong>{r.projectTitle}</strong><span>{r.authors}</span><small>{r.projectCode}</small></div></div></td>
            <td data-label="Validación"><strong>F{r.phase} · Ronda {r.round}</strong><small>{r.versionLabel ?? 'Versión sin etiqueta'}</small></td>
            <td data-label="Solicitud"><strong>{QUALITY_REQUEST_LABELS[r.type]}</strong><small title={r.subject}>{r.subject}</small></td>
            <td data-label="Creada"><time dateTime={r.requestedAt} title={soporteEditorialDate(r.requestedAt, true)}>{shortDate(r.requestedAt)}</time></td>
            <td data-label="Estado"><QualityRequestBadge status={r.status} /></td>
            <td data-label="Última actualización"><time dateTime={r.updatedAt} title={soporteEditorialDate(r.updatedAt, true)}>{shortDate(r.updatedAt)}</time><small>{r.lastEvent}</small></td>
            <td><button type="button" className="qr-open" aria-label={'Ver solicitud: ' + r.subject} onClick={e => { e.stopPropagation(); change('request', r.id); }}><span>Ver solicitud</span><RrppIcon nombre="flecha" /></button></td>
          </tr>)}</tbody></table></div> : <div className="qr-empty"><RrppIcon nombre="comentarios" /><EditorEmpty>{filtered ? 'No hay solicitudes que coincidan con estos filtros.' : tab === 'all' ? 'Aún no has enviado solicitudes.' : 'No tienes solicitudes en este estado.'}</EditorEmpty>{filtered ? <button className="ec-secondary" onClick={clear}>Limpiar filtros</button> : <><p>Los problemas o aclaraciones que reportes durante una validación aparecerán aquí.</p><Link className="ec-secondary" to={miTrabajoUrl()}>Ir a Mi trabajo</Link></>}</div>}
          {list.data && <footer className="mw-pagination"><span aria-live="polite">{list.data.total ? `${(list.data.page - 1) * Number(pageSize) + 1}–${Math.min(list.data.page * Number(pageSize), list.data.total)} de ${list.data.total}` : '0'} solicitudes</span><div><button aria-label="Página anterior" disabled={list.data.page <= 1 || list.isFetching} onClick={() => change('page', String(list.data!.page - 1))}>‹</button><span>{list.data.page} / {list.data.pages}</span><button aria-label="Página siguiente" disabled={list.data.page >= list.data.pages || list.isFetching} onClick={() => change('page', String(list.data!.page + 1))}>›</button><select aria-label="Solicitudes por página" value={pageSize} onChange={e => change('pageSize', e.target.value)}>{[10, 25, 50].map(n => <option key={n} value={n}>Mostrar {n}</option>)}</select></div></footer>}
        </section>
          {!creating && detailId ? <RequestDetail key={detailId} id={detailId} tab={params.get('detailTab') === 'history' ? 'history' : 'detail'} onTab={t => change('detailTab', t)} onClose={close} /> : <div className="qr-placeholder"><RrppIcon nombre="comentarios" /><p>Selecciona una solicitud para consultar su respuesta y seguimiento.</p></div>}
        </div>
      </section>
    </div>
    {creating && <CreateRequest initialWorkItemId={params.get('workItemId') ?? ''} onClose={() => setParams(current => { const next = new URLSearchParams(current); next.delete('create'); next.delete('workItemId'); return next; })} onCreated={id => { setSearch(''); setParams({ vista: 'mis-solicitudes', request: id }); }} />}
  </CrmSidebarLayout>;
}

function CreateRequest({ initialWorkItemId, onClose, onCreated }: { initialWorkItemId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const { data: user } = useMe(), invalidate = useQualityInvalidation();
  const [page, setPage] = useState(1), [search, setSearch] = useState(''), [debounced, setDebounced] = useState('');
  const [workItemId, setWorkItemId] = useState(initialWorkItemId), [type, setType] = useState<QualityRequestType>('calidad_material');
  const [subject, setSubject] = useState(''), [description, setDescription] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const sending = useRef(false);
  useEffect(() => { const timer = setTimeout(() => { setDebounced(search); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  const qs = new URLSearchParams({ page: String(page), search: debounced });
  if (initialWorkItemId) qs.set('workItemId', initialWorkItemId);
  const q = useQuery({ queryKey: [...qualityRequestsKey, user?.id, 'contexts', qs.toString()], queryFn: () => fetchQualityRequestContexts(qs) });
  const selected = q.data?.items.find(r => r.workItemId === workItemId);
  return <Dialog title="Nueva solicitud de Calidad" onClose={() => { if (!busy) onClose(); }}><form onSubmit={async e => {
    e.preventDefault(); if (sending.current || !selected) return; sending.current = true; setBusy(true); setError('');
    try { const r = await createQualityRequest({ workItemId, type, subject, description, idempotencyKey }); await invalidate(); onCreated(r.id); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo enviar la solicitud.'); await invalidate(); }
    finally { sending.current = false; setBusy(false); }
  }}><fieldset disabled={busy}>
    <p className="qr-muted">Reporta una necesidad relacionada con una ronda abierta. El Especialista coordina su atención.</p>
    {!initialWorkItemId && <EditorSearch value={search} onChange={setSearch} placeholder="Buscar una validación elegible…" />}
    {q.isPending ? <EditorSkeleton label="Consultando validaciones elegibles" /> : q.isError ? <p role="alert">No se pudieron consultar las validaciones. <button type="button" onClick={() => q.refetch()}>Reintentar</button></p> : <>
      <label>Validación relacionada<select required value={workItemId} onChange={e => setWorkItemId(e.target.value)}><option value="">Selecciona una ronda</option>{q.data?.items.map(r => <option key={r.workItemId} value={r.workItemId}>{r.projectCode} · {r.projectTitle} · {formatRound(r)}</option>)}</select></label>
      {!q.data?.total && <p role="status">No hay rondas abiertas disponibles con este contexto. <Link to={miTrabajoUrl()}>Ir a Mi trabajo</Link></p>}
      {!initialWorkItemId && q.data && q.data.pages > 1 && <div className="qr-context-pages"><button type="button" disabled={q.data.page <= 1} onClick={() => { setWorkItemId(''); setPage(page - 1); }}>Anterior</button><span>{q.data.page} / {q.data.pages}</span><button type="button" disabled={q.data.page >= q.data.pages} onClick={() => { setWorkItemId(''); setPage(page + 1); }}>Siguiente</button></div>}
    </>}
    {selected && <p className="qr-destination">{formatRound(selected)}<br />Destino: {selected.specialist} · Especialista coordinador</p>}
    <label>Tipo de solicitud<select value={type} onChange={e => setType(e.target.value as QualityRequestType)}>{QUALITY_REQUEST_TYPES.map(t => <option key={t} value={t}>{QUALITY_REQUEST_LABELS[t]}</option>)}</select></label>
    <label>Tema<input required minLength={5} maxLength={160} value={subject} onChange={e => setSubject(e.target.value)} /></label>
    <label>Descripción<textarea required minLength={10} maxLength={4000} rows={5} value={description} onChange={e => setDescription(e.target.value)} /></label>
  </fieldset>{error && <p role="alert" className="eo-error">{error}</p>}<footer><button type="button" className="ec-secondary" disabled={busy} onClick={onClose}>Volver</button><button type="submit" className="ec-primary" disabled={busy || !selected}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button></footer></form></Dialog>;
}

export function QualityRequestInformation({ d, allowValidationLink = true }: { d: QualityRequestDetail; allowValidationLink?: boolean }) {
  return <>
    <section><h4>Información de la solicitud</h4><dl className="qr-facts"><div><dt>Tipo</dt><dd>{QUALITY_REQUEST_LABELS[d.summary.type]}</dd></div><div><dt>Tema</dt><dd>{d.summary.subject}</dd></div><div><dt>Validación</dt><dd>{formatRound(d.summary)}</dd></div><div><dt>Creada</dt><dd>{soporteEditorialDate(d.summary.requestedAt, true)}</dd></div><div><dt>Destino</dt><dd>{d.destination}</dd></div><div><dt>Especialista</dt><dd>{d.specialist ?? 'Sin asignación vigente'}</dd></div>{d.designer && <div><dt>Diseñador</dt><dd>{d.designer}</dd></div>}<div><dt>Actualizada</dt><dd>{soporteEditorialDate(d.summary.updatedAt, true)}</dd></div></dl><h4>Descripción</h4><p className="qr-description">{d.description}</p></section>
    {d.questions.map(q => <section className="qr-question" key={q.id}><h4>{q.answer ? 'Información completada' : 'Se necesita más información'}</h4><p>{q.text}</p><small>{q.actor} · {soporteEditorialDate(q.at, true)}</small>{q.answer && <><p className="qr-description">{q.answer}</p><small>{q.answeredBy} · {q.answeredAt && soporteEditorialDate(q.answeredAt, true)}</small></>}</section>)}
    {d.result && <section className="qr-result"><h4>Resultado</h4><p className="qr-description">{d.result.text}</p><small>{d.result.actor ?? 'Sin actor registrado'} · {soporteEditorialDate(d.result.at, true)}</small>{d.result.references && (allowValidationLink ? <Link className="ec-secondary" to={miTrabajoUrl(d.result.references.qualityPhaseId)}>Ver validación del resultado · {formatRound(d.result.references)}</Link> : <p>Referencia del resultado: {formatRound(d.result.references)}</p>)}</section>}
    {d.cancellation && <section className="qr-result"><h4>Solicitud cancelada</h4><p>{d.cancellation.reason ?? 'El solicitante canceló la solicitud.'}</p><small>{d.cancellation.actor} · {soporteEditorialDate(d.cancellation.at, true)}</small></section>}
  </>;
}
function RequestDetail({ id, tab, onTab, onClose }: { id: string; tab: 'detail' | 'history'; onTab: (t: string) => void; onClose: () => void }) {
  const { data: user } = useMe(), invalidate = useQualityInvalidation(), desktop = useEditorDesktop();
  const q = useQuery({ queryKey: [...qualityRequestsKey, user?.id, 'detail', id], queryFn: () => fetchQualityRequestDetail(id), refetchInterval: 15000 });
  const [cancelVersion, setCancelVersion] = useState<number | null>(null), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const answerRef = useRef<HTMLDivElement>(null);
  const d = q.data, r = d?.summary;
  return <EditorDetail title="Detalle de la solicitud" open modal={!desktop} onClose={onClose}>
    {q.isPending ? <EditorSkeleton label="Cargando detalle de solicitud" /> : q.isError ? <EditorEmpty><span role="alert">No se pudo cargar la solicitud.</span> <button onClick={() => q.refetch()}>Reintentar detalle</button></EditorEmpty> : d && r && <>
      <div className="qr-detail-header"><SoporteEditorialCover url={r.coverUrl} /><div><h3>{r.projectTitle}</h3><p>{r.authors} · {r.projectCode}</p><small>{formatRound(r)}</small><QualityRequestBadge status={r.status} /></div></div>
      <nav className="qr-detail-tabs" aria-label="Contenido de la solicitud"><button aria-pressed={tab === 'detail'} onClick={() => onTab('detail')}>Detalle</button><button aria-pressed={tab === 'history'} onClick={() => onTab('history')}>Historial</button></nav>
      <div className="qr-detail-content"><section hidden={tab !== 'history'}><h4>Historial de la solicitud</h4><ol className="qr-history">{d.history.map(h => <li key={h.id}><strong>{h.label}</strong><small>{h.actor} · {soporteEditorialDate(h.at, true)}</small>{h.text && <p>{h.text}</p>}</li>)}</ol></section><div hidden={tab !== 'detail'}><QualityRequestInformation d={d} />
        {r.requiresAction && <div ref={answerRef}>{d.questions.filter(question => !question.answer).slice(-1).map(question => <AnswerForm key={question.id} id={id} version={r.version} questionId={question.id} onDone={async () => { await invalidate(); setSuccess('Información enviada al Especialista.'); }} onConflict={async () => { await invalidate(); setError('La solicitud cambió. Actualizamos el detalle; revisa su estado.'); }} />)}</div>}
      </div>{success && <p role="status" className="eo-success">{success}</p>}{error && <p role="alert" className="eo-error">{error}</p>}</div>
      <footer className="qr-detail-actions">{r.requiresAction && <button className="ec-primary" onClick={() => { onTab('detail'); requestAnimationFrame(() => { answerRef.current?.scrollIntoView({ block: 'nearest' }); answerRef.current?.querySelector('textarea')?.focus(); }); }}>Completar información</button>}{r.workAccessible && <Link className="ec-secondary" to={miTrabajoUrl(r.qualityPhaseId)}>Ver validación<RrppIcon nombre="flecha" /></Link>}{r.canCancel && <button className="qr-cancel" onClick={() => setCancelVersion(r.version)}>Cancelar solicitud</button>}</footer>
      {cancelVersion !== null && <CancelRequest id={id} version={cancelVersion} onClose={() => setCancelVersion(null)} onDone={async () => { setCancelVersion(null); await invalidate(); setSuccess('Solicitud cancelada.'); }} onConflict={async () => { setCancelVersion(null); await invalidate(); setError('La solicitud cambió. Actualizamos el detalle; revisa su estado.'); }} />}
    </>}
  </EditorDetail>;
}
function AnswerForm({ id, version, questionId, onDone, onConflict }: { id: string; version: number; questionId: string; onDone: () => Promise<void>; onConflict: () => Promise<void> }) {
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <form className="qr-form" onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); setError(''); try { await answerQualityRequest(id, version, questionId, text); await onDone(); } catch (e) { if (e instanceof ApiError && e.status === 409) await onConflict(); else setError(e instanceof Error ? e.message : 'No se pudo enviar'); } finally { setBusy(false); } }}>
    <label>Completar información<textarea required minLength={5} maxLength={2000} rows={4} value={text} onChange={e => setText(e.target.value)} disabled={busy} /></label>{error && <p role="alert" className="eo-error">{error}</p>}<button className="ec-primary" disabled={busy}>{busy ? 'Enviando…' : 'Enviar información'}</button>
  </form>;
}
function CancelRequest({ id, version, onClose, onDone, onConflict }: { id: string; version: number; onClose: () => void; onDone: () => Promise<void>; onConflict: () => Promise<void> }) {
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <Dialog title="Cancelar solicitud" onClose={() => { if (!busy) onClose(); }}><form onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); try { await cancelQualityRequest(id, version, reason); await onDone(); } catch (e) { if (e instanceof ApiError && e.status === 409) await onConflict(); else setError(e instanceof Error ? e.message : 'No se pudo cancelar'); } finally { setBusy(false); } }}><p>La solicitud quedará cancelada y conservará su historial.</p><label>Motivo de cancelación (opcional)<textarea maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} disabled={busy} /></label>{error && <p role="alert">{error}</p>}<footer><button type="button" className="ec-secondary" disabled={busy} onClick={onClose}>Volver</button><button className="ec-primary" disabled={busy}>{busy ? 'Cancelando…' : 'Confirmar cancelación'}</button></footer></form></Dialog>;
}
