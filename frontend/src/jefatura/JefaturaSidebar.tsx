import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
// 'solicitudes' se conserva en el tipo/lista de vistas válidas (un
// enlace viejo a /?vista=solicitudes sigue funcionando, cae en la MISMA
// vista 'inicio' con la pestaña Solicitudes preseleccionada, ver
// PanelJefaturaPage.tsx) -- pero YA NO tiene su propio ítem de sidebar
// (docs/arquitectura/17-jefatura-decisiones.md §26): es un atajo a una
// pestaña que ya vive DENTRO de Inicio, no una página aparte: quitarla
// del nav no pierde nada, ese mismo contenido sigue a un clic desde
// Inicio. "Decisiones" sí es una página real nueva.
export type VistaJefatura =
  | 'inicio'
  | 'asignaciones'
  | 'proyectos'
  | 'seguimiento'
  | 'solicitudes'
  | 'decisiones'
  | 'indicadores';
export const VISTAS_JEFATURA = [
  'inicio',
  'asignaciones',
  'proyectos',
  'seguimiento',
  'solicitudes',
  'decisiones',
  'indicadores',
] as const;
const items = [
  { id: 'inicio', nombre: 'Inicio', icono: 'inicio' },
  { id: 'asignaciones', nombre: 'Asignaciones y carga', icono: 'proceso' },
  { id: 'proyectos', nombre: 'Proyectos', icono: 'proyectos' },
  { id: 'seguimiento', nombre: 'Seguimiento', icono: 'actividad' },
  { id: 'decisiones', nombre: 'Decisiones', icono: 'ingreso' },
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
