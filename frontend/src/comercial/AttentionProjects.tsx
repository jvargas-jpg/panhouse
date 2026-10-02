import { Link } from 'react-router-dom';
import type { ProyectoPendienteSeccion1 } from '../types/api';

const ICONO_CHECK = 'M5 13l4 4L19 7';

import { resumenFaltantes } from '../trazabilidad/preparacionComercial';

function FilaMobile({ proyecto }: { proyecto: ProyectoPendienteSeccion1 }) {
  return (
    <div className="rounded-lg border border-gray-100 p-4">
      <p className="text-sm font-semibold text-gray-900">{proyecto.autores.map((autor) => autor.nombre).join(', ') || 'Sin autor'}</p>
      <p className="mt-0.5 text-xs text-gray-400">
        #{proyecto.codigo} · {proyecto.servicio.nombre}
      </p>
      <p className="mt-3 text-xs text-gray-500">
        <span className="font-medium text-gray-600">Falta: </span>
        {resumenFaltantes(proyecto.faltantesComercial)}
      </p>
      <Link
        to={`/proyectos/${proyecto.id}/ficha-trazabilidad`}
        className="mt-3 flex items-center justify-center rounded-lg border border-dorado/40 bg-dorado/5 px-3 py-2 text-xs font-semibold text-dorado transition-colors hover:bg-dorado/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado/40"
      >
        Continuar ficha
      </Link>
    </div>
  );
}

export function AttentionProjects({
  proyectos,
  cargando,
  huboError,
  onReintentar,
}: {
  proyectos: ProyectoPendienteSeccion1[];
  cargando: boolean;
  huboError: boolean;
  onReintentar: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-col gap-0.5 border-b border-gray-100 px-5 py-4 sm:px-6">
        <h2 className="text-[15px] font-bold text-gray-900">Requieren tu atención</h2>
        <p className="text-sm text-gray-500">Proyectos que necesitan tu gestión para continuar en el flujo editorial.</p>
      </div>

      {cargando && (
        <div className="space-y-2.5 p-5 sm:p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-50" />
          ))}
        </div>
      )}

      {!cargando && huboError && (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <p role="alert" className="text-sm text-red-600">
            No se pudieron cargar los proyectos.
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

      {!cargando && !huboError && proyectos.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-50 text-green-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICONO_CHECK} />
            </svg>
          </span>
          <p className="text-sm font-semibold text-gray-900">Todo al día</p>
          <p className="text-xs text-gray-500">No tenés proyectos con datos contractuales pendientes.</p>
        </div>
      )}

      {!cargando && !huboError && proyectos.length > 0 && (
        <>
          {/* Mobile: cards apiladas */}
          <div className="flex flex-col gap-3 p-4 md:hidden">
            {proyectos.map((proyecto) => (
              <FilaMobile key={proyecto.id} proyecto={proyecto} />
            ))}
          </div>

          {/* Tablet/desktop: tabla */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  <th className="whitespace-nowrap px-5 py-2.5 sm:px-6">Autor / Proyecto</th>
                  <th className="whitespace-nowrap px-5 py-2.5">Falta completar</th>
                  <th className="whitespace-nowrap px-5 py-2.5 text-right sm:pr-6">Acción</th>
                </tr>
              </thead>
              <tbody>
                {proyectos.map((proyecto) => (
                  <tr key={proyecto.id} className="border-t border-gray-50 text-sm transition-colors hover:bg-gray-50/60">
                    <td className="px-5 py-3.5 sm:px-6">
                      <p className="font-semibold text-gray-900">
                        {proyecto.autores.map((autor) => autor.nombre).join(', ') || 'Sin autor'}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        #{proyecto.codigo} · {proyecto.servicio.nombre}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{resumenFaltantes(proyecto.faltantesComercial)}</td>
                    <td className="px-5 py-3.5 text-right sm:pr-6">
                      <Link
                        to={`/proyectos/${proyecto.id}/ficha-trazabilidad`}
                        className="inline-flex items-center gap-1 rounded-lg border border-dorado/40 bg-dorado/5 px-3 py-1.5 text-xs font-semibold text-dorado transition-colors hover:bg-dorado/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado/40"
                      >
                        Continuar ficha
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
