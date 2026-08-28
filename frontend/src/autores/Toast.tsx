// No hay librería de toasts instalada en este proyecto (ver package.json
// del frontend) — este componente es el reemplazo mínimo, autocontenido
// y en el mismo estilo Clean SaaS del resto de la pantalla, en vez de
// sumar una dependencia nueva para una sola notificación. AutoresPage.tsx
// controla cuándo se muestra y su auto-cierre.
export function Toast({ mensaje }: { mensaje: string }) {
  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-50 flex animate-fade-in items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 text-sm shadow-xl"
    >
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">✓</span>
      <p className="font-medium text-gray-900">{mensaje}</p>
    </div>
  );
}
