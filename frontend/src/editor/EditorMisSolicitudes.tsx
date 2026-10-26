import './editor.css';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
import { EDITOR_REQUEST_LABELS } from '../../../shared/editorOwn';
import { EditorEmpty, editorialDate } from './EditorParts';
import { cancelarSolicitud, editorKey, fetchMiProyectoDetalle, fetchMiSolicitudDetalle, fetchMisProyectos, fetchMisSolicitudes } from './editorApi';
import { NuevaSolicitudForm } from './EditorSolicitudForm';

const TABS = [['all', 'Todas'], ['pending', 'Pendientes'], ['resolved', 'Resueltas'], ['returned', 'Devueltas'], ['cancelled', 'Canceladas']] as const;
const STATUS_LABEL: Record<string, string> = { pendiente: 'Pendiente', en_revision: 'En revisión', devuelta: 'Devuelta', resuelta: 'Resuelta', cancelada: 'Cancelada' };
const STATUS_CLASS: Record<string, string> = { pendiente: 'ec-blue', en_revision: 'ec-blue', devuelta: 'ec-amber', resuelta: 'ec-green', cancelada: 'ec-grey' };

export function EditorMisSolicitudes() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find(([id]) => id === params.get('tab'))?.[0] ?? 'all';
  const selected = params.get('request');
  const [creating, setCreating] = useState(false);
  const queryParams = new URLSearchParams({ tab, page: params.get('page') ?? '1', pageSize: '25' });
  const q = useQuery({ queryKey: [...editorKey, 'mis-solicitudes', queryParams.toString()], queryFn: () => fetchMisSolicitudes(queryParams), placeholderData: p => p });
  const items = q.data?.items ?? [];

  return <div className={'ep-module' + (selected || creating ? ' has-detail' : '')}>
    <div className="ep-main">
      <div className="ec-kpis">{q.data && <>
        <div className="ec-kpi ep-kpi-static"><span className="ec-kpi-icon"><RrppIcon nombre="ingreso" /></span><span><strong>{q.data.counts.pending}</strong><b>Pendientes</b><small>En espera de atención</small></span></div>
        <div className="ec-kpi ep-kpi-static"><span className="ec-kpi-icon"><RrppIcon nombre="check" /></span><span><strong>{q.data.counts.resolved}</strong><b>Resueltas</b><small>Con respuesta final</small></span></div>
        <div className="ec-kpi ep-kpi-static"><span className="ec-kpi-icon"><RrppIcon nombre="actividad" /></span><span><strong>{q.data.counts.returned}</strong><b>Devueltas</b><small>Requieren más información</small></span></div>
      </>}</div>
      <div className="es-toolbar">
        <div className="ea-tabs" role="tablist" aria-label="Estado de mis solicitudes">{TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setParams(p => { p.set('tab', id); p.delete('page'); return p; })}>{label}</button>)}</div>
        <button className="ec-primary es-new-request" onClick={() => { setCreating(true); setParams(p => { p.delete('request'); return p; }); }}>+ Nueva solicitud</button>
      </div>
      {q.isError ? <p className="ec-empty" role="alert">No se pudieron cargar tus solicitudes. <button onClick={() => q.refetch()}>Reintentar</button></p> : q.isPending ? <p role="status" className="ec-empty">Cargando…</p> : items.length ? <div className="ea-cards">{items.map(r => <article key={r.id} className="es-request-card" onClick={() => { setCreating(false); setParams(p => { p.set('request', r.id); return p; }); }}>
        <div className="es-request-head"><strong>{EDITOR_REQUEST_LABELS[r.type]}</strong><span className={'ec-status ' + STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</span></div>
        <p className="ep-summary">{r.title} · {r.interventionLabel}</p>
        <p className="ec-caption">{r.motivo}</p>
        <small>Enviada a {r.target} · {editorialDate(r.requestedAt, true)}</small>
      </article>)}</div> : <EditorEmpty>Aún no has enviado solicitudes.</EditorEmpty>}
    </div>
    {creating && <NuevaSolicitudPicker onClose={() => setCreating(false)} />}
    {selected && !creating && <SolicitudDetail id={selected} onClose={() => setParams(p => { p.delete('request'); return p; })} />}
  </div>;
}

