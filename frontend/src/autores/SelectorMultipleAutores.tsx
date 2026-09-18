import { useRef, useState } from 'react';
import type { Autor } from '../types/api';

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40';

const MAX_RESULTADOS = 8;

// Coautoría (CrearProyectoModalForm.tsx, alta de proyecto): buscador +
// etiquetas, mismo lenguaje visual que EtiquetasPersonalidad.tsx (chip
// con botón ✕), pero acá los valores salen de un catálogo real
// (autoresDisponibles), no de texto libre — por eso es un buscador con
// resultados en vez de un input+Enter.
//
// Controlado (value/onChange) con un array de ids, sin react-hook-form:
// ninguna otra pantalla de este proyecto lo usa (ver CrearAutorForm.tsx,
// que también maneja sus arrays — personalidad, redesSociales — a mano).
export function SelectorMultipleAutores({
  autoresDisponibles,
  value,
  onChange,
}: {
  autoresDisponibles: Autor[];
  value: string[];
  onChange: (autorIds: string[]) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const seleccionados = value
    .map((id) => autoresDisponibles.find((autor) => autor.id === id))
    .filter((autor): autor is Autor => autor !== undefined);

  const q = busqueda.trim().toLowerCase();
  const resultados = autoresDisponibles
    .filter((autor) => !value.includes(autor.id))
    // Busca por nombre legal o artístico — el nombre real es el
    // identificador principal en toda la app (ver el <li> más abajo,
    // ya no muestra el artístico), pero el filtro sigue aceptando el
    // artístico como atajo de búsqueda: alguien puede recordar el
    // nombre de pluma de un autor sin saber su nombre legal de memoria.
    .filter((autor) => !q || autor.nombre.toLowerCase().includes(q) || (autor.nombreArtistico ?? '').toLowerCase().includes(q))
    .slice(0, MAX_RESULTADOS);

  function agregar(autorId: string) {
    onChange([...value, autorId]);
    setBusqueda('');
    // Sin esto, la lista se queda abierta tapando el chip recién
    // agregado — onMouseDown con preventDefault (más abajo) evita que
    // el blur del input la cierre sola al hacer click en una opción, así
    // que agregar() tiene que cerrarla explícitamente.
    setAbierto(false);
    // Quita el foco explícitamente: el input lo retiene después del
    // click en la opción (mismo preventDefault de arriba), y como abrir
    // la lista depende de onFocus/onClick, un input que YA está enfocado
    // no dispara onFocus de nuevo — sin este blur, el usuario tendría que
    // hacer click fuera y volver a entrar para reabrir la lista y sumar
    // otro autor. onClick (más abajo) es lo que permite reabrirla con un
    // segundo click directo, ya sin foco.
    inputRef.current?.blur();
  }

  function quitar(autorId: string) {
    onChange(value.filter((id) => id !== autorId));
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id="proyecto-autores-buscador"
        type="text"
        role="combobox"
        aria-expanded={abierto}
        placeholder="Buscar autor por nombre…"
        value={busqueda}
        onChange={(event) => {
          setBusqueda(event.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        // Un click no siempre dispara onFocus (si el input ya estaba
        // enfocado, no hay cambio de foco que detectar) — sin esto, tras
        // agregar() quitarle el foco al input, un solo click para abrir
        // de nuevo la lista no alcanzaría si por algún motivo el foco
        // seguía puesto; onClick lo garantiza sin depender de eso.
        onClick={() => setAbierto(true)}
        // El timeout deja que el click en una opción (más abajo) se
        // registre antes de cerrar la lista — sin esto, el blur del
        // input se dispara primero y el click nunca llega a agregar().
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        className={INPUT_CLASS}
      />

      {abierto && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {resultados.length === 0 ? (
            <li className="px-4 py-2.5 text-sm text-gray-400">
              {autoresDisponibles.length === 0 ? 'No hay clientes registrados todavía.' : 'Sin resultados.'}
            </li>
          ) : (
            // Nombre real/legal, sin el artístico — a pedido explícito
            // del negocio se abandonó el nombre artístico como
            // identificador en toda la app (antes era al revés, con el
            // legal entre paréntesis como referencia; ver el mismo
            // criterio en ClientesGrid.tsx y TarjetaPerfilAutores en
            // SeccionProyectoPerfil.tsx).
            resultados.map((autor) => (
              <li key={autor.id}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => agregar(autor.id)}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-900 transition-colors hover:bg-dorado/10"
                >
                  {autor.nombre}
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {seleccionados.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {seleccionados.map((autor) => (
            <span key={autor.id} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-3 pr-2 text-sm text-gray-800">
              {autor.nombre}
              <button
                type="button"
                onClick={() => quitar(autor.id)}
                aria-label={`Quitar ${autor.nombre}`}
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
