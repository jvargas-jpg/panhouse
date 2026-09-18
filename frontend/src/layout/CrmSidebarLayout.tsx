import type { ReactNode } from 'react';

// AppLayout.tsx envuelve toda la app en <TopBar/> + <main className="mx-auto
// max-w-4xl flex-1 overflow-y-auto px-4 py-6 sm:px-6">. Sin el breakout
// horizontal (ml/mr negativos + w-screen) el flex del sidebar quedaría
// atrapado en esa columna angosta de 896px. -my-6 cancela la posición
// del padding vertical de ese <main> (py-6 = 24px arriba y abajo)
// empujando el elemento hacia arriba — pero SOLO la posición, no el
// alto: el alto real (ver ALTO_LLENO_MAIN más abajo) necesita su propio
// ajuste aparte.
const FULL_BLEED = 'ml-[calc(-50vw+50%)] mr-[calc(-50vw+50%)] w-screen -my-6';

// h-full por sí solo deja una franja de 48px de bg-crema sin cubrir en
// el fondo (bug real, confirmado midiendo con Playwright): h-full
// resuelve contra la CAJA DE CONTENIDO de <main> (ya descontado su
// propio padding, py-6 = 24px arriba + 24px abajo = 48px), pero -my-6
// de arriba solo corrige la POSICIÓN (empuja hacia arriba 24px) — un
// margin-bottom negativo no puede "devolver" esos mismos 24px como
// ALTO del elemento, solo afecta a hermanos que vengan después (acá no
// hay ninguno). +3rem (48px) es exactamente ese padding total de
// <main> — si su py-6 cambia alguna vez, este valor cambia con él.
const ALTO_LLENO_MAIN = 'h-[calc(100%+3rem)]';

export const NAV_ACTIVO =
  'w-full flex items-center gap-3 px-4 py-3 bg-dorado/10 text-dorado rounded-xl font-semibold text-sm border border-dorado/20 transition-all text-left';
export const NAV_INACTIVO =
  'w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl font-medium text-sm transition-all text-left';

// Barra de navegación principal oscura y global (logo PanHouse + menú),
// extraída de AutoresPage.tsx (donde nació, exclusiva de comercial/
// dirección) para que cualquier rol con una pantalla "estilo CRM" la
// comparta — hoy además rrpp (RrppHomePage.tsx). Mismo patrón sidebar
// fijo + panel de contenido que ya documentaba AppLayout.tsx para
// MisProyectosPage/AuditoriaPagosPage/PanelJefaturaPage, pero esas tres
// no se tocaron: siguen con su propia copia hasta que alguien las migre
// a este componente compartido, no es parte de este cambio.
//
// nav: contenido de <nav> (los botones de navegación, con estilo
// NAV_ACTIVO/NAV_INACTIVO de arriba) — cada página decide sus propios
// enlaces. children: panel de contenido a la derecha, con scroll propio
// y el mismo ancho máximo (max-w-5xl) que ya usaba AutoresPage.tsx.
// overlays (opcional): modales/toasts — siblings del panel de
// contenido, no adentro (para no quedar recortados por su overflow).
export function CrmSidebarLayout({ nav, children, overlays }: { nav: ReactNode; children: ReactNode; overlays?: ReactNode }) {
  return (
    <div className={`${FULL_BLEED} ${ALTO_LLENO_MAIN} flex overflow-hidden bg-[#F8F9FA]`}>
      <aside className="z-20 hidden h-full w-64 flex-shrink-0 flex-col border-r border-gray-800 bg-gray-900 shadow-xl md:flex">
        <div className="flex h-20 items-center border-b border-gray-800 px-6">
          <h1 className="text-xl font-light uppercase tracking-widest text-white">
            Pan<span className="font-bold text-dorado">House</span>
          </h1>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-8">{nav}</nav>
      </aside>

      {/* AppLayout.tsx ya envuelve el Outlet en un <main> — dos <main>
          anidados no son válidos (landmark duplicado), así que este
          contenedor de scroll independiente es un <div> con las mismas
          clases. Es la ÚNICA región que scrollea acá adentro: el <div>
          raíz de arriba llena exacto el <main> de AppLayout.tsx (ver
          ALTO_LLENO_MAIN, ya acotado a la pantalla) y es
          overflow-hidden, así que <main> nunca ve contenido de sobra y
          nunca muestra su propio scrollbar. */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto w-full max-w-5xl px-6 py-10">{children}</div>
      </div>

      {overlays}
    </div>
  );
}
