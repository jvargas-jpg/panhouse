import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import type { EditorialProjectDetail, EditorialProjectIntervention } from '../../../shared/editorialChief';
import { editorialKey, exportarProyectosEdicion, fetchEditorialProjectDetail, fetchEditorialProjects } from './jefeEdicionApi';
import { EditorialCover, EditorialEmpty, editorialDate } from './EditorialParts';
import { EditorialRowsSkeleton } from './EditorialAssignments';
import { RrppIcon } from '../rrpp/RrppIcons';
import './editorialChief.css';
import './editorialProjects.css';

const STATUS_CLASS: Record<string, string> = {
  'Bloqueadas': 'ec-red', 'Requiere ajustes': 'ec-amber', 'Esperando autor': 'ec-amber', 'Esperando Especialista': 'ec-amber',
  'En edición': 'ec-blue', 'Por iniciar': 'ec-gray', 'En pausa': 'ec-gray', 'Completadas': 'ec-green',
};
function Badge({ state }: { state: string }) { return <span className={'ec-status ' + (STATUS_CLASS[state] ?? 'ec-blue')}>{state}</span>; }

export function EditorialProjects() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? ''), [filtersOpen, setFiltersOpen] = useState(false);
  const selected = params.get('project');
  const update = (key: string, value: string) => setParams(p => { value ? p.set(key, value) : p.delete(key); p.delete('page'); return p; });
  const urlSearch = params.get('search') ?? '';
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  useEffect(() => { if (search === urlSearch) return; const timer = setTimeout(() => update('search', search), 300); return () => clearTimeout(timer); }, [search, urlSearch]);
  const queryParams = new URLSearchParams({ page: params.get('page') ?? '1', pageSize: params.get('pageSize') ?? '10', sort: params.get('sort') ?? 'activity' });
  for (const key of ['search', 'service', 'state', 'editor']) if (params.get(key)) queryParams.set(key, params.get(key)!);
  const q = useQuery({ queryKey: [...editorialKey, 'projects', queryParams.toString()], queryFn: () => fetchEditorialProjects(queryParams), placeholderData: previous => previous });
  const options = q.data?.options, rows = q.data?.items ?? [];
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState('');
  async function exportar() { setExporting(true); setExportError(''); try { await exportarProyectosEdicion(); } catch { setExportError('No se pudo exportar.'); } finally { setExporting(false); } }
  const clear = () => { setSearch(''); setParams(p => { for (const key of ['search', 'service', 'state', 'editor', 'page']) p.delete(key); return p; }); };
  const cards = q.data ? [
    { label: 'Proyectos en edición', value: q.data.counts.inEditing, sub: 'Con intervenciones activas', icon: 'proyectos' as const },
    { label: 'Con entregas próximas', value: q.data.counts.upcomingDeliveries, sub: 'En los próximos 7 días', icon: 'calendario' as const },
    { label: 'Con intervenciones vencidas', value: q.data.counts.overdue, sub: 'Bajo responsabilidad del Editor', icon: 'riesgo' as const },
    { label: 'En espera de autor', value: q.data.counts.waitingAuthor, sub: 'Feedback pendiente', icon: 'equipo' as const },
  ] : [];
  return <div className={'ep-module' + (selected ? ' has-detail' : '')}>
    <div className="ep-main">
      <div className="ec-kpis">{q.isPending ? <EditorialRowsSkeleton label="Cargando resumen" /> : cards.map(c => <div key={c.label} className="ec-kpi ep-kpi-static"><span className="ec-kpi-icon"><RrppIcon nombre={c.icon} /></span><span><strong>{c.value}</strong><b>{c.label}</b><small>{c.sub}</small></span></div>)}</div>
      <div className="ea-filterbar">
        <label className="ea-search"><span>Buscar</span><input type="search" placeholder="Buscar por proyecto, autor o Editor…" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <button className="ea-filter-toggle ec-secondary" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>Filtros</button>
        <div className={'ea-filters ' + (filtersOpen ? 'is-open' : '')}>{filtersOpen && <button className="ea-filter-close" onClick={() => setFiltersOpen(false)}>Cerrar filtros ×</button>}
          <label>Servicio<select value={params.get('service') ?? ''} onChange={e => update('service', e.target.value)}><option value="">Todos</option>{(options?.services ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
          <label>Estado de edición<select value={params.get('state') ?? ''} onChange={e => update('state', e.target.value)}><option value="">Todos</option>{(options?.states ?? []).map(s => <option key={s} value={s}>{s}</option>)}</select></label>
          <label>Editor<select value={params.get('editor') ?? ''} onChange={e => update('editor', e.target.value)}><option value="">Todos</option>{(options?.editors ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
          <button className="ea-clear" onClick={clear}>Limpiar filtros</button>{filtersOpen && <button className="ec-primary ea-filter-done" onClick={() => setFiltersOpen(false)}>Ver resultados</button>}
        </div>
        <button type="button" className="ea-export" onClick={() => void exportar()} disabled={exporting || !q.data}><RrppIcon nombre="externo" className="h-4 w-4" />{exporting ? 'Exportando…' : 'Exportar'}</button>
      </div>
      {exportError && <p role="alert" className="ec-empty">{exportError}</p>}
      <section className="ec-panel ep-table-panel"><header><RrppIcon nombre="proyectos" /><h2>Lista de proyectos de edición</h2></header>
        <p className="ea-section-caption">Estado actual de los proyectos y sus intervenciones editoriales.</p>
        {q.isError ? <p className="ec-empty" role="alert">No se pudieron cargar los proyectos. <button className="ea-link" onClick={() => q.refetch()}>Reintentar</button></p> : q.isPending ? <EditorialRowsSkeleton /> : rows.length ? <div className="ea-table-wrap"><table className="ea-table ep-table"><thead><tr>{['Proyecto / Autor', 'Servicio', 'Intervenciones', 'Estado actual', 'Editor actual', 'Próxima entrega', 'Última actividad'].map(c => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{rows.map(p => <tr key={p.projectId} className={selected === p.projectId ? 'is-selected' : ''} onClick={() => update('project', p.projectId)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') update('project', p.projectId); }}>
            <td data-label="Proyecto / Autor"><div className="ec-project"><EditorialCover /><span><strong>{p.title}</strong><small>{p.authors}</small></span></div></td>
            <td data-label="Servicio"><span className="ea-service">{p.serviceCode ?? p.service}</span></td>
            <td data-label="Intervenciones"><span className="ep-summary">{p.interventionSummary}</span></td>
            <td data-label="Estado actual"><Badge state={p.editorialState} />{p.risk && p.editorialState !== 'Bloqueadas' && <small className="ea-row-state">En riesgo</small>}</td>
            <td data-label="Editor actual">{p.multipleEditors ? `${p.editorCount} Editores` : p.editor ?? 'Por asignar'}</td>
            <td data-label="Próxima entrega" className={p.overdue ? 'ec-deadline-overdue' : ''}>{p.nextDelivery ? <>{p.nextDelivery.label}<br /><small>{editorialDate(p.nextDelivery.date)}</small></> : 'Sin fecha pautada'}</td>
            <td data-label="Última actividad">{p.lastActivity ? <>{editorialDate(p.lastActivity.at)}<br /><small>{p.lastActivity.label}</small></> : 'Sin registro'}</td>
          </tr>)}</tbody></table></div> : <EditorialEmpty>{params.get('search') || params.get('service') || params.get('state') || params.get('editor') ? <>No hay proyectos de Edición con estos filtros.<br /><button className="ea-link" onClick={clear}>Limpiar filtros</button></> : 'No hay proyectos con proceso de Edición activo.'}</EditorialEmpty>}
        {q.data && !q.isError && <div className="ea-list-footer"><label>Por página<select value={params.get('pageSize') ?? '10'} onChange={e => update('pageSize', e.target.value)}>{[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <label>Ordenar<select value={params.get('sort') ?? 'activity'} onChange={e => update('sort', e.target.value)}><option value="activity">Última actividad</option><option value="delivery">Próxima entrega</option><option value="title">Título</option><option value="state">Estado</option><option value="editor">Editor</option></select></label>
          <span>{q.data.total} proyectos</span><button disabled={q.isFetching || q.data.page <= 1} onClick={() => setParams(p => { p.set('page', String(q.data!.page - 1)); return p; })}>‹</button><span>{q.data.page} / {q.data.pages}</span><button disabled={q.isFetching || q.data.page >= q.data.pages} onClick={() => setParams(p => { p.set('page', String(q.data!.page + 1)); return p; })}>›</button></div>}
      </section>
    </div>
    {selected && <EditorialProjectQuickView projectId={selected} onClose={() => update('project', '')} />}
  </div>;
}

const TABS = [['resumen', 'Resumen'], ['intervenciones', 'Intervenciones'], ['archivos', 'Archivos'], ['historial', 'Historial']] as const;
function EditorialProjectQuickView({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [tab, setTab] = useState<typeof TABS[number][0]>('resumen');
  useEffect(() => setTab('resumen'), [projectId]);
  const q = useQuery({ queryKey: [...editorialKey, 'project-detail', projectId], queryFn: () => fetchEditorialProjectDetail(projectId) });
  return <aside className="ep-detail" aria-label="Detalle del proyecto de edición">
    <header className="ep-detail-head"><button className="ep-close" aria-label="Cerrar detalle" onClick={onClose}>×</button>
      {q.data && <><EditorialCover /><div><h3>{q.data.summary.title}</h3><p>{q.data.summary.authors}</p></div><span className="ea-service">{q.data.summary.serviceCode ?? q.data.summary.service}</span></>}
    </header>
    {q.isPending ? <EditorialRowsSkeleton label="Cargando proyecto" /> : q.isError ? <p role="alert" className="ec-empty">No se pudo cargar el proyecto. <button onClick={() => q.refetch()}>Reintentar</button></p> : q.data && <>
      <div className="ep-tabs" role="tablist">{TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
      <div className="ep-tab-body" role="tabpanel">
        {tab === 'resumen' && <ResumenTab data={q.data} />}
        {tab === 'intervenciones' && <IntervencionesTab data={q.data} />}
        {tab === 'archivos' && <ArchivosTab data={q.data} />}
        {tab === 'historial' && <HistorialTab data={q.data} />}
      </div>
    </>}
  </aside>;
}

function ResumenTab({ data }: { data: EditorialProjectDetail }) {
  const s = data.summary;
  return <div className="ep-resumen"><dl className="ec-detail-grid">
    <div><dt>Estado de edición</dt><dd><Badge state={s.editorialState} />{s.risk && <small className="ea-row-state">En riesgo</small>}</dd></div>
    <div><dt>Editor actual</dt><dd>{s.multipleEditors ? `${s.editorCount} Editores en intervenciones distintas` : s.editor ?? 'Por asignar'}</dd></div>
    <div><dt>Especialista</dt><dd>{s.specialist ?? 'Sin asignar'}</dd></div>
    <div><dt>Servicio</dt><dd>{s.service}</dd></div>
    <div><dt>Responsable actual</dt><dd>{s.responsibleNow === 'editor' ? 'Editor' : s.responsibleNow === 'especialista' ? 'Especialista' : s.responsibleNow === 'autor' ? 'Autor' : 'Sin responsable activo'}</dd></div>
    <div><dt>Próxima entrega</dt><dd className={s.nextDelivery && s.overdue ? 'ec-deadline-overdue' : ''}>{s.nextDelivery ? `${s.nextDelivery.label} · ${editorialDate(s.nextDelivery.date)}` : 'Sin fecha pautada'}</dd></div>
    <div><dt>Última actividad</dt><dd>{s.lastActivity ? `${editorialDate(s.lastActivity.at)} · ${s.lastActivity.label}` : 'Sin registro'}</dd></div>
  </dl>
    {s.blocker && <p className="ec-block"><strong>Bloqueo</strong> · {s.blocker}</p>}
    <p className="ep-next-step"><strong>Siguiente paso</strong><br />{data.nextStep}</p>
    <div className="ep-actions">{!s.editor && !s.multipleEditors && <Link className="ec-primary" to={`/?vista=asignaciones&search=${encodeURIComponent(s.code)}`}>Asignar Editor →</Link>}
      <Link className="ec-secondary" to={`/?vista=seguimiento-edicion&search=${encodeURIComponent(s.code)}`}>Ver en Seguimiento →</Link></div>
  </div>;
}
function IntervencionesTab({ data }: { data: EditorialProjectDetail }) {
  if (!data.interventions.length) return <EditorialEmpty>No hay intervenciones registradas.</EditorialEmpty>;
  return <div className="ep-interventions"><ul>{data.interventions.map((i: EditorialProjectIntervention) => <li key={i.id}><div><strong>{i.label}</strong><Badge state={i.state} /></div><p>{i.editor ?? 'Por asignar'}{i.waitingOn && <span className="ea-row-state"> · Esperando {i.waitingOn === 'author' ? 'al autor' : i.waitingOn === 'specialist' ? 'al Especialista' : 'reanudación'}</span>}</p><span className={i.overdue ? 'ec-deadline-overdue' : ''}>{i.dueDate ? editorialDate(i.dueDate) : i.deliveredAt ? `Entregado ${editorialDate(i.deliveredAt)}` : 'Sin fecha'}</span></li>)}</ul>
    {data.interventionsTotal > data.interventions.length && <Link className="ea-link" to={`/?vista=seguimiento-edicion&search=${encodeURIComponent(data.summary.code)}`}>Ver todas ({data.interventionsTotal}) en Seguimiento →</Link>}
  </div>;
}
function ArchivosTab({ data }: { data: EditorialProjectDetail }) {
  if (!data.drive.rootUrl && !data.drive.links.length) return <EditorialEmpty>Este proyecto aún no tiene espacio documental de Edición disponible.</EditorialEmpty>;
  return <div className="ep-drive"><ul>
    {data.drive.rootUrl && <li><a href={data.drive.rootUrl} target="_blank" rel="noreferrer"><RrppIcon nombre="externo" className="h-4 w-4" />Abrir carpeta de Edición</a></li>}
    {data.drive.links.map(l => <li key={l.key}><a href={l.url} target="_blank" rel="noreferrer"><RrppIcon nombre="externo" className="h-4 w-4" />{l.label}</a></li>)}
  </ul></div>;
}
function HistorialTab({ data }: { data: EditorialProjectDetail }) {
  if (!data.history.length) return <EditorialEmpty>No hay actividad de Edición registrada.</EditorialEmpty>;
  return <ul className="ep-history">{data.history.map(h => <li key={h.id}><strong>{h.label}</strong><small>{h.actor} · {editorialDate(h.at, true)}</small></li>)}</ul>;
}
