// No hay librería de toasts instalada en este proyecto (ver package.json
// del frontend) — este componente es el reemplazo mínimo, autocontenido
// y en el mismo estilo Clean SaaS del resto de la pantalla, en vez de
// sumar una dependencia nueva para una sola notificación. AutoresPage.tsx
// controla cuándo se muestra y su auto-cierre.
//
// variante opcional (default 'exito', sin tocar los llamados existentes):
// agregado para el toast de error de "Eliminar cliente" — un ✓ verde
// sobre un mensaje de error se leería contradictorio.
export function Toast({ mensaje, variante = 'exito' }: { mensaje: string; variante?: 'exito' | 'error' }) {
  const esError = variante === 'error';
  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-50 flex animate-fade-in items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 text-sm shadow-xl"
    >
      <span
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
          esError ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
        }`}
      >
        {esError ? '✕' : '✓'}
      </span>
      <p className="font-medium text-gray-900">{mensaje}</p>
    </div>
  );
}
