import './editor.css';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
import { EditorialCover } from '../jefeEdicion/EditorialParts';
import { Badge } from '../jefeEdicion/EditorialProjects';
import { EditorEmpty, editorialDate } from './EditorParts';
import { editorKey, fetchMiProyectoDetalle, fetchMisProyectos } from './editorApi';

export function EditorMisProyectos() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const selected = params.get('project');
  useEffect(() => { const t = setTimeout(() => setParams(p => { search ? p.set('search', search) : p.delete('search'); p.delete('page'); return p; }), 300); return () => clearTimeout(t); }, [search]);
  const queryParams = new URLSearchParams({ search: params.get('search') ?? '', page: params.get('page') ?? '1', pageSize: '25', sort: 'activity' });
  const q = useQuery({ queryKey: [...editorKey, 'mis-proyectos', queryParams.toString()], queryFn: () => fetchMisProyectos(queryParams), placeholderData: p => p });
  const items = q.data?.items ?? [];

  return <div className={'ep-module' + (selected ? ' has-detail' : '')}>
    <div className="ep-main">
      <div className="ec-kpis">{q.data && <>
        <div className="ec-kpi ep-kpi-static"><span className="ec-kpi-icon"><RrppIcon nombre="proyectos" /></span><span><strong>{q.data.counts.inEditing}</strong><b>Proyectos activos</b><small>En los que participas actualmente</small></span></div>
        <div className="ec-kpi ep-kpi-static"><span className="ec-kpi-icon"><RrppIcon nombre="calendario" /></span><span><strong>{q.data.counts.upcomingDeliveries}</strong><b>Con entrega próxima</b><small>Fechas próximas registradas</small></span></div>
        <div className="ec-kpi ep-kpi-static"><span className="ec-kpi-icon"><RrppIcon nombre="proceso" /></span><span><strong>{q.data.counts.waitingAuthor}</strong><b>Esperando autor</b><small>Señal operacional, no negativa</small></span></div>
      </>}</div>
      <div className="ea-filterbar"><label className="ea-search"><span>Buscar</span><input type="search" placeholder="Buscar por proyecto o autor…" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
      {q.isError ? <p className="ec-empty" role="alert">No se pudieron cargar tus proyectos. <button onClick={() => q.refetch()}>Reintentar</button></p> : q.isPending ? <p role="status" className="ec-empty">Cargando…</p> : items.length ? <div className="ea-cards">{items.map(p => <article key={p.projectId} className="ec-panel ep-project-card" onClick={() => setParams(sp => { sp.set('project', p.projectId); return sp; })}>
        <div className="ec-project"><EditorialCover url={p.coverUrl} /><span><strong>{p.title}</strong><small>#{p.code} · {p.authors}</small></span></div>
        <Badge state={p.editorialState} />
        <p className="ep-summary">{p.interventionSummary}</p>
        {p.progress && <p className="ec-caption">{p.progress.completedUnits} / {p.progress.totalUnits} {p.progress.unitLabel}</p>}
        <dl className="ec-detail-grid">
          <div><dt>Especialista</dt><dd>{p.specialist ?? 'Sin asignar'}</dd></div>
          <div><dt>Próxima entrega</dt><dd>{p.nextDelivery ? editorialDate(p.nextDelivery.date) : 'Sin fecha'}</dd></div>
          <div><dt>Última actualización</dt><dd>{p.lastActivity ? editorialDate(p.lastActivity.at) : '—'}</dd></div>
        </dl>
      </article>)}</div> : <EditorEmpty>No tienes proyectos editoriales activos.</EditorEmpty>}
    </div>
    {selected && <ProyectoDetail id={selected} onClose={() => setParams(sp => { sp.delete('project'); return sp; })} />}
  </div>;
}

function ProyectoDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({ queryKey: [...editorKey, 'mi-proyecto-detalle', id], queryFn: () => fetchMiProyectoDetalle(id) });
  const d = q.data;
  return <aside className="ep-detail" aria-label="Detalle del proyecto">
    <header className="ep-detail-head"><button className="ep-close" aria-label="Cerrar detalle" onClick={onClose}>×</button>
      {d && <><EditorialCover url={d.summary.coverUrl} /><div><h3>{d.summary.title}</h3><p>#{d.summary.code} · {d.summary.authors}</p></div><span className="ea-service">{d.summary.service}</span></>}
    </header>
    {q.isPending ? <p role="status" className="ec-empty">Cargando…</p> : q.isError ? <p role="alert" className="ec-empty">No se pudo cargar el proyecto. <button onClick={() => q.refetch()}>Reintentar</button></p> : d && <div className="ep-resumen">
      <dl className="ec-detail-grid">
        <div><dt>Estado</dt><dd><Badge state={d.summary.editorialState} /></dd></div>
        <div><dt>Especialista</dt><dd>{d.summary.specialist ?? 'Sin asignar'}</dd></div>
      </dl>
      <p className="ep-next-step"><strong>Mi participación actual</strong><br />{d.nextStep}</p>
      <div><h4>Mis intervenciones en este proyecto</h4><ul className="ep-history">{d.interventions.map(i => <li key={i.id}><Link to={'/?vista=mi-trabajo&workItem=' + i.id}><strong>{i.label}</strong></Link><small><Badge state={i.state} /> · {editorialDate(i.dueDate)}</small></li>)}</ul></div>
      {(d.drive.rootUrl || d.drive.links.length > 0) && <div className="ep-drive"><h4>Drive</h4><ul>
        {d.drive.rootUrl && <li><a href={d.drive.rootUrl} target="_blank" rel="noreferrer"><RrppIcon nombre="externo" className="h-4 w-4" />Abrir carpeta de Edición</a></li>}
        {d.drive.links.map(l => <li key={l.key}><a href={l.url} target="_blank" rel="noreferrer"><RrppIcon nombre="externo" className="h-4 w-4" />{l.label}</a></li>)}
      </ul></div>}
      {d.history.length > 0 && <div><h4>Historial</h4><ul className="ep-history">{d.history.map(h => <li key={h.id}><strong>{h.label}</strong><small>{h.actor} · {editorialDate(h.at, true)}</small></li>)}</ul></div>}
    </div>}
  </aside>;
}
