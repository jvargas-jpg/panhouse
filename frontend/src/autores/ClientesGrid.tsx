import type { Autor } from '../types/api';
import { CategoriaBadge } from './CategoriaBadge';

const LAPIZ_PATH = 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z';
const PAPELERA_PATH =
  'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16';

function coincide(autor: Autor, termino: string): boolean {
  const q = termino.trim().toLowerCase();
  if (!q) return true;
  return (
    autor.nombre.toLowerCase().includes(q) ||
    // El nombre real/legal es el identificador principal en pantalla
    // (ver el comentario del <p> más abajo) — el artístico sigue
    // aceptado acá como atajo de búsqueda, por si alguien lo recuerda
    // mejor que el legal.
    (autor.nombreArtistico ?? '').toLowerCase().includes(q) ||
    (autor.email ?? []).some((correo) => correo.toLowerCase().includes(q)) ||
    (autor.pais ?? '').toLowerCase().includes(q) ||
    autor.categoria.toLowerCase().includes(q)
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
    <div className="flex flex-col gap-3">
      {filtrados.map((autor) => (
        <div
          key={autor.id}
          className="flex flex-col items-start justify-between gap-3 rounded-lg border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md md:flex-row md:items-center md:gap-4"
        >
          {/* Izquierda: nombre completo + categoría + correo. Nombre
              real/legal como título principal — a pedido explícito del
              negocio se abandonó el nombre artístico como identificador
              principal en toda la app (antes era al revés; mismo
              criterio en TarjetaPerfilAutores en SeccionProyectoPerfil.tsx
              y el encabezado de ProyectoDetallePage.tsx). El nombre
              artístico, cuando existe, queda como referencia secundaria
              debajo, no desaparece. */}
          <div className="min-w-0 md:w-1/3">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold text-gray-900">{autor.nombre}</p>
              <CategoriaBadge categoria={autor.categoria} />
            </div>
            {autor.nombreArtistico && (
              <p className="mt-0.5 truncate text-xs text-gray-400">Nombre artístico: {autor.nombreArtistico}</p>
            )}
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {autor.email && autor.email.length > 0 ? autor.email.join(', ') : 'Sin correo'}
            </p>
          </div>

          {/* Centro: teléfono y país */}
          <div className="flex flex-wrap items-center gap-2 md:w-1/3">
            <span className="inline-block rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {autor.telefono ?? 'Sin teléfono'}
            </span>
            <span className="inline-block rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {autor.pais ?? 'Sin país'}
            </span>
          </div>

          {/* Derecha: editar/eliminar */}
          <div className="flex flex-shrink-0 items-center gap-2 self-end md:w-1/3 md:justify-end md:self-auto">
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
      ))}
    </div>
  );
}
