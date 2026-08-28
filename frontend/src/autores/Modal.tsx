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
export function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 text-gray-400 transition-colors hover:text-gray-600"
        >
          ✕
        </button>
        <h3 className="mb-6 border-b border-gray-100 pb-4 text-lg font-semibold text-gray-900">{titulo}</h3>
        {children}
      </div>
    </div>
  );
}
