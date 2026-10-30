import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';

export const soporteEditorialHomeKey = ['soporte-editorial', 'inicio'];
export const soporteEditorialWorkKey = ['soporte-editorial', 'mi-trabajo'];
export const miTrabajoUrl = (workItem?: string) => '/?' + new URLSearchParams({ vista: 'mi-trabajo', ...(workItem ? { workItem } : {}) });
// La única superficie real donde soporte_editorial opera hoy una ronda es
// la sección de Calidad del proyecto (SeccionCalidadOperativa.tsx) — no
// existe todavía un "Mi trabajo" propio del rol. ProyectoDetallePage.tsx
// solo da especialista/jefe_area el Command Center (?proceso=); cualquier
// otro rol, soporte_editorial incluido, recibe ProyectoDetalleLegacyPage,
// cuya navegación es por hash (#calidad → Fase 8, ver esa página línea
// ~120) — nunca el query param del Command Center, que esta ruta ignora.
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
export function SoporteEditorialNavigation({ active, close }: { active: SoporteEditorialActiveRoute; close?: () => void }) {
  return <nav aria-label="Navegación de Soporte Editorial">
    <Link to="/" aria-current={active === 'inicio' ? 'page' : undefined} onClick={close}><RrppIcon nombre="inicio" />Inicio</Link>
    <Link to={miTrabajoUrl()} aria-current={active === 'mi-trabajo' ? 'page' : undefined} onClick={close}><RrppIcon nombre="proceso" />Mi trabajo</Link>
    <Link to="/?vista=mis-solicitudes" aria-current={active === 'mis-solicitudes' ? 'page' : undefined} onClick={close}><RrppIcon nombre="comentarios" />Mis solicitudes</Link>
  </nav>;
}
