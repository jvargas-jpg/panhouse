import { useState, type KeyboardEvent } from 'react';

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40';

// Mismo formato que valida Zod en el backend (z.string().email()) — no
// exactamente el mismo validador (Zod usa su propio regex interno), pero
// alcanza para bloquear errores obvios de tipeo en el cliente antes de
// mandar la petición; el backend sigue siendo la fuente de verdad.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Campo "Correo" de CrearAutorForm.tsx: un autor puede tener varios
// correos de contacto (personal, representante, editorial) — mismo
// patrón de chips que EtiquetasPersonalidad.tsx, pero acá cada etiqueta
// se valida como email antes de agregarse, y además de Enter, una coma
// también cierra la etiqueta (común al pegar una lista "a@x.com, b@x.com").
export function EtiquetasCorreos({ value, onChange }: { value: string[]; onChange: (correos: string[]) => void }) {
  const [entrada, setEntrada] = useState('');
  const [error, setError] = useState<string | null>(null);

  function agregarEtiqueta(textoCrudo: string) {
    const texto = textoCrudo.trim();
    if (!texto) {
      setEntrada('');
      return;
    }
    if (!EMAIL_REGEX.test(texto)) {
      setError(`"${texto}" no es un correo válido`);
      return;
    }
    setError(null);
    setEntrada('');
    if (value.includes(texto)) return;
    onChange([...value, texto]);
  }

  function quitarEtiqueta(correo: string) {
    onChange(value.filter((e) => e !== correo));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // preventDefault en Enter: sin esto, dispara el submit del <form>
    // en vez de solo agregar la etiqueta (mismo motivo que
    // EtiquetasPersonalidad.tsx). La coma también agrega, pero no
    // necesita preventDefault — no tiene efecto por defecto en un input
    // de texto que valga la pena bloquear.
    if (event.key === 'Enter') {
      event.preventDefault();
      agregarEtiqueta(entrada);
    } else if (event.key === ',') {
      event.preventDefault();
      agregarEtiqueta(entrada);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          id="autor-email-entrada"
          type="text"
          inputMode="email"
          placeholder="correo@ejemplo.com"
          value={entrada}
          onChange={(event) => {
            setEntrada(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          className={INPUT_CLASS}
        />
        <button
          type="button"
          onClick={() => agregarEtiqueta(entrada)}
          disabled={!entrada.trim()}
          aria-label="Agregar correo"
          className="flex w-11 flex-shrink-0 items-center justify-center rounded-lg bg-tinta text-lg font-medium text-white shadow-sm transition-all hover:bg-gray-800 disabled:opacity-60"
        >
          +
        </button>
      </div>

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((correo) => (
            <span key={correo} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-3 pr-2 text-sm text-gray-800">
              {correo}
              <button
                type="button"
                onClick={() => quitarEtiqueta(correo)}
                aria-label={`Quitar ${correo}`}
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
