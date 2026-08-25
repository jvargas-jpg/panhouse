import { useQuery } from '@tanstack/react-query';
import { fetchAutores } from './autoresApi';

export function ListaAutores() {
  const autoresQuery = useQuery({ queryKey: ['autores'], queryFn: fetchAutores });

  return (
    <section>
      <h2 className="mb-6 flex items-center gap-3 text-2xl font-black text-tinta">
        <span className="h-1 w-8 rounded-full bg-dorado" />
        Autores
      </h2>

      {autoresQuery.isLoading && <p className="text-tinta/70">Cargando autores…</p>}
      {autoresQuery.isError && (
        <p role="alert" className="text-red-600">
          No se pudieron cargar los autores{autoresQuery.error instanceof Error ? `: ${autoresQuery.error.message}` : ''}.
        </p>
      )}
      {autoresQuery.data && autoresQuery.data.autores.length === 0 && <p className="text-tinta/70">No hay autores todavía.</p>}
      {autoresQuery.data && autoresQuery.data.autores.length > 0 && (
        <ul>
          {autoresQuery.data.autores.map((autor) => (
            <li
              key={autor.id}
              className="mb-4 flex flex-col justify-between rounded-2xl border border-tinta/10 bg-white p-6 shadow-sm sm:flex-row sm:items-center"
            >
              <h3 className="text-lg font-bold text-tinta">{autor.nombre}</h3>
              <span className="mt-3 rounded-full bg-tinta/5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-tinta/70 sm:mt-0">
                {autor.email ?? 'sin correo'} · {autor.pais ?? 'sin país'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
