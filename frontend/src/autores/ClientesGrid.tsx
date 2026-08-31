import type { Autor } from '../types/api';

const LAPIZ_PATH = 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z';
const PAPELERA_PATH =
  'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16';

function coincide(autor: Autor, termino: string): boolean {
  const q = termino.trim().toLowerCase();
  if (!q) return true;
  return (
    autor.nombre.toLowerCase().includes(q) ||
    (autor.email ?? '').toLowerCase().includes(q) ||
    (autor.pais ?? '').toLowerCase().includes(q)
  );
}

// Vista "Clientes" del CRM comercial: mismo catálogo de autores que ya
// se pedía en AutoresPage.tsx (para resolver la edición rápida desde
// las tarjetas de proyecto) — acá se reutiliza tal cual, sin una
// segunda petición, solo filtrado en cliente por nombre/correo/país.
export function ClientesGrid({
  autores,
  searchTerm,
  onEditar,
  onEliminar,
}: {
  autores: Autor[];
  searchTerm: string;
  onEditar: (autor: Autor) => void;
  onEliminar: (autor: Autor) => void;
}) {
  const filtrados = autores.filter((autor) => coincide(autor, searchTerm));

  if (autores.length === 0) {
    return <p className="text-tinta/70">No hay clientes registrados todavía.</p>;
  }

  if (filtrados.length === 0) {
    return <p className="text-tinta/70">Ningún cliente coincide con "{searchTerm}".</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
      {filtrados.map((autor) => (
        <div
          key={autor.id}
          className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-dorado/50 hover:shadow-md"
        >
          <div className="mb-4 flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-lg font-bold text-gray-700 shadow-inner">
                {autor.nombre.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="line-clamp-2 text-base font-bold leading-tight text-gray-900">{autor.nombre}</h3>
                <p className="mt-1 text-xs text-gray-500">{autor.pais ?? 'Sin país'}</p>
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                onClick={() => onEditar(autor)}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-dorado/10 hover:text-dorado"
                title="Editar datos del cliente"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={LAPIZ_PATH} />
                </svg>
              </button>

              <button
                onClick={() => onEliminar(autor)}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Eliminar cliente"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={PAPELERA_PATH} />
                </svg>
              </button>
            </div>
          </div>

          <div className="mt-auto border-t border-gray-50 pt-4">
            <span className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-medium text-gray-600">
              {autor.email ?? 'Sin correo'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
