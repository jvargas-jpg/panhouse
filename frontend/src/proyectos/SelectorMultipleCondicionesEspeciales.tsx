import type { CondicionEspecial } from '../types/api';

const INPUT_CLASS =
  'w-full rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado';

const OPCIONES: CondicionEspecial[] = ['Ilustraciones', 'Gráficos', 'Diagramación especial', 'Diagramación ultra especial'];

// Campo "Condiciones especiales" de SeccionProyectoPerfil.tsx: un
// proyecto puede necesitar más de una a la vez (ej. ilustraciones Y
// diagramación especial) — mismo lenguaje visual de chip que
// SelectorMultipleNacionalidades.tsx (un <select> "Agregar…" sobre un
// catálogo cerrado, no texto libre), adaptado de autores/ a proyectos/
// porque este campo es del proyecto, no del autor.
export function SelectorMultipleCondicionesEspeciales({
  value,
  onChange,
  disabled,
}: {
  value: CondicionEspecial[];
  onChange: (condiciones: CondicionEspecial[]) => void;
  disabled?: boolean;
}) {
  const disponibles = OPCIONES.filter((opcion) => !value.includes(opcion));

  function agregar(condicion: string) {
    if (!condicion) return;
    onChange([...value, condicion as CondicionEspecial]);
  }

  function quitar(condicion: CondicionEspecial) {
    onChange(value.filter((c) => c !== condicion));
  }

  return (
    <div>
      <select
        id="condiciones-especiales"
        value=""
        disabled={disabled || disponibles.length === 0}
        onChange={(event) => agregar(event.target.value)}
        className={INPUT_CLASS}
      >
        <option value="">Agregar condición especial…</option>
        {disponibles.map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
      </select>

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((condicion) => (
            <span key={condicion} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-3 pr-2 text-sm text-gray-800">
              {condicion}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => quitar(condicion)}
                  aria-label={`Quitar ${condicion}`}
                  className="rounded-full p-0.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
