import type { Autor } from '../../types/api';
import { AuthorRow } from './AuthorRow';

export type OrdenAutores = 'recientes' | 'antiguos' | 'nombre-asc' | 'nombre-desc';

const OPCIONES_ORDEN: { valor: OrdenAutores; etiqueta: string }[] = [
  { valor: 'recientes', etiqueta: 'Más recientes' },
  { valor: 'antiguos', etiqueta: 'Más antiguos' },
  { valor: 'nombre-asc', etiqueta: 'Nombre A-Z' },
  { valor: 'nombre-desc', etiqueta: 'Nombre Z-A' },
];

function FilaEsqueleto() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 lg:px-6">
      <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-gray-100" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3.5 w-40 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-56 animate-pulse rounded bg-gray-50" />
      </div>
      <div className="hidden h-8 w-20 animate-pulse rounded bg-gray-50 sm:block" />
    </div>
  );
}

// Card única con el listado — a pedido explícito del negocio, reemplaza
// las cards individuales gigantes de ClientesGrid.tsx (que sigue
// existiendo tal cual para dirección). Header interno con el conteo
// real + el selector de orden (frontend-only, sobre autor.nombre/
// createdAt, sin tocar el backend); filas separadas por un
// border-bottom muy suave, no una card por autor.
export function AuthorsList({
  autores,
  totalSinFiltrar,
  proyectosActivosPorAutor,
  orden,
  onOrdenChange,
  cargando,
  huboError,
  hayBusqueda,
  onReintentar,
  onEditar,
  onEliminar,
  onNuevoAutor,
}: {
  autores: Autor[];
  totalSinFiltrar: number;
  proyectosActivosPorAutor: Map<string, number>;
  orden: OrdenAutores;
  onOrdenChange: (valor: OrdenAutores) => void;
  cargando: boolean;
  huboError: boolean;
  hayBusqueda: boolean;
  onReintentar: () => void;
  onEditar: (autor: Autor) => void;
  onEliminar: (autor: Autor) => void;
  onNuevoAutor: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
        <p className="text-sm font-semibold text-gray-900">
          {cargando ? 'Cargando autores…' : `${totalSinFiltrar} autor${totalSinFiltrar === 1 ? '' : 'es'} registrado${totalSinFiltrar === 1 ? '' : 's'}`}
        </p>
        {!cargando && !huboError && totalSinFiltrar > 0 && (
          <label className="flex items-center gap-2 text-xs text-gray-500">
            Ordenar por
            <select
              value={orden}
              onChange={(event) => onOrdenChange(event.target.value as OrdenAutores)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 outline-none transition-colors focus:border-dorado focus:ring-1 focus:ring-dorado/40"
            >
              {OPCIONES_ORDEN.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {cargando && (
        <div className="divide-y divide-gray-50">
          {[0, 1, 2, 3].map((i) => (
            <FilaEsqueleto key={i} />
          ))}
        </div>
      )}

      {!cargando && huboError && (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <p role="alert" className="text-sm text-red-600">
            No se pudieron cargar los autores.
          </p>
          <button
            type="button"
            onClick={onReintentar}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado/40"
          >
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !huboError && totalSinFiltrar === 0 && (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-gray-900">No hay autores registrados.</p>
          <button
            type="button"
            onClick={onNuevoAutor}
            className="rounded-lg bg-dorado px-4 py-2 text-xs font-semibold text-tinta shadow-sm transition-all hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado/40"
          >
            + Registrar primer autor
          </button>
        </div>
      )}

      {!cargando && !huboError && totalSinFiltrar > 0 && autores.length === 0 && (
        <p className="px-6 py-10 text-center text-sm text-gray-500">
          {hayBusqueda ? 'No encontramos autores con esa búsqueda.' : 'Ningún autor coincide con este filtro.'}
        </p>
      )}

      {!cargando && !huboError && autores.length > 0 && (
        <div className="divide-y divide-gray-50">
          {autores.map((autor) => (
            <AuthorRow
              key={autor.id}
              autor={autor}
              proyectosActivos={proyectosActivosPorAutor.get(autor.id) ?? 0}
              onEditar={() => onEditar(autor)}
              onEliminar={() => onEliminar(autor)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
