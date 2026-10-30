import '../editor/editor.css';
import '../editor/miTrabajo.css';
import './correctorHome.css';
import './correctorMiTrabajo.css';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';


import { RrppIcon } from '../rrpp/RrppIcons';
import { EditorDetail, EditorSearch, EditorSelect, EditorSkeleton, useEditorDesktop, useEditorFilters } from '../editor/EditorUi';
import { EditorEmpty } from '../editor/EditorParts';
import { CorrectorCover, CorrectorNavigation, correctorDate, correctorWorkKey } from './CorrectorUi';
import { fetchArchivosCorreccion, fetchMiTrabajoCorrector, fetchMiTrabajoCorrectorDetalle, registrarEntregaCorrector, reportarBloqueoCorrector } from './correctorWorkApi';
import type { CorrectorWorkDetail, CorrectorWorkRow, CorrectorWorkStatus } from '../../../shared/correctorWork';

const TABS = [['active', 'Activas'], ['completed', 'Completadas'], ['all', 'Todas']] as const;
const STATUS_OPTIONS = [['asignada', 'Asignada'], ['en_correccion', 'En corrección'], ['bloqueada', 'Bloqueada'], ['completada', 'Completada']] as const;
const FILTERS = ['status', 'scope', 'project'];
const EMPTY: Record<string, string> = { active: 'No tienes correcciones activas actualmente.', completed: 'Aún no tienes correcciones completadas.' };

function WorkStatus({ row }: { row: CorrectorWorkRow }) {
  const label = row.deadlineState === 'vencido' && row.status !== 'completada' ? 'Vencida' : row.statusLabel;
  const tone = label === 'Vencida' || row.status === 'bloqueada' ? 'red' : row.status === 'en_correccion' ? 'amber' : row.status === 'completada' ? 'green' : 'neutral';
  return <span className={'ec-status ec-' + tone}><i aria-hidden="true" />{label}</span>;
}
function Deadline({ row }: { row: CorrectorWorkRow }) {
  return <span className={row.deadlineState === 'vencido' && row.status !== 'completada' ? 'ec-deadline-overdue' : ''}>{correctorDate(row.deadline, true)}</span>;
}

