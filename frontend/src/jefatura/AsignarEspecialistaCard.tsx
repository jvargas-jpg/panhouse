import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { asignarEspecialista, fetchCargaEquipo } from './jefaturaApi';

// Segundo paso del flujo, inmediatamente después de crear el proyecto:
// reutiliza la misma carga ponderada que ya ve el panel de jefatura
// (GET /especialistas/carga), no duplica esa lógica.
export function AsignarEspecialistaCard({
  proyectoId,
  autorNombre,
  onAsignado,
  onCancelar,
}: {
  proyectoId: string;
  autorNombre: string;
  onAsignado: () => void;
  onCancelar: () => void;
}) {
  const cargaQuery = useQuery({ queryKey: ['especialistas', 'carga'], queryFn: fetchCargaEquipo });
  const [especialistaId, setEspecialistaId] = useState('');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () => asignarEspecialista(proyectoId, especialistaId),
    onSuccess: () => {
      // La carga del especialista asignado cambió; "mis proyectos" del
      // especialista y el riesgo del equipo también dependen de esto.
      queryClient.invalidateQueries({ queryKey: ['especialistas', 'carga'] });
      queryClient.invalidateQueries({ queryKey: ['proyectos', 'riesgo'] });
      onAsignado();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  return (
    <div className="rounded-lg border border-dorado/40 bg-white p-4 shadow-sm">
      <h3 className="mb-2 font-medium text-tinta">Asignar especialista — {autorNombre}</h3>
      <p className="mb-3 text-sm text-tinta/70">Proyecto creado. Elige quién queda a cargo.</p>

      {cargaQuery.isLoading && <p className="text-sm text-tinta/70">Cargando equipo…</p>}
      {cargaQuery.isError && (
        <p role="alert" className="text-sm text-red-600">
          No se pudo cargar el equipo{cargaQuery.error instanceof Error ? `: ${cargaQuery.error.message}` : ''}.
        </p>
      )}

      {cargaQuery.data && cargaQuery.data.especialistas.length === 0 && (
        <p className="text-sm text-tinta/70">No hay especialistas registrados todavía.</p>
      )}

      {cargaQuery.data && cargaQuery.data.especialistas.length > 0 && (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="asignar-especialista" className="mb-1 block text-sm font-medium text-tinta">
              Especialista
            </label>
            <select
              id="asignar-especialista"
              required
              value={especialistaId}
              onChange={(event) => setEspecialistaId(event.target.value)}
              className="rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            >
              <option value="">Seleccionar…</option>
              {cargaQuery.data.especialistas.map((especialista) => (
                <option key={especialista.id} value={especialista.id}>
                  {especialista.nombre} (carga: {especialista.carga})
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={mutacion.isPending}
            className="rounded-md bg-dorado px-4 py-2 text-sm font-medium text-tinta transition hover:brightness-95 disabled:opacity-60"
          >
            {mutacion.isPending ? 'Asignando…' : 'Asignar'}
          </button>
          <button type="button" onClick={onCancelar} className="text-xs text-tinta/70 underline hover:text-tinta">
            Hacerlo después
          </button>
          {mutacion.isError && (
            <span role="alert" className="text-xs text-red-600">
              No se pudo asignar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
            </span>
          )}
        </form>
      )}
    </div>
  );
}
