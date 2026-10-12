import { Link, useLocation } from 'react-router-dom';
import { ComercialSidebarNav } from '../comercial/ComercialSidebarNav';
import { JefaturaSidebar, VISTAS_JEFATURA } from '../jefatura/JefaturaSidebar';
import { RrppSidebarNav } from '../rrpp/RrppSidebarNav';
import { NAV_INACTIVO } from './CrmSidebarLayout';
import { RrppIcon } from '../rrpp/RrppIcons';
import '../jefatura/jefatura.css';
export const PRODUCTION_LOGO = <img src="/brand/panhouse-logo.webp" alt="PanHouse Casa Editorial" className="h-auto w-[176px] object-contain"/>;

export function retornoProyecto(value: string | null): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : null;
}
export function destinoProyectos(rol?: string) {
  return rol === 'especialista' ? '/?vista=mis-proyectos' : rol === 'jefe_area' ? '/?vista=proyectos' : rol === 'rrpp' ? '/rrpp/proyectos' : rol === 'comercial' || rol === 'direccion' ? '/proyectos' : '/';
}
export function SpecialistSidebarNav({ origen, mobile = false }: { origen?: string | null; mobile?: boolean }) {
  const location = useLocation();
  const active = new URLSearchParams(location.pathname === '/' ? location.search : origen?.split('?')[1]).get('vista') ?? 'inicio';
  const items = [{id:'inicio',label:'Inicio',icon:'inicio'}, {id:'mis-proyectos',label:'Mis proyectos',icon:'proyectos'}, {id:'mi-trabajo',label:'Mi trabajo',icon:'actividad'}, {id:'solicitudes',label:'Solicitudes',icon:'ingreso'}, {id:'objetivos',label:'Objetivos del mes',icon:'indicadores'}] as const;
  return <nav aria-label={mobile ? 'Navegación del Especialista móvil' : 'Navegación del Especialista'} className={mobile ? 'jf-mobile-nav' : 'jf-nav'}>{items.map(i => <Link key={i.id} to={i.id === 'inicio' ? '/' : '/?vista='+i.id} aria-current={active === i.id ? 'page' : undefined} className={active === i.id ? 'jf-nav-active' : ''}><RrppIcon nombre={i.icon} className="h-[18px] w-[18px] shrink-0"/>{i.label}</Link>)}</nav>;
}
export function RoleProjectNavigation({ rol, origen, mobile = false }: { rol?: string; origen?: string | null; mobile?: boolean }) {
  if (rol === 'jefe_area') {
    const vista = new URLSearchParams(origen?.split('?')[1]).get('vista');
    const active = VISTAS_JEFATURA.find(v => v === vista) ?? 'proyectos';
    return <JefaturaSidebar vista={active === 'solicitudes' ? 'inicio' : active} mobile={mobile} />;
  }
  if (rol === 'especialista') return <SpecialistSidebarNav origen={origen} mobile={mobile}/>;
  const nav = rol === 'rrpp' ? <RrppSidebarNav vista="proyectos" /> : rol === 'comercial' || rol === 'direccion' ? <ComercialSidebarNav activo="proyectos" /> : <Link to="/" className={NAV_INACTIVO}>{({editor:'Mi espacio de Edición',jefe_edicion:'Jefatura de Edición',corrector:'Mis correcciones',disenador:'Mis trabajos de Diseño',lider_creativo:'Dirección creativa',soporte_editorial:'Soporte editorial',soporte_digital:'Soporte digital',impresion:'Impresión',distribucion:'Distribución'} as Record<string,string>)[rol ?? ''] ?? 'Inicio'}</Link>;
  return mobile ? <nav className="rp-mobile-nav" aria-label="Navegación del rol">{nav}</nav> : nav;
}