export function CorrectorMiTrabajo() {
  const { params, setParams, update, search, setSearch } = useEditorFilters();
  const tab = TABS.find(([id]) => id === params.get('tab'))?.[0] ?? 'active';
  const selected = params.get('workItem');
  const pageSize = ['10', '25', '50'].includes(params.get('pageSize') ?? '') ? params.get('pageSize')! : '10';
  const queryParams = new URLSearchParams({ tab, search: params.get('search') ?? '', page: params.get('page') ?? '1', pageSize });
  for (const key of FILTERS) if (params.get(key)) queryParams.set(key, params.get(key)!);
  const q = useQuery({ queryKey: [...correctorWorkKey, 'lista', queryParams.toString()], queryFn: () => fetchMiTrabajoCorrector(queryParams), placeholderData: p => p });
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
  return <CrmSidebarLayout nav={<CorrectorNavigation active="mi-trabajo" />}    contentMaxWidth="max-w-none" shellClassName="corrector-layout" contentClassName="corrector-home editor-shell" >

    <div className="coh-body">
      <nav className="coh-breadcrumb" aria-label="Ruta de navegación"><span>Corrector</span><RrppIcon nombre="flecha" /><strong>Mi trabajo</strong></nav>
      <header className="coh-page-header"><div><h1>Mi trabajo</h1><p>Consulta las correcciones que tienes asignadas, revisa su estado y registra tus entregas.</p></div></header>
      <section className="mw-page" aria-label="Correcciones asignadas">
        <div className="mw-controls">
          <nav className="mw-views" aria-label="Filtrar correcciones por estado">{TABS.map(([id, label]) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => changeView('tab', id)}>{label}<span>{q.data?.counts[id] ?? '—'}</span></button>)}</nav>
          <div className="mw-tools">
            <EditorSearch value={search} onChange={setSearch} placeholder="Buscar por proyecto, autor o intervención…" />
            <details className="mw-filters" ref={filterRef}><summary><RrppIcon nombre="lista" />Filtros{filterCount > 0 && <span>{filterCount}</span>}</summary><div className="mw-filter-panel">
              <header><strong>Filtrar correcciones</strong><button type="button" aria-label="Cerrar filtros" onClick={() => { if (filterRef.current) filterRef.current.open = false; }}>×</button></header>
              <div className="mw-field"><span>Estado</span><EditorSelect label="Estado" value={params.get('status') ?? ''} onChange={v => changeView('status', v)} options={STATUS_OPTIONS.map(([id, name]) => ({ id, name }))} /></div>
              <div className="mw-field"><span>Proyecto</span><EditorSelect label="Proyecto" value={params.get('project') ?? ''} onChange={v => changeView('project', v)} options={options?.projects ?? []} /></div>
              <footer><button type="button" className="eo-text-button" disabled={!hasFilters} onClick={clear}>Limpiar filtros</button><button type="button" className="ec-primary" onClick={() => { if (filterRef.current) filterRef.current.open = false; }}>Ver resultados</button></footer>
            </div></details>
          </div>
        </div>
        {hasFilters && <div className="mw-active-filters"><span>{q.data?.total ?? '—'} correcciones encontradas</span><button className="eo-text-button" onClick={clear}>Limpiar filtros</button></div>}
        <div className="eo-workspace mw-workspace"><div className="eo-main">
          <section className="mw-list" aria-label="Correcciones asignadas" aria-busy={q.isFetching}>
            <div className="mw-list-heading"><h2>Correcciones asignadas</h2></div>
            {q.isError ? <EditorEmpty><span role="alert">No se pudieron cargar tus correcciones.</span> <button onClick={() => q.refetch()}>Reintentar</button></EditorEmpty> : q.isPending ? <EditorSkeleton label="Cargando correcciones" /> : rows.length ? <div className="eo-table-wrap"><table className="eo-table eo-work-table"><caption className="sr-only">Una fila por intervención de corrección. Selecciona una para consultar su detalle.</caption><thead><tr>{['Proyecto / Autor', 'Intervención', 'Estado', 'Fecha límite', 'Última actividad', ''].map(c => <th scope="col" key={c}>{c || <span className="sr-only">Abrir detalle</span>}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.id} aria-selected={detailId === r.id} className={detailId === r.id ? 'is-selected' : ''} tabIndex={0} onClick={() => update('workItem', r.id)} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); update('workItem', r.id); } }}>
              <td data-label="Proyecto / Autor"><div className="coh-identity"><CorrectorCover url={r.coverUrl} /><div><strong>{r.title}</strong><span>{r.authors}</span></div></div></td>
              <td data-label="Intervención"><strong>{r.intervention}</strong>{r.blocker && <small className="coh-blocker-reason">{r.blocker}</small>}</td>
              <td data-label="Estado"><WorkStatus row={r} /></td>
              <td data-label="Fecha límite"><Deadline row={r} />{r.deadlineState === 'proximo_a_vencer' && r.status !== 'completada' && <small className="coh-soon"> · Vence pronto</small>}</td>
              <td data-label="Última actividad">{r.lastActivity ? <><strong>{correctorDate(r.lastActivity.at, true)}</strong><small>{r.lastActivity.label}</small></> : <span className="eo-muted">Sin actividad</span>}</td>
              <td className="eo-chevron-cell"><button type="button" className="eo-row-action" aria-label={r.cta + ': ' + r.intervention + ' de ' + r.title} onClick={e => { e.stopPropagation(); update('workItem', r.id); }}><span className="mw-mobile-open">Ver detalle</span><RrppIcon nombre="flecha" className="eo-row-chevron" /></button></td>
            </tr>)}</tbody></table></div> : <div className="mw-empty"><RrppIcon nombre="check" /><EditorEmpty>{hasFilters ? 'No hay correcciones que coincidan con estos filtros.' : EMPTY[tab] ?? 'No hay correcciones con estos filtros.'}</EditorEmpty>{hasFilters && <button className="ec-secondary" onClick={clear}>Limpiar filtros</button>}</div>}
            {q.data && <footer className="mw-pagination"><span aria-live="polite">{q.data.total ? `${(q.data.page - 1) * Number(pageSize) + 1}–${Math.min(q.data.page * Number(pageSize), q.data.total)} de ${q.data.total}` : '0'} correcciones</span><div><button aria-label="Página anterior" disabled={q.data.page <= 1 || q.isFetching} onClick={() => changeView('page', String(q.data!.page - 1))}>‹</button><span>{q.data.page} / {q.data.pages}</span><button aria-label="Página siguiente" disabled={q.data.page >= q.data.pages || q.isFetching} onClick={() => changeView('page', String(q.data!.page + 1))}>›</button><select aria-label="Correcciones por página" value={pageSize} onChange={e => changeView('pageSize', e.target.value)}>{[10, 25, 50].map(n => <option key={n} value={n}>Mostrar {n}</option>)}</select></div></footer>}
          </section>
        </div>{detailId ? <CorrectionDetail key={detailId} id={detailId} open={!!selected} initialAction={selected ? params.get('action') : null} onClose={() => update({ workItem: '', action: '', detailClosed: '1' })} /> : <div className="eo-detail-placeholder"><RrppIcon nombre="libro" /><p>Elige una corrección</p><small>Consulta el material, el plazo y registra tu entrega.</small></div>}</div>
      </section>
    </div>
  </CrmSidebarLayout>;
}

