// Legacy shared-inbox adapter. Active Validador assignments use validaciones and shared/validationWork.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';

export const soporteEditorialHomeKey = ['soporte-editorial', 'inicio'];
export const soporteEditorialWorkKey = ['soporte-editorial', 'mi-trabajo'];
export const miTrabajoUrl = (workItem?: string) => '/?' + new URLSearchParams({ vista: 'mi-trabajo', ...(workItem ? { workItem } : {}) });
// Historical project link; the active validator surface is / with a validation ID.
export const openValidationUrl = (projectId: string) => `/proyectos/${projectId}#calidad`;

export function soporteEditorialDate(value: string | null, full = false) {
  if (!value) return 'Sin fecha límite';
  return new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: full ? 'long' : 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function SoporteEditorialCover({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? <img className="se-cover" src={url} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span className="se-cover se-cover-empty" aria-label="Sin portada registrada"><RrppIcon nombre="libro" /></span>;
}

export type SoporteEditorialActiveRoute = 'inicio' | 'mi-trabajo' | 'mis-solicitudes';

// Navegación del shell aprobado; cada entrada tiene una ruta funcional.
export function SoporteEditorialNavigation({ close }: { active: SoporteEditorialActiveRoute; close?: () => void }) {
  return <nav aria-label="Navegación de Validadores"><Link to="/" aria-current="page" onClick={close}><RrppIcon nombre="proceso" />Validaciones</Link></nav>;
}
