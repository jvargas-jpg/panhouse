import '../editor/editor.css';
import '../editor/miTrabajo.css';
import './soporteDigitalHome.css';
import './soporteDigitalMiTrabajo.css';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { TopBar } from '../layout/TopBar';
import { PRODUCTION_LOGO } from '../layout/RoleProjectNavigation';
import { RrppIcon } from '../rrpp/RrppIcons';
import { EditorDetail, EditorSearch, EditorSelect, EditorSkeleton, useEditorDesktop, useEditorFilters } from '../editor/EditorUi';
import { EditorEmpty } from '../editor/EditorParts';
import { DigitalCover, DigitalMobileNavigation, DigitalNavigation, digitalDate, digitalWorkKey, miTrabajoUrl } from './SoporteDigitalUi';
import {
  fetchMiTrabajoDigital, fetchMiTrabajoDigitalArchivos, fetchMiTrabajoDigitalDetalle,
  guardarCampoDigital, marcarDigitalCompletado, registrarActivacionCuenta, registrarEnvioFormulario,
} from './soporteDigitalWorkApi';
import { DIGITAL_STAGE_LABELS } from '../../../shared/soporteDigitalHome';
import { DIGITAL_WORK_TABS, type DigitalWorkDetail, type DigitalWorkRow, type DigitalWorkTab } from '../../../shared/soporteDigitalWork';

const TAB_LABELS: Record<DigitalWorkTab, string> = { all: 'Todas', preparation: 'En preparación', testing: 'Para pruebas KDP', loaded: 'Cargas registradas', completed: 'Digital completado' };
const EMPTY: Record<DigitalWorkTab, string> = {
  all: 'No tienes tareas digitales pendientes actualmente.', preparation: 'No tienes proyectos en preparación.',
  testing: 'No tienes tareas de prueba pendientes.', loaded: 'No tienes cargas registradas todavía.', completed: 'Aún no tienes publicaciones digitales registradas.',
};
const todayCaracas = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function WorkStatus({ row }: { row: DigitalWorkRow }) {
  const label = !row.actionable && row.blocker ? row.blocker : row.actionable && row.deadlineState === 'overdue' ? 'Requiere atención' : row.status;
  const tone = !row.actionable ? 'neutral' : row.deadlineState === 'overdue' ? 'red' : 'blue';
  return <span className={'sd-badge sd-' + tone}><i aria-hidden="true" />{label}</span>;
}
function Deadline({ row }: { row: DigitalWorkRow }) {
  if (!row.deadline) return <span className="eo-muted">Sin fecha límite</span>;
  return <span title={digitalDate(row.deadline, true)} className={row.deadlineState === 'overdue' ? 'sd-overdue' : ''}>{digitalDate(row.deadline)}</span>;
}

