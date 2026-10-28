import '../editor/editor.css';
import '../editor/miTrabajo.css';
import './soporteEditorialHome.css';
import './soporteEditorialMiTrabajo.css';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { TopBar } from '../layout/TopBar';
import { PRODUCTION_LOGO } from '../layout/RoleProjectNavigation';
import { RrppIcon } from '../rrpp/RrppIcons';
import { EditorDetail, EditorSearch, EditorSelect, EditorSkeleton, useEditorDesktop, useEditorFilters } from '../editor/EditorUi';
import { EditorEmpty } from '../editor/EditorParts';
import { SoporteEditorialCover, SoporteEditorialMobileNavigation, SoporteEditorialNavigation, miTrabajoUrl, soporteEditorialDate, soporteEditorialWorkKey } from './SoporteEditorialUi';
import { escalarColeccionValidacion, fetchMiTrabajoValidador, fetchMiTrabajoValidadorDetalle, iniciarValidacion, resolverValidacion } from './soporteEditorialWorkApi';
import type { ValidatorCriterion, ValidatorWorkDetail, ValidatorWorkRow, ValidatorWorkStatus } from '../../../shared/soporteEditorialWork';

const TABS = [['active', 'Activas'], ['waiting', 'Pendientes de nueva revisión'], ['completed', 'Completadas'], ['all', 'Todas']] as const;
const STATUS_OPTIONS = [['new_round', 'Nueva ronda'], ['in_review', 'En revisión'], ['waiting_design', 'Esperando Diseño'], ['completed', 'Completada']] as const;
const FILTERS = ['status', 'type', 'project'];
const EMPTY: Record<string, string> = { active: 'No tienes validaciones activas actualmente.', waiting: 'No tienes validaciones esperando una nueva revisión.', completed: 'Aún no tienes validaciones completadas.' };

function WorkStatus({ row }: { row: ValidatorWorkRow }) {
  const label = row.actionable && row.deadlineState === 'vencido' ? 'Vencida' : row.statusLabel;
  const tone = label === 'Vencida' ? 'red' : row.status === 'in_review' ? 'amber' : row.status === 'completed' ? 'green' : row.status === 'waiting_design' ? 'neutral' : 'blue';
  return <span className={'ec-status ec-' + tone}><i aria-hidden="true" />{label}</span>;
}
function Deadline({ row }: { row: ValidatorWorkRow }) {
  if (!row.deadline) return <span className="eo-muted">Sin fecha límite</span>;
  return <span className={row.deadlineState === 'vencido' ? 'ec-deadline-overdue' : ''}>{soporteEditorialDate(row.deadline, true)}</span>;
}

