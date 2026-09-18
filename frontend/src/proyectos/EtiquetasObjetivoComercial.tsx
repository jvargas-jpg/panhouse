import { useState, type KeyboardEvent } from 'react';

const INPUT_CLASS =
  'w-full bg-white border border-gray-200 text-gray-900 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-tinta/20 focus:border-tinta transition-all placeholder:text-gray-400';

// Campo "Objetivo comercial" de SeccionFichaEditorial.tsx: un proyecto
// puede perseguir más de un objetivo comercial a la vez. Mismo patrón de
// chips que EtiquetasPersonalidad.tsx (autores/), pero adaptado a
// proyectos/ — texto libre, sin catálogo cerrado (el negocio no dio una
// lista fija de opciones, a diferencia de Condiciones especiales, ver
// SelectorMultipleCondicionesEspeciales.tsx).
export function EtiquetasObjetivoComercial({
  value,
  onChange,
}: {
  value: string[];
  onChange: (etiquetas: string[]) => void;
}) {
  const [entrada, setEntrada] = useState('');

  function agregarEtiqueta() {
    const texto = entrada.trim();
    if (!texto || value.includes(texto)) {
      setEntrada('');
      return;
    }
    onChange([...value, texto]);
    setEntrada('');
  }

  function quitarEtiqueta(etiqueta: string) {
    onChange(value.filter((e) => e !== etiqueta));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // preventDefault: sin esto, Enter dentro de un input de un <form>
    // dispara el submit del formulario completo en vez de solo agregar
    // la etiqueta.
    if (event.key === 'Enter') {
      event.preventDefault();
      agregarEtiqueta();
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          id="ficha-editorial-objetivo-comercial-entrada"
          type="text"
          placeholder="Ej. Posicionamiento de marca personal"
          value={entrada}
          onChange={(event) => setEntrada(event.target.value)}
          onKeyDown={handleKeyDown}
          className={INPUT_CLASS}
        />
        <button
          type="button"
          onClick={agregarEtiqueta}
          disabled={!entrada.trim()}
          aria-label="Agregar objetivo comercial"
          className="flex w-11 flex-shrink-0 items-center justify-center rounded-md bg-tinta text-lg font-medium text-white shadow-sm transition-all hover:bg-gray-800 disabled:opacity-60"
        >
          +
        </button>
      </div>

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((etiqueta) => (
            <span key={etiqueta} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-3 pr-2 text-sm text-gray-800">
              {etiqueta}
              <button
                type="button"
                onClick={() => quitarEtiqueta(etiqueta)}
                aria-label={`Quitar ${etiqueta}`}
                className="rounded-full p-0.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
