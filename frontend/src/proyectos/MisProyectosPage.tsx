import { useQuery } from '@tanstack/react-query';
import { ProyectoCard } from './ProyectoCard';
import { fetchMisProyectos } from './proyectosApi';

export function MisProyectosPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['proyectos', 'mios'],
    queryFn: fetchMisProyectos,
  });

  if (isLoading) {
    return <p className="text-tinta/70">Cargando proyectos…</p>;
  }

  if (isError) {
    return (
      <p role="alert" className="text-red-600">
        No se pudieron cargar tus proyectos{error instanceof Error ? `: ${error.message}` : ''}.
      </p>
    );
  }

  const proyectos = data?.proyectos ?? [];

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-tinta sm:text-xl">Mis proyectos</h1>

      {proyectos.length === 0 ? (
        <p className="text-tinta/70">No tienes proyectos activos todavía.</p>
      ) : (
        <ul className="space-y-3">
          {proyectos.map((proyecto) => (
            <ProyectoCard key={proyecto.id} proyecto={proyecto} />
          ))}
        </ul>
      )}
    </div>
  );
}
