export const TRACEABILITY_SECTIONS = [
  { id: 'proyecto', label: 'Proyecto / Ingreso' },
  { id: 'edicion', label: 'Edición' },
  { id: 'correccion', label: 'Corrección' },
  { id: 'diseno', label: 'Diseño y Diagramación' },
  { id: 'calidad', label: 'Calidad Editorial' },
  { id: 'digital', label: 'Soporte Digital' },
  { id: 'lanzamiento', label: 'Lanzamiento y Promoción' },
  { id: 'impresion', label: 'Impresión' },
  { id: 'distribucion', label: 'Distribución' },
] as const;
export type TraceabilitySection = typeof TRACEABILITY_SECTIONS[number]['id'];

export function TraceabilitySectionNav({ active, onChange }: { active: TraceabilitySection; onChange: (section: TraceabilitySection) => void }) {
  return <>
    <nav aria-label="Secciones de la ficha" className="hidden self-start rounded-xl border border-gray-100 bg-white p-2 shadow-sm lg:block">
      <p className="px-3 pb-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Ficha de trazabilidad</p>
      {TRACEABILITY_SECTIONS.map((section, i) => <button key={section.id} type="button" aria-current={active === section.id ? 'page' : undefined} onClick={() => onChange(section.id)} className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado ${active === section.id ? 'bg-dorado/15 font-semibold text-tinta' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
        <span aria-hidden="true" className="w-4 shrink-0 text-[10px] tabular-nums text-gray-400">{i + 1}</span>{section.label}
      </button>)}
    </nav>
    <div className="flex shrink-0 items-center gap-3 lg:hidden">
      <label htmlFor="traceability-section" className="text-xs font-medium text-gray-600">Sección</label>
      <select id="traceability-section" value={active} onChange={(e) => onChange(e.target.value as TraceabilitySection)} className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-dorado/40">
        {TRACEABILITY_SECTIONS.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}
      </select>
    </div>
  </>;
}