export function SoporteEditorialMiTrabajo() {
  const { params, setParams, update, search, setSearch } = useEditorFilters();
  const tab = TABS.find(([id]) => id === params.get('tab'))?.[0] ?? 'active';
  const selected = params.get('workItem');
  const pageSize = ['10', '25', '50'].includes(params.get('pageSize') ?? '') ? params.get('pageSize')! : '10';
  const queryParams = new URLSearchParams({ tab, search: params.get('search') ?? '', page: params.get('page') ?? '1', pageSize });
  for (const key of FILTERS) if (params.get(key)) queryParams.set(key, params.get(key)!);
  const q = useQuery({ queryKey: [...soporteEditorialWorkKey, 'lista', queryParams.toString()], queryFn: () => fetchMiTrabajoValidador(queryParams), placeholderData: p => p });
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
  return <CrmSidebarLayout nav={<SoporteEditorialNavigation active="mi-trabajo" />} logo={PRODUCTION_LOGO} sidebarWidth={224} sidebarBreakpoint="lg" contentMaxWidth="max-w-none" shellClassName="soporte-editorial-layout" contentClassName="soporte-editorial-home editor-shell" footer={<p className="se-footer">Historias que conectan.</p>}>
    <div className="se-topbar"><div><RrppIcon nombre="libro" /><strong>Soporte Editorial</strong></div><TopBar compacto roleLabel="Soporte Editorial" /></div><SoporteEditorialMobileNavigation active="mi-trabajo" />
    <div className="se-body">
      <nav className="se-breadcrumb" aria-label="Ruta de navegación"><span>Soporte Editorial</span><RrppIcon nombre="flecha" /><strong>Mi trabajo</strong></nav>
      <header className="se-page-header"><div><h1>Mis validaciones</h1><p>Revisa las rondas de validación de la bandeja de Calidad, consulta los materiales y registra tus observaciones.</p></div></header>
      <section className="mw-page" aria-label="Rondas de validación">
        <div className="mw-controls">
          <nav className="mw-views" aria-label="Filtrar validaciones por estado">{TABS.map(([id, label]) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => changeView('tab', id)}>{label}<span>{q.data?.counts[id] ?? '—'}</span></button>)}</nav>
          <div className="mw-tools">
            <EditorSearch value={search} onChange={setSearch} placeholder="Buscar por proyecto, autor o ronda…" />
            <details className="mw-filters" ref={filterRef}><summary><RrppIcon nombre="lista" />Filtros{filterCount > 0 && <span>{filterCount}</span>}</summary><div className="mw-filter-panel">
              <header><strong>Filtrar validaciones</strong><button type="button" aria-label="Cerrar filtros" onClick={() => { if (filterRef.current) filterRef.current.open = false; }}>×</button></header>
              <div className="mw-field"><span>Estado</span><EditorSelect label="Estado" value={params.get('status') ?? ''} onChange={v => changeView('status', v)} options={STATUS_OPTIONS.map(([id, name]) => ({ id, name }))} /></div>
              <div className="mw-field"><span>Tipo de validación</span><EditorSelect label="Tipo de validación" value={params.get('type') ?? ''} onChange={v => changeView('type', v)} options={options?.types ?? []} /></div>
              <div className="mw-field"><span>Proyecto</span><EditorSelect label="Proyecto" value={params.get('project') ?? ''} onChange={v => changeView('project', v)} options={options?.projects ?? []} /></div>
              <footer><button type="button" className="eo-text-button" disabled={!hasFilters} onClick={clear}>Limpiar filtros</button><button type="button" className="ec-primary" onClick={() => { if (filterRef.current) filterRef.current.open = false; }}>Ver resultados</button></footer>
            </div></details>
          </div>
        </div>
        {hasFilters && <div className="mw-active-filters"><span>{q.data?.total ?? '—'} validaciones encontradas</span><button className="eo-text-button" onClick={clear}>Limpiar filtros</button></div>}
        <div className="eo-workspace mw-workspace"><div className="eo-main">
          <section className="mw-list" aria-label="Rondas de validación" aria-busy={q.isFetching}>
            <div className="mw-list-heading"><h2>Rondas de validación</h2></div>
            {q.isError ? <EditorEmpty><span role="alert">No se pudieron cargar tus validaciones.</span> <button onClick={() => q.refetch()}>Reintentar</button></EditorEmpty> : q.isPending ? <EditorSkeleton label="Cargando validaciones" /> : rows.length ? <div className="eo-table-wrap"><table className="eo-table se-work-table"><caption className="sr-only">Una fila por ronda de validación. Selecciona una para consultar su detalle.</caption><thead><tr>{['Proyecto / Autor', 'Ronda / Versión', 'Tipo de validación', 'Fecha límite', 'Estado', 'Última actividad', ''].map(c => <th scope="col" key={c}>{c || <span className="sr-only">Abrir detalle</span>}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.id} aria-selected={detailId === r.id} className={detailId === r.id ? 'is-selected' : ''} tabIndex={0} onClick={() => update('workItem', r.id)} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); update('workItem', r.id); } }}>
              <td data-label="Proyecto / Autor"><div className="se-identity"><SoporteEditorialCover url={r.coverUrl} /><div><strong>{r.title}</strong><span>{r.authors}</span></div></div></td>
              <td data-label="Ronda / Versión"><strong>F{r.numeroFase}.{r.ronda}</strong><small>{r.versionLabel}</small></td>
              <td data-label="Tipo de validación">{r.validationType}</td>
              <td data-label="Fecha límite"><Deadline row={r} />{r.deadlineState === 'proximo_a_vencer' && <small className="se-soon"> · Vence pronto</small>}</td>
              <td data-label="Estado"><WorkStatus row={r} /></td>
              <td data-label="Última actividad">{r.lastActivity ? <><strong>{soporteEditorialDate(r.lastActivity.at, true)}</strong><small>{r.lastActivity.label}</small></> : <span className="eo-muted">Sin actividad</span>}</td>
              <td className="eo-chevron-cell"><button type="button" className="eo-row-action" aria-label={r.cta + ': ' + r.validationType + ' de ' + r.title} onClick={e => { e.stopPropagation(); update('workItem', r.id); }}><span className="mw-mobile-open">Ver detalle</span><RrppIcon nombre="flecha" className="eo-row-chevron" /></button></td>
            </tr>)}</tbody></table></div> : <div className="mw-empty"><RrppIcon nombre="check" /><EditorEmpty>{hasFilters ? 'No hay validaciones que coincidan con estos filtros.' : EMPTY[tab] ?? 'No hay validaciones con estos filtros.'}</EditorEmpty>{hasFilters && <button className="ec-secondary" onClick={clear}>Limpiar filtros</button>}</div>}
            {q.data && <footer className="mw-pagination"><span aria-live="polite">{q.data.total ? `${(q.data.page - 1) * Number(pageSize) + 1}–${Math.min(q.data.page * Number(pageSize), q.data.total)} de ${q.data.total}` : '0'} validaciones</span><div><button aria-label="Página anterior" disabled={q.data.page <= 1 || q.isFetching} onClick={() => changeView('page', String(q.data!.page - 1))}>‹</button><span>{q.data.page} / {q.data.pages}</span><button aria-label="Página siguiente" disabled={q.data.page >= q.data.pages || q.isFetching} onClick={() => changeView('page', String(q.data!.page + 1))}>›</button><select aria-label="Validaciones por página" value={pageSize} onChange={e => changeView('pageSize', e.target.value)}>{[10, 25, 50].map(n => <option key={n} value={n}>Mostrar {n}</option>)}</select></div></footer>}
          </section>
        </div>{detailId ? <ValidationDetail key={detailId} id={detailId} open={!!selected} initialTab={params.get('detailTab')} onTabChange={t => update('detailTab', t === 'detalle' ? '' : t)} onClose={() => update({ workItem: '', action: '', detailClosed: '1', detailTab: '' })} /> : <div className="eo-detail-placeholder"><RrppIcon nombre="libro" /><p>Elige una validación</p><small>Consulta el material, el plazo y registra tu resultado.</small></div>}</div>
      </section>
    </div>
  </CrmSidebarLayout>;
}

