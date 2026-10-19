import {Link} from 'react-router-dom';
import type {CreativeActivity,CreativeDashboard,CreativeTask} from '../../../shared/creativeLeader';
import {RrppIcon} from '../rrpp/RrppIcons';
import {Estado} from '../proyectos/fichaViva/FichaElements';

export function creativeDate(value:string|null,options:Intl.DateTimeFormatOptions={day:'numeric',month:'short'}){
  return value?new Intl.DateTimeFormat('es-VE',{timeZone:'America/Caracas',...options}).format(new Date(value.length===10?value+'T12:00:00Z':value)):'Sin fecha pautada';
}
export function CreativeEmpty({children}:{children:React.ReactNode}){return <div className="cl-empty">{children}</div>;}
export function CreativeKpis({data}:{data:CreativeDashboard}){
  const items=[{label:'Briefs pendientes',value:data.kpis.briefs,icon:'ingreso',tone:'gold',note:'requieren tu atención',href:'/?vista=mi-trabajo&tipo=BRIEF'},
    {label:'Conceptos en revisión',value:data.kpis.concepts,icon:'conceptos',tone:'blue',note:'por preparar o ajustar',href:'/?vista=mi-trabajo&tipo=CONCEPT'},
    {label:'Cubiertas por verificar',value:data.kpis.covers,icon:'proceso',tone:'red',note:'entregadas por Diseño',href:'/?vista=mi-trabajo&tipo=COVER_REVIEW'},
    {label:'Próximo vencimiento',value:data.kpis.nextDueAt?creativeDate(data.kpis.nextDueAt):'—',icon:'actividad',tone:'gold',note:data.kpis.nextDueAt?'trabajo creativo pautado':'Sin fecha pautada',href:'/?vista=mi-trabajo&orden=fecha'}] as const;
  return <div className="cl-kpis">{items.map(i=><Link key={i.label} to={i.href} className="cl-kpi"><span className={'cl-kpi-icon '+i.tone}><RrppIcon nombre={i.icon} className="h-7 w-7"/></span><div><strong>{i.value}</strong><h2>{i.label}</h2><p>{i.note}</p></div><span className={'cl-kpi-arrow '+i.tone} aria-hidden="true">›</span></Link>)}</div>;
}
export function CreativeAttentionRow({task}:{task:CreativeTask}){
  return <Link className="cl-attention-row" to={task.href} aria-label={task.cta+' · '+task.project.title}>
    {task.project.coverUrl?<img className="cl-cover" src={task.project.coverUrl} alt={'Portada de '+task.project.title}/>:<span className="cl-cover cl-cover-placeholder" aria-label="Sin portada"><RrppIcon nombre="ingreso" className="h-6 w-6"/><i/><i/><small>PH</small></span>}
    <span className="cl-row-main"><strong>{task.project.title}</strong><small>{task.project.authors} · {task.project.service}</small><span className="cl-task-label">{task.label}</span><span className="cl-row-context">{task.context}</span></span>
    <span className={'cl-row-status '+(task.state==='Requiere ajustes'?'cl-adjust':'')}><Estado state={task.state}/><span className={'cl-due '+(task.overdue?'late':'')}><RrppIcon nombre="calendario" className="h-3.5 w-3.5"/>{task.overdue?'Vencido · ':task.dueToday?'Hoy · ':''}{creativeDate(task.dueAt)}</span></span>
    <span className="cl-cta">{task.cta}</span>
  </Link>;
}
export function CreativeAttentionList({tasks}:{tasks:CreativeTask[]}){
  return tasks.length?<div className="cl-attention-list">{tasks.map(t=><CreativeAttentionRow key={t.id} task={t}/>)}</div>:<CreativeEmpty><strong>No tienes tareas creativas pendientes.</strong><p>Cuando un proyecto requiera tu intervención, aparecerá aquí.</p></CreativeEmpty>;
}
export function CreativeDeadlines({tasks}:{tasks:CreativeTask[]}){
  return tasks.length?<ol className="cl-deadlines">{tasks.map(t=><li key={t.id}><Link to={t.href}><time dateTime={t.dueAt!}><strong>{creativeDate(t.dueAt,{day:'numeric'})}</strong><small>{creativeDate(t.dueAt,{month:'short'})}</small></time><span><strong>{t.project.title}</strong><small>{t.label}</small></span>{t.dueToday&&<em>Hoy</em>}</Link></li>)}</ol>:<CreativeEmpty>No tienes vencimientos próximos.</CreativeEmpty>;
}
export function CreativeActivityList({items}:{items:CreativeActivity[]}){
  return items.length?<ol className="cl-activity">{items.map(a=><li key={a.id}><Link to={a.href}><span className="cl-activity-dot"/><span><strong>{a.label}</strong><small>{a.projectTitle} · {creativeDate(a.at)} · {a.actor}</small></span></Link></li>)}</ol>:<CreativeEmpty>No hay actividad creativa reciente.</CreativeEmpty>;
}
