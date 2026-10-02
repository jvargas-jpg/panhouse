import { CategoriaBadge } from '../../autores/CategoriaBadge';
import { formatearFecha } from '../../proyectos/campos';
import type { Autor } from '../../types/api';
import { AuthorActionsMenu } from './AuthorActionsMenu';

const ICONO_EMAIL = 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
const ICONO_TELEFONO =
  'M3 5a2 2 0 012-2h2.28a1 1 0 01.98.8l.7 3.5a1 1 0 01-.5 1.09l-1.6.8a11.2 11.2 0 005.6 5.6l.8-1.6a1 1 0 011.09-.5l3.5.7a1 1 0 01.8.98V19a2 2 0 01-2 2h-1C7.82 21 3 16.18 3 10.5V5z';

// Iniciales sobre datos ya reales: 2 palabras → primera letra de cada
// una ("Juan Perez" → "JP"); 1 sola palabra → sus 2 primeras letras
// ("esmeralda" → "ES"). Sin normalizar el nombre guardado — nunca se
// muestra el resultado como si fuera el nombre real, solo alimenta el
// avatar.
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0]! + partes[1]![0]!).toUpperCase();
}

function Avatar({ nombre }: { nombre: string }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-500">
      {iniciales(nombre)}
    </span>
  );
}

function BloqueIdentidad({ autor }: { autor: Autor }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate text-sm font-semibold text-gray-900">{autor.nombre}</p>
        <CategoriaBadge categoria={autor.categoria} />
      </div>
      {autor.nombreArtistico && <p className="mt-0.5 truncate text-xs text-gray-400">Nombre artístico: {autor.nombreArtistico}</p>}
      {(autor.email?.[0] || autor.telefono) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
          {autor.email?.[0] && (
            <span className="flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={ICONO_EMAIL} />
              </svg>
              {autor.email[0]}
            </span>
          )}
          {autor.telefono && (
            <span className="flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={ICONO_TELEFONO} />
              </svg>
              {autor.telefono}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Fila premium de la lista "Autores" de comercial — reemplaza las cards
// individuales de ClientesGrid.tsx (esa vista sigue existiendo tal cual
// para dirección, ver AutoresPage.tsx). Dos variantes: fila horizontal
// en desktop/tablet (md+), card vertical apilada en mobile — mismo
// criterio que AttentionProjects.tsx en el Dashboard, evita forzar
// columnas angostas o scroll horizontal para leer los mismos datos.
export function AuthorRow({
  autor,
  proyectosActivos,
  onEditar,
  onEliminar,
}: {
  autor: Autor;
  proyectosActivos: number;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  return (
    <>
      {/* Desktop/tablet */}
      <div className="hidden items-center gap-4 px-5 py-4 md:flex lg:px-6">
        <Avatar nombre={autor.nombre} />
        <BloqueIdentidad autor={autor} />

        <div className="w-28 shrink-0 lg:w-32">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">País</p>
          <p className="mt-0.5 truncate text-sm text-gray-700">{autor.pais ?? '—'}</p>
        </div>

        <div className="hidden w-32 shrink-0 lg:block">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Proyectos activos</p>
          <p className="mt-0.5 text-sm text-gray-700">{proyectosActivos}</p>
        </div>

        <div className="hidden w-28 shrink-0 lg:block">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Fecha de ingreso</p>
          <p className="mt-0.5 text-sm text-gray-700">{formatearFecha(autor.createdAt)}</p>
        </div>

        <AuthorActionsMenu onEditar={onEditar} onEliminar={onEliminar} />
      </div>

      {/* Mobile */}
      <div className="flex flex-col gap-3 px-4 py-4 md:hidden">
        <div className="flex items-start gap-3">
          <Avatar nombre={autor.nombre} />
          <div className="min-w-0 flex-1">
            <BloqueIdentidad autor={autor} />
          </div>
          <AuthorActionsMenu onEditar={onEditar} onEliminar={onEliminar} />
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-14 text-xs text-gray-500">
          <span>{autor.pais ?? 'Sin país'}</span>
          <span>{proyectosActivos} proyecto(s) activo(s)</span>
          <span>{formatearFecha(autor.createdAt)}</span>
        </div>
      </div>
    </>
  );
}
