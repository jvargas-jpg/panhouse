import './soporteDigitalHome.css';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import { apiFetch } from '../lib/api';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { TopBar } from '../layout/TopBar';
import { PRODUCTION_LOGO } from '../layout/RoleProjectNavigation';
import { RrppIcon } from '../rrpp/RrppIcons';
import { DigitalCover, DigitalMobileNavigation, DigitalNavigation } from './SoporteDigitalUi';
import { DIGITAL_STAGE_LABELS, type DigitalPriorityTask, type DigitalStage, type DigitalSupportDashboard } from '../../../shared/soporteDigitalHome';

export const digitalHomeKey = ['soporte-digital', 'inicio'] as const;
const stages: DigitalStage[] = ['preparation', 'testing', 'loaded', 'completed'];
const helps: Record<DigitalStage,string> = { preparation:'Activación y datos previos', testing:'Con paquete final registrado', loaded:'Carga KDP o Kindle registrada', completed:'Cierre del control interno' };
const icons = { preparation:'ingreso', testing:'comparar', loaded:'proceso', completed:'check' } as const;
function calendar(value:string) {return new Intl.DateTimeFormat('es-VE',{timeZone:'America/Caracas',day:'numeric',month:'short'}).format(new Date(value+'T12:00:00Z'));}
function Deadline({task:t}:{task:DigitalPriorityTask}) {
  return <div className={'sd-deadline '+(t.deadlineState==='overdue'?'sd-overdue':'')}>
    {t.deadline?<time dateTime={t.deadline}>{calendar(t.deadline)}</time>:<span>Sin fecha límite</span>}
    {t.deadlineState==='overdue'?<small>Vencida</small>:t.deadlineState==='today'?<small>Hoy</small>:t.deadlineState==='soon'?<small>Vence pronto</small>:null}
  </div>;
}
function TaskTable({tasks}:{tasks:DigitalPriorityTask[]}) {
  return <table className="sd-tasks"><caption className="sr-only">Una fila por tarea digital abierta. Abrir tarea lleva a la gestión digital existente del proyecto.</caption><thead><tr>{['Proyecto / Autor','Etapa / Tarea','Fecha límite','Estado',''].map((x,i)=><th key={i} scope="col">{x||<span className="sr-only">Abrir tarea</span>}</th>)}</tr></thead><tbody>{tasks.map(t=><tr key={t.workItemId}>
    <td><div className="sd-identity"><DigitalCover url={t.coverUrl}/><div><strong>{t.projectTitle}</strong><span>{t.authors}</span><small>{t.projectCode}</small></div></div></td>
    <td data-label="Etapa / Tarea"><small className="sd-stage-label">{DIGITAL_STAGE_LABELS[t.stage]}</small><strong>{t.taskLabel}</strong>{t.blocker&&<span className="sd-blocker">{t.blocker}</span>}</td>
    <td data-label="Fecha límite"><Deadline task={t}/></td>
    <td data-label="Estado"><span className={'sd-badge '+(!t.actionable?'sd-neutral':t.deadlineState==='overdue'?'sd-red':'sd-blue')}><i/>{t.actionable&&t.deadlineState==='overdue'?'Requiere atención':t.status}</span></td>
    <td><Link className="sd-open" to={t.href} aria-label={`Abrir tarea: ${t.taskLabel} de ${t.projectTitle}`}><span>Abrir tarea</span><RrppIcon nombre="flecha"/></Link></td>
  </tr>)}</tbody></table>;
}
export function DigitalDashboardContent({data:d,refresh}:{data:DigitalSupportDashboard;refresh:()=>void}) {
  return <div className="sd-grid"><div className="sd-main">
    <section className="sd-summary" aria-label="Resumen de proyectos digitales">{stages.map(s=><article className={'sd-summary-card sd-'+s} key={s}><span className="sd-summary-icon"><RrppIcon nombre={icons[s]}/></span><div><strong>{d.summary[s]}</strong><h2>{DIGITAL_STAGE_LABELS[s]}</h2><p>{helps[s]}</p></div></article>)}</section>
    <section className="sd-panel sd-priority" aria-label="Mis tareas prioritarias"><header><div><h2>Mis tareas prioritarias</h2><p>{d.flowSummary.activeTasks?`Mostrando ${d.priorityTasks.length} de ${d.flowSummary.activeTasks} tareas abiertas`:'Tu bandeja operativa de hoy'}</p></div><span className="sd-count">{d.flowSummary.activeTasks}</span></header>
      {d.priorityTasks.length?<TaskTable tasks={d.priorityTasks}/>:<div className="sd-empty"><RrppIcon nombre="check"/><h3>No tienes tareas digitales pendientes actualmente.</h3><p>Cuando un proyecto se active en Soporte Digital, sus tareas aparecerán aquí.</p></div>}
    </section>
    <p className="sd-context"><RrppIcon nombre="libro"/>La preparación puede avanzar en paralelo a Calidad. La prueba y la carga requieren la entrega del paquete final.</p>
  </div><aside className="sd-rail" aria-label="Flujo digital y actividad reciente">
    <section className="sd-panel sd-flow"><header><div><h2>Estado del flujo digital</h2><p>Proyectos de la bandeja compartida</p></div></header><ol>{stages.map((s,i)=><li key={s}><span className="sd-step">{i+1}</span><div><strong>{DIGITAL_STAGE_LABELS[s]}</strong><small>{helps[s]}</small></div><b aria-label={`${d.flowSummary.counts[s]} proyectos: ${DIGITAL_STAGE_LABELS[s]}`}>{d.flowSummary.counts[s]}</b></li>)}</ol>
      {d.flowSummary.waitingPackage>0&&<p className="sd-waiting"><RrppIcon nombre="actividad"/>{d.flowSummary.waitingPackage} {d.flowSummary.waitingPackage===1?'proyecto espera':'proyectos esperan'} el paquete final.</p>}
      {d.flowSummary.pausedProjects>0&&<p className="sd-paused">{d.flowSummary.pausedProjects} {d.flowSummary.pausedProjects===1?'proyecto en pausa':'proyectos en pausa'}.</p>}
    </section>
    <section className="sd-panel sd-activity"><header><h2>Actividad reciente</h2></header>{d.recentActivity.unavailable?<div className="sd-module-error"><p role="alert">No se pudo cargar la actividad reciente.</p><button onClick={refresh}>Reintentar actividad</button></div>:d.recentActivity.items.length?<ul>{d.recentActivity.items.map(a=><li key={a.id}><RrppIcon nombre="actividad"/><div><strong>{a.label}</strong><Link to={a.href}>{a.projectTitle}</Link><small>{a.actor} · <time dateTime={a.at}>{new Intl.DateTimeFormat('es-VE',{timeZone:'America/Caracas',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(a.at))}</time></small></div></li>)}</ul>:<p className="sd-no-activity">Aún no hay actividad reciente.</p>}</section>
  </aside></div>;
}
export function DigitalLoading() {
  return <div className="sd-loading" role="status" aria-label="Cargando Inicio de Soporte Digital"><div className="sd-loading-main"><div>{stages.map(s=><i key={s}/>)}</div><section>{[1,2,3,4].map(n=><i key={n}/>)}</section></div><aside><i/><i/></aside></div>;
}
export function SoporteDigitalHomePage() {
  const {data:user}=useMe();
  const q=useQuery({queryKey:[...digitalHomeKey,user?.id],queryFn:()=>apiFetch<DigitalSupportDashboard>('/soporte-digital/inicio'),enabled:!!user,staleTime:0,refetchOnMount:'always'});
  const today=q.data?.today??new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  return <CrmSidebarLayout nav={<DigitalNavigation active="inicio"/>} logo={PRODUCTION_LOGO} sidebarWidth={224} sidebarBreakpoint="lg" contentMaxWidth="max-w-none" shellClassName="soporte-digital-layout" contentClassName="soporte-digital-home" footer={<p className="sd-footer">Historias que conectan.</p>}>
    <div className="sd-topbar"><div><RrppIcon nombre="libro"/><strong>Soporte Digital</strong></div><TopBar compacto roleLabel="Soporte Digital"/></div><DigitalMobileNavigation active="inicio"/>
    <div className="sd-body"><nav className="sd-breadcrumb" aria-label="Ruta de navegación"><span>Soporte Digital</span><RrppIcon nombre="flecha"/><strong>Inicio</strong></nav>
      <header className="sd-page-header"><div><h1>Tu trabajo digital de hoy</h1><p>{user?.nombre?`Hola, ${user.nombre}. `:''}Aquí tienes tus tareas y el estado del proceso digital.</p></div><time dateTime={today}>{new Intl.DateTimeFormat('es-VE',{timeZone:'America/Caracas',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(today+'T12:00:00Z'))}</time></header>
      {q.isPending?<DigitalLoading/>:q.isError?<section className="sd-panel sd-error"><RrppIcon nombre="riesgo"/><h2>No se pudo cargar tu Inicio</h2><p role="alert">No pudimos consultar las tareas de Soporte Digital.</p><button onClick={()=>q.refetch()}>Reintentar</button></section>:<DigitalDashboardContent data={q.data} refresh={()=>q.refetch()}/>}
    </div>
  </CrmSidebarLayout>;
}
