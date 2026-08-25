import { Link } from 'react-router-dom';
import type { ProyectoConRiesgo } from '../types/api';
import { EstadoBadge } from './EstadoBadge';
import { RiesgoBadge } from './RiesgoBadge';

// Usado por "Mis proyectos" (especialista) y por "Proyectos en riesgo"
// del panel de jefatura — misma tarjeta, mismos datos (ProyectoConRiesgo),
// no hay razón para dos versiones del mismo diseño. Toda la tarjeta es
// un enlace a /proyectos/:id.
export function ProyectoCard({ proyecto }: { proyecto: ProyectoConRiesgo }) {
  return (
    <li className="rounded-lg border border-tinta/10 bg-white shadow-sm transition hover:border-dorado hover:shadow">
      <Link to={`/proyectos/${proyecto.id}`} className="block p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-dorado">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-tinta">{proyecto.autor.nombre}</p>
            <p className="text-sm text-tinta/70">
              {proyecto.servicio.nombre} ({proyecto.servicio.codigo})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <EstadoBadge estado={proyecto.estado} />
            <RiesgoBadge riesgo={proyecto.riesgo} />
          </div>
        </div>
      </Link>
    </li>
  );
}