export function SoporteDigitalMiTrabajo() {
  const { params, setParams, update, search, setSearch } = useEditorFilters();
  const tab = (DIGITAL_WORK_TABS as readonly string[]).includes(params.get('tab') ?? '') ? params.get('tab') as DigitalWorkTab : 'all';
  const selected = params.get('workItem');
  const pageSize = ['10', '25', '50'].includes(params.get('pageSize') ?? '') ? params.get('pageSize')! : '10';
  const queryParams = new URLSearchParams({ tab, search: params.get('search') ?? '', page: params.get('page') ?? '1', pageSize });
  if (params.get('project')) queryParams.set('project', params.get('project')!);
  const q = useQuery({ queryKey: [...digitalWorkKey, 'lista', queryParams.toString()], queryFn: () => fetchMiTrabajoDigital(queryParams), placeholderData: p => p });
  const rows = q.data?.items ?? [], options = q.data?.options;
  const desktop = useEditorDesktop();
  const detailId = selected ?? (desktop && params.get('detailClosed') !== '1' ? rows[0]?.workItemId : undefined);
  const hasFilters = !!params.get('project') || !!search;
  const clear = () => { setSearch(''); setParams({ vista: 'mi-trabajo' }); };
  const changeView = (key: string, value: string) => setParams(current => {
    const next = new URLSearchParams(current);
    value ? next.set(key, value) : next.delete(key);
    for (const field of ['workItem', 'detailClosed', 'detailTab']) next.delete(field);
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
  return <CrmSidebarLayout nav={<DigitalNavigation active="mi-trabajo" />} logo={PRODUCTION_LOGO} sidebarWidth={224} sidebarBreakpoint="lg" contentMaxWidth="max-w-none" shellClassName="soporte-digital-layout" contentClassName="soporte-digital-home editor-shell" footer={<p className="sd-footer">Historias que conectan.</p>}>
    <div className="sd-topbar"><div><RrppIcon nombre="libro" /><strong>Soporte Digital</strong></div><TopBar compacto roleLabel="Soporte Digital" /></div><DigitalMobileNavigation active="mi-trabajo" />
    <div className="sd-body">
      <nav className="sd-breadcrumb" aria-label="Ruta de navegación"><span>Soporte Digital</span><RrppIcon nombre="flecha" /><strong>Mi trabajo</strong></nav>
      <header className="sd-page-header"><div><h1>Mis tareas digitales</h1><p>Gestiona la preparación, pruebas y publicación digital de los proyectos activos.</p></div></header>
      <section className="mw-page" aria-label="Tareas digitales">
        <div className="mw-controls">
          <nav className="mw-views" aria-label="Filtrar tareas por etapa">{DIGITAL_WORK_TABS.map(id => <button key={id} type="button" aria-pressed={tab === id} onClick={() => changeView('tab', id)}>{TAB_LABELS[id]}<span>{q.data?.counts[id] ?? '—'}</span></button>)}</nav>
          <div className="mw-tools">
            <EditorSearch value={search} onChange={setSearch} placeholder="Buscar por proyecto, autor, código o tarea…" />
            <details className="mw-filters" ref={filterRef}><summary><RrppIcon nombre="lista" />Filtros{params.get('project') ? <span>1</span> : null}</summary><div className="mw-filter-panel">
              <header><strong>Filtrar tareas</strong><button type="button" aria-label="Cerrar filtros" onClick={() => { if (filterRef.current) filterRef.current.open = false; }}>×</button></header>
              <div className="mw-field"><span>Proyecto</span><EditorSelect label="Proyecto" value={params.get('project') ?? ''} onChange={v => changeView('project', v)} options={options?.projects ?? []} /></div>
              <footer><button type="button" className="eo-text-button" disabled={!hasFilters} onClick={clear}>Limpiar filtros</button><button type="button" className="ec-primary" onClick={() => { if (filterRef.current) filterRef.current.open = false; }}>Ver resultados</button></footer>
            </div></details>
          </div>
        </div>
        {hasFilters && <div className="mw-active-filters"><span>{q.data?.total ?? '—'} tareas encontradas</span><button className="eo-text-button" onClick={clear}>Limpiar filtros</button></div>}
        <div className="eo-workspace mw-workspace"><div className="eo-main">
          <section className="mw-list" aria-label="Tareas digitales" aria-busy={q.isFetching}>
            <div className="mw-list-heading"><h2>Tareas digitales</h2></div>
            {q.isError ? <EditorEmpty><span role="alert">No se pudieron cargar tus tareas digitales.</span> <button onClick={() => q.refetch()}>Reintentar</button></EditorEmpty> : q.isPending ? <EditorSkeleton label="Cargando tareas digitales" /> : rows.length ? <div className="eo-table-wrap"><table className="eo-table"><caption className="sr-only">Una fila por tarea digital. Selecciona una para consultar su detalle.</caption><thead><tr>{['Proyecto / Autor', 'Etapa / Tarea', 'Fecha límite', 'Estado', 'Última actividad', ''].map(c => <th scope="col" key={c}>{c || <span className="sr-only">Abrir detalle</span>}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.workItemId} aria-selected={detailId === r.workItemId} className={detailId === r.workItemId ? 'is-selected' : ''} tabIndex={0} onClick={() => update('workItem', r.workItemId)} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); update('workItem', r.workItemId); } }}>
              <td data-label="Proyecto / Autor"><div className="sd-identity"><DigitalCover url={r.coverUrl} /><div><strong>{r.projectTitle}</strong><span>{r.authors}</span><small>{r.projectCode}</small></div></div></td>
              <td data-label="Etapa / Tarea"><small className="sd-stage-label">{DIGITAL_STAGE_LABELS[r.stage]}</small><strong>{r.taskLabel}</strong></td>
              <td data-label="Fecha límite"><Deadline row={r} /></td>
              <td data-label="Estado"><WorkStatus row={r} /></td>
              <td data-label="Última actividad">{r.lastActivity ? <><strong title={digitalDate(r.lastActivity.at, true)}>{digitalDate(r.lastActivity.at)}</strong><small>{r.lastActivity.label}</small></> : <span className="eo-muted">Sin actividad</span>}</td>
              <td className="eo-chevron-cell"><button type="button" className="eo-row-action" aria-label={'Abrir tarea: ' + r.taskLabel + ' de ' + r.projectTitle} onClick={e => { e.stopPropagation(); update('workItem', r.workItemId); }}><span className="mw-mobile-open">Ver detalle</span><RrppIcon nombre="flecha" className="eo-row-chevron" /></button></td>
            </tr>)}</tbody></table></div> : <div className="mw-empty"><RrppIcon nombre="check" /><EditorEmpty>{hasFilters ? 'No hay tareas que coincidan con estos filtros.' : EMPTY[tab]}</EditorEmpty>{hasFilters && <button className="ec-secondary" onClick={clear}>Limpiar filtros</button>}</div>}
            {q.data && <footer className="mw-pagination"><span aria-live="polite">{q.data.total ? `${(q.data.page - 1) * Number(pageSize) + 1}–${Math.min(q.data.page * Number(pageSize), q.data.total)} de ${q.data.total}` : '0'} tareas</span><div><button aria-label="Página anterior" disabled={q.data.page <= 1 || q.isFetching} onClick={() => changeView('page', String(q.data!.page - 1))}>‹</button><span>{q.data.page} / {q.data.pages}</span><button aria-label="Página siguiente" disabled={q.data.page >= q.data.pages || q.isFetching} onClick={() => changeView('page', String(q.data!.page + 1))}>›</button><select aria-label="Tareas por página" value={pageSize} onChange={e => changeView('pageSize', e.target.value)}>{[10, 25, 50].map(n => <option key={n} value={n}>Mostrar {n}</option>)}</select></div></footer>}
          </section>
        </div>{detailId ? <WorkDetail key={detailId} id={detailId} open={!!selected} initialTab={params.get('detailTab')} onTabChange={t => update('detailTab', t === 'detalle' ? '' : t)} onClose={() => update({ workItem: '', detailClosed: '1', detailTab: '' })} /> : <div className="eo-detail-placeholder"><RrppIcon nombre="libro" /><p>Elige una tarea</p><small>Consulta el estado, los materiales y registra el siguiente paso.</small></div>}</div>
      </section>
    </div>
  </CrmSidebarLayout>;
}

