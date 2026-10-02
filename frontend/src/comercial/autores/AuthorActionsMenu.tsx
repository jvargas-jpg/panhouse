import { useState } from 'react';

const ICONO_PUNTOS = 'M12 6h.01M12 12h.01M12 18h.01';

// "⋮" con Editar/Eliminar — mismo patrón de desplegable que
// NotificacionesCampana.tsx (TopBar.tsx global): backdrop transparente
// fixed inset-0 que cierra al hacer clic afuera, sin sumar un hook de
// "click outside" aparte. Solo dos acciones a propósito: son las únicas
// que ya existen (editarAutor/eliminarAutor, mismas mutaciones que ya
// usaba ClientesGrid.tsx) — no hay pantalla de detalle de autor ni forma
// de filtrar sus proyectos sin backend nuevo, así que "Ver autor"/"Ver
// proyectos" no se agregaron (ver el comentario de CommercialAuthorsView.tsx).
export function AuthorActionsMenu({ onEditar, onEliminar }: { onEditar: () => void; onEliminar: () => void }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Más acciones"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((valor) => !valor)}
        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado/40"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={ICONO_PUNTOS} />
        </svg>
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div role="menu" className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-lg border border-gray-100 bg-white py-1 shadow-lg">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAbierto(false);
                onEditar();
              }}
              className="block w-full px-3.5 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
            >
              Editar
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAbierto(false);
                onEliminar();
              }}
              className="block w-full px-3.5 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
            >
              Eliminar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
