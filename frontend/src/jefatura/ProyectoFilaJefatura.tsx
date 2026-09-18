import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RiesgoBadge } from '../proyectos/RiesgoBadge';
import type { ProyectoConRiesgo } from '../types/api';

// Reemplaza la cuadrícula de tarjetas cuadradas (ProyectoCardJefatura,
// eliminado) por una fila ancha y horizontal — a pedido explícito del
// negocio, mismo componente/estilo Clean SaaS que ya usa
// ProyectosPendientesCrmList.tsx (autores/) para el dashboard de
// Comercial: identificador principal a la izquierda (coautoría + código,
// nunca solo el primer autor — ver el comentario de ProyectoConRiesgo.autores
// en server/helpers/alertas.ts), badge de servicio al centro, acciones
// a la derecha.
//
// `accion` es un slot opcional para el botón "Asignar" de la bandeja de
// "Nuevos Proyectos por Asignar" — con stopPropagation/preventDefault
// para no disparar la navegación de la fila completa (mismo patrón que
// ProyectoCardJefatura.tsx, antes de este cambio).
export function ProyectoFilaJefatura({ proyecto, accion }: { proyecto: ProyectoConRiesgo; accion?: ReactNode }) {
  return (
    <Link
      to={`/proyectos/${proyecto.id}`}
      className="group flex flex-col items-start justify-between gap-3 rounded-lg border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md md:flex-row md:items-center md:gap-4"
    >
      {/* Izquierda: [Nombre Autor 1, Nombre Autor 2] — #Código —
          coautoría completa, todos los autores unidos por coma, por su
          nombre real/legal (mismo criterio que el resto de la app). */}
      <div className="min-w-0 md:w-1/3">
        <p className="truncate text-sm font-bold text-gray-900 transition-colors group-hover:text-dorado">
          {proyecto.autores.map((autor) => autor.nombre).join(', ') || 'Sin autor'} — #{proyecto.codigo}
        </p>
      </div>

      {/* Centro: servicio como badge gris claro. */}
      <div className="md:w-1/3">
        <span className="inline-block rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          {proyecto.servicio.codigo} — {proyecto.servicio.nombre}
        </span>
      </div>

      {/* Derecha: acción de asignar (si aplica), estado de riesgo
          ("En plazo"/"En riesgo"/"Vencido") y el enlace "Ver ficha". */}
      <div className="flex flex-shrink-0 items-center gap-3 self-end md:w-1/3 md:justify-end md:self-auto">
        {accion}
        <RiesgoBadge riesgo={proyecto.riesgo} />
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