const STATUS_HELP: Record<ValidatorWorkStatus, (d: ValidatorWorkDetail) => string> = {
  new_round: d => d.summary.ronda === 1 && d.summary.numeroFase === 1 ? 'Revisa la versión diagramada y registra tus observaciones.' : 'Diseño entregó una nueva versión: revisa los cambios y registra tus observaciones.',
  in_review: () => 'Continúa comparando el material diagramado con la fuente y registra tu validación cuando termines.',
  waiting_design: () => 'Ya registraste tus observaciones de esta ronda. Esperando que Diseño entregue una nueva versión.',
  completed: d => d.approved ? 'Esta ronda fue aprobada.' : 'Esta ronda fue completada con observaciones para Diseño.',
};

function ChecklistField({ c, onChange }: { c: ValidatorCriterion; onChange: (v: { cumple: boolean | null; observaciones: string }) => void }) {
  return <div className="se-criterion">
    <label>{c.label}<select value={c.cumple === null ? '' : c.cumple ? 'si' : 'no'} onChange={e => onChange({ cumple: e.target.value === '' ? null : e.target.value === 'si', observaciones: c.observaciones })}>
      <option value="">Sin revisar</option><option value="si">Cumple</option><option value="no">Requiere corrección</option>
    </select></label>
    <input aria-label={`Observaciones: ${c.label}`} placeholder="Observaciones del criterio" value={c.observaciones} onChange={e => onChange({ cumple: c.cumple, observaciones: e.target.value })} />
  </div>;
}

