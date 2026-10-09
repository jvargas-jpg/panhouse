import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../autores/Modal';
import { aprobarConceptoRrpp } from '../proyectos/direccionCreativaApi';
import type { ConceptosRrpp } from './rrppDashboardApi';

export function ReviewConceptsModal({
  grupo,
  onClose,
  onGuardado,
}: {
  grupo: ConceptosRrpp;
  onClose: () => void;
  onGuardado: (mensaje: string) => void;
}) {
  const queryClient = useQueryClient();
  const [devolviendo, setDevolviendo] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const decision = useMutation({
    mutationFn: ({ id, aprobar }: { id: string; aprobar: boolean }) =>
      aprobarConceptoRrpp(id, {
        aprobar,
        observaciones: aprobar ? null : observaciones.trim() || null,
      }),
    onSuccess: async (_, variables) => {
      await Promise.all(
        [
          ['rrpp'],
          ['direccion-creativa'],
          ['ficha', grupo.proyecto.id],
          ['notificaciones'],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
      onGuardado(
        variables.aprobar
          ? 'Concepto aprobado.'
          : 'Concepto devuelto al Líder Creativo.',
      );
    },
  });
  return (
    <Modal
      titulo="Revisar conceptos de portada"
      subtitulo={`${grupo.proyecto.nombre} — #${grupo.proyecto.codigo}`}
      ancho="proyecto"
      onClose={() => {
        if (!decision.isPending) onClose();
      }}
    >
      <div className="min-h-0 space-y-4 overflow-y-auto p-6">
        <p className="text-sm text-slate-500">
          Revisa las propuestas recibidas del Líder Creativo antes de su envío
          al autor.
        </p>
        {grupo.propuestas.map((p, i) => (
          <section key={p.id} className="rounded-xl border border-gray-200 p-4">
            <h4 className="text-sm font-semibold text-gray-900">
              Propuesta {i + 1}
            </h4>
            {p.descripcion && (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">
                {p.descripcion}
              </p>
            )}
            {p.enlace && (
              <a
                href={p.enlace}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-blue-600 underline"
              >
                Ver propuesta
              </a>
            )}
            {devolviendo === p.id ? (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-medium text-slate-600">
                  Observaciones para el Líder Creativo
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    disabled={decision.isPending}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-gray-200 p-3 text-sm"
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={decision.isPending || !observaciones.trim()}
                    onClick={() =>
                      decision.mutate({ id: p.id, aprobar: false })
                    }
                    className="rounded-lg bg-dorado px-4 py-2 text-xs font-semibold text-gray-900 disabled:opacity-50"
                  >
                    {decision.isPending ? 'Guardando…' : 'Confirmar devolución'}
                  </button>
                  <button
                    type="button"
                    disabled={decision.isPending}
                    onClick={() => setDevolviendo(null)}
                    className="text-xs text-slate-500"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={decision.isPending}
                  onClick={() => decision.mutate({ id: p.id, aprobar: true })}
                  className="rounded-lg bg-dorado px-4 py-2 text-xs font-semibold text-gray-900 disabled:opacity-50"
                >
                  {decision.isPending ? 'Guardando…' : 'Aprobar concepto'}
                </button>
                <button
                  type="button"
                  disabled={decision.isPending}
                  onClick={() => {
                    setDevolviendo(p.id);
                    setObservaciones('');
                    decision.reset();
                  }}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50"
                >
                  Devolver con observaciones
                </button>
              </div>
            )}
          </section>
        ))}
        {decision.isError && (
          <p role="alert" className="text-sm text-red-600">
            {decision.error instanceof Error
              ? decision.error.message
              : 'No se pudo registrar la decisión. Intenta de nuevo.'}
          </p>
        )}
      </div>
      <div className="shrink-0 border-t border-gray-100 px-6 py-4 text-right">
        <button
          type="button"
          disabled={decision.isPending}
          onClick={onClose}
          className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
