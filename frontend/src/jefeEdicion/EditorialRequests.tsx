import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import type { EditorialRequestDetail } from '../../../shared/editorialChief';
import { editorialKey, fetchEditorialRequestDetail, fetchEditorialRequests } from './jefeEdicionApi';
import { EditorialCover, EditorialEmpty, editorialDate } from './EditorialParts';
import { EditorialRowsSkeleton } from './EditorialAssignments';
import { RrppIcon } from '../rrpp/RrppIcons';
import './editorialChief.css';
import './editorialProjects.css';
import './editorialRequests.css';

const TABS = [['pending', 'Pendientes'], ['resolved', 'Resueltas'], ['all', 'Todas']] as const;

export function EditorialRequests({ onOpen }: { onOpen: (id: string) => void }) {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? ''), [filtersOpen, setFiltersOpen] = useState(false);
  const tab = TABS.find(([id]) => id === params.get('tab'))?.[0] ?? 'pending';
  const selected = params.get('selectedRequest');
  const update = (key: string, value: string) => setParams(p => { value ? p.set(key, value) : p.delete(key); p.delete('page'); return p; });
  const urlSearch = params.get('search') ?? '';
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  useEffect(() => { if (search === urlSearch) return; const timer = setTimeout(() => update('search', search), 300); return () => clearTimeout(timer); }, [search, urlSearch]);
  const queryParams = new URLSearchParams({ tab, page: params.get('page') ?? '1', pageSize: params.get('pageSize') ?? '10', sort: params.get('sort') ?? (tab === 'resolved' ? 'newest' : 'oldest') });
  for (const key of ['search', 'service', 'requester', 'from', 'to']) if (params.get(key)) queryParams.set(key, params.get(key)!);
  const q = useQuery({ queryKey: [...editorialKey, 'requests', queryParams.toString()], queryFn: () => fetchEditorialRequests(queryParams), placeholderData: previous => previous });
  const options = q.data?.options, rows = q.data?.items ?? [];
  const clear = () => { setSearch(''); setParams(p => { for (const key of ['search', 'service', 'requester', 'from', 'to', 'page']) p.delete(key); return p; }); };
  return <div className={'ep-module' + (selected ? ' has-detail' : '')}>
    <div className="ep-main">
      <div className="ec-kpis er-kpis">{q.isPending ? <EditorialRowsSkeleton label="Cargando resumen" /> : <>
        <div className="ec-kpi ep-kpi-static er-kpi-pending"><span className="ec-kpi-icon"><RrppIcon nombre="ingreso" /></span><span><strong>{q.data?.counts.pending ?? 0}</strong><b>Pendientes</b><small>Requieren tu decisión</small></span></div>
        <div className="ec-kpi ep-kpi-static"><span className="ec-kpi-icon"><RrppIcon nombre="check" /></span><span><strong>{q.data?.counts.resolved ?? 0}</strong><b>Resueltas</b><small>Historial de asignación</small></span></div>
      </>}</div>
      <div className="ea-tabs" role="tablist" aria-label="Estado de solicitudes">{TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => update('tab', id)}>{label} <span>{q.data?.counts[id] ?? '—'}</span></button>)}</div>
      <div className="ea-filterbar">
        <label className="ea-search"><span>Buscar</span><input type="search" placeholder="Buscar por proyecto, autor o solicitante…" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <button className="ea-filter-toggle ec-secondary" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>Filtros</button>
        <div className={'ea-filters ' + (filtersOpen ? 'is-open' : '')}>{filtersOpen && <button className="ea-filter-close" onClick={() => setFiltersOpen(false)}>Cerrar filtros ×</button>}
          <label>Servicio<select value={params.get('service') ?? ''} onChange={e => update('service', e.target.value)}><option value="">Todos</option>{(options?.services ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
          <label>Solicitado por<select value={params.get('requester') ?? ''} onChange={e => update('requester', e.target.value)}><option value="">Todos</option>{(options?.requesters ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
          <label>Desde<input type="date" value={params.get('from') ?? ''} onChange={e => update('from', e.target.value)} /></label>
          <label>Hasta<input type="date" value={params.get('to') ?? ''} onChange={e => update('to', e.target.value)} /></label>
          <button className="ea-clear" onClick={clear}>Limpiar filtros</button>{filtersOpen && <button className="ec-primary ea-filter-done" onClick={() => setFiltersOpen(false)}>Ver resultados</button>}
        </div>
      </div>
      <section className="ec-panel ep-table-panel"><header><RrppIcon nombre="ingreso" /><h2>Solicitudes de edición</h2></header>
        <p className="ea-section-caption">Asignaciones de Editor que requieren o requirieron tu decisión.</p>
        {q.isError ? <p className="ec-empty" role="alert">No se pudieron cargar las solicitudes. <button className="ea-link" onClick={() => q.refetch()}>Reintentar</button></p> : q.isPending ? <EditorialRowsSkeleton /> : rows.length ? <div className="ea-table-wrap"><table className="ea-table er-table"><thead><tr>{['Proyecto / Autor', 'Tipo', 'Resumen', 'Solicitado por', 'Fecha', 'Estado', 'Acción'].map(c => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{rows.map(r => <tr key={r.id} className={selected === r.id ? 'is-selected' : ''} onClick={() => update('selectedRequest', r.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') update('selectedRequest', r.id); }}>
            <td data-label="Proyecto / Autor"><div className="ec-project"><EditorialCover /><span><strong>{r.title}</strong><small>{r.authors}</small></span></div></td>
            <td data-label="Tipo"><span className="er-type">Asignación de Editor</span></td>
            <td data-label="Resumen">Solicita Editor para esta intervención.</td>
            <td data-label="Solicitado por">{r.requester ?? 'Sin registrar'}{r.requesterRole && <small className="ea-row-state">{r.requesterRole === 'especialista' ? 'Especialista' : r.requesterRole}</small>}</td>
            <td data-label="Fecha">{editorialDate(r.requestedAt)}</td>
            <td data-label="Estado"><span className={'ec-status ' + (r.status === 'pendiente' ? 'ec-amber' : 'ec-green')}>{r.status === 'pendiente' ? 'Pendiente' : 'Resuelta'}</span></td>
            <td data-label="Acción"><button className={r.status === 'pendiente' ? 'ec-primary' : 'ec-secondary'} onClick={e => { e.stopPropagation(); update('selectedRequest', r.id); }}>{r.status === 'pendiente' ? 'Revisar' : 'Ver detalle'}</button></td>
          </tr>)}</tbody></table></div> : <EditorialEmpty>{tab === 'pending' && !params.get('search') && !params.get('service') && !params.get('requester') ? <>No tienes solicitudes pendientes.<br />Las nuevas solicitudes que requieran tu decisión aparecerán aquí.</> : params.get('search') || params.get('service') || params.get('requester') ? <>Sin resultados con estos filtros.<br /><button className="ea-link" onClick={clear}>Limpiar filtros</button></> : 'No hay solicitudes de este tipo.'}</EditorialEmpty>}
        {q.data && !q.isError && <div className="ea-list-footer"><label>Por página<select value={params.get('pageSize') ?? '10'} onChange={e => update('pageSize', e.target.value)}>{[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <label>Ordenar<select value={params.get('sort') ?? (tab === 'resolved' ? 'newest' : 'oldest')} onChange={e => update('sort', e.target.value)}><option value="oldest">Más antigua primero</option><option value="newest">Más reciente primero</option><option value="project">Proyecto</option></select></label>
          <span>{q.data.total} solicitudes</span><button disabled={q.isFetching || q.data.page <= 1} onClick={() => setParams(p => { p.set('page', String(q.data!.page - 1)); return p; })}>‹</button><span>{q.data.page} / {q.data.pages}</span><button disabled={q.isFetching || q.data.page >= q.data.pages} onClick={() => setParams(p => { p.set('page', String(q.data!.page + 1)); return p; })}>›</button></div>}
      </section>
    </div>
    {selected && <EditorialRequestQuickView id={selected} onClose={() => update('selectedRequest', '')} onOpen={onOpen} />}
  </div>;
}

const DETAIL_TABS = [['resumen', 'Resumen'], ['contexto', 'Contexto'], ['historial', 'Historial']] as const;
function EditorialRequestQuickView({ id, onClose, onOpen }: { id: string; onClose: () => void; onOpen: (id: string) => void }) {
  const [tab, setTab] = useState<typeof DETAIL_TABS[number][0]>('resumen');
  useEffect(() => setTab('resumen'), [id]);
  const q = useQuery({ queryKey: [...editorialKey, 'request-detail', id], queryFn: () => fetchEditorialRequestDetail(id) });
  return <aside className="ep-detail" aria-label="Detalle de la solicitud">
    <header className="ep-detail-head"><button className="ep-close" aria-label="Cerrar detalle" onClick={onClose}>×</button>
      {q.data && <><EditorialCover /><div><h3>{q.data.summary.title}</h3><p>{q.data.summary.authors}</p></div><span className="ea-service">{q.data.summary.service}</span></>}
    </header>
    {q.isPending ? <EditorialRowsSkeleton label="Cargando solicitud" /> : q.isError ? <p role="alert" className="ec-empty">No se pudo cargar la solicitud. <button onClick={() => q.refetch()}>Reintentar</button></p> : q.data && <>
      <div className="ep-tabs" role="tablist">{DETAIL_TABS.map(([tid, label]) => <button key={tid} role="tab" aria-selected={tab === tid} onClick={() => setTab(tid)}>{label}</button>)}</div>
      <div className="ep-tab-body" role="tabpanel">
        {tab === 'resumen' && <ResumenTab data={q.data} onOpen={onOpen} />}
        {tab === 'contexto' && (q.data.context ? <ContextoTab data={q.data} /> : <EditorialEmpty>Sin contexto operativo disponible: el proceso de Edición de este proyecto ya avanzó más allá de la solicitud original.</EditorialEmpty>)}
        {tab === 'historial' && (q.data.history.length ? <ul className="ep-history">{q.data.history.map(h => <li key={h.id}><strong>{h.label}</strong><small>{h.actor} · {editorialDate(h.at, true)}</small></li>)}</ul> : <EditorialEmpty>No hay actividad registrada para esta solicitud.</EditorialEmpty>)}
      </div>
    </>}
  </aside>;
}

function ResumenTab({ data, onOpen }: { data: EditorialRequestDetail; onOpen: (id: string) => void }) {
  const s = data.summary;
  return <div className="ep-resumen">
    <dl className="ec-detail-grid">
      <div><dt>Tipo</dt><dd><span className="er-type">Asignación de Editor</span></dd></div>
      <div><dt>Estado</dt><dd><span className={'ec-status ' + (s.status === 'pendiente' ? 'ec-amber' : 'ec-green')}>{s.status === 'pendiente' ? 'Pendiente' : 'Resuelta'}</span></dd></div>
      <div><dt>Solicitado por</dt><dd>{s.requester ?? 'Sin registrar'}{s.requesterRole && <small>{s.requesterRole === 'especialista' ? 'Especialista' : s.requesterRole}</small>}</dd></div>
      <div><dt>Fecha de solicitud</dt><dd>{editorialDate(s.requestedAt, true)}</dd></div>
      <div><dt>Servicio</dt><dd>{s.service}</dd></div>
      <div><dt>Intervención</dt><dd>Inicio de edición</dd></div>
    </dl>
    {s.status === 'pendiente' ? <div className="ep-actions"><button className="ec-primary" onClick={() => onOpen(s.id)}>Revisar asignación →</button></div>
      : <div className="er-result"><h4>Resultado</h4><p><strong>Editor asignado:</strong> {s.resultEditor ?? 'Sin registrar'}</p><p><strong>Resuelto por:</strong> {s.resolvedBy ?? 'Sin registrar'} · {editorialDate(s.resolvedAt, true)}</p>
        <div className="ep-actions"><Link className="ec-secondary" to={`/?vista=proyectos-edicion&project=${s.projectId}`}>Abrir proyecto →</Link></div></div>}
  </div>;
}
function ContextoTab({ data }: { data: EditorialRequestDetail }) {
  const c = data.context!;
  return <dl className="ec-detail-grid">
    <div><dt>Estado de edición</dt><dd>{c.editorialState}</dd></div>
    <div><dt>Editor actual</dt><dd>{c.currentEditor ?? 'Por asignar'}</dd></div>
    <div><dt>Especialista</dt><dd>{c.specialist ?? 'Sin asignar'}</dd></div>
    <div><dt>Fecha límite</dt><dd>{editorialDate(c.deadline)}</dd></div>
    {c.blocker && <div><dt>Bloqueo</dt><dd>{c.blocker}</dd></div>}
    {c.waitingOn && <div><dt>Esperando</dt><dd>{c.waitingOn === 'author' ? 'Autor' : c.waitingOn === 'specialist' ? 'Especialista' : 'Reanudación'}</dd></div>}
  </dl>;
}
