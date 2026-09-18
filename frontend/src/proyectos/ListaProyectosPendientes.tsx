import { useQuery, type QueryKey } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ProyectoPendienteSeccion1 } from '../types/api';

// Mismo estilo visual que "Autores sin proyecto" (jefatura), reutilizado
// para las "notificaciones internas" de rrpp y comercial: una fila es un
// enlace directo a /proyectos/:id, sin botón de acción propio — ese ya
// existe en la pantalla de detalle.
//
// linkTo (opcional): "Matrices de Ingreso (RRPP)" en RrppHomePage.tsx
// reutiliza este mismo componente pero navega a
// /rrpp/matriz/:proyectoId (módulo propio, fuera de la vista de detalle
// del proyecto) en vez de /proyectos/:id — default sin cambios para los
// consumidores existentes.
export function ListaProyectosPendientes({
  titulo,
  queryKey,
  queryFn,
  mensajeVacio,
  linkTo = (proyecto) => `/proyectos/${proyecto.id}`,
}: {
  titulo: string;
  queryKey: QueryKey;
  queryFn: () => Promise<{ proyectos: ProyectoPendienteSeccion1[] }>;
  mensajeVacio: string;
  linkTo?: (proyecto: ProyectoPendienteSeccion1) => string;
}) {
  const query = useQuery({ queryKey, queryFn });

  return (
    <section>
      <h2 className="mb-6 flex items-center gap-3 text-2xl font-black text-tinta">
        <span className="h-1 w-8 rounded-full bg-dorado" />
        {titulo}
      </h2>

      {query.isLoading && <p className="text-tinta/70">Cargando proyectos…</p>}
      {query.isError && (
        <p role="alert" className="text-red-600">
          No se pudieron cargar los proyectos{query.error instanceof Error ? `: ${query.error.message}` : ''}.
        </p>
      )}
      {query.data && query.data.proyectos.length === 0 && <p className="text-tinta/70">{mensajeVacio}</p>}
      {query.data && query.data.proyectos.length > 0 && (
        <ul>
          {query.data.proyectos.map((proyecto) => (
            <li key={proyecto.id}>
              <Link
                to={linkTo(proyecto)}
                className="group mb-4 flex cursor-pointer flex-col justify-between rounded-2xl border border-tinta/10 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-dorado/40 hover:shadow-xl sm:flex-row sm:items-center"
              >
                {/* Identificador principal generado solo (sin título
                    manual, ver el comentario de la columna en
                    server/db/schema/proyectos.ts) — autores (coautoría,
                    todos unidos por coma, por su nombre real/legal, no el
                    artístico — a pedido explícito del negocio, mismo
                    criterio en ProyectosPendientesCrmList.tsx, el otro
                    consumidor de esta misma lista de pendientes) + el
                    codigo único del proyecto. */}
                <h3 className="text-lg font-bold text-tinta transition-colors group-hover:text-dorado">
                  {proyecto.autores.map((autor) => autor.nombre).join(', ') || 'Sin autor'} — #
                  {proyecto.codigo || proyecto.id.slice(0, 6).toUpperCase()}
                </h3>
                <div className="mt-3 flex items-center gap-3 sm:mt-0">
                  <span className="rounded-full bg-tinta/5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-tinta/70 transition-colors group-hover:bg-dorado/10 group-hover:text-dorado">
                    {proyecto.servicio.codigo} — {proyecto.servicio.nombre}
                  </span>
                  <span aria-hidden="true" className="text-dorado opacity-0 transition-opacity group-hover:opacity-100">
                    →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
