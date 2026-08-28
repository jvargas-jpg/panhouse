import { useState } from 'react';
import type { ProyectoResumen } from '../types/api';

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40';

// Buscador/selector de proyectos activos para el formulario de pagos:
// sin librería de combobox instalada (mismo criterio que Toast.tsx),
// filtrado en memoria sobre la lista ya cargada por GET /proyectos/activos
// — no hace falta un debounce ni una consulta por tecla, la lista de
// proyectos activos de un comercial es chica.
export function SelectorProyecto({
  proyectos,
  proyectoSeleccionado,
  onSeleccionar,
}: {
  proyectos: ProyectoResumen[];
  proyectoSeleccionado: ProyectoResumen | null;
  onSeleccionar: (proyecto: ProyectoResumen | null) => void;
}) {
  const [busqueda, setBusqueda] = useState('');

  if (proyectoSeleccionado) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-dorado/30 bg-dorado/5 px-4 py-2.5">
        <div>
          <p className="text-sm font-semibold text-gray-900">{proyectoSeleccionado.titulo ?? proyectoSeleccionado.autor.nombre}</p>
          <p className="text-xs text-gray-500">
            {proyectoSeleccionado.autor.nombre} · {proyectoSeleccionado.servicio.nombre}
          </p>
        </div>
        <button type="button" onClick={() => onSeleccionar(null)} className="text-xs font-medium text-gray-500 hover:text-gray-900">
          Cambiar
        </button>
      </div>
    );
  }

  const termino = busqueda.trim().toLowerCase();
  const resultados = termino
    ? proyectos
        .filter(
          (proyecto) =>
            (proyecto.titulo ?? '').toLowerCase().includes(termino) ||
            proyecto.autor.nombre.toLowerCase().includes(termino) ||
            proyecto.servicio.nombre.toLowerCase().includes(termino),
        )
        .slice(0, 8)
    : [];

  return (
    <div className="relative">
      <input
        type="text"
        value={busqueda}
        onChange={(event) => setBusqueda(event.target.value)}
        placeholder="Buscar por autor, título o servicio…"
        className={INPUT_CLASS}
      />
      {termino && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {resultados.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">Sin resultados.</p>
          ) : (
            resultados.map((proyecto) => (
              <button
                key={proyecto.id}
                type="button"
                onClick={() => {
                  onSeleccionar(proyecto);
                  setBusqueda('');
                }}
                className="block w-full border-b border-gray-50 px-4 py-2.5 text-left text-sm last:border-0 hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">{proyecto.titulo ?? proyecto.autor.nombre}</span>
                <span className="ml-2 text-xs text-gray-500">
                  {proyecto.autor.nombre} · {proyecto.servicio.nombre}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