function ResolveForm({ id, d, onDone }: { id: string; d: ValidatorWorkDetail; onDone: (message: string) => void }) {
  const qc = useQueryClient();
  const [criteria, setCriteria] = useState(d.criteria);
  const [archivo, setArchivo] = useState(''); const [paginas, setPaginas] = useState(''); const [observaciones, setObservaciones] = useState('');
  const [cantidad, setCantidad] = useState(0); const [pendientes, setPendientes] = useState(0); const [nuevos, setNuevos] = useState(0);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const esValidacionDeCambios = d.summary.numeroFase === 2 || d.summary.numeroFase === 4;
  const total = esValidacionDeCambios ? pendientes + nuevos : cantidad;
  async function invalidate() { await qc.invalidateQueries({ predicate: q => soporteEditorialWorkKey.every((k, i) => q.queryKey[i] === k) }); }
  async function resolver(aprobar: boolean) {
    setBusy(true); setError('');
    try {
      await resolverValidacion(id, {
        aprobar, cantidadComentarios: total, cantidadPaginas: paginas ? Number(paginas) : undefined,
        comentariosUrl: archivo || undefined, observaciones: observaciones || undefined,
        checklist: criteria.length ? Object.fromEntries(criteria.map(c => [c.key, { cumple: c.cumple, observaciones: c.observaciones || undefined }])) : undefined,
        cambiosPendientesPorAplicar: esValidacionDeCambios ? pendientes : undefined, cambiosNuevosSugeridos: esValidacionDeCambios ? nuevos : undefined,
      });
      await invalidate(); onDone(aprobar ? 'Validación aprobada.' : 'Observaciones enviadas a Diseño.');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo registrar el resultado.'); } finally { setBusy(false); }
  }
  return <form className="ep-form mw-delivery" onSubmit={e => e.preventDefault()}>
    <h4>Lista de revisión</h4>
    {criteria.length > 0 && <div className="se-criteria">{criteria.map(c => <ChecklistField key={c.key} c={c} onChange={v => setCriteria(prev => prev.map(x => x.key === c.key ? { ...x, ...v } : x))} />)}</div>}
    <div className="mw-field-row"><label>PDF con comentarios<input type="url" placeholder="https://drive.google.com/…" value={archivo} onChange={e => setArchivo(e.target.value)} /></label><label>Páginas revisadas<input type="number" min="1" value={paginas} onChange={e => setPaginas(e.target.value)} /></label></div>
    {esValidacionDeCambios ? <div className="mw-field-row"><p className="mw-caption">Por verificar: {d.toVerifyChanges ?? 0}</p><label>Pendientes por aplicar<input type="number" min="0" value={pendientes} onChange={e => setPendientes(Number(e.target.value))} /></label><label>Cambios nuevos sugeridos<input type="number" min="0" value={nuevos} onChange={e => setNuevos(Number(e.target.value))} /></label></div> : <label>Total de comentarios por aplicar<input type="number" min="0" value={cantidad} onChange={e => setCantidad(Number(e.target.value))} /></label>}
    <label>Observaciones de la revisión<textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} /></label>
    {error && <p role="alert" className="eo-error">{error}</p>}
    <div className="eo-actions"><button type="button" className="ec-primary" disabled={busy} onClick={() => resolver(true)}>Aprobar versión</button><button type="button" className="ec-secondary" disabled={!archivo || busy} onClick={() => resolver(false)}>Devolver comentarios a Diseño</button></div>
  </form>;
}

