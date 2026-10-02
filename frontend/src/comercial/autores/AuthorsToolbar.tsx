import type { CategoriaCliente } from '../../types/api';

const ICONO_BUSCAR = 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z';

export type FiltroCategoria = 'todos' | CategoriaCliente;

const CHIPS: { valor: FiltroCategoria; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'VIP', etiqueta: 'VIP' },
  { valor: 'Estándar', etiqueta: 'Estándar' },
];

// Buscador + filtro por categoría — ambos sobre los autores que ya
// están cargados (mismo filtrado en frontend que ya usaba
// ClientesGrid.tsx, ver el useMemo en CommercialAuthorsView.tsx), sin
// ninguna consulta nueva al backend. Sin filtro de país/servicio/fecha:
// no existían antes y el pedido fue explícito en no agregar filtros que
// requieran lógica nueva.
export function AuthorsToolbar({
  searchTerm,
  onSearchTermChange,
  filtroCategoria,
  onFiltroCategoriaChange,
}: {
  searchTerm: string;
  onSearchTermChange: (valor: string) => void;
  filtroCategoria: FiltroCategoria;
  onFiltroCategoriaChange: (valor: FiltroCategoria) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={ICONO_BUSCAR} />
        </svg>
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          placeholder="Buscar por nombre, nombre artístico, correo o país…"
          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 shadow-none outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:ring-2 focus:ring-dorado/40"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {CHIPS.map((chip) => {
          const activo = filtroCategoria === chip.valor;
          return (
            <button
              key={chip.valor}
              type="button"
              onClick={() => onFiltroCategoriaChange(chip.valor)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado/40 ${
                activo ? 'bg-dorado/15 text-dorado' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {chip.etiqueta}
            </button>
          );
        })}
      </div>
    </div>
  );
}
