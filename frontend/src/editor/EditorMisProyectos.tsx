import './editor.css';
import './misProyectos.css';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
import { EditorialCover } from '../jefeEdicion/EditorialParts';
import { EditorEmpty, editorialDate } from './EditorParts';
import { EditorDetail, EditorSearch, EditorSelect, EditorSkeleton, useEditorFilters, useEditorDesktop } from './EditorUi';
import { fechaActividad } from '../rrpp/RrppDashboardCards';
import { editorKey, fetchMiProyectoDetalle, fetchMisProyectos } from './editorApi';
import type { EditorProjectRow, EditorProjectWork } from '../../../shared/editorProjects';

const TABS = [['summary', 'Resumen'], ['interventions', 'Intervenciones'], ['material', 'Material'], ['deliveries', 'Entregas'], ['feedback', 'Feedback']] as const;
const FILTERS = ['state', 'service', 'specialist', 'participation'];
const workUrl = (projectId: string, workItemId: string) => '/?' + new URLSearchParams({ vista: 'mi-trabajo', project: projectId, workItem: workItemId });
const date = (value: string | null) => value ? new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value.length === 10 ? value + 'T12:00:00Z' : value)) : 'Sin fecha límite';
function ProjectStatus({ project }: { project: EditorProjectRow }) {
  const label = project.stateLabel ?? project.editorialState;
  const color = label === 'Bloqueado' ? 'red' : label === 'Requiere ajustes' ? 'violet' : label === 'En edición' ? 'amber' : label === 'Edición finalizada' ? 'green' : 'neutral';
  return <span className={'ec-status ec-' + color}><i aria-hidden="true" />{label}</span>;
}
function WorkStatus({ item }: { item: EditorProjectWork }) {
  const label = item.historical ? 'Entrega registrada' : item.state === 'Bloqueadas' ? 'Bloqueada' : item.overdue && !item.waitingOn ? 'Vencida' : item.state === 'Completadas' ? 'Completada' : !item.startedAt && item.actionable && item.state !== 'Requiere ajustes' ? 'Por iniciar' : item.state;
  const color = /Bloqueada|Vencida/.test(label) ? 'red' : label === 'Requiere ajustes' ? 'violet' : /Completada|Entrega registrada/.test(label) ? 'green' : label === 'En edición' ? 'amber' : 'neutral';
  return <span className={'ec-status ec-' + color}><i aria-hidden="true" />{label}</span>;
}
export function EditorMisProyectos() {
  const { params, setParams, search, setSearch } = useEditorFilters();
  const selected = params.get('project'), desktop = useEditorDesktop();
  const pageSize = ['10', '25', '50'].includes(params.get('pageSize') ?? '') ? params.get('pageSize')! : '25';
  const queryParams = new URLSearchParams({ search: params.get('search') ?? '', page: params.get('page') ?? '1', pageSize, sort: params.get('sort') ?? 'priority' });
  for (const key of FILTERS) if (params.get(key)) queryParams.set(key, params.get(key)!);
  const q = useQuery({ queryKey: [...editorKey, 'mis-proyectos', queryParams.toString()], queryFn: () => fetchMisProyectos(queryParams), placeholderData: p => p });
  const items = q.data?.items ?? [];
  const detailId = selected ?? (desktop && params.get('projectClosed') !== '1' ? items[0]?.projectId : undefined);
  const filterActive = !!search || FILTERS.some(k => params.has(k));
  const change = (key: string, value: string) => setParams(current => {
    const next = new URLSearchParams(current);
    value ? next.set(key, value) : next.delete(key);
    if (!['project', 'detailTab'].includes(key)) {
      for (const field of ['project', 'detailTab', 'projectClosed']) next.delete(field);
      if (key !== 'page') next.delete('page');
    }
    return next;
  });
  const close = () => setParams(current => { const next = new URLSearchParams(current); next.delete('project'); next.delete('detailTab'); next.set('projectClosed', '1'); return next; });
  const clear = () => { setSearch(''); setParams({ vista: 'mis-proyectos' }); };
  return <section className="mp-page" aria-label="Portafolio editorial personal">
    <div className="mp-toolbar">
      <EditorSearch value={search} onChange={setSearch} placeholder="Buscar proyecto, autor o código…" />
      <EditorSelect label="Estado editorial" value={params.get('state') ?? ''} onChange={v => change('state', v)} options={(q.data?.options.states ?? []).map(s => ({ id: s, name: s }))} />
      <EditorSelect label="Servicio" value={params.get('service') ?? ''} onChange={v => change('service', v)} options={q.data?.options.services ?? []} />
      <EditorSelect label="Mi participación" value={params.get('participation') ?? ''} onChange={v => change('participation', v)} options={[{ id: 'active', name: 'Participación activa' }, { id: 'history', name: 'Participación histórica' }]} />
      {((q.data?.options.specialists.length ?? 0) > 1 || params.has('specialist')) && <EditorSelect label="Especialista" value={params.get('specialist') ?? ''} onChange={v => change('specialist', v)} options={q.data?.options.specialists ?? []} />}
      {filterActive && <button className="eo-text-button mp-clear" onClick={clear}>Limpiar filtros</button>}
    </div>
    <div className="mp-workspace"><section className="mp-list" aria-label="Proyectos en los que participas" aria-busy={q.isFetching}>
      <header className="mp-list-heading"><h2>Tus proyectos editoriales</h2><label>Ordenar por <select aria-label="Ordenar proyectos" value={params.get('sort') ?? 'priority'} onChange={e => change('sort', e.target.value)}><option value="priority">Trabajo activo primero</option><option value="activity">Última actividad</option><option value="title">Título</option><option value="delivery">Próxima entrega</option><option value="state">Estado editorial</option></select></label></header>
      {q.isError ? <EditorEmpty><span role="alert">No se pudieron cargar tus proyectos.</span> <button onClick={() => q.refetch()}>Reintentar</button></EditorEmpty> : q.isPending ? <EditorSkeleton label="Cargando proyectos editoriales" /> : items.length ? <table className="mp-project-table"><caption className="sr-only">Una fila por proyecto. Selecciona uno para consultar tu participación editorial.</caption><thead><tr>{['Proyecto / Autor', 'Estado editorial', 'Mis intervenciones', 'Última actividad', ''].map(label => <th key={label} scope="col">{label || <span className="sr-only">Abrir proyecto</span>}</th>)}</tr></thead><tbody>{items.map(p => <tr key={p.projectId} className={detailId === p.projectId ? 'is-selected' : ''} aria-selected={detailId === p.projectId} tabIndex={0} onClick={() => change('project', p.projectId)} onKeyDown={e => { if (e.target === e.currentTarget && ['Enter', ' '].includes(e.key)) { e.preventDefault(); change('project', p.projectId); } }}>
        <td><div className="mp-project-identity"><EditorialCover url={p.coverUrl} /><div><strong title={p.title}>{p.title}</strong><span title={p.authors}>{p.authors}</span><small>{p.code}</small></div></div><span className="mp-mobile-service">{p.service}</span></td>
        <td data-label="Estado editorial"><ProjectStatus project={p} />{p.overdue && p.participation !== 'history' && <small className="ec-deadline-overdue">Con entrega vencida</small>}</td>
        <td data-label="Mis intervenciones"><strong>{p.currentIntervention ?? (p.participation === 'history' ? 'Participación finalizada' : 'Sin trabajo activo')}</strong><small>{p.interventionSummary}</small><span className="mp-mobile-deadline">Próxima entrega: {p.nextDelivery ? date(p.nextDelivery.date) : 'Sin fecha límite'}</span></td>
        <td data-label="Última actividad">{p.lastActivity ? <><strong title={editorialDate(p.lastActivity.at, true)}>{fechaActividad(p.lastActivity.at)}</strong><small>{p.lastActivity.label}</small></> : <span className="eo-muted">Sin actividad registrada</span>}</td>
        <td><button type="button" className="mp-open-project" aria-label={'Ver participación en ' + p.title} onClick={e => { e.stopPropagation(); change('project', p.projectId); }}><span>Ver proyecto</span><RrppIcon nombre="flecha" /></button></td>
      </tr>)}</tbody></table> : <div className="mp-empty"><RrppIcon nombre="proyectos" /><EditorEmpty>{filterActive ? 'No hay proyectos que coincidan con estos filtros.' : 'No tienes proyectos editoriales activos.'}</EditorEmpty>{filterActive && <button className="ec-secondary" onClick={clear}>Limpiar filtros</button>}</div>}
      {q.data && <footer className="mp-pagination"><span aria-live="polite">{q.data.total ? `${(q.data.page - 1) * Number(pageSize) + 1}–${Math.min(q.data.page * Number(pageSize), q.data.total)} de ${q.data.total}` : '0'} proyectos</span><div><button aria-label="Página anterior" disabled={q.data.page <= 1 || q.isFetching} onClick={() => change('page', String(q.data!.page - 1))}>‹</button><span>{q.data.page} / {q.data.pages}</span><button aria-label="Página siguiente" disabled={q.data.page >= q.data.pages || q.isFetching} onClick={() => change('page', String(q.data!.page + 1))}>›</button><select aria-label="Proyectos por página" value={pageSize} onChange={e => change('pageSize', e.target.value)}>{[10, 25, 50].map(n => <option value={n} key={n}>Mostrar {n}</option>)}</select></div></footer>}
    </section>{detailId ? <ProyectoDetail key={detailId} id={detailId} tab={params.get('detailTab') ?? 'summary'} onTab={value => change('detailTab', value)} onClose={close} /> : <div className="mp-placeholder"><RrppIcon nombre="libro" /><p>Tu participación, en contexto</p><span>Selecciona un proyecto para consultar sus intervenciones, material y entregas.</span></div>}</div>
  </section>;
}
function WorkLine({ item, projectId }: { item: EditorProjectWork; projectId: string }) {
  const content = <><span className="mp-work-icon"><RrppIcon nombre="libro" /></span><span className="mp-work-copy"><strong>{item.label}</strong>{item.type !== item.label && <small>{item.type}</small>}<span>{item.waitingOn ? 'SLA en pausa' : item.deliveredAt && item.state === 'Completadas' ? 'Entrega: ' + date(item.deliveredAt) : date(item.dueDate)}</span></span><WorkStatus item={item} />{!item.historical && <RrppIcon nombre="flecha" />}</>;
  return <li>{item.historical ? <div className="mp-work-row">{content}</div> : <Link className="mp-work-row" to={workUrl(projectId, item.id)} aria-label={(item.actionable ? 'Abrir en Mi trabajo: ' : 'Ver detalle: ') + item.label}>{content}</Link>}</li>;
}
function ProyectoDetail({ id, tab: rawTab, onTab, onClose }: { id: string; tab: string; onTab: (s: string) => void; onClose: () => void }) {
  const desktop = useEditorDesktop();
  // Fit the panel to the space below its real header/filter position. The
  // existing shell can scroll independently of the document on desktop.
  useEffect(() => {
    if (!desktop) return;
    const panel = document.querySelector<HTMLElement>('.mp-workspace .eo-detail');
    if (!panel) return;
    let frame = 0;
    const fit = () => { panel.style.maxHeight = `${Math.max(240, window.innerHeight - Math.max(65, panel.getBoundingClientRect().top) - 16)}px`; };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); };
    fit(); window.addEventListener('resize', schedule); window.addEventListener('scroll', schedule, true);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true); panel.style.removeProperty('max-height'); };
  });
  const tab = rawTab === 'work' ? 'interventions' : rawTab === 'files' ? 'material' : TABS.some(([key]) => key === rawTab) ? rawTab : 'summary';
  const q = useQuery({ queryKey: [...editorKey, 'mi-proyecto-detalle', id], queryFn: () => fetchMiProyectoDetalle(id) }), d = q.data, p = d?.summary;
  return <EditorDetail title="Mi participación en el proyecto" modal={!desktop} open onClose={onClose}>
    {q.isPending ? <EditorSkeleton label="Cargando participación editorial" /> : q.isError ? <EditorEmpty><span role="alert">No se pudo cargar el proyecto.</span> <button onClick={() => q.refetch()}>Reintentar proyecto</button></EditorEmpty> : d && p && <>
      <div className="mp-detail-header"><EditorialCover url={p.coverUrl} /><div><h3>{p.title}</h3><p>{p.authors}</p><small>{p.code}</small><ProjectStatus project={p} /></div></div>
      <nav className="mp-detail-tabs" aria-label="Contenido de mi proyecto">{TABS.map(([key, label]) => <button type="button" key={key} aria-pressed={tab === key} onClick={() => onTab(key)}>{label}</button>)}</nav>
      <div className="mp-detail-content">
        {tab === 'summary' && <>
          <dl className="mp-context"><div><dt>Servicio</dt><dd>{p.service}</dd></div><div><dt>Especialista coordinador</dt><dd>{p.specialist ?? 'Sin asignar'}</dd></div><div><dt>Tu asignación</dt><dd>{p.assignedAt ? date(p.assignedAt) : 'Sin fecha registrada'}</dd></div>{p.endedAt && <div><dt>Fin de participación</dt><dd>{date(p.endedAt)}</dd></div>}</dl>
          <section className="mp-current-work"><h4>{p.participation === 'history' ? 'Tu participación anterior' : 'Tu trabajo en este proyecto'}</h4>{p.currentWork ? <><strong>{p.currentWork.label}</strong><WorkStatus item={p.currentWork} /></> : <strong>{p.participation === 'history' ? 'Participación finalizada' : 'Sin trabajo activo actualmente.'}</strong>}<p>{d.nextStep}</p></section>
          {p.nextDelivery && <div className="mp-next-delivery"><RrppIcon nombre="calendario" /><div><span>Tu próxima entrega</span><strong>{p.nextDelivery.label}</strong></div><time className={p.overdue ? 'ec-deadline-overdue' : ''}>{date(p.nextDelivery.date)}</time></div>}
          {d.blockers.map(b => <div className="mp-blocker" key={b.workItemId}><RrppIcon nombre="riesgo" /><div><strong>Bloqueo registrado</strong><p>{b.reason}</p><small>{date(b.createdAt)}</small></div></div>)}
          <section className="mp-summary-work"><header><h4>Mis intervenciones</h4><button className="eo-text-button" onClick={() => onTab('interventions')}>Ver todas →</button></header><p className="mp-caption">{p.interventionSummary}</p>{d.interventions.length ? <ul className="mp-work-list">{d.interventions.slice(0, 3).map(item => <WorkLine key={item.id} item={item} projectId={id} />)}</ul> : <EditorEmpty>{p.participation === 'history' ? 'No hay entregas conservadas de tu participación anterior.' : 'No tienes intervenciones registradas en este proyecto.'}</EditorEmpty>}</section>
          {p.lastActivity && <div className="mp-last-activity"><span>Última actividad editorial</span><strong>{p.lastActivity.label}</strong><small>{fechaActividad(p.lastActivity.at)} · {date(p.lastActivity.at)}</small></div>}
          <details className="mp-history" open={rawTab === 'history' || undefined}><summary>Historial de mi participación</summary>{d.history.length ? <ul>{d.history.map(h => <li key={h.id}><strong>{h.label}</strong><small>{h.actor} · {editorialDate(h.at, true)}</small></li>)}</ul> : <EditorEmpty>Sin actividad registrada.</EditorEmpty>}</details>
        </>}
        {tab === 'interventions' && <section><h4>Mis intervenciones en este proyecto</h4><p className="mp-caption">{p.participation === 'history' ? 'Entregas de tu participación anterior. El acceso operativo finalizó con tu asignación.' : 'Consulta el detalle o continúa la intervención en Mi trabajo.'}</p>{d.interventions.length ? <ul className="mp-work-list">{d.interventions.map(item => <WorkLine key={item.id} item={item} projectId={id} />)}</ul> : <EditorEmpty>No tienes intervenciones registradas en este proyecto.</EditorEmpty>}</section>}
        {tab === 'material' && <section><h4>Material editorial</h4><p className="mp-caption">Carpetas de Edición asociadas a este proyecto.</p>{d.materialUnavailable ? <EditorEmpty><span role="alert">No se pudo consultar el material.</span> <button onClick={() => q.refetch()}>Reintentar material</button></EditorEmpty> : d.drive.links.length ? <div className="mp-material-links">{d.drive.links.map(link => <a key={link.key} href={link.url} target="_blank" rel="noreferrer"><RrppIcon nombre="proyectos" /><span>{link.label}</span><RrppIcon nombre="externo" /></a>)}</div> : <EditorEmpty>{p.participation === 'history' ? 'El acceso al material finalizó con tu asignación.' : 'Este proyecto aún no tiene espacio documental de Edición disponible.'}</EditorEmpty>}</section>}
        {tab === 'deliveries' && <section><h4>Mis entregas</h4>{d.deliveries.length ? <ul className="mp-records">{d.deliveries.map(del => <li key={del.id}><RrppIcon nombre="ingreso" /><div><strong>{del.label}</strong><small>{editorialDate(del.submittedAt, true)}</small>{del.observaciones && <p>{del.observaciones}</p>}{del.driveUrl ? <a href={del.driveUrl} target="_blank" rel="noreferrer">Ver archivo entregado ↗</a> : <span className="mp-caption">Registro histórico; acceso al archivo finalizado.</span>}</div></li>)}</ul> : <EditorEmpty>Aún no has registrado entregas en este proyecto.</EditorEmpty>}</section>}
        {tab === 'feedback' && <section><h4>Feedback de mis intervenciones</h4>{d.feedback.length ? <ul className="mp-records">{d.feedback.map(f => <li key={f.id}><RrppIcon nombre="comentarios" /><div><strong>{f.interventionLabel}</strong><span>{f.label}</span><small>{f.actor} · {date(f.at)}</small>{f.pending ? <><span className="mp-feedback-pending">Pendiente de aplicar</span><Link className="eo-text-button" to={workUrl(id, f.workItemId)}>Aplicar en Mi trabajo →</Link></> : f.kind === 'applied' && <span className="mp-feedback-applied">Aplicado</span>}</div></li>)}</ul> : <EditorEmpty>No hay feedback registrado en este proyecto.</EditorEmpty>}</section>}
        <footer className="mp-detail-actions">
          {p.currentWork && !p.currentWork.historical && <Link className="ec-primary" to={workUrl(id, p.currentWork.id)}><RrppIcon nombre="flecha" />{p.currentWork.actionable ? 'Abrir en Mi trabajo' : 'Ver en Mi trabajo'}</Link>}
          {d.drive.rootUrl && <a className={p.currentWork ? 'ec-secondary' : 'ec-primary'} href={d.drive.rootUrl} target="_blank" rel="noreferrer"><RrppIcon nombre="proyectos" />Ver en Drive<RrppIcon nombre="externo" /></a>}
        </footer>
      </div>
    </>}
  </EditorDetail>;
}
