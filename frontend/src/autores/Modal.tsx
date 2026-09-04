import type { ReactNode } from 'react';

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
export function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 text-gray-400 transition-colors hover:text-gray-600"
        >
          ✕
        </button>
        <h3 className="shrink-0 border-b border-gray-100 px-6 pb-4 pt-6 text-lg font-semibold text-gray-900">{titulo}</h3>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