function BlockDialog({ onClose, onSubmit, busy, error }: { onClose: () => void; onSubmit: (reason: string) => void; busy: boolean; error: string }) {
  const ref = useRef<HTMLDialogElement>(null), [reason, setReason] = useState('');
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="mw-dialog" aria-labelledby="cmw-block-title" onCancel={e => { e.preventDefault(); onClose(); }}>
    <header><h3 id="cmw-block-title">Reportar problema</h3><button type="button" aria-label="Cerrar formulario" onClick={onClose}>×</button></header>
    <form className="ep-form" onSubmit={e => { e.preventDefault(); onSubmit(reason); }}>
      <label>Motivo del bloqueo<textarea autoFocus required minLength={5} maxLength={1000} placeholder="Material incorrecto, archivo corrupto, falta información…" value={reason} onChange={e => setReason(e.target.value)} /></label>
      {error && <p role="alert" className="eo-error">{error}</p>}
      <div className="eo-actions"><button className="ec-primary" disabled={busy}>{busy ? 'Guardando…' : 'Reportar'}</button><button type="button" disabled={busy} onClick={onClose}>Cancelar</button></div>
    </form>
  </dialog>;
}

function CorrectionFilePicker({ id, label, folders, value, onSelect }: { id: string; label: string; folders: { key: string; label: string; driveUrl: string | null }[]; value: string; onSelect: (url: string) => void }) {
  const [token, setToken] = useState('');
  const output = folders.find(f => f.key === 'CORRECTION_OUTPUT' && f.driveUrl);
  const q = useQuery({ queryKey: [...correctorWorkKey, 'archivos', id, token], queryFn: () => fetchArchivosCorreccion(id, 'CORRECTION_OUTPUT', token || undefined), enabled: !!output, retry: false });
  return <div className="eo-file-picker">
    <label>{label}<input type="url" required placeholder="https://drive.google.com/file/d/…" value={value} onChange={e => onSelect(e.target.value)} /></label>
    {!output ? <p className="mw-caption">La carpeta «Corregido» aún no está disponible; pega el enlace manualmente.</p> : q.isPending ? <EditorSkeleton /> : q.isError ? <p role="alert">No pudimos consultar los archivos. <button type="button" onClick={() => q.refetch()}>Reintentar</button></p> : <><ul>{q.data?.items.map(f => <li key={f.id}><button type="button" onClick={() => onSelect(f.url)}><RrppIcon nombre="ingreso" />{f.name}<span>Seleccionar</span></button></li>)}</ul>{!q.data?.items.length && <p>No hay archivos accesibles en «Corregido» todavía.</p>}{q.data?.nextPageToken && <button type="button" onClick={() => setToken(q.data!.nextPageToken!)}>Más archivos</button>}</>}
  </div>;
}

