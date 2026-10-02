import { useEffect, useId, useRef, type ReactNode } from 'react';

// Overlay Clean SaaS compartido por los dos modales de esta pantalla
// (Autor y Proyecto) — mismo fondo difuminado + tarjeta + botón cerrar
// para ambos, para no duplicar esa estructura dos veces.
//
// `animate-in`/`fade-in` (plugin tailwindcss-animate) no está instalado
// en este proyecto; se usa animate-fade-in, la utilidad de fundido ya
// definida en tailwind.config.ts (mismo patrón que el stepper de
// ProyectoDetallePage.tsx), para lograr el mismo efecto sin sumar una
// dependencia nueva.
//
// flex-col + overflow-hidden + max-h-[90vh]: la "ventana" nunca puede
// ser más alta que la pantalla. Header (shrink-0) fijo arriba; el slot
// de más abajo es un simple flex-1 min-h-0 SIN su propio scroll ni
// padding — a propósito. Antes este componente decidía el scroll por
// todos los que lo usan (overflow-y-auto acá mismo), pero el botón
// "Crear Autor" vivía DENTRO de ese scroll con position: sticky, y en
// la práctica terminaba flotando a mitad del formulario en vez de
// quedar anclado abajo (comportamiento de sticky poco fiable dentro de
// un contenedor que además tiene padding y un footer largo). Ahora cada
// formulario decide su propia estructura interna dentro de este slot ya
// acotado en alto: CrearAutorForm.tsx arma su propio flex-col de tres
// pisos (cuerpo con scroll real + footer flex-none, fuera del área de
// scroll — sin sticky) para su caso (formulario largo);
// CrearProyectoModalForm.tsx (más corto, nunca necesitó scroll) sigue
// funcionando igual que siempre, sin cambios, porque un <form> normal
// dentro de un flex-col simplemente ocupa su alto de contenido.
// `ancho` es opcional (default 'md', el tamaño de siempre para los
// modales angostos de un solo campo) — los formularios largos de varias
// columnas (ej. RegistroSeguimientoForm.tsx) necesitan más aire que
// max-w-md, donde un grid de 2-3 columnas nunca llega a activarse.
// '4xl' (max-w-4xl, 896px): usado por el modal de Autor, que reparte su
// contenido en navegación lateral + panel (AuthorFormSectionNav.tsx) —
// necesita más aire que '3xl' para que esa composición de dos columnas
// no se sienta apretada.
const ANCHOS = { proyecto: 'max-w-[720px]', md: 'max-w-md', '3xl': 'max-w-3xl', '4xl': 'max-w-4xl' } as const;

export function Modal({
  titulo,
  subtitulo,
  onClose,
  children,
  ancho = 'md',
}: {
  titulo: string;
  subtitulo?: string;
  onClose: () => void;
  children: ReactNode;
  ancho?: keyof typeof ANCHOS;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();

  // Esc para cerrar + trampa de foco manual (Tab/Shift+Tab no se
  // escapan del modal) — sin sumar una librería de modal nueva, solo
  // DOM estándar. El panel recibe el foco inicial al montar (en vez de
  // adivinar cuál sería "el primer campo útil" entre los distintos
  // formularios que usan este componente).
  useEffect(() => {
    panelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const primero = focusables[0]!;
      const ultimo = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className={`relative flex max-h-[90vh] w-full ${ANCHOS[ancho]} flex-col overflow-hidden rounded-2xl bg-white shadow-xl outline-none`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 text-gray-400 transition-colors hover:text-gray-600"
        >
          ✕
        </button>
        <div className="shrink-0 border-b border-gray-100 px-6 pb-4 pt-6">
          <h3 id={tituloId} className="pr-6 text-lg font-semibold text-gray-900">
            {titulo}
          </h3>
          {subtitulo && <p className="mt-1 pr-6 text-sm text-gray-500">{subtitulo}</p>}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
