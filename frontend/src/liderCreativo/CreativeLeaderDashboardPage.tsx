import {CreativeRequestsPage} from './CreativeRequestsPage';
import {creativeRequestFilters} from './creativeRequestRoutes';
import {CreativePortfolioPage} from './CreativePortfolioPage';
import {creativePortfolioFilters} from './creativePortfolioRoutes';
import {creativeWorkFilters} from './creativeWorkRoutes';
import {CreativeWorkInbox} from './CreativeWorkInbox';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {useMe} from '../auth/useAuth';
import {CrmSidebarLayout} from '../layout/CrmSidebarLayout';
import {TopBar} from '../layout/TopBar';
import {PRODUCTION_LOGO,retornoProyecto} from '../layout/RoleProjectNavigation';
import {Card} from '../proyectos/fichaViva/FichaElements';
import {CreativeSidebarNav} from './CreativeSidebarNav';
import {CreativeActivityList,CreativeAttentionList,CreativeDeadlines,CreativeEmpty,CreativeKpis,creativeDate} from './CreativeDashboardParts';
import {useCreativeActivity,useCreativeRequests,useCreativeDashboard,useCreativeWork,useCreativePortfolio} from './creativeApi';
import {CreativeWorkDialog} from './CreativeWorkDialog';
import '../proyectos/fichaViva/fichaViva.css';
import './creativeLeader.css';

function DashboardSkeleton(){return <div className="cl-loading" role="status" aria-label="Cargando trabajo creativo"><div className="cl-kpis">{[1,2,3,4].map(i=><div key={i}/>)}</div><div className="cl-loading-panels"><div/><div/></div></div>;}
export function CreativeLeaderDashboardPage(){
  const {data:user}=useMe(),[params,setParams]=useSearchParams(),navigate=useNavigate();
  const vista=['mi-trabajo','proyectos-creativos','solicitudes'].includes(params.get('vista')??'')?params.get('vista')!:'inicio';
  const query=useCreativeDashboard(params.get('orden')==='fecha'?'fecha':'accion',vista==='inicio'),activity=useCreativeActivity(vista==='inicio');
  const work=useCreativeWork(creativeWorkFilters(params),vista==='mi-trabajo');
  const portfolio=useCreativePortfolio(creativePortfolioFilters(params),vista==='proyectos-creativos');
  const requestInbox=useCreativeRequests(creativeRequestFilters(params),vista==='solicitudes');
  const data=query.data,actions=vista==='mi-trabajo'?work.data?.counts.actionable:vista==='proyectos-creativos'?portfolio.data?.counts.actionable:vista==='solicitudes'?requestInbox.data?.counts.actionableWork:data?.totalActions,requests=vista==='mi-trabajo'?work.data?.counts.requests:vista==='proyectos-creativos'?portfolio.data?.counts.requests:vista==='solicitudes'?requestInbox.data?.counts.pending:data?.pendingRequests;
  const names:Record<string,string>={inicio:'Hola, '+(user?.nombre??'Líder Creativo'),'mi-trabajo':'Mi trabajo','proyectos-creativos':'Proyectos creativos',solicitudes:'Solicitudes'};
  const subtitles:Record<string,string>={inicio:'Aquí tienes el estado de tu trabajo creativo.','mi-trabajo':'Todas tus tareas creativas, organizadas por estado y prioridad.','proyectos-creativos':'Contexto, entregas y próximos pasos de tus intervenciones.',solicitudes:'Solicitudes creativas disponibles para recibir y comenzar.'};
  const close=()=>{const target=retornoProyecto(params.get('volver'));if(target)navigate(target);else setParams(p=>{for(const key of ['trabajo','accion','concepto','proyecto','workItem'])p.delete(key);return p;});};
  return <CrmSidebarLayout nav={<CreativeSidebarNav active={vista} actions={actions} requests={requests}/>} logo={PRODUCTION_LOGO} sidebarWidth={244} sidebarBreakpoint="lg"
    contentMaxWidth="max-w-[1700px]" contentClassName="cl-shell" footer={<div className="cl-sidebar-footer"><span>{user?.nombre}</span><strong>Líder Creativo</strong><small>Dirección Creativa</small><p>Historias que conectan</p></div>}>
    <div className="cl-account-bar"><span>Dirección Creativa</span><TopBar compacto/></div>
    <CreativeSidebarNav active={vista} actions={actions} requests={requests} mobile/>
    <div className="cl-body">{!['proyectos-creativos','solicitudes'].includes(vista)&&<header className="cl-header"><div><span className="cl-eyebrow">DIRECCIÓN CREATIVA</span><h1>{names[vista]}</h1><p>{subtitles[vista]}</p></div>{vista!=='mi-trabajo'&&<time dateTime={new Date().toISOString()}>{creativeDate(new Date().toISOString(),{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</time>}</header>}
      {vista==='solicitudes'?<CreativeRequestsPage/>:vista==='proyectos-creativos'?<CreativePortfolioPage/>:vista==='mi-trabajo'?<CreativeWorkInbox/>:query.isPending?<DashboardSkeleton/>:query.isError?<Card title="No se pudo consultar tu trabajo creativo"><CreativeEmpty><p role="alert">{query.error.message}</p><button className="fv-button" onClick={()=>query.refetch()}>Reintentar</button></CreativeEmpty></Card>:data&&<>
        {vista==='inicio'&&<><CreativeKpis data={data}/><div className="cl-dashboard-grid">
          <Card title="Requieren tu atención" icon="grid" className="cl-attention" action={<Link to="/?vista=mi-trabajo">Ver todas las tareas →</Link>}><p className="cl-panel-caption">Tareas creativas asignadas y pendientes.</p><CreativeAttentionList tasks={data.attention}/></Card>
          <aside className="cl-right-rail"><Card title="Próximos vencimientos" icon="clock" action={<Link to="/?vista=mi-trabajo&orden=fecha">Ver todos →</Link>}><CreativeDeadlines tasks={data.deadlines}/></Card>
            <Card title="Actividad reciente" icon="clock">{activity.isPending?<div className="cl-activity-skeleton" role="status" aria-label="Cargando actividad"/>:activity.isError?<CreativeEmpty><p role="alert">No se pudo consultar la actividad.</p><button onClick={()=>activity.refetch()}>Reintentar actividad</button></CreativeEmpty>:<CreativeActivityList items={activity.data?.items??[]}/>}</Card></aside>
        </div></>}
        <p className="cl-updated">Actualizado {creativeDate(data.updatedAt,{hour:'2-digit',minute:'2-digit'})}<button onClick={()=>{void query.refetch();if(vista==='inicio')void activity.refetch();}}>Actualizar</button></p>
      </>}
    </div>
    {params.get('trabajo')&&<CreativeWorkDialog id={params.get('trabajo')!} actionType={params.get('accion')} conceptId={params.get('concepto')} onClose={close}/>}
  </CrmSidebarLayout>;
}
