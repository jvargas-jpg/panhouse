import { useQuery, type QueryKey } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ProyectoPendienteSeccion1 } from '../types/api';

const LAPIZ_PATH = 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z';
const PAPELERA_PATH =
  'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16';

function coincide(proyecto: ProyectoPendienteSeccion1, termino: string): boolean {
  const q = termino.trim().toLowerCase();
  if (!q) return true;
  return (
    (proyecto.titulo ?? '').toLowerCase().includes(q) ||
    proyecto.id.toLowerCase().includes(q) ||
    // Coautoría: revisa TODOS los autores del proyecto, no solo el
    // primero — antes de esto, buscar por el nombre de un coautor
    // secundario no encontraba el proyecto.
    proyecto.autores.some((autor) => autor.nombre.toLowerCase().includes(q)) ||
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
// El lápiz abre CrearProyectoModalForm.tsx en modo edición para que
// Ventas pueda corregir el tipo de servicio de un proyecto ya creado —
// el autor queda bloqueado ahí adentro (ver el comentario de ese
// componente). Los datos de contacto del autor NO se editan desde esta
// vista — eso sigue centralizado en la pestaña "Clientes"
// (ClientesGrid.tsx), decisión explícita de una ronda anterior.
//
// La papelera (a pedido explícito, para no forzar entrar al modal solo
// para borrar) elimina directo, sin pasar por edición — mismo patrón
// que ClientesGrid.tsx: la fila solo dispara el callback, la
// confirmación nativa y la mutación viven en el padre (AutoresPage.tsx).
export function ProyectosPendientesCrmList({
  queryKey,
  queryFn,
  mensajeVacio,
  searchTerm,
  onEditarProyecto,
  onEliminarProyecto,
}: {
  queryKey: QueryKey;
  queryFn: () => Promise<{ proyectos: ProyectoPendienteSeccion1[] }>;
  mensajeVacio: string;
  searchTerm: string;
  onEditarProyecto: (proyecto: ProyectoPendienteSeccion1) => void;
  onEliminarProyecto: (proyecto: ProyectoPendienteSeccion1) => void;
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
        <div className="flex flex-col gap-3">
          {proyectosFiltrados.map((proyecto) => (
            <Link
              key={proyecto.id}
              to={`/proyectos/${proyecto.id}`}
              className="group flex flex-col items-start justify-between gap-3 rounded-lg border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md md:flex-row md:items-center md:gap-4"
            >
              {/* Izquierda: título del proyecto en negrita (identificador
                  principal, ver CrearProyectoModalForm.tsx), autores + ID
                  acortado como secundario — proyectos creados antes de que
                  el título fuera obligatorio no lo tienen, de ahí el
                  respaldo en cursiva. Coautoría: todos los autores unidos
                  por coma, no solo el primero. */}
              <div className="min-w-0 md:w-1/3">
                <p className="truncate text-sm font-bold text-gray-900 transition-colors group-hover:text-dorado">
                  {proyecto.titulo ?? <span className="italic text-gray-400">Sin título</span>}
                </p>
                <p className="mt-0.5 truncate text-xs text-gray-500">
                  {proyecto.autores.map((autor) => autor.nombre).join(', ') || 'Sin autor'} · ID: {proyecto.id.slice(0, 8)}
                </p>
              </div>

              {/* Centro: tipo de servicio como badge */}
              <div className="md:w-1/3">
                <span className="inline-block rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  {proyecto.servicio.codigo} — {proyecto.servicio.nombre}
                </span>
              </div>

              {/* Derecha: acciones — editar y eliminar directo desde la fila. */}
              <div className="flex flex-shrink-0 items-center gap-2 self-end md:w-1/3 md:justify-end md:self-auto">
                <span className="flex items-center gap-1 text-xs font-medium text-gray-400 transition-colors group-hover:text-dorado">
                  Ver ficha{' '}
                  <span className="translate-x-[-5px] transform opacity-0 transition-opacity group-hover:translate-x-0 group-hover:opacity-100">
                    →
                  </span>
                </span>
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onEditarProyecto(proyecto);
                  }}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-dorado/10 hover:text-dorado"
                  title="Editar proyecto (servicio)"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={LAPIZ_PATH} />
                  </svg>
                </button>
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onEliminarProyecto(proyecto);
                  }}
                  className="p-2 text-gray-400 transition-colors hover:text-red-600"
                  title="Eliminar proyecto"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={PAPELERA_PATH} />
                  </svg>
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
