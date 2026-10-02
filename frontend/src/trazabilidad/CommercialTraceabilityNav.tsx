export type CommercialTraceabilityView = 'ingreso' | 'resumen';
export function CommercialTraceabilityNav({ active, onChange }: { active: CommercialTraceabilityView; onChange: (v: CommercialTraceabilityView) => void }) {
  return <nav aria-label="Gestión comercial de la ficha" className="self-start rounded-xl border border-gray-100 bg-white p-2 shadow-sm">
    <p className="hidden px-3 pb-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 lg:block">Ficha de trazabilidad</p>
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
      {([{ id: 'ingreso', group: 'Tu gestión', label: 'Ingreso comercial' }, { id: 'resumen', group: 'Seguimiento', label: 'Resumen de la ficha' }] as const).map((v) => <div key={v.id}>
        <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{v.group}</p>
        <button type="button" aria-current={active === v.id ? 'page' : undefined} onClick={() => onChange(v.id)} className={`min-h-11 w-full rounded-lg px-3 py-2 text-left text-xs focus-visible:ring-2 focus-visible:ring-dorado ${active === v.id ? 'bg-dorado/15 font-semibold text-tinta' : 'text-gray-600 hover:bg-gray-50'}`}>{v.label}</button>
      </div>)}
    </div>
  </nav>;
}
