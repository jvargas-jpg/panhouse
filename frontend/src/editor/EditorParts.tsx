import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
export { editorialDate } from '../jefeEdicion/EditorialParts';

// The four Editor screens share the global shell and scoped editorial UI.
// Supervisory layouts retain their own composition; editor.css owns this role.
export const EDITOR_NAV = [['inicio', 'Inicio', 'inicio'], ['mi-trabajo', 'Mi trabajo', 'proceso'], ['mis-proyectos', 'Mis proyectos', 'proyectos'], ['mis-solicitudes', 'Mis solicitudes', 'comentarios']] as const;

export function EditorNav({active,pending=0}:{active:string;pending?:number}){return <nav aria-label="Navegación del Editor">{EDITOR_NAV.map(([id,label,icon])=><Link key={id} to={id==='inicio'?'/':'/?vista='+id} aria-current={active===id?'page':undefined}><RrppIcon nombre={icon}/><span>{label}</span>{id==='mis-solicitudes'&&pending>0&&<small>{pending}</small>}</Link>)}</nav>;}

export function EditorPanel({ title, icon, action, children, className = '' }: { title: string; icon?: Parameters<typeof RrppIcon>[0]['nombre']; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={'ec-panel ' + className}><header>{icon && <RrppIcon nombre={icon} />}<h2>{title}</h2>{action}</header>{children}</section>;
}
export function EditorEmpty({ children }: { children: ReactNode }) { return <p className="ec-empty">{children}</p>; }
