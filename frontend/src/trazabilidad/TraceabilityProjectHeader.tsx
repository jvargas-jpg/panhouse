import { Link } from 'react-router-dom';
import type { ProyectoDetalleConAutores } from '../types/api';
import { ESTADO_CLASE, ESTADO_LABEL } from '../proyectos/estado';

export function TraceabilityProjectHeader({ proyecto }: { proyecto: ProyectoDetalleConAutores }) {
  const nombre = proyecto.titulo?.trim() || proyecto.autores.map((autor) => autor.nombre).join(', ') || 'Sin autor asignado';
  return <header className="mb-4 shrink-0">
    <Link to="/proyectos" className="inline-flex min-h-8 items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado">← Volver a Proyectos</Link>
    <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Ficha de trazabilidad</p>
        <h1 className="mt-1 break-words text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">{nombre}</h1>
        <p className="mt-1 text-xs leading-5 text-gray-500">{proyecto.servicio.codigo} — {proyecto.servicio.nombre}<span className="mx-2 text-gray-300">·</span><span className="font-mono text-gray-700">#{proyecto.codigo}</span></p>
      </div>
      <span className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium ${ESTADO_CLASE[proyecto.estado]}`}>{ESTADO_LABEL[proyecto.estado]}</span>
    </div>
  </header>;
}
