import { SECCIONES_AUTOR_FORM, type SeccionAutorForm } from './authorFormSecciones';

const ICONO_CHECK = 'M5 13l4 4L19 7';

// Navegación interna del formulario de autor — NO es un wizard: el
// usuario puede saltar libremente entre secciones, nada bloquea el
// avance ni exige un orden. Un solo componente cubre las dos variantes
// (sidebar vertical en desktop, tabs horizontales en mobile) para que
// la lógica de "qué sección está activa / cuál tiene datos" viva en un
// solo lugar — CrearAutorForm.tsx decide vía Tailwind (hidden md:flex /
// flex md:hidden) cuál variante se pinta en cada breakpoint.
export function AuthorFormSectionNav({
  activa,
  onCambiar,
  seccionesConDatos,
  variant,
}: {
  activa: SeccionAutorForm;
  onCambiar: (seccion: SeccionAutorForm) => void;
  seccionesConDatos: Record<SeccionAutorForm, boolean>;
  variant: 'sidebar' | 'tabs';
}) {
  if (variant === 'tabs') {
    return (
      <div role="tablist" aria-label="Secciones del formulario de autor" className="flex gap-1.5 overflow-x-auto">
        {SECCIONES_AUTOR_FORM.map((seccion) => {
          const esActiva = seccion.id === activa;
          return (
            <button
              key={seccion.id}
              type="button"
              role="tab"
              id={`autor-form-tab-tabs-${seccion.id}`}
              aria-selected={esActiva}
              aria-controls="autor-form-panel"
              onClick={() => onCambiar(seccion.id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado/40 ${
                esActiva ? 'bg-dorado/15 text-dorado' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <IndicadorSeccion esActiva={esActiva} tieneDatos={seccionesConDatos[seccion.id]} />
              {seccion.etiquetaCorta}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="tablist" aria-label="Secciones del formulario de autor" aria-orientation="vertical" className="flex flex-col gap-0.5">
      <p className="mb-2 px-2.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">Perfil del autor</p>
      {SECCIONES_AUTOR_FORM.map((seccion) => {
        const esActiva = seccion.id === activa;
        return (
          <button
            key={seccion.id}
            type="button"
            role="tab"
            id={`autor-form-tab-sidebar-${seccion.id}`}
            aria-selected={esActiva}
            aria-controls="autor-form-panel"
            onClick={() => onCambiar(seccion.id)}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado/40 ${
              esActiva ? 'bg-dorado/10 font-semibold text-gray-900' : 'text-gray-500 hover:bg-gray-100/80 hover:text-gray-700'
            }`}
          >
            <IndicadorSeccion esActiva={esActiva} tieneDatos={seccionesConDatos[seccion.id]} />
            {seccion.etiqueta}
          </button>
        );
      })}
    </div>
  );
}

// Prioridad visual: activa (punto dorado) > tiene datos (check) > vacía
// (círculo neutro). Puramente informativo — nunca bloquea el submit ni
// funciona como validación (ver comentario en CrearAutorForm.tsx sobre
// seccionesConDatos).
function IndicadorSeccion({ esActiva, tieneDatos }: { esActiva: boolean; tieneDatos: boolean }) {
  if (esActiva) return <span className="h-2 w-2 shrink-0 rounded-full bg-dorado" />;
  if (tieneDatos) {
    return (
      <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={ICONO_CHECK} />
      </svg>
    );
  }
  return <span className="h-2 w-2 shrink-0 rounded-full border border-gray-300" />;
}
