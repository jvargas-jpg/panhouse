import { Link } from 'react-router-dom';

// Logo/footer/nav del sidebar de comercial — extraído de
// ComercialDashboardPage.tsx (donde nació) para que cualquier pantalla
// nueva de comercial (empieza con CommercialAuthorsView.tsx) reutilice
// exactamente la misma identidad en vez de copiar el JSX: "Inicio" y
// "Autores" deben sentirse la misma aplicación, no dos pantallas
// parecidas mantenidas a mano por separado.




const ICONO_INICIO = 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10';
const ICONO_AUTORES = 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z';
const ICONO_PROYECTOS = 'M9 3h6l2 3h3a1 1 0 011 1v11a2 2 0 01-2 2H5a2 2 0 01-2-2V7a1 1 0 011-1h3l2-3z';
const ICONO_PAGO = 'M3 10h18M7 15h2m4 0h4M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z';
const ICONO_INDICADORES = 'M4 19V10m6 9V5m6 14v-6';

const ITEM_ACTIVO =
  'flex w-full items-center gap-3 rounded-lg border border-dorado/20 bg-dorado/10 px-3.5 py-2.5 text-left text-sm font-semibold text-dorado transition-all';
const ITEM_INACTIVO =
  'flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-white';

function IconoNav({ path }: { path: string }) {
  return (
    <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={path} />
    </svg>
  );
}

export type ItemNavComercial = 'inicio' | 'autores' | 'proyectos' | 'pagos' | 'indicadores';

// Navegación compartida del módulo Comercial, incluido el estado activo de Pagos.
export function ComercialSidebarNav({ activo }: { activo: ItemNavComercial }) {
  return (
    <>
      <Link to="/" className={activo === 'inicio' ? ITEM_ACTIVO : ITEM_INACTIVO}>
        <IconoNav path={ICONO_INICIO} />
        Inicio
      </Link>
      <Link to="/autores" className={activo === 'autores' ? ITEM_ACTIVO : ITEM_INACTIVO}>
        <IconoNav path={ICONO_AUTORES} />
        Autores
      </Link>
      <Link to="/proyectos" className={activo === 'proyectos' ? ITEM_ACTIVO : ITEM_INACTIVO}>
        <IconoNav path={ICONO_PROYECTOS} />
        Proyectos
      </Link>

      <div className="my-3 border-t border-gray-800" />

      <Link
        to="/comercial/pagos"
        aria-current={activo === 'pagos' ? 'page' : undefined}
        className={activo === 'pagos' ? ITEM_ACTIVO : ITEM_INACTIVO}
      >
        <IconoNav path={ICONO_PAGO} />
        Pagos
      </Link>
      <Link to="/comercial/metricas" aria-current={activo === 'indicadores' ? 'page' : undefined} className={activo === 'indicadores' ? ITEM_ACTIVO : ITEM_INACTIVO}>
        <IconoNav path={ICONO_INDICADORES} />
        Indicadores
      </Link>
    </>
  );
}
