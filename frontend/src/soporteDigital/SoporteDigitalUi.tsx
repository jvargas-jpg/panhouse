import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';

export const digitalWorkKey = ['soporte-digital', 'mi-trabajo'];
export const miTrabajoUrl = (workItemId?: string) => '/?' + new URLSearchParams({ vista: 'mi-trabajo', ...(workItemId ? { workItem: workItemId } : {}) });

export function digitalDate(value: string | null, full = false) {
  if (!value) return 'Sin fecha límite';
  return new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: full ? 'long' : 'short', ...(value.length > 10 ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(value.length === 10 ? value + 'T12:00:00Z' : value));
}

export function DigitalCover({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? <img className="sd-cover" src={url} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span className="sd-cover sd-cover-empty" aria-label="Sin portada registrada"><RrppIcon nombre="libro" /></span>;
}

// Navegación del rol: la bandeja de solicitudes es saliente y privada.
export type DigitalActiveRoute = 'inicio' | 'mi-trabajo' | 'mis-solicitudes';

export function DigitalNavigation({ active, close }: { active: DigitalActiveRoute; close?: () => void }) {
  return <nav aria-label="Navegación de Soporte Digital">
    <Link to="/" aria-current={active === 'inicio' ? 'page' : undefined} onClick={close}><RrppIcon nombre="inicio" />Inicio</Link>
    <Link to={miTrabajoUrl()} aria-current={active === 'mi-trabajo' ? 'page' : undefined} onClick={close}><RrppIcon nombre="proceso" />Mi trabajo</Link>
    <Link to="/?vista=mis-solicitudes" aria-current={active === 'mis-solicitudes' ? 'page' : undefined} onClick={close}><RrppIcon nombre="comentarios" />Mis solicitudes</Link>
  </nav>;
}

export function DigitalMobileNavigation({ active }: { active: DigitalActiveRoute }) {
  const ref = useRef<HTMLDialogElement>(null), [open, setOpen] = useState(false);
  useEffect(() => { if (open) ref.current?.showModal(); else ref.current?.close(); }, [open]);
  return <div className="sd-mobile-nav">
    <button onClick={() => setOpen(true)} aria-expanded={open} aria-controls="sd-menu">☰ Menú de Soporte Digital</button>
    <dialog ref={ref} id="sd-menu" aria-label="Menú de Soporte Digital" onCancel={() => setOpen(false)}>
      <button className="sd-menu-close" aria-label="Cerrar menú" onClick={() => setOpen(false)}>×</button>
      <img src="/brand/panhouse-logo.webp" alt="PanHouse Casa Editorial" />
      <DigitalNavigation active={active} close={() => setOpen(false)} />
    </dialog>
  </div>;
}