const STATUS_HELP: Record<CorrectorWorkStatus, (d: CorrectorWorkDetail) => string> = {
  asignada: () => 'Revisa el material disponible e inicia la corrección cuando estés listo.',
  en_correccion: () => 'Continúa la corrección y registra tu entrega cuando ambos archivos estén listos.',
  bloqueada: d => d.blocker ? 'Reportaste un bloqueo: ' + d.blocker.reason : 'Esta corrección está bloqueada.',
  completada: () => 'Esta corrección está completada. Puedes consultar tu entrega y su historial.',
};

function CorrectionDetail({ id, open, onClose, initialAction }: { id: string; open: boolean; onClose: () => void; initialAction: string | null }) {
  const cache = useQueryClient();
  const desktop = useEditorDesktop();
  const q = useQuery({ queryKey: [...correctorWorkKey, 'detalle', id], queryFn: () => fetchMiTrabajoCorrectorDetalle(id) });
  const [tab, setTab] = useState<'detalle' | 'archivos' | 'historial'>('detalle');
  const [mode, setMode] = useState(initialAction === 'entrega' ? 'entrega' : '');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const [form, setForm] = useState({ tripaUrl: '', reportUrl: '', observaciones: '', reason: '' });
  const running = useRef(false);
  async function invalidate() { await cache.invalidateQueries({ predicate: q => ['corrector'].includes(String(q.queryKey[0])) }); }
  async function run(action: () => Promise<unknown>, message: string) {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setSuccess('');
    try { await action(); await invalidate(); setMode(''); setSuccess(message); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la acción.'); } finally { running.current = false; setBusy(false); }
  }
  useEffect(() => { setError(''); }, [mode]);
  const d = q.data, row = d?.summary;
  const canExecute = !!row?.actionable;
  const changeTab = (t: typeof tab) => { setTab(t); setMode(''); setError(''); };
  return <EditorDetail title="Detalle de la corrección" modal={!desktop} open={open || desktop} onClose={onClose}>
    {q.isPending ? <EditorSkeleton label="Cargando corrección" /> : q.isError ? <EditorEmpty><span role="alert">No se pudo cargar la corrección.</span> <button onClick={() => q.refetch()}>Reintentar</button></EditorEmpty> : row && d && <>
      <div className="mw-detail-header eo-detail-project"><CorrectorCover url={row.coverUrl} /><div><h3>{row.title}</h3><span>{row.authors}</span></div></div>
      <nav className="mw-detail-tabs" aria-label="Contenido de la corrección">{(['detalle', 'archivos', 'historial'] as const).map(key => <button key={key} type="button" aria-pressed={tab === key} onClick={() => changeTab(key)}>{key === 'detalle' ? 'Detalle' : key === 'archivos' ? 'Archivos' : 'Historial'}</button>)}</nav>
      <div className="mw-detail-content">
        {tab === 'detalle' && <>
          <section className="mw-current"><h4><RrppIcon nombre="libro" />Información general</h4>
            <dl className="eo-facts mw-context">
              <div><dt>Proyecto</dt><dd>{row.title}</dd></div>
              <div><dt>Autor</dt><dd>{row.authors}</dd></div>
              <div><dt>Intervención</dt><dd>{row.intervention}</dd></div>
              <div><dt>Fecha de asignación</dt><dd>{d.assignedAt ? correctorDate(d.assignedAt) : 'Sin registrar'}</dd></div>
              <div><dt>Fecha límite</dt><dd><Deadline row={row} /></dd></div>
              <div><dt>Especialista coordinador</dt><dd>{d.specialist ?? 'Sin asignar'}</dd></div>
              <div><dt>Estado actual</dt><dd><WorkStatus row={row} /></dd></div>
              {d.slaLabel && <div><dt>Plazo de corrección</dt><dd>{d.slaLabel}</dd></div>}
            </dl>
          </section>
          <section className="mw-next-step"><span>Siguiente paso</span><p>{STATUS_HELP[row.status](d)}</p></section>
          {d.blocker && <div className="eo-blocker"><RrppIcon nombre="riesgo" /><div><strong>Bloqueo abierto</strong><p>{d.blocker.reason}</p><small>{correctorDate(d.blocker.createdAt, true)}</small></div></div>}
        </>}
        {tab === 'archivos' && <>
          <section><h4>Material para corregir</h4><p className="mw-caption">Documento recibido para esta intervención.</p>
            {d.materialUnavailable ? <EditorEmpty><span role="alert">No se pudo consultar el material.</span> <button onClick={() => q.refetch()}>Reintentar material</button></EditorEmpty> : d.folders.find(f => f.key === 'CORRECTION_INPUT' && f.driveUrl) ? <div className="eo-drive-links">{d.folders.filter(f => f.key === 'CORRECTION_INPUT' && f.driveUrl).map(f => <a href={f.driveUrl!} key={f.key} target="_blank" rel="noreferrer"><RrppIcon nombre="proyectos" /><span>{f.label}</span><RrppIcon nombre="externo" /></a>)}</div> : <EditorEmpty>El material de Drive aún no está vinculado a esta intervención.</EditorEmpty>}
          </section>
          <section><h4>Entregas registradas</h4>{d.deliveries.length ? <ul className="eo-history mw-history">{d.deliveries.map(del => <li key={del.id}><a href={del.tripaDriveUrl} target="_blank" rel="noreferrer">Ver tripa corregida ↗</a>{' · '}<a href={del.reportDriveUrl} target="_blank" rel="noreferrer">Ver informe técnico ↗</a><small>{correctorDate(del.submittedAt, true)}</small>{del.observaciones && <p>{del.observaciones}</p>}</li>)}</ul> : <EditorEmpty>Aún no registras entregas para esta corrección.</EditorEmpty>}</section>
        </>}
        {tab === 'historial' && <section><h4>Historial de esta corrección</h4>{d.history.length ? <ul className="eo-history mw-history">{d.history.map(h => <li key={h.id}><strong>{h.label}</strong><small>{h.actor} · {correctorDate(h.at, true)}</small></li>)}</ul> : <EditorEmpty>Sin actividad registrada.</EditorEmpty>}</section>}
        {error && !mode && <p role="alert" className="eo-error">{error}</p>}{success && <p role="status" className="eo-success">{success}</p>}
        {!mode && row.status !== 'completada' && <div className="mw-work-actions"><h4>Acciones</h4>
          {canExecute ? <button className="ec-primary" disabled={busy} onClick={() => setMode('entrega')}><RrppIcon nombre="externo" />Registrar entrega</button> : row.status === 'bloqueada' ? <p className="mw-caption">Resuelve el bloqueo para poder continuar.</p> : null}
          {canExecute && <div className="mw-secondary-actions"><button className="ec-secondary" onClick={() => setMode('bloqueo')}><RrppIcon nombre="riesgo" />Reportar problema</button></div>}
        </div>}
        {mode === 'entrega' && canExecute && <form className="ep-form mw-delivery" onSubmit={e => { e.preventDefault(); void run(() => registrarEntregaCorrector(id, form.tripaUrl, form.reportUrl, form.observaciones), 'Entrega registrada.'); }}>
          <h4>Registrar entrega</h4>
          <CorrectionFilePicker id={id} label="Tripa corregida (control de cambios)" folders={d.folders} value={form.tripaUrl} onSelect={url => setForm({ ...form, tripaUrl: url })} />
          <CorrectionFilePicker id={id} label="Informe técnico de corrección" folders={d.folders} value={form.reportUrl} onSelect={url => setForm({ ...form, reportUrl: url })} />
          <label>Observaciones (opcional)<textarea maxLength={1000} value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} /></label>
          {error && <p role="alert" className="eo-error">{error}</p>}
          <div className="eo-actions"><button className="ec-primary" disabled={busy || !form.tripaUrl || !form.reportUrl}>{busy ? 'Registrando…' : 'Confirmar entrega'}</button><button type="button" disabled={busy} onClick={() => setMode('')}>Cancelar</button></div>
        </form>}
        {mode === 'bloqueo' && <BlockDialog busy={busy} error={error} onClose={() => { if (!busy) setMode(''); }} onSubmit={reason => void run(() => reportarBloqueoCorrector(id, reason), 'Bloqueo reportado.')} />}
        <Link className="eo-project-link" to={'/?vista=mi-trabajo'}>Ver todo mi trabajo<RrppIcon nombre="flecha" /></Link>
      </div>
    </>}
  </EditorDetail>;
}
