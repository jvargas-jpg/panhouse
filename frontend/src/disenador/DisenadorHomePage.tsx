import { useQuery } from '@tanstack/react-query';
import { fetchProyectosPendientesDiseno } from '../proyectos/proyectosPendientesApi';
import { Link } from 'react-router-dom';

export function DisenadorHomePage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['proyectos', 'pendientes', 'diseno'],
    queryFn: fetchProyectosPendientesDiseno,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 border-b border-tinta/10 pb-5">
        <h1 className="text-2xl font-bold text-tinta">Inicio — Dirección Creativa y Diseño</h1>
        <p className="mt-1 text-sm text-tinta/70">Proyectos pendientes de propuestas de portada o revisión.</p>
      </header>

      {isLoading && (
        <div className="flex justify-center py-10">
          <p className="animate-pulse text-sm font-medium text-tinta/60">Cargando proyectos...</p>
        </div>
      )}

      {isError && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <p className="text-sm text-red-600">Error al cargar: {error instanceof Error ? error.message : 'Desconocido'}</p>
        </div>
      )}

      {data && data.proyectos.length === 0 && (
        <div className="rounded-xl border border-dashed border-tinta/20 bg-crema/20 p-12 text-center">
          <p className="text-lg font-medium text-tinta/50">No hay proyectos pendientes de diseño.</p>
          <p className="mt-1 text-sm text-tinta/40">¡Todo al día!</p>
        </div>
      )}

      {data && data.proyectos.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.proyectos.map((proyecto) => (
            <li key={proyecto.id}>
              <Link
                to={`/proyectos/${proyecto.id}`}
                className="group flex h-full flex-col justify-between rounded-xl border border-tinta/10 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-dorado/50 hover:shadow-md"
              >
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="rounded-full bg-crema px-2.5 py-0.5 text-xs font-semibold text-tinta">
                      {proyecto.servicio.codigo}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-tinta group-hover:text-dorado-oscuro transition-colors">
                    {proyecto.autor.nombre}
                  </h3>
                  <p className="mt-1 text-xs text-tinta/60">{proyecto.servicio.nombre}</p>
                </div>
                
                <div className="mt-4 flex items-center text-xs font-medium text-dorado-oscuro group-hover:underline">
                  Abrir ficha creativa <span>→</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}