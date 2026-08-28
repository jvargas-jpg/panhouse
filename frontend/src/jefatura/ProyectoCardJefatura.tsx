import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RiesgoBadge } from '../proyectos/RiesgoBadge';
import type { ProyectoConRiesgo } from '../types/api';

// Mismo diseño de tarjeta Clean SaaS que ProyectosPendientesCrmList.tsx
// (autores/), reutilizado acá para Jefatura: avatar con inicial del
// autor, badge de servicio, "Ver ficha →" en hover. Se le agrega el
// RiesgoBadge (dato ya disponible en ProyectoConRiesgo) porque detectar
// riesgo es el trabajo central de jefatura — no estaba en la tarjeta de
// Comercial porque ese rol no maneja esa señal.
//
// `accion` es un slot opcional para el botón "Asignar" de la bandeja de
// "Nuevos Proyectos por Asignar" — con stopPropagation/preventDefault
// para no disparar la navegación de la tarjeta completa (mismo patrón
// que los íconos de lápiz/engranaje en las tarjetas de Comercial).
export function ProyectoCardJefatura({ proyecto, accion }: { proyecto: ProyectoConRiesgo; accion?: ReactNode }) {
  return (
    <Link
      to={`/proyectos/${proyecto.id}`}
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-dorado/50 hover:shadow-md"
    >
      <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-gray-100 to-gray-200 transition-colors group-hover:from-dorado group-hover:to-yellow-500" />

      <div className="mb-4 mt-2 flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-lg font-bold text-gray-700 shadow-inner">
            {proyecto.autor.nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="line-clamp-2 text-base font-bold leading-tight text-gray-900 transition-colors group-hover:text-dorado">
              {proyecto.autor.nombre}
            </h3>
            <div className="mt-1.5">
              <RiesgoBadge riesgo={proyecto.riesgo} />
            </div>
          </div>
        </div>

        {accion}
      </div>

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
  );
}
