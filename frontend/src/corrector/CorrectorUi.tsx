import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';

export const correctorHomeKey = ['corrector', 'inicio'];
export const correctorWorkKey = ['corrector', 'mi-trabajo'];
export const workUrl = (workItemId?: string) => '/?' + new URLSearchParams({ vista: 'mi-trabajo', ...(workItemId ? { workItem: workItemId } : {}) });
export const solicitudesUrl = () => '/?' + new URLSearchParams({ vista: 'mis-solicitudes' });

export function correctorDate(value: string | null, full = false) {
  if (!value) return 'Sin fecha límite';
  return new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: full ? 'long' : 'short', ...(value.length > 10 ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(value.length === 10 ? value + 'T12:00:00Z' : value));
}

export function CorrectorCover({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? <img className="coh-cover" src={url} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span className="coh-cover coh-cover-empty" aria-label="Sin portada registrada"><RrppIcon nombre="libro" /></span>;
}

export type CorrectorActiveRoute = 'inicio' | 'mi-trabajo' | 'mis-solicitudes';

export function CorrectorNavigation({ active, close }: { active: CorrectorActiveRoute; close?: () => void }) {
  return <nav aria-label="Navegación del Corrector">
    <Link to="/" aria-current={active === 'inicio' ? 'page' : undefined} onClick={close}><RrppIcon nombre="inicio" />Inicio</Link>
    <Link to={workUrl()} aria-current={active === 'mi-trabajo' ? 'page' : undefined} onClick={close}><RrppIcon nombre="proceso" />Mi trabajo</Link>
    <Link to={solicitudesUrl()} aria-current={active === 'mis-solicitudes' ? 'page' : undefined} onClick={close}><RrppIcon nombre="comentarios" />Mis solicitudes</Link>
  </nav>;
}

export function CorrectorMobileNavigation({ active }: { active: CorrectorActiveRoute }) {
  const ref = useRef<HTMLDialogElement>(null), [open, setOpen] = useState(false);
  useEffect(() => { if (open) ref.current?.showModal(); else ref.current?.close(); }, [open]);
  return <div className="coh-mobile-nav">
    <button onClick={() => setOpen(true)} aria-expanded={open} aria-controls="coh-mobile-menu">☰ Menú del corrector</button>
    <dialog ref={ref} id="coh-mobile-menu" aria-label="Menú del Corrector" onCancel={() => setOpen(false)}>
      <button className="coh-close-menu" onClick={() => setOpen(false)} aria-label="Cerrar menú">×</button>
      <img src="/brand/panhouse-logo.webp" alt="PanHouse Casa Editorial" />
      <CorrectorNavigation active={active} close={() => setOpen(false)} />
    </dialog>
  </div>;
}
