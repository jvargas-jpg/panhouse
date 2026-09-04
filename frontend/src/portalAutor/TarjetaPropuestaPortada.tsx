import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { LibroAutor } from '../types/api';
import { actualizarDecisionPortada } from './portalAutorApi';

const DECISION_LABEL: Record<'aprobada' | 'rechazada', string> = {
  aprobada: 'Aprobada',
  rechazada: 'Cambios solicitados',
};

const DECISION_CLASE: Record<'aprobada' | 'rechazada', string> = {
  aprobada: 'bg-green-100 text-green-700',
  rechazada: 'bg-red-100 text-red-700',
};

// Se monta siempre desde LibroDetalleAutorPage.tsx, pero no dibuja nada
// si todavía no hay propuesta (propuestaPortadaUrl null) — guardia acá
// adentro en vez de en el padre, para que "cuándo mostrarse" sea una
// sola decisión, autocontenida en este componente.
export function TarjetaPropuestaPortada({ libro }: { libro: LibroAutor }) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: (datos: { decision: 'aprobada' | 'rechazada'; feedback: string | null }) =>
      actualizarDecisionPortada(libro.id, datos.decision, datos.feedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mis-libros'] });
      setModalAbierto(false);
      setMotivo('');
    },
  });

  if (!libro.propuestaPortadaUrl) return null;

  function handleEnviarRechazo(event: FormEvent) {
    event.preventDefault();
    if (!motivo.trim()) return;
    mutacion.mutate({ decision: 'rechazada', feedback: motivo.trim() });
  }

  const decision = libro.portadaDecisionAutor;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
        <h2 className="font-bold text-tinta">Propuesta de Portada</h2>
      </div>

      <div className="flex flex-col gap-4 p-6">
        <a
          href={libro.propuestaPortadaUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-tinta transition hover:bg-gray-50"
        >
          Ver Propuesta ↗
        </a>

        {decision === 'pendiente' && (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => mutacion.mutate({ decision: 'aprobada', feedback: null })}
              disabled={mutacion.isPending}
              className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-green-700 disabled:opacity-60"
            >
              Aprobar
            </button>
            <button
              type="button"
              onClick={() => setModalAbierto(true)}
              disabled={mutacion.isPending}
              className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-700 disabled:opacity-60"
            >
              Solicitar Cambios
            </button>
          </div>
        )}

        {decision !== 'pendiente' && (
          <div>
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${DECISION_CLASE[decision]}`}>
              {DECISION_LABEL[decision]}
            </span>
            {libro.portadaFeedback && <p className="mt-2 text-sm text-gray-600">{libro.portadaFeedback}</p>}
          </div>
        )}

        {mutacion.isError && (
          <p role="alert" className="text-sm text-red-600">
            No se pudo enviar tu decisión{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
          </p>
        )}
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setModalAbierto(false)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 text-gray-400 transition-colors hover:text-gray-600"
            >
              ✕
            </button>
            <h3 className="mb-4 border-b border-gray-100 pb-4 text-lg font-semibold text-gray-900">Solicitar Cambios</h3>
            <form onSubmit={handleEnviarRechazo} className="flex flex-col gap-4">
              <div>
                <label htmlFor="portada-motivo" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  ¿Qué te gustaría cambiar?
                </label>
                <textarea
                  id="portada-motivo"
                  rows={4}
                  required
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-all focus:ring-2 focus:ring-dorado/30"
                />
              </div>
              <button
                type="submit"
                disabled={mutacion.isPending || !motivo.trim()}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-700 disabled:opacity-60"
              >
                {mutacion.isPending ? 'Enviando…' : 'Enviar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
