import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
export { editorialDate } from '../jefeEdicion/EditorialParts';

// The four Editor screens share the global shell and scoped editorial UI.
// Supervisory layouts retain their own composition; editor.css owns this role.
export const EDITOR_NAV = [['inicio', 'Inicio', 'inicio'], ['mi-trabajo', 'Mi trabajo', 'proceso'], ['mis-proyectos', 'Mis proyectos', 'proyectos'], ['mis-solicitudes', 'Mis solicitudes', 'comentarios']] as const;

export function EditorNav({ active, pending = 0, mobile = false }: { active: string; pending?: number; mobile?: boolean }) {
  const [open, setOpen] = useState(false);
  const nav = <nav aria-label="Navegación del Editor" className="ec-nav">{EDITOR_NAV.map(([id, label, icon]) => <Link key={id} to={id === 'inicio' ? '/' : '/?vista=' + id} aria-current={active === id ? 'page' : undefined} onClick={() => setOpen(false)}><RrppIcon nombre={icon} /><span>{label}</span>{id === 'mis-solicitudes' && pending > 0 && <small>{pending}</small>}</Link>)}</nav>;
  return mobile ? <div className="ec-mobile-nav eo-mobile-nav"><button aria-expanded={open} aria-controls="ec-mobile-menu" onClick={() => setOpen(!open)}><span aria-hidden="true">☰</span> <span>Menú del editor</span></button>{open && <div id="ec-mobile-menu">{nav}</div>}</div> : nav;
}

export function EditorPanel({ title, icon, action, children, className = '' }: { title: string; icon?: Parameters<typeof RrppIcon>[0]['nombre']; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={'ec-panel ' + className}><header>{icon && <RrppIcon nombre={icon} />}<h2>{title}</h2>{action}</header>{children}</section>;
}
export function EditorEmpty({ children }: { children: ReactNode }) { return <p className="ec-empty">{children}</p>; }
