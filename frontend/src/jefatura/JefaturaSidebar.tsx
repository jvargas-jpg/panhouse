import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
export type VistaJefatura =
  | 'inicio'
  | 'asignaciones'
  | 'proyectos'
  | 'seguimiento'
  | 'solicitudes'
  | 'indicadores';
export const VISTAS_JEFATURA = [
  'inicio',
  'asignaciones',
  'proyectos',
  'seguimiento',
  'solicitudes',
  'indicadores',
] as const;
const items = [
  { id: 'inicio', nombre: 'Inicio', icono: 'inicio' },
  { id: 'asignaciones', nombre: 'Asignaciones y carga', icono: 'proceso' },
  { id: 'proyectos', nombre: 'Proyectos', icono: 'proyectos' },
  { id: 'seguimiento', nombre: 'Seguimiento', icono: 'actividad' },
  { id: 'solicitudes', nombre: 'Solicitudes', icono: 'ingreso' },
  { id: 'indicadores', nombre: 'Indicadores', icono: 'indicadores' },
] as const;
export function JefaturaSidebar({
  vista,
  mobile = false,
}: {
  vista: VistaJefatura;
  mobile?: boolean;
}) {
  return (
    <nav
      aria-label={
        mobile ? 'Navegación de Jefatura móvil' : 'Navegación de Jefatura'
      }
      className={mobile ? 'jf-mobile-nav' : 'jf-nav'}
    >
      {items.map((item) => (
        <Link
          key={item.id}
          to={item.id === 'inicio' ? '/' : `/?vista=${item.id}`}
          aria-current={vista === item.id ? 'page' : undefined}
          className={`${vista === item.id ? 'jf-nav-active' : ''} ${item.id === 'indicadores' ? 'jf-nav-divider' : ''}`}
        >
          <RrppIcon
            nombre={item.icono}
            className="h-[18px] w-[18px] shrink-0"
          />
          {item.nombre}
        </Link>
      ))}
    </nav>
  );
}
