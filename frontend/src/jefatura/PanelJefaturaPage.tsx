import { lazy, Suspense, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMe } from '../auth/useAuth';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { AssignmentCandidateDrawer } from './AssignmentCandidateDrawer';
import { fetchComparacionAsignacion, fetchDashboardJefatura } from './commandCenterApi';
import { ErrorJefatura, RequestsList } from './JefaturaCards';
import { JefaturaSidebar, VISTAS_JEFATURA, type VistaJefatura } from './JefaturaSidebar';
import { DecisionesPage } from './DecisionesPage';
import { AsignacionesCargaPage } from './AsignacionesCargaPage';
import { ProyectosJefaturaPage } from './ProyectosJefaturaPage';
import { MonthlyGoalsPage } from '../objetivos/MonthlyGoalsPage';
import { OperationHomePage } from '../proyectos/OperationHomePage';
import { ValidationManagement } from '../validaciones/ValidationManagement';
import './jefatura.css';
const IndicadoresPage=lazy(()=>import('./IndicadoresPage').then(m=>({default:m.IndicadoresPage})));

export function PanelJefaturaPage() {
 const [params]=useSearchParams();
 const vista=params.get('vista');
 return !vista||vista==='inicio'||!VISTAS_JEFATURA.includes(vista as VistaJefatura)?<OperationHomePage/>:<JefaturaSecondaryPage/>;
}
function JefaturaSecondaryPage() {
 const {data:user}=useMe(),[params,setParams]=useSearchParams(),cache=useQueryClient();
 const vista=params.get('vista') as VistaJefatura;
 const [notice,setNotice]=useState('');
 const selected=vista==='asignaciones'?params.get('proyecto'):null;
 const query=useQuery({queryKey:['jefatura','candidatos',selected],queryFn:()=>fetchComparacionAsignacion(selected!),enabled:!!selected&&user?.rol==='jefe_area'});
 const requests=useQuery({queryKey:['jefatura','dashboard'],queryFn:fetchDashboardJefatura,enabled:vista==='solicitudes'&&user?.rol==='jefe_area'});
 if(user&&user.rol!=='jefe_area')return <p role="alert">No tienes acceso a Jefatura.</p>;
 if(vista==='seguimiento'){
  const target=new URLSearchParams(params);
  if(params.get('subvista')==='objetivos'){target.set('vista','indicadores');return <Navigate to={'/?'+target} replace/>;}
  if(params.get('proyecto'))return <Navigate to={'/proyectos/'+params.get('proyecto')} replace/>;
  target.set('vista','proyectos');return <Navigate to={'/?'+target} replace/>;
 }
 const close=()=>setParams(old=>{const p=new URLSearchParams(old);p.delete('proyecto');p.delete('decision');return p;});
 const changed=async(message:string,shouldClose=false)=>{
  await Promise.all(['jefatura','proyectos','proyecto','ficha','project-portfolio','operation-home','especialista-inicio','notificaciones'].map(key=>cache.invalidateQueries({queryKey:[key]})));
  setNotice(message);if(shouldClose)close();
 };
 const titles:Partial<Record<VistaJefatura,string>>={proyectos:'Proyectos',decisiones:'Decisiones y escalaciones',indicadores:'Indicadores',solicitudes:'Seguimiento de solicitudes'};
 return <CrmSidebarLayout nav={<JefaturaSidebar vista={vista}/>} contentMaxWidth="max-w-[1440px]" contentClassName="p-4 sm:p-7" overlays={<>
  {selected&&query.data&&<AssignmentCandidateDrawer key={selected} proyecto={query.data.proyecto} onClose={close} onCambio={changed} modoInicial={params.get('decision')==='candidatos'?'candidatos':'contexto'}/>}
  {notice&&<div role="status" className="jf-toast">{notice}<button onClick={()=>setNotice('')} aria-label="Cerrar aviso"> ×</button></div>}
 </>}><main className="jefatura">
  {titles[vista]&&<header className="jf-page-header"><div><p className="jf-eyebrow">JEFATURA · OPERACIÓN EDITORIAL</p><h1>{titles[vista]}</h1></div></header>}
  {vista==='asignaciones'&&<>{selected&&query.isError&&<ErrorJefatura texto="No pudimos abrir el proyecto seleccionado." retry={()=>void query.refetch()}/>}<ValidationManagement/><AsignacionesCargaPage onCompare={(p,mode='contexto')=>setParams(old=>{const next=new URLSearchParams(old);next.set('proyecto',p.id);next.set('decision',mode);return next;})}/></>}
  {vista==='proyectos'&&<ProyectosJefaturaPage/>}
  {vista==='decisiones'&&<DecisionesPage/>}
  {vista==='indicadores'&&<><nav className="mg-subnav" aria-label="Vistas de Indicadores"><Link to="/?vista=indicadores">Indicadores</Link><Link to="/?vista=indicadores&subvista=objetivos">Objetivos del mes</Link></nav>{params.get('subvista')==='objetivos'?<MonthlyGoalsPage team/>:<Suspense fallback={<p role="status">Cargando indicadores…</p>}><IndicadoresPage/></Suspense>}</>}
  {vista==='solicitudes'&&(requests.isPending?<p role="status">Consultando solicitudes…</p>:requests.isError?<ErrorJefatura retry={()=>void requests.refetch()}/>:<RequestsList requests={requests.data.requests}/>)}
 </main></CrmSidebarLayout>;
}
