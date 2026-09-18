import { PAISES } from './paises';

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40';

// Campo "Nacionalidad" de CrearAutorForm.tsx: un autor puede tener más
// de una (doble nacionalidad, naturalización) — mismo lenguaje visual de
// chip que EtiquetasPersonalidad.tsx/EtiquetasCorreos.tsx, pero acá cada
// etiqueta sale de PAISES (catálogo cerrado, mismo que ya usaba el
// <select> de "Nacionalidad" antes de este cambio), no de texto libre —
// mismo criterio que SelectorMultipleAutores.tsx: un <select> para
// agregar en vez de un input+Enter, así ningún país se guarda con un
// typo o una variante de tipeo distinta.
export function SelectorMultipleNacionalidades({ value, onChange }: { value: string[]; onChange: (nacionalidades: string[]) => void }) {
  const disponibles = PAISES.filter((pais) => !value.includes(pais));

  function agregar(pais: string) {
    if (!pais) return;
    onChange([...value, pais]);
  }

  function quitar(pais: string) {
    onChange(value.filter((p) => p !== pais));
  }

  return (
    <div>
      <select
        id="autor-nacionalidad"
        value=""
        onChange={(event) => agregar(event.target.value)}
        className={INPUT_CLASS}
      >
        <option value="">Agregar nacionalidad…</option>
        {disponibles.map((pais) => (
          <option key={pais} value={pais}>
            {pais}
          </option>
        ))}
      </select>

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((pais) => (
            <span key={pais} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-3 pr-2 text-sm text-gray-800">
              {pais}
              <button
                type="button"
                onClick={() => quitar(pais)}
                aria-label={`Quitar ${pais}`}
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
