import { Link } from 'react-router-dom';

const ICONO_NUEVO = 'M12 4v16m8-8H4';
const ICONO_AUTORES = 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z';
const ICONO_PROYECTOS = 'M9 3h6l2 3h3a1 1 0 011 1v11a2 2 0 01-2 2H5a2 2 0 01-2-2V7a1 1 0 011-1h3l2-3z';
const ICONO_PAGO = 'M3 10h18M7 15h2m4 0h4M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z';

const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado/40';

// "Accesos rápidos" — cuatro atajos a flujos que ya existen, sin lógica
// nueva. Jerarquía de tres niveles, todos con el mismo lenguaje visual
// (icono + texto + hover + foco) para que no se sientan como cuatro
// componentes distintos:
// - "Nuevo proyecto": primario, relleno dorado.
// - "Ver autores"/"Ver proyectos": secundarios, fila neutra con icono.
// - "Registrar pago": terciario (el módulo actual es temporal, se va a
//   reemplazar por un acceso a la app de pagos externa), más chico y
//   con menos contraste que los dos de arriba, pero con suficiente
//   contraste para no leerse como deshabilitado.
export function QuickActions({ onNuevoProyecto }: { onNuevoProyecto: () => void }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-3 text-[15px] font-bold text-gray-900">Accesos rápidos</h2>

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={onNuevoProyecto}
          className={`flex w-full items-center gap-2 rounded-lg bg-dorado px-3.5 py-2.5 text-left text-sm font-semibold text-tinta shadow-sm transition-all hover:brightness-95 active:scale-[0.99] ${FOCO}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICONO_NUEVO} />
          </svg>
          Nuevo proyecto
        </button>

        <Link
          to="/autores"
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 ${FOCO}`}
        >
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={ICONO_AUTORES} />
          </svg>
          Ver autores
        </Link>

        <Link
          to="/proyectos"
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 ${FOCO}`}
        >
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={ICONO_PROYECTOS} />
          </svg>
          Ver proyectos
        </Link>

        <div className="my-1 border-t border-gray-100" />

        <Link
          to="/comercial/pagos"
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 ${FOCO}`}
        >
          <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={ICONO_PAGO} />
          </svg>
          Registrar pago
        </Link>
      </div>
    </div>
  );
}
