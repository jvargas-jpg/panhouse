import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { AppFrame } from '../layout/AppFrame';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { useMe } from '../auth/useAuth';
import './authorPortal.css';

// The customer portal keeps its focused navigation and uses the same account bar and surfaces.
export function AutorLayout() {
  const {data:user}=useMe();
  if(user?.rol!=='autor')return <Navigate to="/" replace/>;
  const nav=[['/autor','Inicio','⌂'],['/autor/proyectos','Mis proyectos','▤'],['/autor/aprobaciones','Aprobaciones','✓'],['/autor/documentos','Documentos','▱'],['/autor/solicitudes','Solicitudes','↗'],['/autor/notificaciones','Notificaciones','◉']];
  return <AppFrame><CrmSidebarLayout contexto="fullscreen" shellClassName="ap-shell" contentMaxWidth="max-w-6xl" contentClassName="author-portal" nav={<nav aria-label="Portal del Autor"><p className="ph-nav-label">TU ESPACIO EDITORIAL</p>{nav.map(([path,label,icon])=><NavLink key={path} to={path} end={path==='/autor'} className={({isActive})=>'ph-nav-item'+(isActive?' ph-nav-active':'')}><span aria-hidden="true">{icon}</span>{label}</NavLink>)}</nav>}><Outlet/></CrmSidebarLayout></AppFrame>;
}