const NEXT_ACTION_LABEL: Record<string, string> = {
  enviarFormulario: 'Enviar el formulario de activación Amazon',
  registrarActivacion: 'Registrar la activación de la cuenta Amazon',
  registrarPrueba: 'Registrar la prueba de archivos KDP',
  registrarCarga: 'Registrar la carga en KDP o Kindle',
  marcarCompletado: 'Marcar el control digital como completado',
};

function NextActionForm({ projectId, kind, onDone }: { projectId: string; kind: string; onDone: () => void }) {
  const [date, setDate] = useState(todayCaracas());
  const [dateKindle, setDateKindle] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit() {
    setBusy(true); setError('');
    try {
      if (kind === 'enviarFormulario') await registrarEnvioFormulario(projectId, date);
      else if (kind === 'registrarActivacion') await registrarActivacionCuenta(projectId, date);
      else if (kind === 'registrarPrueba') await guardarCampoDigital(projectId, 'pruebaArchivos', date);
      else if (kind === 'registrarCarga') { if (!date && !dateKindle) throw new Error('Indica al menos una fecha de carga.'); if (date) await guardarCampoDigital(projectId, 'cargaKdp', date); if (dateKindle) await guardarCampoDigital(projectId, 'cargaKindle', dateKindle); }
      else if (kind === 'marcarCompletado') await marcarDigitalCompletado(projectId, date);
      onDone();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo registrar el cambio.'); } finally { setBusy(false); }
  }
  return <form className="ep-form mw-delivery" onSubmit={e => e.preventDefault()}>
    <h4>{NEXT_ACTION_LABEL[kind]}</h4>
    {kind === 'registrarCarga' ? <div className="mw-field-row">
      <label>Carga KDP<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <label>Carga Kindle<input type="date" value={dateKindle} onChange={e => setDateKindle(e.target.value)} /></label>
    </div> : <label>Fecha<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>}
    {error && <p role="alert" className="eo-error">{error}</p>}
    <div className="eo-actions"><button type="button" className="ec-primary" disabled={busy} onClick={submit}>{busy ? 'Guardando…' : 'Registrar'}</button></div>
  </form>;
}

function Materials({ id, available }: { id: string; available: boolean }) {
  const q = useQuery({ queryKey: [...digitalWorkKey, 'archivos', id], queryFn: () => fetchMiTrabajoDigitalArchivos(id), enabled: available });
  if (!available) return <EditorEmpty>El paquete final todavía no está disponible. Diseño/Calidad debe entregarlo antes de poder probar archivos aquí.</EditorEmpty>;
  if (q.isPending) return <EditorSkeleton label="Cargando materiales" />;
  if (q.isError) return <EditorEmpty><span role="alert">No se pudieron cargar los materiales.</span> <button onClick={() => q.refetch()}>Reintentar</button></EditorEmpty>;
  if (!q.data.items.length) return <EditorEmpty>Sin archivos en la carpeta KDP todavía.</EditorEmpty>;
  return <div className="eo-drive-links">{q.data.items.map(f => <a href={f.url} key={f.id} target="_blank" rel="noreferrer"><RrppIcon nombre="proyectos" /><span>{f.name}</span><RrppIcon nombre="externo" /></a>)}</div>;
}

type DetailTab = 'detalle' | 'materiales' | 'amazon' | 'historial';
const DETAIL_TABS: readonly DetailTab[] = ['detalle', 'materiales', 'amazon', 'historial'];

function WorkDetail({ id, open, initialTab, onTabChange, onClose }: { id: string; open: boolean; initialTab: string | null; onTabChange: (t: DetailTab) => void; onClose: () => void }) {
  const qc = useQueryClient();
  const desktop = useEditorDesktop();
  const q = useQuery<DigitalWorkDetail>({ queryKey: [...digitalWorkKey, 'detalle', id], queryFn: () => fetchMiTrabajoDigitalDetalle(id) });
  const [tab, setTab] = useState<DetailTab>(DETAIL_TABS.includes(initialTab as DetailTab) ? initialTab as DetailTab : 'detalle');
  useEffect(() => { setTab(DETAIL_TABS.includes(initialTab as DetailTab) ? initialTab as DetailTab : 'detalle'); }, [initialTab]);
  const [success, setSuccess] = useState('');
  const changeTab = (t: DetailTab) => { setTab(t); setSuccess(''); onTabChange(t); };
  async function invalidate() {
    await qc.invalidateQueries({ predicate: p => digitalWorkKey.every((k, i) => p.queryKey[i] === k) });
    await qc.invalidateQueries({ queryKey: ['soporte-digital', 'inicio'] });
  }
  const d = q.data, row = d?.summary;
  return <EditorDetail title="Detalle de la tarea digital" modal={!desktop} open={open || desktop} onClose={onClose}>
    {q.isPending ? <EditorSkeleton label="Cargando tarea" /> : q.isError ? <EditorEmpty><span role="alert">No se pudo cargar la tarea.</span> <button onClick={() => q.refetch()}>Reintentar</button></EditorEmpty> : row && d && <>
      <div className="mw-detail-header eo-detail-project"><DigitalCover url={row.coverUrl} /><div><h3>{row.projectTitle}</h3><span>{row.authors} · {row.projectCode}</span><small>{DIGITAL_STAGE_LABELS[row.stage]}</small><WorkStatus row={row} /></div></div>
      <nav className="mw-detail-tabs" aria-label="Contenido de la tarea">{DETAIL_TABS.map(key => <button key={key} type="button" aria-pressed={tab === key} onClick={() => changeTab(key)}>{key === 'detalle' ? 'Detalle' : key === 'materiales' ? 'Materiales' : key === 'amazon' ? 'Amazon / KDP' : 'Historial'}</button>)}</nav>
      <div className="mw-detail-content">
        {tab === 'detalle' && <>
          <section className="mw-current"><h4><RrppIcon nombre="libro" />Información de la tarea</h4>
            <dl className="eo-facts mw-context">
              <div><dt>Proyecto</dt><dd>{row.projectTitle}</dd></div>
              <div><dt>Autor</dt><dd>{row.authors}</dd></div>
              <div><dt>Etapa</dt><dd>{DIGITAL_STAGE_LABELS[row.stage]}</dd></div>
              <div><dt>Tarea actual</dt><dd>{row.taskLabel}</dd></div>
              <div><dt>Fecha límite</dt><dd><Deadline row={row} /></dd></div>
              <div><dt>Estado</dt><dd><WorkStatus row={row} /></dd></div>
              <div><dt>Especialista</dt><dd>{d.specialist ?? 'Sin asignar'}</dd></div>
              <div><dt>Activada desde</dt><dd>{digitalDate(d.assignedAt, true)}</dd></div>
            </dl>
          </section>
          <section className="mw-next-step"><span>Siguiente paso</span><p>{row.blocker ? row.blocker : d.waitingOn ? `Esperando a ${d.waitingOn}.` : d.nextAction ? NEXT_ACTION_LABEL[d.nextAction.kind] : 'No hay ninguna acción pendiente de tu parte en esta tarea.'}</p></section>
          {row.actionable && row.deadlineState === 'overdue' && <div className="eo-blocker"><RrppIcon nombre="riesgo" /><div><strong>Esta tarea está vencida.</strong><p>Revisa el siguiente paso y regístralo lo antes posible.</p></div></div>}
          {d.nextAction && <NextActionForm projectId={row.projectId} kind={d.nextAction.kind} onDone={async () => { await invalidate(); setSuccess('Cambio registrado.'); }} />}
          {success && <p role="status" className="eo-success">{success}</p>}
        </>}
        {tab === 'materiales' && <section><h4>Material de esta tarea</h4><p className="mw-caption">Archivos reales del paquete final en la carpeta KDP del proyecto.</p><Materials id={id} available={d.materialsAvailable} /></section>}
        {tab === 'amazon' && <section><h4>Registro real de Amazon / KDP</h4><p className="mw-caption">Solo los datos que Soporte Digital ya registró en la ficha de este proyecto.</p>
          {d.catalog.map(group => <details className="se-criteria-review" key={group.label} open><summary>{group.label}</summary><dl className="eo-facts mw-context">{group.fields.map(f => <div key={f.key}><dt>{f.label}</dt><dd>{f.value ? (f.type === 'fecha' ? digitalDate(f.value) : f.value) : <span className="eo-muted">Sin registrar</span>}</dd></div>)}</dl></details>)}
        </section>}
        {tab === 'historial' && <section><h4>Historial de esta tarea</h4>{d.history.length ? <ul className="eo-history mw-history">{d.history.map(h => <li key={h.id}><strong>{h.label}</strong><small>{digitalDate(h.at, true)}</small></li>)}</ul> : <EditorEmpty>Sin actividad registrada.</EditorEmpty>}</section>}
        <Link className="eo-project-link" to={miTrabajoUrl()}>Ver todo mi trabajo<RrppIcon nombre="flecha" /></Link>
      </div>
    </>}
  </EditorDetail>;
}
