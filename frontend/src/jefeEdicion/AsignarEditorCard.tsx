import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { asignarEditor, fetchCargaEditores } from './jefeEdicionApi';

// Mismo patrón exacto que AsignarEspecialistaCard (jefatura): reutiliza
// la carga ponderada de editores (GET /editores/carga), no duplica esa
// lógica. A diferencia de ese flujo, acá el proyecto ya existe — se
// abre por fila desde ProyectosSinEditor, no después de crear nada.
export function AsignarEditorCard({
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
  const cargaQuery = useQuery({ queryKey: ['editores', 'carga'], queryFn: fetchCargaEditores });
  const [editorId, setEditorId] = useState('');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () => asignarEditor(proyectoId, editorId),
    onSuccess: () => {
      // El proyecto ya no está "sin editor" — desaparece de esa lista.
      // La carga del editor asignado también cambió.
      queryClient.invalidateQueries({ queryKey: ['proyectos', 'sin-editor'] });
      queryClient.invalidateQueries({ queryKey: ['editores', 'carga'] });
      onAsignado();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  return (
    <div className="rounded-lg border border-dorado/40 bg-white p-4 shadow-sm">
      <h3 className="mb-2 font-medium text-tinta">Asignar editor — {autorNombre}</h3>

      {cargaQuery.isLoading && <p className="text-sm text-tinta/70">Cargando equipo…</p>}
      {cargaQuery.isError && (
        <p role="alert" className="text-sm text-red-600">
          No se pudo cargar el equipo{cargaQuery.error instanceof Error ? `: ${cargaQuery.error.message}` : ''}.
        </p>
      )}

      {cargaQuery.data && cargaQuery.data.editores.length === 0 && (
        <p className="text-sm text-tinta/70">No hay editores registrados todavía.</p>
      )}

      {cargaQuery.data && cargaQuery.data.editores.length > 0 && (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="asignar-editor" className="mb-1 block text-sm font-medium text-tinta">
              Editor
            </label>
            <select
              id="asignar-editor"
              required
              value={editorId}
              onChange={(event) => setEditorId(event.target.value)}
              className="rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            >
              <option value="">Seleccionar…</option>
              {cargaQuery.data.editores.map((editor) => (
                <option key={editor.id} value={editor.id}>
                  {editor.nombre} (carga: {editor.carga})
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
            Cancelar
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
