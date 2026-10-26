import './editor.css';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
import { EditorialCover } from '../jefeEdicion/EditorialParts';
import { Badge } from '../jefeEdicion/EditorialProjects';
import { EditorEmpty, editorialDate } from './EditorParts';
import { editorKey, fetchMiTrabajo, fetchMiTrabajoDetalle, iniciarTrabajo, registrarEntrega, reportarBloqueo, resolverBloqueo } from './editorApi';
import { NuevaSolicitudForm } from './EditorSolicitudForm';

const TABS = [['all', 'Todos'], ['today', 'Para hoy'], ['inProgress', 'En curso'], ['feedback', 'Feedback'], ['waiting', 'En espera'], ['completed', 'Completados']] as const;

export function EditorMiTrabajo() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const tab = TABS.find(([id]) => id === params.get('tab'))?.[0] ?? 'all';
  const selected = params.get('workItem');
  const update = (key: string, value: string) => setParams(p => { value ? p.set(key, value) : p.delete(key); p.delete('page'); return p; });
  useEffect(() => { const t = setTimeout(() => update('search', search), 300); return () => clearTimeout(t); }, [search]);
  const queryParams = new URLSearchParams({ tab, search: params.get('search') ?? '', page: params.get('page') ?? '1', pageSize: '10' });
  const q = useQuery({ queryKey: [...editorKey, 'mi-trabajo', queryParams.toString()], queryFn: () => fetchMiTrabajo(queryParams), placeholderData: p => p });
  const rows = q.data?.items ?? [];

  return <div className={'ep-module' + (selected ? ' has-detail' : '')}>
    <div className="ep-main">
      <div className="ea-tabs" role="tablist" aria-label="Estado de mi trabajo">{TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => update('tab', id)}>{label}{q.data && <span>{q.data.counts[id] ?? 0}</span>}</button>)}</div>
      <div className="ea-filterbar"><label className="ea-search"><span>Buscar</span><input type="search" placeholder="Buscar por proyecto, autor o trabajo…" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
      <section className="ec-panel ep-table-panel"><header><RrppIcon nombre="proceso" /><h2>Intervenciones asignadas</h2></header>
        {q.isError ? <p className="ec-empty" role="alert">No se pudieron cargar tus intervenciones. <button className="ea-link" onClick={() => q.refetch()}>Reintentar</button></p> : q.isPending ? <p role="status" className="ec-empty">Cargando…</p> : rows.length ? <div className="ea-table-wrap"><table className="ea-table et-table"><thead><tr>{['Proyecto / Autor', 'Trabajo', 'Tipo', 'Fecha objetivo', 'Estado', 'Responsable', 'Acción'].map(c => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{rows.map(i => <tr key={i.id} className={selected === i.id ? 'is-selected' : ''} onClick={() => update('workItem', i.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') update('workItem', i.id); }}>
            <td data-label="Proyecto / Autor"><div className="ec-project"><EditorialCover url={i.coverUrl} /><span><strong>{i.title}</strong><small>{i.authors}</small></span></div></td>
            <td data-label="Trabajo">{i.label}</td>
            <td data-label="Tipo"><span className="ea-service">{i.service}</span></td>
            <td data-label="Fecha objetivo" className={i.overdue ? 'ec-deadline-overdue' : ''}>{editorialDate(i.dueDate)}</td>
            <td data-label="Estado"><Badge state={i.state} /></td>
            <td data-label="Responsable">{i.waitingOn === 'author' ? 'Autor' : i.waitingOn === 'specialist' ? 'Especialista' : i.waitingOn === 'project_pause' ? 'Pausa' : 'Tú'}</td>
            <td data-label="Acción"><button className="ec-secondary" onClick={e => { e.stopPropagation(); update('workItem', i.id); }}>{i.state === 'Bloqueadas' ? 'Ver bloqueo' : i.state === 'Requiere ajustes' ? 'Aplicar feedback' : i.state === 'Completadas' ? 'Ver entrega' : i.waitingOn ? 'Ver contexto' : 'Abrir'}</button></td>
          </tr>)}</tbody></table></div> : <EditorEmpty>No tienes intervenciones asignadas con estos filtros.</EditorEmpty>}
        {q.data && q.data.pages > 1 && <div className="ea-list-footer"><span>{q.data.total} intervenciones</span><button disabled={q.data.page <= 1} onClick={() => setParams(p => { p.set('page', String(q.data!.page - 1)); return p; })}>‹</button><span>{q.data.page} / {q.data.pages}</span><button disabled={q.data.page >= q.data.pages} onClick={() => setParams(p => { p.set('page', String(q.data!.page + 1)); return p; })}>›</button></div>}
      </section>
    </div>
    {selected && <MiTrabajoDetail id={selected} onClose={() => update('workItem', '')} />}
  </div>;
}

function MiTrabajoDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const cache = useQueryClient();
  const [mode, setMode] = useState<'' | 'entrega' | 'bloqueo' | 'solicitud'>('');
  const [form, setForm] = useState({ driveUrl: '', observaciones: '', reason: '' });
  const q = useQuery({ queryKey: [...editorKey, 'mi-trabajo-detalle', id], queryFn: () => fetchMiTrabajoDetalle(id) });
  useEffect(() => { setMode(''); setForm({ driveUrl: '', observaciones: '', reason: '' }); }, [id]);
  async function invalidate() { await cache.invalidateQueries({ queryKey: editorKey }); }
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function run(action: () => Promise<unknown>) { setBusy(true); setError(''); try { await action(); await invalidate(); setMode(''); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la acción.'); } finally { setBusy(false); } }

  const item = q.data?.item;
  return <aside className="ep-detail" aria-label="Detalle del trabajo">
    <header className="ep-detail-head"><button className="ep-close" aria-label="Cerrar detalle" onClick={onClose}>×</button>
      {item && <><EditorialCover url={item.coverUrl} /><div><h3>{item.label}</h3><p>{item.title} · {item.authors}</p></div><span className="ea-service">{item.service}</span></>}
    </header>
    {q.isPending ? <p role="status" className="ec-empty">Cargando…</p> : q.isError ? <p role="alert" className="ec-empty">No se pudo cargar la intervención. <button onClick={() => q.refetch()}>Reintentar</button></p> : item && q.data && <div className="ep-resumen">
      <dl className="ec-detail-grid">
        <div><dt>Estado</dt><dd><Badge state={item.state} /></dd></div>
        <div><dt>Fecha límite</dt><dd className={item.overdue ? 'ec-deadline-overdue' : ''}>{editorialDate(item.dueDate)}</dd></div>
        <div><dt>Responsable actual</dt><dd>{item.waitingOn === 'author' ? 'Autor' : item.waitingOn === 'specialist' ? 'Especialista' : item.waitingOn === 'project_pause' ? 'Pausa del proyecto' : 'Tú'}</dd></div>
        {item.waitingOn && <div><dt /><dd className="ec-info">Esta espera no se cuenta como atraso tuyo.</dd></div>}
      </dl>

      {q.data.folders.length > 0 && <div className="ep-drive"><h4>Material y carpetas</h4><ul>{q.data.folders.map(f => f.driveUrl ? <li key={f.key}><a href={f.driveUrl} target="_blank" rel="noreferrer"><RrppIcon nombre="externo" className="h-4 w-4" />{f.label}</a></li> : null)}</ul></div>}

      {q.data.blocker ? <div className="ec-block">
        <strong>Bloqueo abierto</strong> · {q.data.blocker.reason}<br /><small>{editorialDate(q.data.blocker.createdAt, true)}</small>
        <div className="ep-actions"><button className="ec-secondary" disabled={busy} onClick={() => run(() => resolverBloqueo(id))}>Marcar bloqueo resuelto</button></div>
      </div> : item.actionable && <div className="ep-actions">
        {!item.chapter && item.state === 'Pendiente' && <button className="ec-secondary" disabled={busy} onClick={() => run(() => iniciarTrabajo(id))}>Iniciar trabajo</button>}
        <button className="ec-primary" disabled={busy} onClick={() => setMode('entrega')}>Registrar entrega</button>
        <button className="ec-secondary" disabled={busy} onClick={() => setMode('bloqueo')}>Reportar bloqueo</button>
        <button className="ec-secondary" disabled={busy} onClick={() => setMode('solicitud')}>Solicitar apoyo</button>
      </div>}

      {mode === 'entrega' && <form className="ep-form" onSubmit={e => { e.preventDefault(); run(() => registrarEntrega(id, form.driveUrl, form.observaciones)); }}>
        <label>Enlace de Drive del archivo entregado<input type="url" required placeholder="https://drive.google.com/…" value={form.driveUrl} onChange={e => setForm({ ...form, driveUrl: e.target.value })} /></label>
        <label>Observaciones (opcional)<textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} maxLength={1000} /></label>
        <div className="ep-actions"><button className="ec-primary" disabled={busy}>Confirmar entrega</button><button type="button" onClick={() => setMode('')}>Cancelar</button></div>
      </form>}
      {mode === 'bloqueo' && <form className="ep-form" onSubmit={e => { e.preventDefault(); run(() => reportarBloqueo(id, form.reason)); }}>
        <label>Motivo del bloqueo<textarea required minLength={5} maxLength={1000} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></label>
        <div className="ep-actions"><button className="ec-primary" disabled={busy}>Reportar bloqueo</button><button type="button" onClick={() => setMode('')}>Cancelar</button></div>
      </form>}
      {mode === 'solicitud' && item.workItemId && <NuevaSolicitudForm workItemId={item.workItemId} onDone={() => { setMode(''); void invalidate(); }} onCancel={() => setMode('')} />}
      {error && <p role="alert" className="ec-empty">{error}</p>}

      {q.data.deliveries.length > 0 && <div><h4>Entregas registradas</h4><ul className="ei-deliveries">{q.data.deliveries.map(d => <li key={d.id}><a href={d.driveUrl} target="_blank" rel="noreferrer">Ver archivo ↗</a><time>{editorialDate(d.submittedAt, true)}</time></li>)}</ul></div>}

      {q.data.history.length > 0 && <div><h4>Actividad reciente</h4><ul className="ep-history">{q.data.history.map(h => <li key={h.id}><strong>{h.label}</strong><small>{h.actor} · {editorialDate(h.at, true)}</small></li>)}</ul></div>}
      <div className="ep-actions"><Link className="ec-secondary" to={'/?vista=mis-proyectos&project=' + item.projectId}>Ver proyecto →</Link></div>
    </div>}
  </aside>;
}
