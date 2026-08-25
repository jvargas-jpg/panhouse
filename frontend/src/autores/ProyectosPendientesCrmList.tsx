import { useQuery, type QueryKey } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ProyectoPendienteSeccion1 } from '../types/api';

// Variante "CRM" de proyectos/ListaProyectosPendientes.tsx, exclusiva de
// AutoresPage: acá cada proyecto pendiente se lee como un contacto con
// el que comercial debe cerrar el contrato (de ahí el avatar con la
// inicial del autor y el título fijo "Proyectos Pendientes"). El
// componente genérico no se tocó porque lo reutilizan RrppHomePage,
// SoporteEditorialHomePage y SoporteDigitalHomePage con su propio
// título — esta tarjeta de "contacto" no les pertenece a ellos.
export function ProyectosPendientesCrmList({
  queryKey,
  queryFn,
  mensajeVacio,
}: {
  queryKey: QueryKey;
  queryFn: () => Promise<{ proyectos: ProyectoPendienteSeccion1[] }>;
  mensajeVacio: string;
}) {
  const query = useQuery({ queryKey, queryFn });

  return (
    <div>
      <h2 className="mb-4 text-2xl font-semibold tracking-tight text-tinta">Proyectos Pendientes</h2>

      {query.isLoading && <p className="text-tinta/70">Cargando proyectos…</p>}
      {query.isError && (
        <p role="alert" className="text-red-600">
          No se pudieron cargar los proyectos{query.error instanceof Error ? `: ${query.error.message}` : ''}.
        </p>
      )}
      {query.data && query.data.proyectos.length === 0 && <p className="text-tinta/70">{mensajeVacio}</p>}
      {query.data && query.data.proyectos.length > 0 && (
        <ul className="flex flex-col gap-4">
          {query.data.proyectos.map((proyecto) => (
            <li key={proyecto.id}>
              <Link
                to={`/proyectos/${proyecto.id}`}
                className="group flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-dorado/50 hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-100 font-semibold text-tinta">
                    {proyecto.autor.nombre.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">{proyecto.autor.nombre}</h3>
                </div>
                <span className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-gray-600 transition-colors group-hover:border-dorado/30 group-hover:bg-dorado/10 group-hover:text-dorado">
                  {proyecto.servicio.codigo} — {proyecto.servicio.nombre}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
