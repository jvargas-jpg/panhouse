import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import type { EditorialTrackingDetail, EditorialTrackingTab } from '../../../shared/editorialChief';
import { editorialKey, exportarSeguimientoEdicion, fetchEditorialTracking, fetchEditorialTrackingDetail } from './jefeEdicionApi';
import { EditorialCover, EditorialEmpty, editorialDate } from './EditorialParts';
import { EditorialRowsSkeleton } from './EditorialAssignments';
import { Badge } from './EditorialProjects';
import { RrppIcon } from '../rrpp/RrppIcons';
import './editorialChief.css';
import './editorialProjects.css';
import './editorialTracking.css';

const TABS: [EditorialTrackingTab, string][] = [['priority', 'Prioritarios'], ['overdue', 'Vencidas'], ['risk', 'En riesgo'], ['blocked', 'Bloqueadas'], ['editing', 'En edición'], ['waiting', 'Esperando terceros'], ['all', 'Todas']];
const TAB_COUNT_KEY: Record<EditorialTrackingTab, 'overdue' | 'risk' | 'blocked' | 'waitingThirdParty' | 'priority' | 'all' | null> = { priority: 'priority', overdue: 'overdue', risk: 'risk', blocked: 'blocked', editing: null, waiting: 'waitingThirdParty', all: 'all' };
const RESPONSIBLE_LABEL: Record<string, string> = { editor: 'Editor', autor: 'Autor', especialista: 'Especialista' };

