import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { LibroAutor } from '../types/api';
import { actualizarManuscrito } from './portalAutorApi';

// Aparte de LibroDetalleAutorPage.tsx para poder inicializar el
// useState directo desde libro.manuscritoUrl (mismo criterio que
// SeccionEdicion.tsx: el padre solo la renderiza una vez que el libro ya
// cargó, así que acá siempre hay un valor real, sin useEffect).
export function CajaEntregaManuscrito({ libro }: { libro: LibroAutor }) {
  const [manuscritoUrl, setManuscritoUrl] = useState(libro.manuscritoUrl ?? '');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () => actualizarManuscrito(libro.id, manuscritoUrl.trim() || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mis-libros'] });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
        <h2 className="font-bold text-tinta">Entrega de manuscrito</h2>
        <p className="mt-1 text-sm text-gray-500">Pega el enlace a tu manuscrito original (Google Docs, OneDrive, etc.).</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="manuscrito-url" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
            Enlace al manuscrito
          </label>
          <input
            id="manuscrito-url"
            type="text"
            placeholder="https://docs.google.com/document/d/..."
            value={manuscritoUrl}
            onChange={(event) => {
              setManuscritoUrl(event.target.value);
              mutacion.reset();
            }}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-all focus:ring-2 focus:ring-dorado/30"
          />
        </div>

        <button
          type="submit"
          disabled={mutacion.isPending}
          className="rounded-lg bg-tinta px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-gray-800 disabled:opacity-60"
        >
          {mutacion.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </form>

      {mutacion.isSuccess && <p className="px-6 pb-4 text-sm text-green-600">Guardado ✓</p>}
      {mutacion.isError && (
        <p role="alert" className="px-6 pb-4 text-sm text-red-600">
          No se pudo guardar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
        </p>
      )}
    </div>
  );
}
