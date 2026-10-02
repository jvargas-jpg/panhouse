import type { ReactNode } from 'react';
import type { FichaCompleta, ProyectoDetalleConAutores } from '../types/api';
import { SeccionEdicion } from '../proyectos/SeccionEdicion';
import { SeccionFichaEditorial } from '../proyectos/SeccionFichaEditorial';
import { SeccionCorreccion } from '../proyectos/SeccionCorreccion';
import { SeccionCorreccionControl } from '../proyectos/SeccionCorreccionControl';
import { SeccionDiseno, SeccionDisenoBrief } from '../proyectos/SeccionDiseno';
import { SeccionCalidad } from '../proyectos/SeccionCalidad';
import { SeccionSoporteDigital } from '../proyectos/SeccionSoporteDigital';
import { SeccionLanzamientoPromocion } from '../proyectos/SeccionLanzamientoPromocion';
import { SeccionLanzamiento } from '../proyectos/SeccionLanzamiento';
import { SeccionImpresion } from '../proyectos/SeccionImpresion';
import { SeccionDistribucion } from '../proyectos/SeccionDistribucion';
import { TRACEABILITY_SECTIONS, type TraceabilitySection } from './TraceabilitySectionNav';

function ReadOnlyBlock({ title, children }: { title: string; children: ReactNode }) {
  return <div className="border-b border-gray-100 pb-5 last:border-0 last:pb-0"><h3 className="mb-3 text-sm font-semibold text-gray-900">{title}</h3><div className="[&_h3]:hidden [&>div]:border-0 [&>div]:p-0 [&>div]:shadow-none [&>div]:rounded-none">{children}</div></div>;
}

// GET /fichas-trazabilidad/:id already authorizes Comercial to read these
// fields. Every reused component is explicitly read-only. RRPP matrices
// retain their narrower visibility and are not mounted here.
export function TraceabilityReadOnlySection({ section, proyecto, ficha }: { section: Exclude<TraceabilitySection, 'proyecto'>; proyecto: ProyectoDetalleConAutores; ficha: FichaCompleta }) {
  const p = { proyectoId: proyecto.id, ficha, puedeEditar: false };
  return <section aria-label={TRACEABILITY_SECTIONS.find((s) => s.id === section)?.label} className="flex h-full min-h-0 flex-col">
    <header className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-gray-100 px-5 py-4 sm:px-6">
      <div><h2 className="text-base font-semibold text-gray-900">{TRACEABILITY_SECTIONS.find((s) => s.id === section)?.label}</h2><p className="mt-1 text-xs text-gray-500">Consulta la información registrada por el área responsable.</p></div><span className="rounded-md bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">Solo lectura</span>
    </header>
    <div className="min-h-0 flex-1 overflow-auto px-5 py-5 sm:px-6">
      <div className="space-y-4 break-words [&_.grid-cols-2]:grid-cols-1 sm:[&_.grid-cols-2]:grid-cols-2 [&_table]:text-xs [&_h3]:text-sm">
        {section === 'edicion' && <><ReadOnlyBlock title="Control de Edición"><SeccionEdicion {...p} /></ReadOnlyBlock><ReadOnlyBlock title="Ficha editorial · RRPP"><SeccionFichaEditorial {...p} /></ReadOnlyBlock></>}
        {section === 'correccion' && <><ReadOnlyBlock title="Control de Corrección"><SeccionCorreccionControl {...p} /></ReadOnlyBlock><ReadOnlyBlock title="Matriz de Corrección"><SeccionCorreccion {...p} /></ReadOnlyBlock></>}
        {section === 'diseno' && <><ReadOnlyBlock title="Brief creativo"><SeccionDisenoBrief {...p} proyecto={proyecto} rolUsuario="comercial" /></ReadOnlyBlock><ReadOnlyBlock title="Diseño y propuestas de portada"><SeccionDiseno {...p} proyecto={proyecto} puedeEditarControl={false} rolUsuario="comercial" /></ReadOnlyBlock></>}
        {section === 'calidad' && <ReadOnlyBlock title="Control y Calidad Editorial"><SeccionCalidad {...p} puedeEditarControl={false} /></ReadOnlyBlock>}
        {section === 'digital' && <ReadOnlyBlock title="Control y Soporte Digital"><SeccionSoporteDigital {...p} puedeEditarControl={false} /></ReadOnlyBlock>}
        {section === 'lanzamiento' && <><ReadOnlyBlock title="Lanzamiento y Promoción · RRPP"><SeccionLanzamientoPromocion {...p} /></ReadOnlyBlock><ReadOnlyBlock title="Seguimiento de lanzamiento"><SeccionLanzamiento {...p} puedeEditarControl={false} /></ReadOnlyBlock></>}
        {section === 'impresion' && <ReadOnlyBlock title="Impresión"><SeccionImpresion {...p} /></ReadOnlyBlock>}
        {section === 'distribucion' && <ReadOnlyBlock title="Distribución"><SeccionDistribucion {...p} puedeEditarControl={false} /></ReadOnlyBlock>}
      </div>
    </div>
  </section>;
}
