import { Link, useLocation } from 'react-router-dom';
import { ComercialSidebarNav } from '../comercial/ComercialSidebarNav';
import { JefaturaSidebar } from '../jefatura/JefaturaSidebar';
import { RrppSidebarNav } from '../rrpp/RrppSidebarNav';
import { NAV_ACTIVO, NAV_INACTIVO } from './CrmSidebarLayout';
import '../jefatura/jefatura.css';

export function retornoProyecto(value: string | null): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : null;
}
export function destinoProyectos(rol?: string) {
  return rol === 'jefe_area' ? '/?vista=proyectos' : rol === 'rrpp' ? '/rrpp/proyectos' : rol === 'comercial' || rol === 'direccion' ? '/proyectos' : '/';
}
export function SpecialistSidebarNav() {
  const location = useLocation();
  const metricas = new URLSearchParams(location.search).get('vista') === 'metricas';
  const home = location.pathname === '/';
  return <><Link to="/" className={home && !metricas ? NAV_ACTIVO : NAV_INACTIVO}>Tablero Kanban</Link><Link to="/?vista=metricas" className={home && metricas ? NAV_ACTIVO : NAV_INACTIVO}>Métricas de Producción</Link></>;
}
export function RoleProjectNavigation({ rol, origen, mobile = false }: { rol?: string; origen?: string | null; mobile?: boolean }) {
  if (rol === 'jefe_area') return <JefaturaSidebar vista={origen?.includes('vista=asignaciones') ? 'asignaciones' : 'proyectos'} mobile={mobile} />;
  const nav = rol === 'rrpp' ? <RrppSidebarNav vista="proyectos" /> : rol === 'comercial' || rol === 'direccion' ? <ComercialSidebarNav activo="proyectos" /> : rol === 'especialista' ? <SpecialistSidebarNav /> : <Link to="/" className={NAV_INACTIVO}>{({editor:'Mi espacio de Edición',jefe_edicion:'Jefatura de Edición',corrector:'Mis correcciones',disenador:'Mis trabajos de Diseño',lider_creativo:'Dirección creativa',soporte_editorial:'Soporte editorial',soporte_digital:'Soporte digital',impresion:'Impresión',distribucion:'Distribución'} as Record<string,string>)[rol ?? ''] ?? 'Inicio'}</Link>;
  return mobile ? <nav className="rp-mobile-nav" aria-label="Navegación del rol">{nav}</nav> : nav;
}
