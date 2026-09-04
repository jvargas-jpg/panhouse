import { useState, type KeyboardEvent } from 'react';

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40';

// Campo "Personalidad" de CrearAutorForm.tsx: era un textarea de texto
// libre, ahora es un array de etiquetas cortas ("Extrovertida",
// "Directa") — más fácil de escanear en el directorio de clientes que un
// párrafo, y hace que el dato sea filtrable/agregable más adelante sin
// parsear texto. Controlado (value/onChange), como SelectorCodigoTelefonico.tsx.
export function EtiquetasPersonalidad({ value, onChange }: { value: string[]; onChange: (etiquetas: string[]) => void }) {
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
          id="autor-personalidad-entrada"
          type="text"
          placeholder="Ej. Extrovertida"
          value={entrada}
          onChange={(event) => setEntrada(event.target.value)}
          onKeyDown={handleKeyDown}
          className={INPUT_CLASS}
        />
        <button
          type="button"
          onClick={agregarEtiqueta}
          disabled={!entrada.trim()}
          aria-label="Agregar etiqueta"
          className="flex w-11 flex-shrink-0 items-center justify-center rounded-lg bg-tinta text-lg font-medium text-white shadow-sm transition-all hover:bg-gray-800 disabled:opacity-60"
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
