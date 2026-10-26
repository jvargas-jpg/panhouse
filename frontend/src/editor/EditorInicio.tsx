import './editor.css';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
import { editorKey, fetchEditorDashboard } from './editorApi';
import { EditorEmpty, EditorPanel, editorialDate } from './EditorParts';
import { EditorialCover } from '../jefeEdicion/EditorialParts';

export function EditorInicio() {
  const q = useQuery({ queryKey: [...editorKey, 'inicio'], queryFn: fetchEditorDashboard });
  if (q.isPending) return <div className="ec-skeleton" role="status" aria-label="Cargando tu panorama"><div /><div /><div /><div /><section /><section /></div>;
  if (q.isError) return <EditorPanel title="No se pudo cargar tu panorama"><p role="alert" className="ec-empty">{q.error.message}</p><button className="ec-retry" onClick={() => q.refetch()}>Reintentar</button></EditorPanel>;
  const d = q.data;
  const kpis = [
    { label: 'Pendientes hoy', value: d.summary.pendingToday, sub: 'Tareas asignadas para hoy', icon: 'proceso', color: 'blue', tab: 'today' },
    { label: 'Por vencer', value: d.summary.dueSoon, sub: 'Con fecha próxima', icon: 'calendario', color: 'amber', tab: 'all' },
    { label: 'Bloqueadas', value: d.summary.blocked, sub: 'Requieren tu gestión', icon: 'actividad', color: 'red', tab: 'all' },
    { label: 'Feedback por aplicar', value: d.summary.feedbackToApply, sub: 'Comentarios del autor', icon: 'ingreso', color: 'blue', tab: 'feedback' },
  ] as const;
  return <>
    <div className="ec-kpis">{kpis.map(k => <Link className={'ec-kpi ec-' + k.color} key={k.label} to={'/?vista=mi-trabajo&tab=' + k.tab}><span className="ec-kpi-icon"><RrppIcon nombre={k.icon} /></span><span><strong>{k.value}</strong><b>{k.label}</b><small>{k.sub}</small></span></Link>)}</div>
    <div className="ec-dashboard">
      <EditorPanel title="Requiere tu atención" icon="actividad" className="ec-attention">
        {d.attentionItems.length ? <div className="ei-attention">{d.attentionItems.map(i => <article key={i.id}>
          <div className="ec-project"><EditorialCover url={i.coverUrl} /><span><strong>{i.title}</strong><small>{i.code}</small></span></div>
          <span className={'ec-status ' + (i.overdue ? 'ec-red' : i.atRisk ? 'ec-amber' : 'ec-blue')}>{i.situation ?? i.state}</span>
          <span>{i.label}</span>
          <span className={'ei-deadline' + (i.overdue ? ' ec-deadline-overdue' : '')}><RrppIcon nombre="calendario" />{i.dueDate ? (i.overdue ? 'Vencido ' : 'Vence ') + editorialDate(i.dueDate) : 'Sin fecha límite'}</span>
          <Link className="ec-primary" to={'/?vista=mi-trabajo&workItem=' + i.id}>{i.cta}</Link>
        </article>)}</div> : <EditorEmpty>No tienes trabajo que requiera atención inmediata.</EditorEmpty>}
      </EditorPanel>
      <EditorPanel title="Próximas entregas" icon="calendario" className="ec-upcoming">
        {d.upcomingDeliveries.length ? <ul className="ec-deliveries">{d.upcomingDeliveries.map(i => <li key={i.id}><Link to={'/?vista=mi-trabajo&workItem=' + i.id}><EditorialCover /><span><strong>{i.label}</strong><small>{i.title}</small></span></Link><time>{editorialDate(i.dueDate)}</time></li>)}</ul> : <EditorEmpty>No tienes entregas próximas registradas.</EditorEmpty>}
      </EditorPanel>
      <EditorPanel title="Feedback reciente" icon="ingreso" className="ec-requests">
        {d.recentFeedback.length ? <ul className="ei-feedback">{d.recentFeedback.map(f => <li key={f.id}><strong>{f.text}</strong><small>{f.title} · {editorialDate(f.at)}</small></li>)}</ul> : <EditorEmpty>No hay feedback reciente de tus proyectos.</EditorEmpty>}
      </EditorPanel>
      <EditorPanel title="Estado de mi trabajo esta semana" icon="indicadores" className="ec-state-panel">
        <div className="ei-week">
          <div><strong>{d.weekStatus.completed}</strong><small>Completadas</small></div>
          <div><strong>{d.weekStatus.inProgress}</strong><small>En curso</small></div>
          <div><strong>{d.weekStatus.dueSoon}</strong><small>Por vencer</small></div>
          <div><strong>{d.weekStatus.blocked}</strong><small>Bloqueadas</small></div>
        </div>
      </EditorPanel>
      <EditorPanel title="Accesos rápidos" icon="proceso" className="ec-load-panel">
        <div className="ei-quick">
          <Link to="/?vista=mi-trabajo"><RrppIcon nombre="proceso" />Abrir mi trabajo</Link>
          <Link to="/?vista=mis-proyectos"><RrppIcon nombre="proyectos" />Ver mis proyectos</Link>
        </div>
      </EditorPanel>
    </div>
  </>;
}
