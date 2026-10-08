import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { aprobarConceptoRrpp, fetchPropuestasPendientesRrpp } from '../proyectos/direccionCreativaApi';

function diasDesde(fechaIso: string): number {
  const ms = Date.now() - new Date(fechaIso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

// "PENDIENTE DE APROBACIÓN CREATIVA" (master prompt 5C §12/§27) —
// bandeja propia de RRPP, deliberadamente separada de "Proyectos"/
// "Matrices de Ingreso" (su contexto de intake inicial): flujo
// confirmado Líder Creativo -> conceptos -> RRPP -> Autor, nunca
// directo al Autor (GATE-05, reusado en el backend).
export function PendientesAprobacionCreativaPanel() {
  const query = useQuery({ queryKey: ['direccion-creativa', 'pendientes-rrpp'], queryFn: fetchPropuestasPendientesRrpp });
  const propuestas = query.data?.propuestas ?? [];
  const [enRevision, setEnRevision] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: ({ propuestaId, aprobar }: { propuestaId: string; aprobar: boolean }) =>
      aprobarConceptoRrpp(propuestaId, { aprobar, observaciones: observaciones || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direccion-creativa', 'pendientes-rrpp'] });
      setEnRevision(null);
      setObservaciones('');
    },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="mb-2 text-xl font-bold text-gray-900">Pendiente de Aprobación Creativa</h2>
      <p className="mb-6 text-sm text-gray-500">Conceptos de portada entregados por Dirección Creativa, esperando tu revisión antes de llegar al autor.</p>

      {query.isLoading && <p className="animate-pulse text-sm text-tinta/70">Cargando…</p>}
      {query.isError && (
        <p role="alert" className="text-sm text-red-600">
          No se pudo cargar{query.error instanceof Error ? `: ${query.error.message}` : ''}.
        </p>
      )}

      {query.data && propuestas.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">No hay conceptos esperando aprobación.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {propuestas.map((propuesta) => (
          <div key={propuesta.propuestaId} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900">{propuesta.autorNombre}</p>
                <p className="text-xs text-gray-500">#{propuesta.proyectoCodigo}</p>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                Esperando hace {diasDesde(propuesta.createdAt)}d
              </span>
            </div>

            {propuesta.descripcion && <p className="mt-2 text-sm text-gray-700">{propuesta.descripcion}</p>}
            {propuesta.enlace && (
              <a href={propuesta.enlace} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-dorado underline">
                Ver propuesta
              </a>
            )}

            {enRevision !== propuesta.propuestaId ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => mutacion.mutate({ propuestaId: propuesta.propuestaId, aprobar: true })}
                  disabled={mutacion.isPending}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                >
                  Aprobar
                </button>
                <button
                  type="button"
                  onClick={() => setEnRevision(propuesta.propuestaId)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Devolver con observaciones
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                <textarea
                  rows={2}
                  value={observaciones}
                  onChange={(event) => setObservaciones(event.target.value)}
                  placeholder="¿Qué debe ajustar el líder creativo?"
                  className="rounded-md border border-gray-200 px-2 py-1.5 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => mutacion.mutate({ propuestaId: propuesta.propuestaId, aprobar: false })}
                    disabled={mutacion.isPending}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    Confirmar devolución
                  </button>
                  <button type="button" onClick={() => setEnRevision(null)} className="text-xs text-gray-500 underline">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {mutacion.isError && (
              <p role="alert" className="mt-2 text-xs text-red-600">
                No se pudo registrar la decisión.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