export function EditorialTracking() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? ''), [filtersOpen, setFiltersOpen] = useState(false);
  const tab = TABS.find(([id]) => id === params.get('tab'))?.[0] ?? 'priority';
  const selected = params.get('workItem');
  const update = (key: string, value: string) => setParams(p => { value ? p.set(key, value) : p.delete(key); p.delete('page'); return p; });
  const urlSearch = params.get('search') ?? '';
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  useEffect(() => { if (search === urlSearch) return; const timer = setTimeout(() => update('search', search), 300); return () => clearTimeout(timer); }, [search, urlSearch]);
  const queryParams = new URLSearchParams({ tab, page: params.get('page') ?? '1', pageSize: params.get('pageSize') ?? '10', sort: params.get('sort') ?? 'due' });
  for (const key of ['search', 'service', 'status', 'editor', 'responsible', 'interventionType', 'from', 'to']) if (params.get(key)) queryParams.set(key, params.get(key)!);
  const q = useQuery({ queryKey: [...editorialKey, 'tracking', queryParams.toString()], queryFn: () => fetchEditorialTracking(queryParams), placeholderData: previous => previous });
  const options = q.data?.options, rows = q.data?.items ?? [];
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState('');
  async function exportar() { setExporting(true); setExportError(''); try { await exportarSeguimientoEdicion(queryParams); } catch { setExportError('No se pudo exportar.'); } finally { setExporting(false); } }
  const clear = () => { setSearch(''); setParams(p => { for (const key of ['search', 'service', 'status', 'editor', 'responsible', 'interventionType', 'from', 'to', 'page']) p.delete(key); return p; }); };
  const cards = q.data ? [
    { label: 'Vencidas', value: q.data.counts.overdue, sub: 'Bajo responsabilidad del Editor', icon: 'actividad' as const },
    { label: 'En riesgo', value: q.data.counts.risk, sub: 'Vencen hoy, aún accionables', icon: 'riesgo' as const },
    { label: 'Bloqueadas', value: q.data.counts.blocked, sub: 'Con motivo de bloqueo explícito', icon: 'equipo' as const },
    { label: 'Esperando terceros', value: q.data.counts.waitingThirdParty, sub: 'Autor o Especialista', icon: 'proceso' as const },
  ] : [];
  return <div className={'ep-module' + (selected ? ' has-detail' : '')}>
    <div className="ep-main">
      <div className="ec-kpis">{q.isPending ? <EditorialRowsSkeleton label="Cargando resumen" /> : cards.map(c => <div key={c.label} className="ec-kpi ep-kpi-static"><span className="ec-kpi-icon"><RrppIcon nombre={c.icon} /></span><span><strong>{c.value}</strong><b>{c.label}</b><small>{c.sub}</small></span></div>)}</div>
      <div className="ea-tabs" role="tablist" aria-label="Estado de seguimiento">{TABS.map(([id, label]) => { const key = TAB_COUNT_KEY[id]; return <button key={id} role="tab" aria-selected={tab === id} onClick={() => update('tab', id)}>{label}{key && <span>{q.data?.counts[key] ?? '—'}</span>}</button>; })}</div>
      <div className="ea-filterbar">
        <label className="ea-search"><span>Buscar</span><input type="search" placeholder="Buscar por proyecto, autor, editor o capítulo…" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <button className="ea-filter-toggle ec-secondary" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>Filtros</button>
        <div className={'ea-filters ' + (filtersOpen ? 'is-open' : '')}>{filtersOpen && <button className="ea-filter-close" onClick={() => setFiltersOpen(false)}>Cerrar filtros ×</button>}
          <label>Servicio<select value={params.get('service') ?? ''} onChange={e => update('service', e.target.value)}><option value="">Todos</option>{(options?.services ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
          <label>Estado<select value={params.get('status') ?? ''} onChange={e => update('status', e.target.value)}><option value="">Todos</option>{(options?.states ?? []).map(s => <option key={s} value={s}>{s}</option>)}</select></label>
          <label>Editor<select value={params.get('editor') ?? ''} onChange={e => update('editor', e.target.value)}><option value="">Todos</option>{(options?.editors ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
          <label>Responsable actual<select value={params.get('responsible') ?? ''} onChange={e => update('responsible', e.target.value)}><option value="">Todos</option><option value="editor">Editor</option><option value="autor">Autor</option><option value="especialista">Especialista</option></select></label>
          <details className="ea-more-filters"><summary>Más filtros</summary><div>
            <label>Tipo de intervención<select value={params.get('interventionType') ?? ''} onChange={e => update('interventionType', e.target.value)}><option value="">Todos</option>{(options?.interventionTypes ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
            <label>Desde<input type="date" value={params.get('from') ?? ''} onChange={e => update('from', e.target.value)} /></label>
            <label>Hasta<input type="date" value={params.get('to') ?? ''} onChange={e => update('to', e.target.value)} /></label>
          </div></details>
          <button className="ea-clear" onClick={clear}>Limpiar filtros</button>{filtersOpen && <button className="ec-primary ea-filter-done" onClick={() => setFiltersOpen(false)}>Ver resultados</button>}
        </div>
        <button type="button" className="ea-export" onClick={() => void exportar()} disabled={exporting || !q.data}><RrppIcon nombre="externo" className="h-4 w-4" />{exporting ? 'Exportando…' : 'Exportar'}</button>
      </div>
      {exportError && <p role="alert" className="ec-empty">{exportError}</p>}
      <section className="ec-panel ep-table-panel"><header><RrppIcon nombre="proceso" /><h2>Intervenciones bajo supervisión</h2></header>
        <p className="ea-section-caption">Trabajo de Edición ya operativo: cada fila es una intervención, no un proyecto.</p>
        {q.isError ? <p className="ec-empty" role="alert">No se pudieron cargar las intervenciones. <button className="ea-link" onClick={() => q.refetch()}>Reintentar</button></p> : q.isPending ? <EditorialRowsSkeleton /> : rows.length ? <div className="ea-table-wrap"><table className="ea-table et-table"><thead><tr>{['Proyecto / Autor', 'Intervención', 'Servicio', 'Editor', 'Estado', 'Responsable', 'Fecha límite', 'Días', 'Acciones'].map(c => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{rows.map(i => <tr key={i.id} className={selected === i.id ? 'is-selected' : ''} onClick={() => update('workItem', i.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') update('workItem', i.id); }}>
            <td data-label="Proyecto / Autor"><div className="ec-project"><EditorialCover /><span><strong>{i.title}</strong><small>{i.authors}</small></span></div></td>
            <td data-label="Intervención">{i.label}</td>
            <td data-label="Servicio"><span className="ea-service">{i.serviceCode ?? i.service}</span></td>
            <td data-label="Editor">{i.editor ?? 'Por asignar'}</td>
            <td data-label="Estado"><Badge state={i.state} /></td>
            <td data-label="Responsable">{i.currentResponsible ? RESPONSIBLE_LABEL[i.currentResponsible] : '—'}</td>
            <td data-label="Fecha límite" className={i.overdue ? 'ec-deadline-overdue' : ''}>{editorialDate(i.dueDate)}</td>
            <td data-label="Días" className={i.overdue ? 'ec-deadline-overdue' : i.waitingOn ? 'et-neutral' : ''}>{i.daysLabel}</td>
            <td data-label="Acciones"><button className="ec-secondary" onClick={e => { e.stopPropagation(); update('workItem', i.id); }}>Ver seguimiento</button></td>
          </tr>)}</tbody></table></div> : <EditorialEmpty>{tab === 'priority' && !params.get('search') && !params.get('service') ? 'No hay intervenciones que requieran atención inmediata.' : params.get('search') || params.get('service') || params.get('status') || params.get('editor') ? <>No hay intervenciones que coincidan con estos filtros.<br /><button className="ea-link" onClick={clear}>Limpiar filtros</button></> : tab === 'overdue' ? 'No hay intervenciones vencidas.' : 'No hay intervenciones con estos filtros.'}</EditorialEmpty>}
        {q.data && !q.isError && <div className="ea-list-footer"><label>Por página<select value={params.get('pageSize') ?? '10'} onChange={e => update('pageSize', e.target.value)}>{[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <label>Ordenar<select value={params.get('sort') ?? 'due'} onChange={e => update('sort', e.target.value)}><option value="due">Fecha límite</option><option value="status">Estado</option><option value="editor">Editor</option><option value="project">Proyecto</option></select></label>
          <span>{q.data.total} intervenciones</span><button disabled={q.isFetching || q.data.page <= 1} onClick={() => setParams(p => { p.set('page', String(q.data!.page - 1)); return p; })}>‹</button><span>{q.data.page} / {q.data.pages}</span><button disabled={q.isFetching || q.data.page >= q.data.pages} onClick={() => setParams(p => { p.set('page', String(q.data!.page + 1)); return p; })}>›</button></div>}
      </section>
    </div>
    {selected && <EditorialTrackingQuickView id={selected} onClose={() => update('workItem', '')} />}
  </div>;
}

const DETAIL_TABS = [['resumen', 'Resumen'], ['historial', 'Historial'], ['archivos', 'Archivos']] as const;
function EditorialTrackingQuickView({ id, onClose }: { id: string; onClose: () => void }) {
  const [tab, setTab] = useState<typeof DETAIL_TABS[number][0]>('resumen');
  useEffect(() => setTab('resumen'), [id]);
  const q = useQuery({ queryKey: [...editorialKey, 'tracking-detail', id], queryFn: () => fetchEditorialTrackingDetail(id) });
  return <aside className="ep-detail" aria-label="Detalle de la intervención">
    <header className="ep-detail-head"><button className="ep-close" aria-label="Cerrar detalle" onClick={onClose}>×</button>
      {q.data && <><EditorialCover /><div><h3>{q.data.summary.label}</h3><p>{q.data.project.title} · {q.data.project.authors}</p></div><span className="ea-service">{q.data.project.service}</span></>}
    </header>
    {q.isPending ? <EditorialRowsSkeleton label="Cargando intervención" /> : q.isError ? <p role="alert" className="ec-empty">No se pudo cargar la intervención. <button onClick={() => q.refetch()}>Reintentar</button></p> : q.data && <>
      <div className="ep-tabs" role="tablist">{DETAIL_TABS.map(([tid, label]) => <button key={tid} role="tab" aria-selected={tab === tid} onClick={() => setTab(tid)}>{label}</button>)}</div>
      <div className="ep-tab-body" role="tabpanel">
        {tab === 'resumen' && <ResumenTab data={q.data} />}
        {tab === 'historial' && (q.data.history.length ? <ul className="ep-history">{q.data.history.map(h => <li key={h.id}><strong>{h.label}</strong><small>{h.actor} · {editorialDate(h.at, true)}</small></li>)}</ul> : <EditorialEmpty>No hay actividad de Edición registrada para esta intervención.</EditorialEmpty>)}
        {tab === 'archivos' && <ArchivosTab data={q.data} />}
      </div>
    </>}
  </aside>;
}

function ResumenTab({ data }: { data: EditorialTrackingDetail }) {
  const s = data.summary;
  return <div className="ep-resumen">
    <p className="et-responsible"><span>Responsable actual</span><strong className={'et-responsible-' + (s.currentResponsible ?? 'none')}>{s.currentResponsible ? RESPONSIBLE_LABEL[s.currentResponsible] : 'Sin responsable activo'}</strong></p>
    <dl className="ec-detail-grid">
      <div><dt>Tipo</dt><dd>{s.label}</dd></div>
      <div><dt>Estado</dt><dd><Badge state={s.state} /></dd></div>
      <div><dt>Editor asignado</dt><dd>{s.editor ?? 'Por asignar'}</dd></div>
      <div><dt>Especialista</dt><dd>{data.specialist ?? 'Sin asignar'}</dd></div>
      <div><dt>Fecha límite</dt><dd className={s.overdue ? 'ec-deadline-overdue' : ''}>{editorialDate(s.dueDate)}</dd></div>
      <div><dt>Tiempo</dt><dd className={s.overdue ? 'ec-deadline-overdue' : ''}>{s.daysLabel}</dd></div>
    </dl>
    {data.riskReason && <p className="ec-info"><strong>En riesgo</strong> · {data.riskReason}</p>}
    {data.blockerReason && <p className="ec-block"><strong>Bloqueo</strong> · {data.blockerReason}</p>}
    {s.waitingOn && <p className="ec-info">{s.state}. Esta espera no se atribuye como atraso del Editor.</p>}
    <p className="ep-next-step"><strong>Siguiente paso</strong><br />{data.nextStep}</p>
    <div className="ep-actions">
      <Link className="ec-secondary" to={`/?vista=proyectos-edicion&project=${data.project.id}`}>Ver en proyecto →</Link>
      <Link className="ec-secondary" to={`/?vista=asignaciones&search=${encodeURIComponent(data.project.code)}`}>Reasignar →</Link>
    </div>
    {data.siblings.length > 0 && <div className="et-siblings"><h4>Otras intervenciones de este proyecto</h4><ul>{data.siblings.map(sib => <li key={sib.id}><span>{sib.label}</span><Badge state={sib.state} /></li>)}</ul>
      {data.siblingsTotal > data.siblings.length && <Link className="ea-link" to={`/?vista=proyectos-edicion&project=${data.project.id}`}>Ver proyecto completo →</Link>}
    </div>}
  </div>;
}
function ArchivosTab({ data }: { data: EditorialTrackingDetail }) {
  if (!data.drive.rootUrl && !data.drive.links.length && !data.drive.files.length) return <EditorialEmpty>Este proyecto aún no tiene espacio documental de Edición disponible.</EditorialEmpty>;
  return <div className="ep-drive"><ul>
    {data.drive.files.map((f, n) => <li key={n}><a href={f.url} target="_blank" rel="noreferrer"><RrppIcon nombre="externo" className="h-4 w-4" />{f.label}</a></li>)}
    {data.drive.rootUrl && <li><a href={data.drive.rootUrl} target="_blank" rel="noreferrer"><RrppIcon nombre="externo" className="h-4 w-4" />Abrir carpeta de Edición</a></li>}
    {data.drive.links.map(l => <li key={l.key}><a href={l.url} target="_blank" rel="noreferrer"><RrppIcon nombre="externo" className="h-4 w-4" />{l.label}</a></li>)}
  </ul></div>;
}
