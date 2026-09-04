import { useState } from 'react';
import { CODIGOS_TELEFONICOS } from './codigosTelefonicos';

// Reemplaza el <select> nativo del código de país en CrearAutorForm.tsx:
// cerrado, un <select> estándar muestra la opción completa ("Venezuela
// (+58)") y le roba ancho al input del número de al lado. Este botón
// cerrado solo muestra el código; la lista abierta sí muestra "País
// (+Código)" completo. Mismo patrón de dropdown ya usado en
// NotificacionesCampana.tsx: backdrop fixed inset-0 transparente para
// cerrar al clickear afuera, sin sumar un hook de "click outside" aparte.
export function SelectorCodigoTelefonico({ value, onChange }: { value: string; onChange: (codigo: string) => void }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((actual) => !actual)}
        aria-label="Código de país"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className="flex w-24 shrink-0 items-center justify-between gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40 sm:w-28"
      >
        <span>{value}</span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${abierto ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />

          <ul
            role="listbox"
            aria-label="Código de país"
            className="absolute left-0 z-50 mt-1 max-h-60 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {CODIGOS_TELEFONICOS.map((c) => (
              <li key={`${c.pais}-${c.codigo}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.codigo === value}
                  onClick={() => {
                    onChange(c.codigo);
                    setAbierto(false);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                    c.codigo === value ? 'bg-dorado/10 font-medium text-dorado' : 'text-gray-700'
                  }`}
                >
                  {c.pais} ({c.codigo})
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
