import './editorialChief.css';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {useState} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { TopBar } from '../layout/TopBar';
import { PRODUCTION_LOGO } from '../layout/RoleProjectNavigation';
import { useMe } from '../auth/useAuth';
import { RrppIcon } from '../rrpp/RrppIcons';
import { editorialKey, fetchEditorialActivity, fetchEditorialDashboard } from './jefeEdicionApi';
import { EditorialDecisionDrawer, EditorialLoadDrawer } from './EditorialDrawers';
import { EditorialModule } from './EditorialModule';
import {EditorialAssignments} from './EditorialAssignments';
import {EditorialProjects} from './EditorialProjects';
import {EditorialTracking} from './EditorialTracking';
import {EditorialRequests} from './EditorialRequests';
import {EditorialIndicadoresPage} from './EditorialIndicadoresPage';
import { EDITORIAL_NAV, EditorialNav, EditorialPanel, EditorialEmpty, EditorialCover, EditorialRows, EditorialDistribution, EditorialKpis, EditorialTeam, editorialDate } from './EditorialParts';
export function JefeEdicionHomePage(){
  const cache=useQueryClient();
  const {data:user}=useMe(),[params,setParams]=useSearchParams();
  const active=EDITORIAL_NAV.find(n=>n[0]===params.get('vista'))?.[0]??(params.has('request')?'asignaciones':'inicio');
  const [notice,setNotice]=useState('');
  const query=useQuery({queryKey:[...editorialKey,'dashboard'],queryFn:fetchEditorialDashboard});
  const activity=useQuery({queryKey:[...editorialKey,'activity'],queryFn:fetchEditorialActivity,enabled:active==='inicio'});
  const d=query.data;
  const open=(id:string)=>{setNotice('');setParams(p=>{p.delete('carga');p.delete('intervencion');p.delete('request');p.delete('originRequest');p.set(active==='asignaciones'?'request':'intervencion',id);return p;});};
  const load=(id:string)=>setParams(p=>{p.set('carga',id);return p;});
  const close=()=>{const origin=params.get('originRequest');if(origin)setParams({vista:'solicitudes-edicion',selectedRequest:origin});else setParams(p=>{p.delete('intervencion');p.delete('request');p.delete('carga');return p;});};
  const descriptions:Record<string,string>={inicio:'Resumen del estado de la edición y de las acciones que requieren tu atención.',asignaciones:'Gestiona las solicitudes de edición y asigna Editores según la carga del equipo.','seguimiento-edicion':'Supervisa las intervenciones editoriales, sus plazos, desvíos y responsables actuales.','solicitudes-edicion':'Gestiona las solicitudes que requieren una decisión del Área de Edición.','proyectos-edicion':'Consulta el estado editorial de cada proyecto, sus intervenciones y responsabilidades.','indicadores-edicion':'Estado operativo actual de las intervenciones de Edición.'};
  return <CrmSidebarLayout nav={<EditorialNav active={active} pending={d?.summary.pendingRequests}/>} logo={PRODUCTION_LOGO} sidebarWidth={244} sidebarBreakpoint="lg" contentMaxWidth="max-w-none" contentClassName="ec-shell" footer={<div className="ec-sidebar-footer"><span className="ec-avatar">{user?.nombre.split(/\s+/).slice(0,2).map(n=>n[0]).join('')}</span><div><strong>Jefe de Edición</strong><small>Área de Edición</small></div><p>Historias que conectan.</p></div>}>
    <div className="ec-topbar"><div><span className="ec-top-context">Gestor editorial</span><small>Área de Edición</small></div><TopBar compacto/></div>
    <EditorialNav active={active} pending={d?.summary.pendingRequests} mobile/>
    <div className="ec-body">{active!=='indicadores-edicion'&&<header className="ec-page-header"><div><span>ÁREA DE EDICIÓN</span><h1>{EDITORIAL_NAV.find(n=>n[0]===active)![1]}</h1><p>{descriptions[active]}</p></div>{!['asignaciones','proyectos-edicion'].includes(active)&&<time><RrppIcon nombre="calendario"/>{editorialDate(d?.today??new Date().toISOString(),true)}</time>}</header>}
    {notice&&<p className="ea-success" role="status">{notice}<button aria-label="Cerrar aviso" onClick={()=>setNotice('')}>×</button></p>}
    {active==='asignaciones'?<EditorialAssignments onOpen={open} onLoad={load}/>:active==='proyectos-edicion'?<EditorialProjects/>:active==='seguimiento-edicion'?<EditorialTracking/>:active==='solicitudes-edicion'?<EditorialRequests onOpen={open}/>:active==='indicadores-edicion'?<EditorialIndicadoresPage/>:query.isPending?<div className="ec-skeleton" role="status" aria-label="Cargando centro de Edición"><div/><div/><div/><div/><section/><section/></div>:query.isError?<EditorialPanel title="No se pudo cargar Edición"><p role="alert" className="ec-empty">{query.error.message}</p><button className="ec-retry" onClick={()=>query.refetch()}>Reintentar</button></EditorialPanel>:d&&(active!=='inicio'?<EditorialModule active={active} dashboard={d} onOpen={open} onLoad={load}/>:<>
    <EditorialKpis data={d}/><div className="ec-dashboard">
      <EditorialPanel title="Carga del equipo de edición" icon="equipo" className="ec-load-panel" action={<Link to="/?vista=asignaciones">Ver detalle →</Link>}><EditorialTeam data={d} onLoad={load}/></EditorialPanel>
      <EditorialPanel title="Estado de edición" icon="capas" className="ec-state-panel"><p className="ec-caption">Distribución de intervenciones</p><EditorialDistribution data={d.interventionDistribution}/></EditorialPanel>
      <EditorialPanel title="Requieren tu atención" icon="actividad" className="ec-attention" action={<Link to="/?vista=seguimiento-edicion">Ver todas ({d.attentionTotal}) →</Link>}><EditorialRows items={d.attentionItems} onOpen={open}/></EditorialPanel>
      <EditorialPanel title="Próximas entregas del equipo" icon="calendario" className="ec-upcoming" action={<Link to="/?vista=seguimiento-edicion&tab=editing&sort=due">Ver todas →</Link>}>
        {d.upcomingDeliveries.length?<ul className="ec-deliveries">{d.upcomingDeliveries.map(i=><li key={i.id}><button onClick={()=>open(i.id)}><EditorialCover/><span><strong>{i.label}</strong><small>{i.title}</small><small>{i.editor}</small></span><time>{editorialDate(i.dueDate)}</time></button></li>)}</ul>:<EditorialEmpty>No hay próximas entregas con fecha registrada.</EditorialEmpty>}
      </EditorialPanel>
      <EditorialPanel title="Solicitudes recientes" icon="ingreso" className="ec-requests" action={<Link to="/?vista=solicitudes-edicion">Ver todas →</Link>}>
        {d.pendingRequests.length?<div className="ec-request-list">{d.pendingRequests.map(r=><div key={r.id}><div className="ec-project"><EditorialCover/><span><strong>{r.title}</strong><small>{r.authors}</small></span></div><span>{r.label}<small>{r.requestedBy} · {editorialDate(r.requestedAt)}</small></span><span className="ec-status ec-amber">{r.state}</span><button className="ec-primary" onClick={()=>open(r.id)}>Revisar</button></div>)}</div>:<EditorialEmpty>No tienes solicitudes pendientes.</EditorialEmpty>}
      </EditorialPanel>
      <EditorialPanel title="Actividad reciente" icon="actividad" className="ec-activity" action={<button onClick={()=>activity.refetch()} aria-label="Actualizar actividad">↻</button>}>
        {activity.isPending?<div className="ec-activity-loading" role="status">Cargando actividad…</div>:activity.isError?<><p role="alert" className="ec-empty">No se pudo cargar la actividad.</p><button className="ec-retry" onClick={()=>activity.refetch()}>Reintentar actividad</button></>:activity.data?.items.length?<ol>{activity.data.items.map(a=><li key={a.id}><strong>{a.text}</strong><span>{a.title}</span><small>{a.actor} · {editorialDate(a.at)}</small></li>)}</ol>:<EditorialEmpty>No hay actividad de Edición registrada.</EditorialEmpty>}
      </EditorialPanel>
    </div></>)}
    {d&&<p className="ec-updated">Actualizado {new Intl.DateTimeFormat('es-VE',{timeZone:'America/Caracas',hour:'2-digit',minute:'2-digit'}).format(new Date(d.updatedAt))}<button onClick={()=>{void cache.invalidateQueries({queryKey:editorialKey});}}>Actualizar</button></p>}
    </div>
    {(params.get('request')??params.get('intervencion'))&&<EditorialDecisionDrawer key={params.get('request')??params.get('intervencion')} id={(params.get('request')??params.get('intervencion'))!} onClose={close} onAssigned={()=>{const origin=params.get('originRequest');if(origin)setParams({vista:'solicitudes-edicion',tab:'resolved',selectedRequest:origin});else close();setNotice('Editor asignado correctamente.');}}/>}
    {params.get('carga')&&<EditorialLoadDrawer id={params.get('carga')!} onClose={close} onOpen={open}/>}
  </CrmSidebarLayout>;
}
