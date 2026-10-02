import { useMemo } from 'react';
import { CategoriaBadge } from '../autores/CategoriaBadge';
import { formatearFecha } from '../proyectos/campos';
import type { Autor, ProyectoResumen } from '../types/api';

const MAX_FILAS = 5;

// "Autores recientes" — GET /autores ya ordena por createdAt desc (ver
// server/routes/autores.routes.ts), así que los primeros MAX_FILAS ya
// son los más nuevos, sin ordenar de nuevo acá. La columna "proyectos"
// cuenta cuántos proyectos ACTIVOS de proyectosActivos (GET
// /proyectos/activos, que el dashboard ya carga para el KPI) tienen a
// este autor como autor.id — es un conteo directo sobre una relación
// real (proyecto → autor), no una inferencia de negocio. Dos límites
// conocidos, documentados a propósito: (1) solo cuenta proyectos
// activos, no el histórico completo (GET /proyectos con el histórico
// completo es exclusivo de jefe_area/dirección); (2) proyecto.autor en
// ProyectoResumen es el autor legacy singular, no la coautoría completa
// — un proyecto con coautores solo suma para el primero. Preferible a
// no mostrar nada, pero no es "total de proyectos del autor".
export function RecentAuthors({
  autores,
  proyectosActivos,
  cargando,
  huboError,
  onReintentar,
}: {
  autores: Autor[];
  proyectosActivos: ProyectoResumen[];
  cargando: boolean;
  huboError: boolean;
  onReintentar: () => void;
}) {
  const proyectosActivosPorAutor = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const proyecto of proyectosActivos) {
      mapa.set(proyecto.autor.id, (mapa.get(proyecto.autor.id) ?? 0) + 1);
    }
    return mapa;
  }, [proyectosActivos]);

  const recientes = autores.slice(0, MAX_FILAS);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-3 text-[15px] font-bold text-gray-900">Autores recientes</h2>

      {cargando && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-50" />
          ))}
        </div>
      )}

      {!cargando && huboError && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p role="alert" className="text-sm text-red-600">
            No se pudieron cargar los autores.
          </p>
          <button
            type="button"
            onClick={onReintentar}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado/40"
          >
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !huboError && recientes.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-500">No hay autores registrados todavía.</p>
      )}

      {!cargando && !huboError && recientes.length > 0 && (
        <div className="flex flex-col divide-y divide-gray-50">
          {recientes.map((autor) => (
            <div key={autor.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <p className="truncate text-sm font-semibold text-gray-900">{autor.nombre}</p>
                <CategoriaBadge categoria={autor.categoria} />
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 text-xs text-gray-400">
                <span className="truncate">
                  {autor.pais ?? 'Sin país'} · {proyectosActivosPorAutor.get(autor.id) ?? 0} proyecto(s)
                </span>
                <span className="shrink-0">{formatearFecha(autor.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
