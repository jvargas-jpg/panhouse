import './editor.css';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
import { editorKey, fetchEditorDashboard } from './editorApi';
import { EditorEmpty, EditorPanel, editorialDate } from './EditorParts';
import { EditorialCover } from '../jefeEdicion/EditorialParts';
import { EditorKpis, EditorStatus, activityVisual } from './EditorUi';
import { fechaActividad } from '../rrpp/RrppDashboardCards';

export function EditorInicio(){
 const q=useQuery({queryKey:[...editorKey,'inicio'],queryFn:fetchEditorDashboard});
 if(q.isPending)return <div className="ec-skeleton" role="status" aria-label="Cargando tu panorama"><div/><div/><div/><div/><section/><section/></div>;
 if(q.isError)return <EditorPanel title="No se pudo cargar tu panorama"><p role="alert" className="ec-empty">{q.error.message}</p><button className="ec-retry" onClick={()=>q.refetch()}>Reintentar</button></EditorPanel>;
 const d=q.data;
 const quick=d.attentionItems.find(i=>i.actionable&&i.state!=='Bloqueadas');
 return <>
  <EditorKpis items={[
   {label:'Pendientes hoy',value:d.summary.pendingToday,sub:'Trabajo que necesita atención hoy',icon:'lista',color:'blue',href:'/?vista=mi-trabajo&tab=today'},
   {label:'Por vencer',value:d.summary.dueSoon,sub:'Con fecha próxima registrada',icon:'actividad',color:'amber',href:'/?vista=mi-trabajo&risk=dueSoon'},
   {label:'Bloqueadas',value:d.summary.blocked,sub:'Requieren tu gestión',icon:'riesgo',color:'red',href:'/?vista=mi-trabajo&status=Bloqueadas'},
   {label:'Feedback por aplicar',value:d.summary.feedbackToApply,sub:'Comentarios pendientes de aplicar',icon:'comentarios',color:'violet',href:'/?vista=mi-trabajo&tab=feedback'}
  ]}/>
  <div className="eo-home-grid">
   <EditorPanel title="Requiere tu atención" icon="capas" className="eo-attention-panel" action={<Link to="/?vista=mi-trabajo">Ver todo <span>→</span></Link>}>
    {d.attentionItems.length?<div className="eo-attention-wrap"><table className="eo-attention-table">
     <thead><tr><th>Proyecto / Autor</th><th>Intervención</th><th>Situación</th><th>Fecha</th><th><span className="sr-only">Acción</span></th></tr></thead>
     <tbody>{d.attentionItems.map(i=><tr key={i.id}>
      <td data-label="Proyecto / Autor"><div className="ec-project"><EditorialCover url={i.coverUrl}/><span><strong>{i.title}</strong><small>{i.authors}</small></span></div></td>
      <td data-label="Intervención">{i.label}</td>
      <td data-label="Situación"><EditorStatus state={i.situation??i.state}/></td>
      <td data-label="Fecha" className={i.overdue?'ec-deadline-overdue':''}>{i.dueDate?editorialDate(i.dueDate):'Sin fecha límite'}</td>
      <td data-label="Acción"><Link className="eo-attention-action" to={'/?vista=mi-trabajo&workItem='+i.id}>{i.state==='Bloqueadas'?'Ver bloqueo':'Continuar trabajo'}<RrppIcon nombre="flecha"/></Link></td>
     </tr>)}</tbody>
    </table></div>:<EditorEmpty>No tienes trabajo que requiera atención inmediata.</EditorEmpty>}
   </EditorPanel>
   <EditorPanel title="Próximas entregas" icon="calendario" className="eo-upcoming-panel" action={<Link to="/?vista=mi-trabajo">Ver todas →</Link>}>
    {d.upcomingDeliveries.length?<ul className="eo-upcoming">{d.upcomingDeliveries.map(i=><li key={i.id}><time>{editorialDate(i.dueDate)}</time><i/><Link to={'/?vista=mi-trabajo&workItem='+i.id}><strong>{i.label}</strong><small>{i.title}</small></Link><RrppIcon nombre="flecha"/></li>)}</ul>:
    <div className="eo-upcoming-empty"><RrppIcon nombre="calendario"/><p>No tienes entregas próximas registradas.</p><small>Cuando definas una fecha de entrega en tus intervenciones, aparecerá aquí.</small></div>}
   </EditorPanel>
   <EditorPanel title="Actividad reciente" icon="actividad" className="eo-activity-panel" action={<Link to="/?vista=mi-trabajo">Ver toda →</Link>}>
    {d.recentActivity.length?<ul className="eo-activity-feed">{d.recentActivity.map(a=>{const v=activityVisual(a.text);return <li key={a.id}>
      <span className={'eo-activity-dot '+v.color}><RrppIcon nombre={v.icon}/></span>
      <div><span><strong>{a.text}</strong><small>{a.title}</small></span><time>{fechaActividad(a.at)}</time></div>
     </li>;})}</ul>:<EditorEmpty>No hay actividad reciente en tus proyectos.</EditorEmpty>}
   </EditorPanel>
   <div className="eo-home-secondary">
    <EditorPanel title="Estado de mi trabajo esta semana" icon="indicadores"><div className="ei-week">{[[d.weekStatus.completed,'Completadas','green'],[d.weekStatus.inProgress,'En curso','blue'],[d.weekStatus.dueSoon,'Por vencer','amber'],[d.weekStatus.blocked,'Bloqueadas','red']].map(([value,label,color])=><div key={label}><i className={'eo-dot '+color}/><strong>{value}</strong><small>{label}</small></div>)}</div></EditorPanel>
    <EditorPanel title="Accesos rápidos" icon="rapido"><div className="ei-quick">
     <Link to="/?vista=mi-trabajo"><RrppIcon nombre="proceso"/><span>Abrir mi trabajo<small>Ver intervenciones asignadas</small></span><RrppIcon nombre="flecha"/></Link>
     <Link to="/?vista=mis-proyectos"><RrppIcon nombre="proyectos"/><span>Ver proyectos<small>Tu participación editorial</small></span><RrppIcon nombre="flecha"/></Link>
     {quick&&<Link to={'/?vista=mi-trabajo&workItem='+quick.id+'&action=entrega'}><RrppIcon nombre="externo"/><span>Registrar entrega<small>{quick.label}</small></span><RrppIcon nombre="flecha"/></Link>}
     <Link to="/?vista=mis-solicitudes&create=1"><RrppIcon nombre="equipo"/><span>Solicitar apoyo<small>Contactar a tu equipo</small></span><RrppIcon nombre="flecha"/></Link>
    </div></EditorPanel>
   </div>
  </div>
 </>;
}
