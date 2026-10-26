import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
export { editorialDate } from '../jefeEdicion/EditorialParts';

// Mismo sistema visual navy/gold que Jefe de Edición (reutiliza
// editorialChief.css tal cual: .ec-shell/.ec-nav/.ec-mobile-nav/.ec-panel
// etc.) -- las 4 imágenes de referencia de Editor usan la misma identidad
// PanHouse, así que no hace falta un CSS nuevo, solo un nav propio.
export const EDITOR_NAV = [['inicio', 'Inicio', 'inicio'], ['mi-trabajo', 'Mi trabajo', 'proceso'], ['mis-proyectos', 'Mis proyectos', 'proyectos'], ['mis-solicitudes', 'Mis solicitudes', 'ingreso']] as const;

export function EditorNav({ active, pending = 0, mobile = false }: { active: string; pending?: number; mobile?: boolean }) {
  const [open, setOpen] = useState(false);
  const nav = <nav aria-label="Navegación del Editor" className="ec-nav">{EDITOR_NAV.map(([id, label, icon]) => <Link key={id} to={id === 'inicio' ? '/' : '/?vista=' + id} aria-current={active === id ? 'page' : undefined} onClick={() => setOpen(false)}><RrppIcon nombre={icon} /><span>{label}</span>{id === 'mis-solicitudes' && pending > 0 && <small>{pending}</small>}</Link>)}</nav>;
  return mobile ? <div className="ec-mobile-nav"><button aria-expanded={open} aria-controls="ec-mobile-menu" onClick={() => setOpen(!open)}>☰ <span>Área de Edición</span></button>{open && <div id="ec-mobile-menu">{nav}</div>}</div> : nav;
}

export function EditorPanel({ title, icon, action, children, className = '' }: { title: string; icon?: Parameters<typeof RrppIcon>[0]['nombre']; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={'ec-panel ' + className}><header>{icon && <RrppIcon nombre={icon} />}<h2>{title}</h2>{action}</header>{children}</section>;
}
export function EditorEmpty({ children }: { children: ReactNode }) { return <p className="ec-empty">{children}</p>; }
