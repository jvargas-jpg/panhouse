import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { LibroAutor } from '../types/api';
import { calcularFaseActual } from './faseAutor';
import { fetchMisLibros } from './portalAutorApi';

function TarjetaLibro({ libro }: { libro: LibroAutor }) {
  return (
    <Link
      to={`/mis-libros/${libro.id}`}
      className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-dorado/50 hover:shadow-md"
    >
      <div>
        <h3 className="text-base font-bold text-tinta">{libro.titulo ?? libro.servicio.nombre}</h3>
        <p className="text-sm text-gray-500">{libro.servicio.nombre}</p>
      </div>
      <div>
        <span className="inline-block rounded-full bg-dorado/10 px-3 py-1 text-xs font-semibold text-dorado">
          {calcularFaseActual(libro)}
        </span>
      </div>
    </Link>
  );
}

export function AutorHomePage() {
  const misLibrosQuery = useQuery({ queryKey: ['mis-libros'], queryFn: fetchMisLibros });
  const libros = misLibrosQuery.data?.proyectos ?? [];

  if (misLibrosQuery.isLoading) {
    return <p className="text-tinta/70">Cargando tus libros…</p>;
  }

  if (misLibrosQuery.isError) {
    return (
      <p role="alert" className="text-red-600">
        No se pudieron cargar tus libros{misLibrosQuery.error instanceof Error ? `: ${misLibrosQuery.error.message}` : ''}.
      </p>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-tinta">Mis Libros</h1>

      {libros.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          Todavía no tienes ningún libro en proceso.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {libros.map((libro) => (
            <TarjetaLibro key={libro.id} libro={libro} />
          ))}
        </div>
      )}
    </div>
  );
}