function NuevaSolicitudPicker({ onClose }: { onClose: () => void }) {
  const [projectId, setProjectId] = useState('');
  const [workItemId, setWorkItemId] = useState('');
  const proyectos = useQuery({ queryKey: [...editorKey, 'mis-proyectos', 'picker'], queryFn: () => fetchMisProyectos(new URLSearchParams({ search: '', page: '1', pageSize: '50', sort: 'title' })) });
  const detalle = useQuery({ queryKey: [...editorKey, 'mi-proyecto-detalle', projectId], queryFn: () => fetchMiProyectoDetalle(projectId), enabled: !!projectId });
  return <aside className="ep-detail" aria-label="Nueva solicitud">
    <header className="ep-detail-head"><button className="ep-close" aria-label="Cerrar" onClick={onClose}>×</button><div><h3>Nueva solicitud</h3></div></header>
    <div className="ep-resumen">
      <label className="ep-form" style={{ marginBottom: 10 }}>Proyecto
        <select value={projectId} onChange={e => { setProjectId(e.target.value); setWorkItemId(''); }}>
          <option value="">Selecciona un proyecto</option>
          {proyectos.data?.items.map(p => <option key={p.projectId} value={p.projectId}>{p.title} (#{p.code})</option>)}
        </select>
      </label>
      {projectId && <label className="ep-form" style={{ marginBottom: 10 }}>Intervención
        <select value={workItemId} onChange={e => setWorkItemId(e.target.value)}>
          <option value="">Selecciona una intervención</option>
          {detalle.data?.interventions.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
        </select>
      </label>}
      {workItemId && <NuevaSolicitudForm workItemId={workItemId} onDone={onClose} onCancel={onClose} />}
    </div>
  </aside>;
}

function SolicitudDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({ queryKey: [...editorKey, 'mi-solicitud-detalle', id], queryFn: () => fetchMiSolicitudDetalle(id) });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const d = q.data;
  async function cancelar() {
    if (!d) return; setBusy(true); setError('');
    try { await cancelarSolicitud(id, d.summary.version); await q.refetch(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cancelar.'); }
    finally { setBusy(false); }
  }
  return <aside className="ep-detail" aria-label="Detalle de la solicitud">
    <header className="ep-detail-head"><button className="ep-close" aria-label="Cerrar detalle" onClick={onClose}>×</button>
      {d && <div><h3>{EDITOR_REQUEST_LABELS[d.summary.type]}</h3><p>{d.summary.title} · {d.summary.interventionLabel}</p></div>}
    </header>
    {q.isPending ? <p role="status" className="ec-empty">Cargando…</p> : q.isError ? <p role="alert" className="ec-empty">No se pudo cargar la solicitud. <button onClick={() => q.refetch()}>Reintentar</button></p> : d && <div className="ep-resumen">
      <dl className="ec-detail-grid">
        <div><dt>Estado</dt><dd><span className={'ec-status ' + STATUS_CLASS[d.summary.status]}>{STATUS_LABEL[d.summary.status]}</span></dd></div>
        <div><dt>Destino</dt><dd>{d.summary.target}</dd></div>
        <div><dt>Enviada</dt><dd>{editorialDate(d.summary.requestedAt, true)}</dd></div>
        {d.summary.resolvedAt && <div><dt>Resuelta</dt><dd>{editorialDate(d.summary.resolvedAt, true)}</dd></div>}
      </dl>
      <p className="ep-next-step"><strong>Motivo</strong><br />{d.description}</p>
      {d.summary.outcome && <p className="ec-info"><strong>Resultado</strong> · {d.summary.outcome}</p>}
      {(d.summary.status === 'pendiente' || d.summary.status === 'en_revision') && <div className="ep-actions"><button className="ec-secondary" disabled={busy} onClick={cancelar}>Cancelar solicitud</button></div>}
      {error && <p role="alert" className="ec-empty">{error}</p>}
      <div><h4>Historial</h4>{d.history.length ? <ul className="ep-history">{d.history.map(h => <li key={h.id}><strong>{h.label}</strong><small>{h.actor} · {editorialDate(h.at, true)}</small></li>)}</ul> : <EditorEmpty>Sin eventos registrados todavía.</EditorEmpty>}</div>
    </div>}
  </aside>;
}
