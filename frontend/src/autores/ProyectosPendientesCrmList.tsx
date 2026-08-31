import { useQuery, type QueryKey } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ProyectoPendienteSeccion1 } from '../types/api';

const LAPIZ_PATH = 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z';

function coincide(proyecto: ProyectoPendienteSeccion1, termino: string): boolean {
  const q = termino.trim().toLowerCase();
  if (!q) return true;
  return (
    proyecto.id.toLowerCase().includes(q) ||
    proyecto.autor.nombre.toLowerCase().includes(q) ||
    proyecto.servicio.codigo.toLowerCase().includes(q) ||
    proyecto.servicio.nombre.toLowerCase().includes(q)
  );
}

// Variante "CRM" de proyectos/ListaProyectosPendientes.tsx, exclusiva de
// AutoresPage: acá cada proyecto pendiente se lee como un contacto con
// el que comercial debe cerrar el contrato (de ahí el avatar con la
// inicial del autor). El componente genérico no se tocó porque lo
// reutilizan RrppHomePage, SoporteEditorialHomePage y
// SoporteDigitalHomePage con su propio título — esta tarjeta de
// "contacto" no les pertenece a ellos.
//
// Sin título propio: la Action Bar de AutoresPage.tsx ya es el título
// "Proyectos Pendientes" de esta sección — tenerlo acá también sería
// un encabezado duplicado.
//
// Un solo botón de edición a propósito (no dos, como antes): el lápiz
// abre CrearProyectoModalForm.tsx en modo edición para que Ventas
// pueda corregir el tipo de servicio de un proyecto ya creado — el
// autor queda bloqueado ahí adentro (ver el comentario de ese
// componente). Los datos de contacto del autor NO se editan desde esta
// vista — eso sigue centralizado en la pestaña "Clientes"
// (ClientesGrid.tsx), decisión explícita de una ronda anterior.
export function ProyectosPendientesCrmList({
  queryKey,
  queryFn,
  mensajeVacio,
  searchTerm,
  onEditarProyecto,
}: {
  queryKey: QueryKey;
  queryFn: () => Promise<{ proyectos: ProyectoPendienteSeccion1[] }>;
  mensajeVacio: string;
  searchTerm: string;
  onEditarProyecto: (proyecto: ProyectoPendienteSeccion1) => void;
}) {
  const query = useQuery({ queryKey, queryFn });
  const proyectosFiltrados = query.data?.proyectos.filter((proyecto) => coincide(proyecto, searchTerm)) ?? [];

  return (
    <div>
      {query.isLoading && <p className="text-tinta/70">Cargando proyectos…</p>}
      {query.isError && (
        <p role="alert" className="text-red-600">
          No se pudieron cargar los proyectos{query.error instanceof Error ? `: ${query.error.message}` : ''}.
        </p>
      )}
      {query.data && query.data.proyectos.length === 0 && <p className="text-tinta/70">{mensajeVacio}</p>}
      {query.data && query.data.proyectos.length > 0 && proyectosFiltrados.length === 0 && (
        <p className="text-tinta/70">Ningún proyecto coincide con "{searchTerm}".</p>
      )}
      {proyectosFiltrados.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {proyectosFiltrados.map((proyecto) => (
            <Link
              key={proyecto.id}
              to={`/proyectos/${proyecto.id}`}
              className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-dorado/50 hover:shadow-md"
            >
              {/* Franja superior decorativa sutil */}
              <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-gray-100 to-gray-200 transition-colors group-hover:from-dorado group-hover:to-yellow-500" />

              {/* Cabecera Tarjeta: Avatar, Nombre y el único botón de edición
                  (servicio/título del proyecto, ver el comentario del
                  componente arriba). */}
              <div className="mb-4 mt-2 flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-lg font-bold text-gray-700 shadow-inner">
                    {proyecto.autor.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="line-clamp-2 text-base font-bold leading-tight text-gray-900 transition-colors group-hover:text-dorado">
                      {proyecto.autor.nombre}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">ID: {proyecto.id}</p>
                  </div>
                </div>

                <button
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onEditarProyecto(proyecto);
                  }}
                  className="flex-shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-dorado/10 hover:text-dorado"
                  title="Editar proyecto (servicio)"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={LAPIZ_PATH} />
                  </svg>
                </button>
              </div>

              {/* Cuerpo Tarjeta: Badges */}
              <div className="mt-auto flex items-center justify-between border-t border-gray-50 pt-4">
                <span className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-600">
                  {proyecto.servicio.codigo} — {proyecto.servicio.nombre}
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-gray-400 transition-colors group-hover:text-dorado">
                  Ver ficha{' '}
                  <span className="translate-x-[-5px] transform opacity-0 transition-opacity group-hover:translate-x-0 group-hover:opacity-100">
                    →
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