function EscalarColeccion({ id }: { id: string }) {
  const [motivo, setMotivo] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [error, setError] = useState('');
  return <details className="se-escalate"><summary>¿La colección registrada no corresponde al proyecto?</summary>
    <div className="se-escalate-body">
      <label>Motivo de la discrepancia<textarea maxLength={1000} value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
      <button type="button" className="ec-secondary" disabled={busy || motivo.trim().length < 10} onClick={async () => { setBusy(true); setError(''); try { await escalarColeccionValidacion(id, motivo); setDone(true); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo enviar'); } finally { setBusy(false); } }}>Solicitar revisión de Jefatura</button>
      {done && <p role="status" className="eo-success">Caso enviado a Jefatura.</p>}{error && <p role="alert" className="eo-error">{error}</p>}
    </div>
  </details>;
}

type DetailTab = 'detalle' | 'materiales' | 'observaciones' | 'historial';
const DETAIL_TABS: readonly DetailTab[] = ['detalle', 'materiales', 'observaciones', 'historial'];

function ValidationDetail({ id, open, initialTab, onTabChange, onClose }: { id: string; open: boolean; initialTab: string | null; onTabChange: (t: DetailTab) => void; onClose: () => void }) {
  const qc = useQueryClient();
  const desktop = useEditorDesktop();
  const q = useQuery({ queryKey: [...soporteEditorialWorkKey, 'detalle', id], queryFn: () => fetchMiTrabajoValidadorDetalle(id) });
  const [tab, setTab] = useState<DetailTab>(DETAIL_TABS.includes(initialTab as DetailTab) ? initialTab as DetailTab : 'detalle');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const changeTab = (t: DetailTab) => { setTab(t); setError(''); setSuccess(''); onTabChange(t); };
  async function iniciar() {
    setBusy(true); setError('');
    try { await iniciarValidacion(id); await qc.invalidateQueries({ predicate: p => soporteEditorialWorkKey.every((k, i) => p.queryKey[i] === k) }); changeTab('observaciones'); setSuccess('Validación iniciada.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo iniciar la validación.'); } finally { setBusy(false); }
  }
  const d = q.data, row = d?.summary;
  const MATERIAL_LABEL: Record<string, string> = { diagrammed: 'proyectos', source: 'comparar', previous: 'actividad', previous_comments: 'comentarios', legal: 'ingreso', comments: 'comentarios' };
  return <EditorDetail title="Detalle de la validación" modal={!desktop} open={open || desktop} onClose={onClose}>
    {q.isPending ? <EditorSkeleton label="Cargando validación" /> : q.isError ? <EditorEmpty><span role="alert">No se pudo cargar la validación.</span> <button onClick={() => q.refetch()}>Reintentar</button></EditorEmpty> : row && d && <>
      <div className="mw-detail-header eo-detail-project"><SoporteEditorialCover url={row.coverUrl} /><div><h3>{row.title}</h3><span>{row.authors} · F{row.numeroFase}.{row.ronda} · {row.versionLabel}</span></div></div>
      <nav className="mw-detail-tabs" aria-label="Contenido de la validación">{(['detalle', 'materiales', 'observaciones', 'historial'] as const).map(key => <button key={key} type="button" aria-pressed={tab === key} onClick={() => changeTab(key)}>{key === 'detalle' ? 'Detalle' : key === 'materiales' ? 'Materiales' : key === 'observaciones' ? 'Observaciones' : 'Historial'}</button>)}</nav>
      <div className="mw-detail-content">
        {tab === 'detalle' && <>
          <section className="mw-current"><h4><RrppIcon nombre="libro" />Información de la validación</h4>
            <dl className="eo-facts mw-context">
              <div><dt>Proyecto</dt><dd>{row.title}</dd></div>
              <div><dt>Autor</dt><dd>{row.authors}</dd></div>
              <div><dt>Ronda</dt><dd>F{row.numeroFase}.{row.ronda}</dd></div>
              <div><dt>Versión</dt><dd>{row.versionLabel}</dd></div>
              <div><dt>Tipo de validación</dt><dd>{row.validationType}</dd></div>
              <div><dt>Fecha límite</dt><dd><Deadline row={row} /></dd></div>
              <div><dt>Estado</dt><dd><WorkStatus row={row} /></dd></div>
              <div><dt>Especialista</dt><dd>{d.specialist ?? 'Sin asignar'}</dd></div>
              <div><dt>Diseñador</dt><dd>{d.designer ?? 'Sin asignar'}</dd></div>
              <div><dt>Solicitada</dt><dd>{soporteEditorialDate(d.requestedAt, true)}</dd></div>
              {d.startedAt && <div><dt>Iniciada</dt><dd>{soporteEditorialDate(d.startedAt, true)}</dd></div>}
            </dl>
          </section>
          <section className="mw-next-step"><span>Siguiente paso</span><p>{STATUS_HELP[row.status](d)}</p></section>
          {row.actionable && row.deadlineState === 'vencido' && <div className="eo-blocker"><RrppIcon nombre="riesgo" /><div><strong>Esta validación está vencida.</strong><p>Por favor revisa los materiales y registra tus observaciones.</p></div></div>}
          {d.previousRound && <p className="mw-caption">Proviene de Ronda {d.previousRound.label}.</p>}
        </>}
        {tab === 'materiales' && <section><h4>Material de esta ronda</h4><p className="mw-caption">Solo los archivos necesarios para validar esta ronda.</p>
          {d.materials.length ? <div className="eo-drive-links">{d.materials.map(m => <a href={m.url} key={m.role} target="_blank" rel="noreferrer"><RrppIcon nombre={(MATERIAL_LABEL[m.role] ?? 'proyectos') as Parameters<typeof RrppIcon>[0]['nombre']} /><span>{m.label}</span><RrppIcon nombre="externo" /></a>)}</div> : <EditorEmpty>Sin material vinculado a esta ronda.</EditorEmpty>}
        </section>}
        {tab === 'observaciones' && <>
          {row.status === 'new_round' && <section><h4>Inicia la validación</h4><p className="mw-caption">Inicia la revisión para habilitar la lista de criterios y registrar tu resultado.</p>
            {error && <p role="alert" className="eo-error">{error}</p>}
            <button className="ec-primary" disabled={busy} onClick={iniciar}>{busy ? 'Iniciando…' : 'Iniciar validación'}</button>
          </section>}
          {row.status === 'in_review' && <>
            {d.criteria.some(c => c.key === 'logo_coleccion') && <EscalarColeccion id={id} />}
            <ResolveForm key={id} id={id} d={d} onDone={msg => { changeTab('detalle'); setSuccess(msg); }} />
          </>}
          {(row.status === 'waiting_design' || row.status === 'completed') && <section><h4>Resultado registrado</h4>
            <dl className="eo-facts mw-context">
              <div><dt>Resultado</dt><dd>{d.approved ? 'Aprobada' : 'Devuelta con comentarios'}</dd></div>
              <div><dt>Comentarios</dt><dd>{d.commentsCount ?? 0}</dd></div>
              {(d.toVerifyChanges !== null || d.pendingChanges !== null || d.newChanges !== null) && <div><dt>Cambios</dt><dd>Por verificar: {d.toVerifyChanges ?? 0} · Pendientes: {d.pendingChanges ?? 0} · Nuevos: {d.newChanges ?? 0}</dd></div>}
              {d.pagesReviewed !== null && <div><dt>Páginas revisadas</dt><dd>{d.pagesReviewed}</dd></div>}
              {d.resolvedAt && <div><dt>Registrado</dt><dd>{soporteEditorialDate(d.resolvedAt, true)}</dd></div>}
            </dl>
            {d.observations && <p className="mw-caption">{d.observations}</p>}
            {d.criteria.length > 0 && <details className="se-criteria-review"><summary>Criterios revisados</summary><ul>{d.criteria.map(c => <li key={c.key}>{c.label}: {c.cumple === null ? 'No aplica' : c.cumple ? 'Cumple' : 'Corrección requerida'}{c.observaciones ? ` · ${c.observaciones}` : ''}</li>)}</ul></details>}
          </section>}
        </>}
        {tab === 'historial' && <section><h4>Historial de esta ronda</h4>{d.history.length ? <ul className="eo-history mw-history">{d.history.map(h => <li key={h.id}><strong>{h.label}</strong><small>{soporteEditorialDate(h.at, true)}</small></li>)}</ul> : <EditorEmpty>Sin actividad registrada.</EditorEmpty>}</section>}
        {success && <p role="status" className="eo-success">{success}</p>}
        <Link className="eo-project-link" to={miTrabajoUrl()}>Ver todo mi trabajo<RrppIcon nombre="flecha" /></Link>
      </div>
    </>}
  </EditorDetail>;
}
